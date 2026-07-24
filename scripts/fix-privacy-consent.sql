-- ============================================================
-- FIX URGENTE — Desbloquear acceso tras implementación LFPDPPP
-- ============================================================
-- PROBLEMA:
--   Tras aplicar migrate-supabase-full.sql, las columnas
--   privacyAcceptedAt, privacyAcceptedVersion y privacyAcceptedIp
--   existen en la tabla "User", PERO los usuarios EXISTENTES (como
--   admin@control.com) las tienen en NULL.
--
--   El middleware (src/middleware.ts) bloquea TODAS las peticiones
--   /api/* con HTTP 403 PRIVACY_CONSENT_REQUIRED cuando:
--     privacyAccepted !== true  O  privacyVersion !== '1.0'
--
--   Esto hace que el login funcione, pero TODAS las pestañas del
--   sistema muestren error "Debe aceptar el Aviso de Privacidad".
--
-- SOLUCIÓN:
--   Marcar como aceptado el Aviso de Privacidad v1.0 para todos los
--   usuarios existentes. Después de esto, podrán acceder con normalidad.
--   Los usuarios nuevos deberán aceptarlo en su primer login mediante
--   el modal de consentimiento.
--
-- EJECUTAR EN: Supabase Dashboard → SQL Editor → New query
-- IDEMPOTENTE: se puede ejecutar varias veces sin daño.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) Asegurar que las columnas existan (por si acaso)
-- ============================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt"      TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedIp"      TEXT;

-- ============================================================
-- 2) Marcar consentimiento v1.0 para todos los usuarios existentes
--    que aún no lo hayan aceptado (NULL o versión distinta).
--
--    Esto simula que el usuario ya aceptó el aviso, para no bloquear
--    el acceso a usuarios que ya estaban usando el sistema antes de
--    la implementación de LFPDPPP (Task 17).
--
--    En adelante, los usuarios NUEVOS serán creados con NULL y deberán
--    aceptar el aviso en su primer login (flujo normal del modal).
-- ============================================================
UPDATE "User"
SET
    "privacyAcceptedAt"      = COALESCE("privacyAcceptedAt", NOW()),
    "privacyAcceptedVersion" = '1.0',
    "privacyAcceptedIp"      = COALESCE("privacyAcceptedIp", '127.0.0.1')
WHERE
    "privacyAcceptedAt" IS NULL
    OR "privacyAcceptedVersion" IS NULL
    OR "privacyAcceptedVersion" <> '1.0';

-- ============================================================
-- 3) Verificación — cuántos usuarios fueron actualizados
-- ============================================================
SELECT
    email,
    role,
    "privacyAcceptedAt",
    "privacyAcceptedVersion",
    "privacyAcceptedIp"
FROM "User"
ORDER BY email;

COMMIT;

-- ============================================================
-- DESPUÉS DE EJECUTAR:
--   1. Cierra sesión en la app (o borra cookies del sitio).
--   2. Vuelve a iniciar sesión con admin@control.com.
--   3. El JWT nuevo incluirá privacyAccepted=true y privacyVersion='1.0'.
--   4. El middleware permitirá el paso a todas las APIs.
--   5. Todas las pestañas cargarán con normalidad.
--
-- NOTA: Si tenías una sesión abierta antes de ejecutar este SQL,
--   el JWT viejo sigue teniendo privacyAccepted=false. Por eso es
--   OBLIGATORIO cerrar sesión y volver a iniciar. El botón "Limpiar
--   cache" del navegador NO sirve para esto — hay que cerrar sesión
--   desde la app (o borrar las cookies next-auth.session-token y
--   session_user manualmente).
-- ============================================================
