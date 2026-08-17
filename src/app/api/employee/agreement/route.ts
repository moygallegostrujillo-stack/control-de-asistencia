// ============================================================
// /api/employee/agreement
//   GET  — Estado actual del acuerdo + texto vigente (si necesita aceptación).
//   POST — Aceptación del acuerdo por parte del empleado autenticado.
//
// RT-P0.5 — Flujo de onboarding ElectronicRecordAgreement
//   (art. 132 fracción XXXIV LFT, reformado DOF 27-dic-2024)
//
// El art. 132 XXXIV LFT establece que el registro electrónico de
// jornada "hará prueba plena si se acredita que fue acordado entre
// la persona trabajadora y empleadora". Este endpoint materializa
// el acuerdo: el empleado lee el texto, manifiesta su conformidad,
// y el sistema registra la fecha, IP, User-Agent y hash del
// documento como evidencia probatoria.
//
// El middleware de check-in (route.ts de /api/attendance/check-in)
// valida que exista un ElectronicRecordAgreement con isActive=true
// y agreementVersion vigente antes de permitir el registro de
// asistencia.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import {
  ELECTRONIC_RECORD_AGREEMENT_VERSION,
  getAgreementText,
  computeAgreementHash,
} from '@/lib/electronic-record-agreement-text';

const COMPANY_ID = 'singleton';

// ============================================================
// GET /api/employee/agreement
// Devuelve el estado actual del acuerdo del empleado autenticado:
//   - hasActiveAgreement: true si tiene un acuerdo isActive=true con
//     la versión vigente.
//   - agreement: datos del acuerdo vigente (o null si no tiene).
//   - currentVersion: versión vigente del acuerdo ("1.0").
//   - needsAcceptance: true si debe aceptar (no tiene acuerdo o
//     tiene una versión distinta).
//   - agreementText: el texto íntegro del acuerdo, SÓLO si
//     needsAcceptance=true (para no regresar texto innecesario
//     cuando ya tiene uno aceptado).
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    // Necesitamos el employeeId del usuario autenticado.
    // getAuthUser() ya lo resuelve a través de user.employee.id.
    if (!user.employeeId) {
      // Si no es empleado, no aplica el acuerdo (admins no hacen check-in).
      // Devolvemos needsAcceptance=false para que el layout no muestre banner.
      return NextResponse.json({
        hasActiveAgreement: false,
        agreement: null,
        currentVersion: ELECTRONIC_RECORD_AGREEMENT_VERSION,
        needsAcceptance: false,
        agreementText: null,
        reason: 'USER_IS_NOT_EMPLOYEE',
      });
    }

    // Cargar el acuerdo activo del empleado (relación 1:1).
    const existingAgreement = await db.electronicRecordAgreement.findUnique({
      where: { employeeId: user.employeeId },
    });

    const hasActiveAgreement =
      !!existingAgreement &&
      existingAgreement.isActive &&
      existingAgreement.agreementVersion === ELECTRONIC_RECORD_AGREEMENT_VERSION;

    const needsAcceptance = !hasActiveAgreement;

    // Si necesita aceptación, cargar el texto con los placeholders llenos
    // (necesita los datos de la empresa).
    let agreementText: string | null = null;
    if (needsAcceptance) {
      const company = await db.company.findUnique({
        where: { id: COMPANY_ID },
        select: { razonSocial: true, rfc: true, domicilioFiscal: true },
      });
      // Si la empresa no existe aún, usamos placeholders genéricos.
      agreementText = getAgreementText({
        razonSocial: company?.razonSocial || 'No especificado',
        rfc: company?.rfc || 'No especificado',
        domicilioFiscal: company?.domicilioFiscal ?? null,
      });
    }

    return NextResponse.json({
      hasActiveAgreement,
      agreement: hasActiveAgreement
        ? {
            agreedAt: existingAgreement!.agreedAt.toISOString(),
            agreementVersion: existingAgreement!.agreementVersion,
            documentHash: existingAgreement!.documentHash,
          }
        : null,
      currentVersion: ELECTRONIC_RECORD_AGREEMENT_VERSION,
      needsAcceptance,
      agreementText,
    });
  } catch (error) {
    console.error('GET /api/employee/agreement error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/employee/agreement
// Body: { agreementHash: string } — hash SHA-256 del texto que el
//   empleado vio y aceptó (calculado en el frontend al renderizar).
//
// Valida que el hash recibido corresponda al texto vigente del
// acuerdo (con los datos actuales de la empresa). Esto evita que
// el empleado acepte una versión anterior o un texto manipulado.
//
// Si ya existe un acuerdo activo con la MISMA versión → 200 "already accepted".
// Si existe un acuerdo activo con una versión DISTINTA → se revoca
//   (isActive=false, revokedAt=now, revokedReason) y se crea el nuevo.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    // Solo los empleados necesitan aceptar el acuerdo. Si un admin
    // intenta llamar este endpoint (no debería), lo rechazamos.
    if (!user.employeeId) {
      return forbiddenResponse();
    }

    const body = await req.json().catch(() => ({}));
    const { agreementHash } = body as { agreementHash?: string };

    if (!agreementHash || typeof agreementHash !== 'string') {
      return NextResponse.json(
        { error: 'El campo agreementHash es requerido' },
        { status: 400 }
      );
    }

    // Cargar los datos de la empresa para reconstruir el texto vigente.
    const company = await db.company.findUnique({
      where: { id: COMPANY_ID },
      select: { razonSocial: true, rfc: true, domicilioFiscal: true },
    });

    const currentText = getAgreementText({
      razonSocial: company?.razonSocial || 'No especificado',
      rfc: company?.rfc || 'No especificado',
      domicilioFiscal: company?.domicilioFiscal ?? null,
    });
    const expectedHash = computeAgreementHash(currentText);

    // Validar que el hash recibido corresponde al texto vigente.
    // Esto es CRÍTICO para la prueba plena: garantiza que el texto
    // que el empleado aceptó es exactamente el que la empresa tiene
    // registrado como vigente.
    if (agreementHash !== expectedHash) {
      return NextResponse.json(
        {
          error: 'HASH_MISMATCH',
          message:
            'El hash del acuerdo no coincide con el texto vigente. Recarga la página e inténtalo nuevamente.',
          expectedHash,
        },
        { status: 409 }
      );
    }

    // Verificar si ya existe un acuerdo activo para este empleado.
    const existingAgreement = await db.electronicRecordAgreement.findUnique({
      where: { employeeId: user.employeeId },
    });

    // Caso 1: ya existe un acuerdo activo con la MISMA versión → 200.
    if (
      existingAgreement &&
      existingAgreement.isActive &&
      existingAgreement.agreementVersion === ELECTRONIC_RECORD_AGREEMENT_VERSION
    ) {
      return NextResponse.json({
        ok: true,
        alreadyAccepted: true,
        agreement: {
          agreedAt: existingAgreement.agreedAt.toISOString(),
          agreementVersion: existingAgreement.agreementVersion,
          documentHash: existingAgreement.documentHash,
        },
        message: 'El acuerdo ya había sido aceptado previamente.',
      });
    }

    const { ip, ua } = getIpAndUA(req);
    const now = new Date();

    // Caso 2: existe un acuerdo activo con versión DISTINTA → revocarlo.
    // (Si está inactivo, ya está revocado; no tocamos.)
    let revokedPrevious = false;
    if (
      existingAgreement &&
      existingAgreement.isActive &&
      existingAgreement.agreementVersion !== ELECTRONIC_RECORD_AGREEMENT_VERSION
    ) {
      await db.electronicRecordAgreement.update({
        where: { id: existingAgreement.id },
        data: {
          isActive: false,
          revokedAt: now,
          revokedReason: `Reemplazado por versión ${ELECTRONIC_RECORD_AGREEMENT_VERSION}`,
        },
      });
      revokedPrevious = true;
    }

    // Caso 3: existe pero está inactivo (revocado previamente) o
    // no existe → creamos uno nuevo. En el caso inactivo, Prisma
    // nos impide crear uno nuevo con el mismo employeeId (relación
    // 1:1 con @unique), así que hacemos upsert.
    const agreement = await db.electronicRecordAgreement.upsert({
      where: { employeeId: user.employeeId },
      create: {
        employeeId: user.employeeId,
        agreedAt: now,
        agreedIp: ip,
        agreedUserAgent: ua,
        agreementVersion: ELECTRONIC_RECORD_AGREEMENT_VERSION,
        documentHash: expectedHash,
        isActive: true,
      },
      update: {
        agreedAt: now,
        agreedIp: ip,
        agreedUserAgent: ua,
        agreementVersion: ELECTRONIC_RECORD_AGREEMENT_VERSION,
        documentHash: expectedHash,
        isActive: true,
        revokedAt: null,
        revokedReason: null,
      },
    });

    // Audit log — registro probatorio del consentimiento.
    await auditLog({
      userId: user.id,
      action: 'ACCEPT_ELECTRONIC_RECORD_AGREEMENT',
      entityType: 'ELECTRONIC_RECORD_AGREEMENT',
      entityId: agreement.id,
      sucursalId: user.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId: user.employeeId,
        agreementVersion: ELECTRONIC_RECORD_AGREEMENT_VERSION,
        documentHash: expectedHash,
        agreedAt: now.toISOString(),
        revokedPrevious,
        previousVersion: revokedPrevious ? existingAgreement!.agreementVersion : null,
        legalReference:
          'LFT art. 132 fracción XXXIV (reformado DOF 27-dic-2024) — prueba plena si fue acordado',
      },
    });

    return NextResponse.json({
      ok: true,
      alreadyAccepted: false,
      agreement: {
        agreedAt: agreement.agreedAt.toISOString(),
        agreementVersion: agreement.agreementVersion,
        documentHash: agreement.documentHash,
      },
      message: 'Acuerdo aceptado correctamente.',
    });
  } catch (error) {
    console.error('POST /api/employee/agreement error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
