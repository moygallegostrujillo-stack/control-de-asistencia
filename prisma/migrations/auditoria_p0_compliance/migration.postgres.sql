-- ============================================================
-- Migración: auditoria_p0_compliance (PostgreSQL / Supabase prod)
-- Fecha: 14 de agosto 2026
-- Versión schema: v2.2 → v2.3
-- Requisitos: RT-P0.1, RT-P0.5, RT-P0.7 (auditoría jurídico-laboral)
-- ============================================================
-- Esta migración es IDEMPOTENTE: usa "IF NOT EXISTS" para que pueda
-- ejecutarse múltiples veces sin error.
--
-- ⚠️ NO EJECUTAR AUTOMÁTICAMENTE. Revisar manualmente antes de aplicar.
-- Aplicar vía endpoint /api/migrate/auditoria-p0-compliance?token=...
-- (siguiendo el patrón de migraciones manuales del proyecto).
-- ============================================================

-- ============================================================
-- RT-P0.1 — Tabla JornadaConfig (tope semanal por año, art. 61 LFT)
-- ============================================================

CREATE TABLE IF NOT EXISTS "JornadaConfig" (
    "year"            INTEGER NOT NULL,
    "maxWeeklyHours"  INTEGER NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JornadaConfig_pkey" PRIMARY KEY ("year")
);

COMMENT ON TABLE "JornadaConfig" IS 'RT-P0.1: Tope de jornada semanal máxima por año (art. 61 LFT, reforma DOF 27-dic-2024).';

-- Seed inicial de los topes 2026-2030 (Decreto DOF 27-dic-2024, Transitorio)
-- ON CONFLICT para idempotencia en PostgreSQL
INSERT INTO "JornadaConfig" ("year", "maxWeeklyHours", "updatedAt") VALUES
  (2026, 48, CURRENT_TIMESTAMP),
  (2027, 46, CURRENT_TIMESTAMP),
  (2028, 44, CURRENT_TIMESTAMP),
  (2029, 42, CURRENT_TIMESTAMP),
  (2030, 40, CURRENT_TIMESTAMP)
ON CONFLICT ("year") DO NOTHING;

-- ============================================================
-- RT-P0.5 — Tabla ElectronicRecordAgreement (art. 132 XXXIV LFT)
-- ============================================================

CREATE TABLE IF NOT EXISTS "ElectronicRecordAgreement" (
    "id"               TEXT NOT NULL,
    "employeeId"       TEXT NOT NULL,
    "agreedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agreedIp"         TEXT NOT NULL,
    "agreedUserAgent"  TEXT NOT NULL,
    "agreementVersion" TEXT NOT NULL,
    "documentHash"     TEXT NOT NULL,
    "documentUrl"      TEXT,
    "isActive"         BOOLEAN NOT NULL DEFAULT TRUE,
    "revokedAt"        TIMESTAMP(3),
    "revokedReason"    TEXT,
    CONSTRAINT "ElectronicRecordAgreement_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "ElectronicRecordAgreement" IS 'RT-P0.5: Acuerdo formal patrón-trabajador de registro electrónico (art. 132 XXXIV LFT).';
COMMENT ON COLUMN "ElectronicRecordAgreement.documentHash" IS 'sha256 del texto del acuerdo aceptado, como evidencia probatoria.';

-- Índices para ElectronicRecordAgreement
CREATE UNIQUE INDEX IF NOT EXISTS "ElectronicRecordAgreement_employeeId_key"
    ON "ElectronicRecordAgreement"("employeeId");
CREATE INDEX IF NOT EXISTS "ElectronicRecordAgreement_employeeId_idx"
    ON "ElectronicRecordAgreement"("employeeId");
CREATE INDEX IF NOT EXISTS "ElectronicRecordAgreement_isActive_idx"
    ON "ElectronicRecordAgreement"("isActive");
CREATE INDEX IF NOT EXISTS "ElectronicRecordAgreement_agreementVersion_idx"
    ON "ElectronicRecordAgreement"("agreementVersion");

-- Foreign key: Employee → ElectronicRecordAgreement (onDelete: CASCADE)
-- En PostgreSQL, añadimos la constraint con IF NOT EXISTS simulado vía DO block
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ElectronicRecordAgreement_employeeId_fkey'
          AND table_name = 'ElectronicRecordAgreement'
    ) THEN
        ALTER TABLE "ElectronicRecordAgreement"
            ADD CONSTRAINT "ElectronicRecordAgreement_employeeId_fkey"
            FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================
-- RT-P0.7 — AuditLog: añadir previousHash y recordHash
-- ============================================================
-- Encadenamiento de hashes para hacer la bitácora tamper-evident.

-- Columna previousHash (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AuditLog' AND column_name = 'previousHash'
    ) THEN
        ALTER TABLE "AuditLog" ADD COLUMN "previousHash" TEXT;
    END IF;
END $$;

-- Columna recordHash (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AuditLog' AND column_name = 'recordHash'
    ) THEN
        ALTER TABLE "AuditLog" ADD COLUMN "recordHash" TEXT;
    END IF;
END $$;

COMMENT ON COLUMN "AuditLog.previousHash" IS 'RT-P0.7: Hash del registro anterior en la cadena (null para pre-chain).';
COMMENT ON COLUMN "AuditLog.recordHash" IS 'RT-P0.7: sha256(previousHash + campos del registro) — tamper-evident.';

-- Índice para acelerar la verificación de la cadena
CREATE INDEX IF NOT EXISTS "AuditLog_recordHash_idx" ON "AuditLog"("recordHash");

-- ============================================================
-- Verificación post-migración (ejecutar manualmente en Supabase)
-- ============================================================
-- SELECT year, maxWeeklyHours FROM "JornadaConfig" ORDER BY year;
-- → debe mostrar 5 filas (2026-2030).
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'AuditLog' ORDER BY ordinal_position;
-- → debe incluir previousHash y recordHash como últimas columnas.
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'ElectronicRecordAgreement' ORDER BY ordinal_position;
-- → debe mostrar las 11 columnas esperadas.
