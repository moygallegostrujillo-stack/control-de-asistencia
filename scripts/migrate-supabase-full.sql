-- ============================================================
-- MIGRACIÓN COMPREHENSIVA SUPABASE — Control de Asistencia v2.2
-- ============================================================
-- EJECUTAR EN: Supabase Dashboard → SQL Editor → New query
--
-- Este SQL es IDEMPOTENTE: puede ejecutarse cuantas veces sea necesario.
-- Usa ADD COLUMN IF NOT EXISTS y CREATE INDEX IF NOT EXISTS.
--
-- Asegura que TODAS las columnas del schema.postgres.prisma existan
-- en la BD, sin importar en qué estado estaba. Resuelve el error 500
-- en login (Prisma hace SELECT de columnas que no existen).
--
-- Es SEGURO:
--   - Todas las columnas nuevas son NULLABLE o tienen DEFAULT
--   - Los índices únicos permiten múltiples NULLs (estándar SQL)
--   - No borra ni modifica datos existentes
-- ============================================================

-- ============================================================
-- 1) TABLA: Company (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Company" (
    "id"                 TEXT        NOT NULL,
    "razonSocial"        TEXT        NOT NULL,
    "rfc"                TEXT        NOT NULL,
    "registroPatronal"   TEXT,
    "domicilioFiscal"    TEXT,
    "telefono"           TEXT,
    "email"              TEXT,
    "logoUrl"            TEXT,
    "representanteLegal" TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "razonSocial"        TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "rfc"                TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "registroPatronal"   TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "domicilioFiscal"    TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "telefono"           TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "email"              TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "logoUrl"            TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "representanteLegal" TEXT;

-- ============================================================
-- 2) TABLA: Sucursal
-- ============================================================
CREATE TABLE IF NOT EXISTS "Sucursal" (
    "id"                       TEXT        NOT NULL,
    "name"                     TEXT        NOT NULL,
    "codigoLocal"              TEXT,
    "address"                  TEXT        NOT NULL,
    "latitude"                 DOUBLE PRECISION,
    "longitude"                DOUBLE PRECISION,
    "geofenceRadiusMeters"     INTEGER     NOT NULL DEFAULT 150,
    "enforceGeofence"          BOOLEAN     NOT NULL DEFAULT false,
    "mealToleranceMinutes"     INTEGER     NOT NULL DEFAULT 5,
    "restToleranceMinutes"     INTEGER     NOT NULL DEFAULT 3,
    "mealDurationMinutes"      INTEGER     NOT NULL DEFAULT 30,
    "restDurationMinutes"      INTEGER     NOT NULL DEFAULT 15,
    "checkoutToleranceMinutes" INTEGER     NOT NULL DEFAULT 10,
    "isActive"                 BOOLEAN     NOT NULL DEFAULT true,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "codigoLocal"              TEXT;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "latitude"                 DOUBLE PRECISION;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "longitude"                DOUBLE PRECISION;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "geofenceRadiusMeters"     INTEGER NOT NULL DEFAULT 150;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "enforceGeofence"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "mealToleranceMinutes"     INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "restToleranceMinutes"     INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "mealDurationMinutes"      INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "restDurationMinutes"      INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "checkoutToleranceMinutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "isActive"                 BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "Sucursal_name_key" ON "Sucursal"("name");

-- ============================================================
-- 3) TABLA: User
-- ============================================================
CREATE TABLE IF NOT EXISTS "User" (
    "id"                  TEXT        NOT NULL,
    "email"               TEXT        NOT NULL,
    "passwordHash"        TEXT        NOT NULL,
    "name"                TEXT        NOT NULL,
    "role"                TEXT        NOT NULL DEFAULT 'EMPLOYEE',
    "sucursalId"          TEXT,
    "isActive"            BOOLEAN     NOT NULL DEFAULT true,
    "lastLoginAt"         TIMESTAMP(3),
    "failedLoginAttempts" INTEGER     NOT NULL DEFAULT 0,
    "lockedUntil"         TIMESTAMP(3),
    "mfaEnabled"          BOOLEAN     NOT NULL DEFAULT false,
    "mfaSecret"           TEXT,
    "mfaBackupCodesHash"  TEXT,
    "mfaEnrolledAt"       TIMESTAMP(3),
    "privacyAcceptedAt"        TIMESTAMP(3),
    "privacyAcceptedVersion"   TEXT,
    "privacyAcceptedIp"        TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role"                TEXT NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sucursalId"          TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive"            BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt"         TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil"         TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaEnabled"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaSecret"           TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaBackupCodesHash"  TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaEnrolledAt"       TIMESTAMP(3);
-- LFPDPPP (Task 17):
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt"        TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedVersion"   TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedIp"        TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX        IF NOT EXISTS "User_sucursalId_idx"          ON "User"("sucursalId");
CREATE INDEX        IF NOT EXISTS "User_role_idx"                ON "User"("role");
CREATE INDEX        IF NOT EXISTS "User_privacyAcceptedAt_idx"   ON "User"("privacyAcceptedAt");

-- ============================================================
-- 4) TABLA: Employee
-- ============================================================
CREATE TABLE IF NOT EXISTS "Employee" (
    "id"                  TEXT        NOT NULL,
    "employeeNumber"      TEXT        NOT NULL,
    "position"            TEXT        NOT NULL,
    "department"          TEXT        NOT NULL,
    "sucursalId"          TEXT        NOT NULL,
    "userId"              TEXT        NOT NULL,
    "hireDate"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseSalary"          DOUBLE PRECISION,
    "vacationBalanceDays" INTEGER     NOT NULL DEFAULT 12,
    "rfc"                 TEXT,
    "curp"                TEXT,
    "isActive"            BOOLEAN     NOT NULL DEFAULT true,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "position"            TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "department"          TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "sucursalId"          TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hireDate"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "baseSalary"          DOUBLE PRECISION;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "vacationBalanceDays" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "isActive"            BOOLEAN NOT NULL DEFAULT true;
-- RFC y CURP (Task 20):
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "rfc"  TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "curp" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key"        ON "Employee"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_rfc_key"           ON "Employee"("rfc");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_curp_key"          ON "Employee"("curp");
CREATE INDEX        IF NOT EXISTS "Employee_sucursalId_idx"    ON "Employee"("sucursalId");
CREATE INDEX        IF NOT EXISTS "Employee_isActive_idx"      ON "Employee"("isActive");

-- ============================================================
-- 5) TABLA: WorkSchedule
-- ============================================================
CREATE TABLE IF NOT EXISTS "WorkSchedule" (
    "id"               TEXT        NOT NULL,
    "employeeId"       TEXT        NOT NULL,
    "dayOfWeek"        INTEGER     NOT NULL,
    "startTime"        TEXT        NOT NULL,
    "endTime"          TEXT        NOT NULL,
    "toleranceMinutes" INTEGER     NOT NULL DEFAULT 10,
    "isWeeklyRest"     BOOLEAN     NOT NULL DEFAULT false,
    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkSchedule" ADD COLUMN IF NOT EXISTS "toleranceMinutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "WorkSchedule" ADD COLUMN IF NOT EXISTS "isWeeklyRest"     BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "WorkSchedule_employeeId_dayOfWeek_key" ON "WorkSchedule"("employeeId", "dayOfWeek");

-- ============================================================
-- 6) TABLA: AttendanceRecord (la más afectada por LFT 2027 + Task 18)
-- ============================================================
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
    "id"                        TEXT        NOT NULL,
    "employeeId"                TEXT        NOT NULL,
    "sucursalId"                TEXT        NOT NULL,
    "date"                      TIMESTAMP(3) NOT NULL,
    "checkInTime"               TIMESTAMP(3),
    "checkInLat"                DOUBLE PRECISION,
    "checkInLong"               DOUBLE PRECISION,
    "checkInMethod"             TEXT,
    "checkInIp"                 TEXT,
    "checkInUserAgent"          TEXT,
    "checkOutTime"              TIMESTAMP(3),
    "checkOutLat"               DOUBLE PRECISION,
    "checkOutLong"              DOUBLE PRECISION,
    "checkOutMethod"            TEXT,
    "checkOutIp"                TEXT,
    "checkOutUserAgent"         TEXT,
    "mealStart"                 TIMESTAMP(3),
    "mealEnd"                   TIMESTAMP(3),
    "mealDurationMinutes"       INTEGER,
    "mealExceeded"              BOOLEAN     NOT NULL DEFAULT false,
    "restStart"                 TIMESTAMP(3),
    "restEnd"                   TIMESTAMP(3),
    "restDurationMinutes"       INTEGER,
    "restExceeded"              BOOLEAN     NOT NULL DEFAULT false,
    "status"                    TEXT        NOT NULL DEFAULT 'PRESENT',
    "workedMinutes"             INTEGER,
    "overtimeMinutes"           INTEGER,
    "overtimeDoubleMinutes"     INTEGER,
    "overtimeTripleMinutes"     INTEGER,
    "overtimeWeeklyAccumulated" INTEGER,
    "isRestDayWorked"           BOOLEAN     NOT NULL DEFAULT false,
    "restDayWorkedMinutes"      INTEGER,
    "restDayPremiumMinutes"     INTEGER,
    "isSunday"                  BOOLEAN     NOT NULL DEFAULT false,
    "shiftType"                 TEXT,
    "nightMinutes"              INTEGER,
    "notes"                     TEXT,
    "justification"             TEXT,
    "justificationStatus"       TEXT,
    "justificationResolvedById" TEXT,
    "isLocked"                  BOOLEAN     NOT NULL DEFAULT true,
    "originalCheckInTime"       TIMESTAMP(3),
    "originalCheckOutTime"      TIMESTAMP(3),
    "correctionReason"          TEXT,
    "correctedById"             TEXT,
    "correctedAt"               TIMESTAMP(3),
    "employeeSignedAt"          TIMESTAMP(3),
    "employeeSignatureHash"     TEXT,
    "employeeSignedIp"          TEXT,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- Asegurar cada columna (idempotente):
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "checkInMethod"             TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "checkInIp"                 TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "checkInUserAgent"          TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "checkOutMethod"            TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "checkOutIp"                TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "checkOutUserAgent"         TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "mealStart"                 TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "mealEnd"                   TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "mealDurationMinutes"       INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "mealExceeded"              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "restStart"                 TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "restEnd"                   TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "restDurationMinutes"       INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "restExceeded"              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "status"                    TEXT NOT NULL DEFAULT 'PRESENT';
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "workedMinutes"             INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "overtimeMinutes"           INTEGER;
-- LFT 2027 (art. 66, 68, 73):
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "overtimeDoubleMinutes"     INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "overtimeTripleMinutes"     INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "overtimeWeeklyAccumulated" INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "isRestDayWorked"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "restDayWorkedMinutes"      INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "restDayPremiumMinutes"     INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "isSunday"                  BOOLEAN NOT NULL DEFAULT false;
-- Task 18 — Jornada nocturna (art. 60 y 61 LFT):
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "shiftType"                 TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "nightMinutes"              INTEGER;
-- Inmutabilidad (art. 132 XXXIV LFT):
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "notes"                     TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "justification"             TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "justificationStatus"       TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "justificationResolvedById" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "isLocked"                  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "originalCheckInTime"       TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "originalCheckOutTime"      TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "correctionReason"          TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "correctedById"             TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "correctedAt"               TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "employeeSignedAt"          TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "employeeSignatureHash"     TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "employeeSignedIp"          TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_employeeId_date_key" ON "AttendanceRecord"("employeeId", "date");
CREATE INDEX        IF NOT EXISTS "AttendanceRecord_sucursalId_date_idx" ON "AttendanceRecord"("sucursalId", "date");
CREATE INDEX        IF NOT EXISTS "AttendanceRecord_date_idx"             ON "AttendanceRecord"("date");
CREATE INDEX        IF NOT EXISTS "AttendanceRecord_status_idx"           ON "AttendanceRecord"("status");

-- ============================================================
-- 7) TABLA: Vacation
-- ============================================================
CREATE TABLE IF NOT EXISTS "Vacation" (
    "id"              TEXT        NOT NULL,
    "employeeId"      TEXT        NOT NULL,
    "type"            TEXT        NOT NULL DEFAULT 'VACACIONES',
    "startDate"       TIMESTAMP(3) NOT NULL,
    "endDate"         TIMESTAMP(3) NOT NULL,
    "days"            INTEGER     NOT NULL,
    "reason"          TEXT,
    "status"          TEXT        NOT NULL DEFAULT 'PENDING',
    "requestedById"   TEXT        NOT NULL,
    "approvedById"    TEXT,
    "approvedAt"      TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantMode"       TEXT        NOT NULL DEFAULT 'EMPLOYEE_REQUEST',
    "isPartial"       BOOLEAN     NOT NULL DEFAULT false,
    "startTime"       TIMESTAMP(3),
    "endTime"         TIMESTAMP(3),
    "partialHours"    INTEGER,
    CONSTRAINT "Vacation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "type"            TEXT NOT NULL DEFAULT 'VACACIONES';
ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "status"          TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "approvedAt"      TIMESTAMP(3);
ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
-- Permisos parciales + otorgamiento admin:
ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "grantMode"       TEXT NOT NULL DEFAULT 'EMPLOYEE_REQUEST';
ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "isPartial"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "startTime"       TIMESTAMP(3);
ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "endTime"         TIMESTAMP(3);
ALTER TABLE "Vacation" ADD COLUMN IF NOT EXISTS "partialHours"    INTEGER;

CREATE INDEX IF NOT EXISTS "Vacation_employeeId_startDate_idx" ON "Vacation"("employeeId", "startDate");
CREATE INDEX IF NOT EXISTS "Vacation_status_idx"               ON "Vacation"("status");
CREATE INDEX IF NOT EXISTS "Vacation_startDate_endDate_idx"    ON "Vacation"("startDate", "endDate");

-- ============================================================
-- 8) TABLA: Holiday
-- ============================================================
CREATE TABLE IF NOT EXISTS "Holiday" (
    "id"          TEXT        NOT NULL,
    "date"        TIMESTAMP(3) NOT NULL,
    "name"        TEXT        NOT NULL,
    "description" TEXT,
    "isOfficial"  BOOLEAN     NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "isOfficial"  BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "Holiday_date_key" ON "Holiday"("date");

-- ============================================================
-- 9) TABLA: AuditLog
-- ============================================================
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id"         TEXT        NOT NULL,
    "userId"     TEXT,
    "action"     TEXT        NOT NULL,
    "entityType" TEXT        NOT NULL,
    "entityId"   TEXT,
    "sucursalId" TEXT,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "details"    TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "sucursalId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress"  TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent"  TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "details"    TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_sucursalId_idx" ON "AuditLog"("sucursalId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx"  ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx"     ON "AuditLog"("action");

-- ============================================================
-- 10) TABLA: DynamicQR
-- ============================================================
CREATE TABLE IF NOT EXISTS "DynamicQR" (
    "id"          TEXT        NOT NULL,
    "code"        TEXT        NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "used"        BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "DynamicQR_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DynamicQR" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "DynamicQR_code_key"      ON "DynamicQR"("code");
CREATE INDEX        IF NOT EXISTS "DynamicQR_expiresAt_idx" ON "DynamicQR"("expiresAt");

-- ============================================================
-- 11) TABLA: PrivacyRequest (NUEVA — LFPDPPP art. 29-32)
-- ============================================================
CREATE TABLE IF NOT EXISTS "PrivacyRequest" (
    "id"              TEXT        NOT NULL,
    "userId"          TEXT        NOT NULL,
    "type"            TEXT        NOT NULL,
    "status"          TEXT        NOT NULL DEFAULT 'PENDING',
    "requestDetails"  TEXT,
    "resolutionNotes" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"      TIMESTAMP(3),
    "resolvedById"    TEXT,
    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- Row Level Security — bloqueo total desde claves publicas (anon/authenticated).
-- Prisma usa rol postgres/service_role que BYPASSA RLS → la app sigue funcionando.
ALTER TABLE "PrivacyRequest" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "PrivacyRequest" IS
  'Solicitudes ARCO (LFPDPPP arts. 29-32). RLS habilitado sin politicas = bloqueo total desde anon/authenticated.';

CREATE INDEX IF NOT EXISTS "PrivacyRequest_userId_idx"    ON "PrivacyRequest"("userId");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_status_idx"    ON "PrivacyRequest"("status");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_type_idx"      ON "PrivacyRequest"("type");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_createdAt_idx" ON "PrivacyRequest"("createdAt");

-- ============================================================
-- 12) FOREIGN KEYS (idempotentes: DROP IF EXISTS + ADD)
-- ============================================================

-- User → Sucursal
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_sucursalId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_sucursalId_fkey"
    FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee → Sucursal
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_sucursalId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_sucursalId_fkey"
    FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Employee → User
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_userId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- WorkSchedule → Employee
ALTER TABLE "WorkSchedule" DROP CONSTRAINT IF EXISTS "WorkSchedule_employeeId_fkey";
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AttendanceRecord → Employee
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_employeeId_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AttendanceRecord → Sucursal
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_sucursalId_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sucursalId_fkey"
    FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AttendanceRecord → User (justificationResolver)
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_justificationResolvedById_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_justificationResolvedById_fkey"
    FOREIGN KEY ("justificationResolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AttendanceRecord → User (correctedBy)
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_correctedById_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_correctedById_fkey"
    FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vacation → Employee
ALTER TABLE "Vacation" DROP CONSTRAINT IF EXISTS "Vacation_employeeId_fkey";
ALTER TABLE "Vacation" ADD CONSTRAINT "Vacation_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Vacation → User (requestedBy)
ALTER TABLE "Vacation" DROP CONSTRAINT IF EXISTS "Vacation_requestedById_fkey";
ALTER TABLE "Vacation" ADD CONSTRAINT "Vacation_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Vacation → User (approvedBy)
ALTER TABLE "Vacation" DROP CONSTRAINT IF EXISTS "Vacation_approvedById_fkey";
ALTER TABLE "Vacation" ADD CONSTRAINT "Vacation_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditLog → User
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DynamicQR → User (createdBy)
ALTER TABLE "DynamicQR" DROP CONSTRAINT IF EXISTS "DynamicQR_createdById_fkey";
ALTER TABLE "DynamicQR" ADD CONSTRAINT "DynamicQR_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PrivacyRequest → User (requester)
ALTER TABLE "PrivacyRequest" DROP CONSTRAINT IF EXISTS "PrivacyRequest_userId_fkey";
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PrivacyRequest → User (resolver)
ALTER TABLE "PrivacyRequest" DROP CONSTRAINT IF EXISTS "PrivacyRequest_resolvedById_fkey";
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FIN — Después de ejecutar, prueba login de nuevo.
-- ============================================================
-- Verificación rápida (opcional):
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'PrivacyRequest';
-- Esperado: PrivacyRequest | true
-- ============================================================
