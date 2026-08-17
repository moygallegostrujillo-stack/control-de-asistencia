-- ============================================================
-- Migración: auditoria_p0_archived_at (SQLite / dev local)
-- RT-P0.8: Campo archivedAt en AttendanceRecord (LFT art. 804)
-- ============================================================
-- SQLite NO soporta "ADD COLUMN IF NOT EXISTS" ni bloques procedural
-- DO $$ como PostgreSQL. Por eso esta migración NO es idempotente a
-- nivel SQL puro: si se ejecuta dos veces, la segunda fallará con
-- "duplicate column name".
--
-- En desarrollo local esto se maneja así:
--   - Para aplicar la migración, usar `bun run db:push` (Prisma hace
--     el diff contra el schema y aplica solo lo que falta) o ejecutar
--     este SQL una sola vez tras borrar/recrear la DB.
--   - El endpoint de migración manual del proyecto puede envolver este
--     SQL en un try/catch que ignore el error "duplicate column".
--
-- En PRODUCCIÓN (PostgreSQL/Supabase) usar migration.postgres.sql,
-- que SÍ es idempotente.
-- ============================================================

-- ============================================================
-- RT-P0.8 — AttendanceRecord: añadir columna archivedAt
-- ============================================================
-- Fecha en que el registro fue archivado por la política de retención
-- (LFT art. 804 — 12 meses posteriores a la terminación laboral).
-- NULL = registro activo. Si tiene valor, el registro fue anonimizado
-- (IPs/UA nulificados) y se conserva solo para valor probatorio.
--
-- ⚠️ ONE-SHOT: si la columna ya existe, este ALTER falla con
-- "duplicate column name: archivedAt". Capturar el error a nivel app
-- para idempotencia.

ALTER TABLE "AttendanceRecord" ADD COLUMN "archivedAt" DATETIME;

-- Índice para filtrar eficientemente registros no archivados (archivedAt IS NULL)
-- CREATE INDEX IF NOT EXISTS SÍ está soportado en SQLite ≥ 3.3.0.
CREATE INDEX IF NOT EXISTS "AttendanceRecord_archivedAt_idx" ON "AttendanceRecord"("archivedAt");

-- ============================================================
-- Verificación post-migración (ejecutar manualmente)
-- ============================================================
-- PRAGMA table_info(AttendanceRecord);
-- → debe incluir archivedAt como una de las últimas columnas.
--
-- PRAGMA index_list(AttendanceRecord);
-- → debe incluir AttendanceRecord_archivedAt_idx.
