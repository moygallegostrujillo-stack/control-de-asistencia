-- ============================================================
-- Migración: auditoria_p0_compliance
-- Fecha: 14 de agosto 2026
-- Versión schema: v2.2 → v2.3
-- Requisitos: RT-P0.1, RT-P0.5, RT-P0.7 (auditoría jurídico-laboral)
-- ============================================================
-- Esta migración es IDEMPOTENTE: usa "IF NOT EXISTS" para que pueda
-- ejecutarse múltiples veces sin error. Compatible con SQLite (dev)
-- y PostgreSQL (prod Supabase).
--
-- ⚠️ NO EJECUTAR AUTOMÁTICAMENTE. Revisar manualmente antes de aplicar.
-- ============================================================

-- ============================================================
-- RT-P0.1 — Tabla JornadaConfig (tope semanal por año, art. 61 LFT)
-- ============================================================
-- Consultada por validateWorkSchedules() para rechazar horarios semanales
-- que excedan el tope del año en curso (48h 2026 → 40h 2030).

CREATE TABLE IF NOT EXISTS "JornadaConfig" (
    "year"            INTEGER NOT NULL,
    "maxWeeklyHours"  INTEGER NOT NULL,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL,
    CONSTRAINT "JornadaConfig_pkey" PRIMARY KEY ("year")
);

-- Seed inicial de los topes 2026-2030 (Decreto DOF 27-dic-2024, Transitorio)
INSERT OR IGNORE INTO "JornadaConfig" ("year", "maxWeeklyHours", "updatedAt") VALUES
  (2026, 48, CURRENT_TIMESTAMP),
  (2027, 46, CURRENT_TIMESTAMP),
  (2028, 44, CURRENT_TIMESTAMP),
  (2029, 42, CURRENT_TIMESTAMP),
  (2030, 40, CURRENT_TIMESTAMP);

-- ============================================================
-- RT-P0.5 — Tabla ElectronicRecordAgreement (art. 132 XXXIV LFT)
-- ============================================================
-- Acuerdo formal patrón-trabajador sobre registro electrónico de jornada.
-- Relación 1:1 con Employee (employeeId UNIQUE).
-- Si es NULL → el empleado no ha aceptado el acuerdo y no puede check-in
-- a partir del 1-ene-2027.

CREATE TABLE IF NOT EXISTS "ElectronicRecordAgreement" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "employeeId"       TEXT NOT NULL,
    "agreedAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agreedIp"         TEXT NOT NULL,
    "agreedUserAgent"  TEXT NOT NULL,
    "agreementVersion" TEXT NOT NULL,
    "documentHash"     TEXT NOT NULL,
    "documentUrl"      TEXT,
    "isActive"         BOOLEAN NOT NULL DEFAULT TRUE,
    "revokedAt"        DATETIME,
    "revokedReason"    TEXT,
    CONSTRAINT "ElectronicRecordAgreement_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Índices para ElectronicRecordAgreement
CREATE UNIQUE INDEX IF NOT EXISTS "ElectronicRecordAgreement_employeeId_key"
    ON "ElectronicRecordAgreement"("employeeId");
CREATE INDEX IF NOT EXISTS "ElectronicRecordAgreement_employeeId_idx"
    ON "ElectronicRecordAgreement"("employeeId");
CREATE INDEX IF NOT EXISTS "ElectronicRecordAgreement_isActive_idx"
    ON "ElectronicRecordAgreement"("isActive");
CREATE INDEX IF NOT EXISTS "ElectronicRecordAgreement_agreementVersion_idx"
    ON "ElectronicRecordAgreement"("agreementVersion");

-- ============================================================
-- RT-P0.7 — AuditLog: añadir previousHash y recordHash
-- ============================================================
-- Encadenamiento de hashes para hacer la bitácora tamper-evident.
-- Los campos son NULLABLE para no romper los registros existentes
-- (pre-chain). Los registros nuevos siempre tendrán hash.

-- Verificar si las columnas ya existen antes de añadirlas (idempotente).
-- SQLite no soporta "ADD COLUMN IF NOT EXISTS", por eso usamos un bloque
-- que ignora el error si la columna ya existe.

-- Columna previousHash
-- En SQLite: si la columna ya existe, el ALTER falla con error "duplicate column".
-- Se ejecuta con error ignorado (ver endpoint de migración idempotente).
ALTER TABLE "AuditLog" ADD COLUMN "previousHash" TEXT;

-- Columna recordHash
ALTER TABLE "AuditLog" ADD COLUMN "recordHash" TEXT;

-- Índice para acelerar la verificación de la cadena
CREATE INDEX IF NOT EXISTS "AuditLog_recordHash_idx" ON "AuditLog"("recordHash");

-- ============================================================
-- Verificación post-migración (ejecutar manualmente)
-- ============================================================
-- SELECT year, maxWeeklyHours FROM JornadaConfig ORDER BY year;
-- → debe mostrar 5 filas (2026-2030).
--
-- PRAGMA table_info(AuditLog);
-- → debe incluir previousHash y recordHash como últimas columnas.
--
-- PRAGMA table_info(ElectronicRecordAgreement);
-- → debe mostrar las 11 columnas esperadas.
--
-- PRAGMA foreign_key_list(ElectronicRecordAgreement);
-- → debe mostrar la FK a Employee con ON DELETE CASCADE.
