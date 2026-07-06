-- ============================================================
-- DESACTIVAR MFA TEMPORALMENTE — Versión robusta
-- ============================================================
-- Esta versión PRIMERO descubre el nombre real de la tabla
-- (PostgreSQL es case-sensitive y Prisma puede haberla creado
-- con otro nombre). Luego ejecuta el UPDATE de forma segura.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PASO 1: Descubrir el nombre real de la tabla de usuarios
-- ════════════════════════════════════════════════════════════
-- Ejecuta SOLO este bloque primero y mira los resultados.
-- Deberías ver una fila con el nombre exacto de la tabla
-- (probablemente "User", "user", o algo similar).

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND (table_name ILIKE '%user%'
       OR table_name ILIKE '%usuario%'
       OR table_name ILIKE '%account%'
       OR table_name ILIKE '%login%')
ORDER BY table_schema, table_name;

-- ════════════════════════════════════════════════════════════
-- PASO 2: Ver todas las tablas (por si el Paso 1 no encuentra nada)
-- ════════════════════════════════════════════════════════════
-- Descomenta estas líneas si el Paso 1 no devolvió nada:

-- SELECT table_schema, table_name
-- FROM information_schema.tables
-- WHERE table_type = 'BASE TABLE'
--   AND table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
-- ORDER BY table_schema, table_name;
