-- ============================================================
-- Backfill de sequenceNumber en AuditLog (fix race condition 8-sep-2026)
-- ============================================================
--
-- PROPÓSITO:
--   Añadir la columna sequenceNumber (Int, unique) a la tabla
--   "AuditLog" y poblarla con un orden determinista basado en
--   createdAt. Esto elimina la race condition que causaba falsos
--   positivos de "alteración detectada" en el verificador de
--   integridad.
--
-- EJECUTAR EN: Supabase SQL Editor (producción)
--   https://supabase.com/dashboard/project/xvimpyvwncsxfsumgosv
--
-- IDEMPOTENTE: Sí. Si ya se ejecutó, no hace nada (ADD COLUMN IF
--   NOT EXISTS + WHERE sequenceNumber IS NULL).
--
-- NO DESTRUCTIVO: No elimina ni modifica registros existentes.
--   Solo añade la columna y la pobla.
--
-- ORDEN:
--   1. ADD COLUMN sequenceNumber (nullable inicialmente para no
--      romper registros existentes).
--   2. Asignar sequenceNumber basado en ROW_NUMBER() ordenado por
--      createdAt ASC (orden cronológico de inserción).
--   3. ADD UNIQUE INDEX en sequenceNumber.
--
-- NOTA: El código de la app (src/lib/audit.ts) ya asigna
--   sequenceNumber a nuevos registros via transacción. Este
--   script solo se ocupa de los EXISTENTES al momento del deploy.
-- ============================================================

BEGIN;

-- Paso 1: Añadir columna sequenceNumber (nullable al inicio).
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "sequenceNumber" INTEGER;

-- Paso 2: Poblar con valores únicos basados en orden cronológico.
-- Usamos ROW_NUMBER() ordenado por createdAt ASC, y como desempate
-- usamos id (para registros que coinciden en el mismo milisegundo).
-- Esto garantiza un orden estable y reproducible.
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY "createdAt" ASC, id ASC
    ) AS new_seq
  FROM "AuditLog"
  WHERE "sequenceNumber" IS NULL
)
UPDATE "AuditLog" a
SET "sequenceNumber" = n.new_seq
FROM numbered n
WHERE a.id = n.id;

-- Paso 3: Crear índice unique en sequenceNumber.
-- Si ya existe (porque se creó con prisma db:push), lo saltamos.
CREATE UNIQUE INDEX IF NOT EXISTS "AuditLog_sequenceNumber_key"
  ON "AuditLog" ("sequenceNumber");

-- Paso 4: Índice secundario para queries orderBy sequenceNumber.
CREATE INDEX IF NOT EXISTS "AuditLog_sequenceNumber_idx"
  ON "AuditLog" ("sequenceNumber");

COMMIT;

-- ============================================================
-- Verificación (ejecutar aparte para confirmar):
--   SELECT COUNT(*) AS total,
--          COUNT("sequenceNumber") AS with_seq,
--          MIN("sequenceNumber") AS min_seq,
--          MAX("sequenceNumber") AS max_seq
--   FROM "AuditLog";
--
--   Esperado:
--     total == with_seq (todos los registros tienen sequenceNumber)
--     min_seq == 1
--     max_seq == total
--
--   Y para verificar unicidad:
--   SELECT COUNT(DISTINCT "sequenceNumber"), COUNT(*)
--   FROM "AuditLog";
--   Ambos deben ser iguales.
-- ============================================================
