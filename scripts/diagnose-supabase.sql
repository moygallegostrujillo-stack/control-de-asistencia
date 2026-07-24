-- ============================================================
-- DIAGNÓSTICO — Estado actual de la BD de Supabase
-- ============================================================
-- Corre esto en Supabase Dashboard → SQL Editor → New query
-- Devuelve todas las columnas de cada tabla para comparar con el schema.
-- ============================================================

SELECT
  table_name  AS "tabla",
  column_name AS "columna",
  data_type   AS "tipo",
  is_nullable AS "nullable",
  column_default AS "default"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('User','Employee','AttendanceRecord','Vacation',
                     'Sucursal','Company','WorkSchedule','Holiday',
                     'AuditLog','DynamicQR','PrivacyRequest')
ORDER BY table_name, ordinal_position;

-- ============================================================
-- También: lista de tablas que existen (para ver si falta PrivacyRequest)
-- ============================================================
SELECT tablename AS "tabla_existe"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
