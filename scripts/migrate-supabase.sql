-- ============================================================
-- MIGRACIÓN SUPABASE — Control de Asistencia v2.2
-- ============================================================
-- EJECUTAR EN: Supabase Dashboard → SQL Editor → New query
-- URL: https://supabase.com/dashboard/project/_/sql/new
--
-- ESTE SQL sincroniza la base de datos de producción (Supabase)
-- con el schema actual. Corrige el error 500 en login y agrega
-- todos los campos faltantes.
--
-- Es SEGURO ejecutarlo:
--   - Todas las columnas nuevas son NULLABLE (no afecta datos existentes)
--   - Los índices únicos permiten múltiples NULLs (estándar SQL)
--   - La tabla PrivacyRequest es nueva (no conflictos)
-- ============================================================

-- 1) User: campos de privacidad (LFPDPPP — aviso de privacidad)
ALTER TABLE "User" ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "privacyAcceptedIp" TEXT,
ADD COLUMN     "privacyAcceptedVersion" TEXT;

-- 2) Employee: RFC y CURP (art. 804 LFT — reporte STPS)
--    ESTO ES LO QUE ROMPIÓ EL LOGIN (include: { employee: true })
ALTER TABLE "Employee" ADD COLUMN     "curp" TEXT,
ADD COLUMN     "rfc" TEXT;

-- 3) AttendanceRecord: jornada nocturna (art. 60 y 61 LFT)
ALTER TABLE "AttendanceRecord" ADD COLUMN     "nightMinutes" INTEGER,
ADD COLUMN     "shiftType" TEXT;

-- 4) PrivacyRequest: tabla nueva (derechos ARCO — LFPDPPP art. 29-32)
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestDetails" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- 4b) Row Level Security — bloqueo total desde claves publicas (anon/authenticated)
--     Esto protege la API REST auto-generada de Supabase (/rest/v1/PrivacyRequest).
--     Prisma usa el rol 'postgres' (o service_role) que BYPASSA RLS → la app sigue funcionando.
--     NO se agregan politicas → acceso denegado por defecto desde cualquier cliente directo.
ALTER TABLE "PrivacyRequest" ENABLE ROW LEVEL SECURITY;
-- Comentario documental para auditoria INAI:
COMMENT ON TABLE "PrivacyRequest" IS
  'Solicitudes ARCO (LFPDPPP arts. 29-32). RLS habilitado sin politicas = bloqueo total desde anon/authenticated. Solo rol postgres/service_role (usado por Prisma) puede leer/escribir.';

-- 5) Índices para PrivacyRequest
CREATE INDEX "PrivacyRequest_userId_idx" ON "PrivacyRequest"("userId");
CREATE INDEX "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");
CREATE INDEX "PrivacyRequest_type_idx" ON "PrivacyRequest"("type");
CREATE INDEX "PrivacyRequest_createdAt_idx" ON "PrivacyRequest"("createdAt");

-- 6) Índice para User.privacyAcceptedAt (middleware lo consulta en cada request)
CREATE INDEX "User_privacyAcceptedAt_idx" ON "User"("privacyAcceptedAt");

-- 7) Índices únicos para RFC y CURP (NULL no viola unique en PostgreSQL)
CREATE UNIQUE INDEX "Employee_rfc_key" ON "Employee"("rfc");
CREATE UNIQUE INDEX "Employee_curp_key" ON "Employee"("curp");

-- 8) Foreign keys para PrivacyRequest
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FIN — Después de ejecutar, el login debe funcionar de inmediato.
-- No necesita reiniciar Vercel (las serverless functions leen
-- el schema de la BD en cada request).
-- ============================================================
