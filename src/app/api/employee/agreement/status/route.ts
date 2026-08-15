// ============================================================
// GET /api/employee/agreement/status
//   Retorna el estado de aceptación del acuerdo de registro
//   electrónico del empleado autenticado.
//
// RT-P0.5 — Flujo de onboarding ElectronicRecordAgreement
//   (art. 132 fracción XXXIV LFT)
//
// Versión ligera del GET /api/employee/agreement: NO regresa el
// texto íntegro del acuerdo (que puede ser de varios KB). Sirve
// para que el layout / middleware compruebe rápidamente si el
// empleado necesita aceptar el acuerdo antes de mostrar el banner.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { ELECTRONIC_RECORD_AGREEMENT_VERSION } from '@/lib/electronic-record-agreement-text';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    // Si el usuario no es empleado (admin/supervisor), no aplica
    // el acuerdo → needsAcceptance=false (no muestra banner).
    if (!user.employeeId) {
      return NextResponse.json({
        hasActiveAgreement: false,
        needsAcceptance: false,
        reason: 'USER_IS_NOT_EMPLOYEE',
      });
    }

    const existingAgreement = await db.electronicRecordAgreement.findUnique({
      where: { employeeId: user.employeeId },
      select: {
        isActive: true,
        agreementVersion: true,
        agreedAt: true,
      },
    });

    const hasActiveAgreement =
      !!existingAgreement &&
      existingAgreement.isActive &&
      existingAgreement.agreementVersion === ELECTRONIC_RECORD_AGREEMENT_VERSION;

    return NextResponse.json({
      hasActiveAgreement,
      needsAcceptance: !hasActiveAgreement,
      currentVersion: ELECTRONIC_RECORD_AGREEMENT_VERSION,
      agreedAt: existingAgreement?.agreedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('GET /api/employee/agreement/status error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
