-- ============================================================
-- Migración: auditoria_p0_archived_at (PostgreSQL / Supabase prod)
-- RT-P0.8: Campo archivedAt en AttendanceRecord (LFT art. 804)
-- ============================================================
-- Esta migración es IDEMPOTENTE: usa "IF NOT EXISTS" y bloques DO $$
-- para que pueda ejecutarse múltiples veces sin error.
--
-- ⚠️ NO EJECUTAR AUTOMÁTICAMENTE. Revisar manualmente antes de aplicar.
-- Aplicar vía Supabase SQL Editor o endpoint de migración manual
-- (siguiendo el patrón de migraciones del proyecto).
-- ============================================================

-- ============================================================
-- RT-P0.8 — AttendanceRecord: añadir columna archivedAt
-- ============================================================
-- Fecha en que el registro fue archivado por la política de retención
-- (LFT art. 804 — 12 meses posteriores a la terminación laboral).
-- NULL = registro activo. Si tiene valor, el registro fue anonimizado
-- (IPs/UA nulificados) y se conserva solo para valor probatorio.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AttendanceRecord' AND column_name = 'archivedAt'
    ) THEN
        ALTER TABLE "AttendanceRecord" ADD COLUMN "archivedAt" TIMESTAMP(3);
    END IF;
END $$;

COMMENT ON COLUMN "AttendanceRecord.archivedAt" IS 'RT-P0.8: Fecha de archivado por retención 12 meses (LFT art. 804). NULL = activo.';

-- Índice para filtrar eficientemente registros no archivados (archivedAt IS NULL)
CREATE INDEX IF NOT EXISTS "AttendanceRecord_archivedAt_idx" ON "AttendanceRecord"("archivedAt");

-- ============================================================
-- Verificación post-migración (ejecutar manualmente en Supabase)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'AttendanceRecord' AND column_name = 'archivedAt';
-- → debe mostrar 1 fila: archivedAt | timestamp without time zone
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'AttendanceRecord' AND indexname = 'AttendanceRecord_archivedAt_idx';
-- → debe mostrar 1 fila.
