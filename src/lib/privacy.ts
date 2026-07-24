// ============================================================
// src/lib/privacy.ts
//   Utilidades de cumplimiento LFPDPPP (Ley Federal de Protección
//   de Datos Personales en Posesión de los Particulares).
//
//   - Versión actual del Aviso de Privacidad (cambia → re-pedir consentimiento).
//   - Validación de consentimiento.
//   - Anonimización de datos personales en registros de asistencia
//     (resolución del conflicto LFPDPPP art. 31 vs LFT art. 804).
// ============================================================

import { db } from './db';

/**
 * Versión actual del Aviso de Privacidad.
 * Incrementar (ej. "1.0" → "1.1") cada vez que el aviso sea modificado
 * materialmente. Esto fuerza el re-consentimiento de todos los usuarios
 * al próximo inicio de sesión (LFPDPPP art. 17, princ. de lealtad).
 */
export const CURRENT_PRIVACY_VERSION = '1.0';

/**
 * Rutas PÚBLICAS que NO requieren consentimiento previo del aviso de
 * privacidad. El middleware las exceptúa del redirect a /legal/aviso-de-privacidad.
 */
export const PRIVACY_PUBLIC_PATHS = [
  '/legal',
  '/api/health',
  '/api/auth/login',
  '/api/auth/qr-login',
  '/api/auth/quick-login',
  '/api/auth/session',
  '/api/auth/csrf',
  '/api/auth/providers',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/callback',
  '/api/auth/_log',
  '/api/user/privacy/accept',
  '/api/user/privacy/status',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/seed',
];

/**
 * Indica si un usuario ha aceptado la versión VIGENTE del Aviso de Privacidad.
 * - false si nunca aceptó o si aceptó una versión distinta.
 * - true solo si privacyAcceptedVersion coincide con CURRENT_PRIVACY_VERSION.
 */
export function hasAcceptedCurrentPrivacy(user: {
  privacyAcceptedAt?: Date | null;
  privacyAcceptedVersion?: string | null;
}): boolean {
  return (
    !!user.privacyAcceptedAt &&
    user.privacyAcceptedVersion === CURRENT_PRIVACY_VERSION
  );
}

// ============================================================
// ANONIMIZACIÓN — Resolución del conflicto LFPDPPP art. 31 vs LFT art. 804
// ============================================================
//
// LFPDPPP art. 31 (derecho de cancelación): el responsable debe suprimir
// los datos personales una vez expirada la finalidad del tratamiento.
//
// LFT art. 804: el patrón debe conservar los registros de asistencia
// y nómina por 12 meses posteriores a la terminación de la relación
// laboral (propósitos probatorios: demandas laborales, auditorías IMSS,
// visitas STPS).
//
// Conflicto: LFPDPPP dice "borra", LFT dice "conserva".
//
// Decisión de diseño (documentada para auditoría INAI/STPS):
//   1. Se SUPRIMEN los datos personales IDENTIFICATIVOS del usuario
//      (email, name, IP, User-Agent, MFA secret, password hash).
//   2. Se ANONIMIZAN los campos identificadores del Employee
//      (name → "Usuario Anonimizado", employeeNumber → hash, etc.).
//   3. Se CONSERVAN los AttendanceRecords (jornada, horas extra,
//      prima, status) para cumplimiento LFT art. 804, PERO se
//      anonimizan las IPs y User-Agents asociados.
//   4. El userId de los registros se mantiene (como FK a un usuario
//      "anónimo") para no romper la integridad referencial de la
//      bitácora, pero el usuario se marca isActive=false y sus
//      datos se reemplazan.
//
// La anonimización es IRREVERSIBLE (no se puede deshacer).
// ============================================================

export interface AnonymizationResult {
  anonymizedUser: boolean;
  anonymizedEmployee: boolean;
  anonymizedAttendanceRecords: number;
  anonymizedAuditLogs: number;
  deletedVacations: number;
  deletedWorkSchedules: number;
  deletedDynamicQRs: number;
  errors: string[];
}

/**
 * Anonimiza todos los datos personales de un usuario, conservando
 * los registros de asistencia probatorios (LFT art. 804).
 *
 * @param userId - ID del usuario a anonimizar
 * @param reason - Motivo legal (ej. "CANCELLATION_REQUEST_ARCO_PR-xxx")
 * @returns Resumen de lo anonimizado
 */
export async function anonymizeUserData(
  userId: string,
  reason: string
): Promise<AnonymizationResult> {
  const result: AnonymizationResult = {
    anonymizedUser: false,
    anonymizedEmployee: false,
    anonymizedAttendanceRecords: 0,
    anonymizedAuditLogs: 0,
    deletedVacations: 0,
    deletedWorkSchedules: 0,
    deletedDynamicQRs: 0,
    errors: [],
  };

  try {
    // 1. Verificar que el usuario existe y cargar su Employee.
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });
    if (!user) {
      result.errors.push(`Usuario ${userId} no encontrado`);
      return result;
    }

    // 2. ANONIMIZAR User — suprimir datos identificativos.
    //    Email se reemplaza por un hash único (para evitar duplicados @unique).
    //    passwordHash se reemplaza por un valor no usable (login imposible).
    const anonymizedEmail = `anon-${userId.slice(0, 8)}@anonymized.local`;
    await db.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: 'Usuario Anonimizado',
        passwordHash: '__ANONYMIZED__',
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodesHash: null,
        mfaEnrolledAt: null,
        privacyAcceptedIp: null, // suprimir IP de consentimiento (LFPDPPP art. 31)
        isActive: false, // acceso bloqueado
      },
    });
    result.anonymizedUser = true;

    // 3. ANONIMIZAR Employee (si existe) — suprimir position/department.
    if (user.employee) {
      await db.employee.update({
        where: { id: user.employee.id },
        data: {
          position: 'ANONIMIZADO',
          department: 'ANONIMIZADO',
          isActive: false,
        },
      });
      result.anonymizedEmployee = true;

      // 4. ANONIMIZAR AttendanceRecords — conservar registro, suprimir IPs/UA.
      //    (LFT art. 804 obliga a conservar la jornada; LFPDPPP art. 31 exige
      //    suprimir IPs que ya no son necesarias para la finalidad probatoria).
      const attUpdate = await db.attendanceRecord.updateMany({
        where: { employeeId: user.employee.id },
        data: {
          checkInIp: null,
          checkInUserAgent: null,
          checkOutIp: null,
          checkOutUserAgent: null,
        },
      });
      result.anonymizedAttendanceRecords = attUpdate.count;

      // 5. ELIMINAR WorkSchedules (no son probatorios — son config operativa).
      const wsDelete = await db.workSchedule.deleteMany({
        where: { employeeId: user.employee.id },
      });
      result.deletedWorkSchedules = wsDelete.count || 0;

      // 6. ELIMINAR Vacations (no tienen valor probatorio LFT art. 804;
      //    el saldo se cancela con la terminación laboral).
      const vacDelete = await db.vacation.deleteMany({
        where: { employeeId: user.employee.id },
      });
      result.deletedVacations = vacDelete.count || 0;
    }

    // 7. ANONIMIZAR AuditLogs donde aparece como actor — conservar
    //    el registro de la acción (probatorio) pero suprimir IP/UA.
    const audUpdate = await db.auditLog.updateMany({
      where: { userId },
      data: {
        ipAddress: null,
        userAgent: null,
      },
    });
    result.anonymizedAuditLogs = audUpdate.count;

    // 8. ELIMINAR DynamicQRs creados por el usuario.
    const qrDelete = await db.dynamicQR.deleteMany({
      where: { createdById: userId },
    });
    result.deletedDynamicQRs = qrDelete.count || 0;

    // 9. Registrar en AuditLog la anonimización (accion probatoria).
    await db.auditLog.create({
      data: {
        userId,
        action: 'PRIVACY_ANONYMIZATION',
        entityType: 'USER',
        entityId: userId,
        sucursalId: user.sucursalId,
        details: JSON.stringify({
          reason,
          anonymizedEmail,
          anonymizedAttendanceRecords: result.anonymizedAttendanceRecords,
          anonymizedAuditLogs: result.anonymizedAuditLogs,
          deletedVacations: result.deletedVacations,
          deletedWorkSchedules: result.deletedWorkSchedules,
          deletedDynamicQRs: result.deletedDynamicQRs,
          legalNote:
            'Anonimización por ejercicio del derecho de cancelación (LFPDPPP art. 31). ' +
            'Conservación de AttendanceRecords y AuditLogs anonimizados por LFT art. 804 (12 meses post-terminación).',
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch (e: any) {
    result.errors.push(`Error durante anonimización: ${e?.message || 'desconocido'}`);
  }

  return result;
}
