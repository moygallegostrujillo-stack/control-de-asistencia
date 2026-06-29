#!/usr/bin/env bash
# ============================================================
# deploy-vercel.sh — Deploy automatizado a Vercel + Railway
# ============================================================
#
# Este script automatiza el deploy del sistema Control de Asistencia
# NOM-037 v2.2 a producción:
#
#   1. Verifica prerrequisitos (Vercel CLI, bun, git)
#   2. Cambia schema Prisma a PostgreSQL
#   3. Verifica variables de entorno requeridas
#   4. Hace push del schema a Supabase (db:push)
#   5. (Opcional) Carga datos seed
#   6. Deploy a Vercel (producción)
#   7. Instrucciones para deploy del servicio realtime en Railway
#   8. Verificación final del deployment
#
# Uso:
#   ./scripts/deploy-vercel.sh              # deploy completo interactivo
#   ./scripts/deploy-vercel.sh --skip-db    # saltar db:push (si ya está hecho)
#   ./scripts/deploy-vercel.sh --prod-only  # solo vercel deploy --prod
#
# IMPORTANTE: Este script NO debe ejecutarse en el sandbox.
# Es para tu máquina local con acceso a Vercel CLI y git.
# ============================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helpers
log()   { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
info()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
warn()  { echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} ⚠️  $1"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)]${NC} ❌ $1"; }
step()  { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}▶ $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# Args
SKIP_DB=false
PROD_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --skip-db) SKIP_DB=true ;;
    --prod-only) PROD_ONLY=true; SKIP_DB=true ;;
    --help|-h)
      echo "Uso: $0 [--skip-db] [--prod-only] [--help]"
      echo ""
      echo "Opciones:"
      echo "  --skip-db     No ejecutar prisma db:push (asume schema ya sincronizado)"
      echo "  --prod-only   Solo hace 'vercel --prod' (asume todo lo demás listo)"
      echo "  --help        Muestra esta ayuda"
      exit 0
      ;;
  esac
done

# ============================================================
# Banner
# ============================================================

cat << 'BANNER'
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 Control de Asistencia NOM-037 v2.2                  ║
║   Deploy automatizado a Vercel + Railway                 ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
BANNER

# ============================================================
# Step 0: Verificar prerrequisitos
# ============================================================
step "Step 0: Verificando prerrequisitos"

cd "$(dirname "$0")/.."

# Detectar si estamos en el sandbox (no debe ejecutarse aquí)
if [ -f "/home/z/my-project/dev.log" ] && [ -d "/home/z/my-project/mini-services" ]; then
  if [ "$(pwd)" = "/home/z/my-project" ]; then
    error "Este script NO debe ejecutarse en el sandbox de desarrollo."
    error "Cópialo a tu máquina local y ejecútalo desde ahí."
    error ""
    error "En tu máquina local:"
    error "  git clone <repo>"
    error "  cd control-de-asistencia"
    error "  ./scripts/deploy-vercel.sh"
    exit 1
  fi
fi

# Bun
if ! command -v bun &> /dev/null; then
  error "Bun no está instalado. Instalar con: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
log "Bun: $(bun --version)"

# Vercel CLI
if ! command -v vercel &> /dev/null; then
  warn "Vercel CLI no está instalado. Instalando..."
  npm install -g vercel
fi
log "Vercel CLI: $(vercel --version 2>&1 | head -1)"

# Git
if ! command -v git &> /dev/null; then
  error "Git no está instalado."
  exit 1
fi
log "Git: $(git --version)"

# Estar en repo git
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
  warn "No es un repo git. Inicializando..."
  git init
  git add -A
  git commit -m "Initial commit para deploy Vercel"
fi

log "Branch actual: $(git branch --show-current)"
log "✅ Prerrequisitos OK"

# ============================================================
# Step 1: Cambiar schema a PostgreSQL
# ============================================================
if [ "$PROD_ONLY" = false ]; then
  step "Step 1: Cambiando schema Prisma a PostgreSQL"

  CURRENT_PROVIDER=$(awk '/^datasource db {/,/}/' prisma/schema.prisma | grep -E '^\s*provider\s*=' | head -1 | sed -E 's/.*=\s*"([^"]+)".*/\1/')

  if [ "$CURRENT_PROVIDER" = "postgresql" ]; then
    log "Schema ya está en PostgreSQL ✅"
  else
    warn "Schema actual es $CURRENT_PROVIDER. Cambiando a PostgreSQL..."
    ./scripts/switch-schema.sh postgres
    log "Schema cambiado a PostgreSQL ✅"
    warn "Recuerda hacer commit de este cambio antes del deploy."
    read -p "¿Hacer commit ahora? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      git add prisma/schema.prisma
      git commit -m "build: switch schema to PostgreSQL for production deploy"
      log "Commit creado ✅"
    fi
  fi
fi

# ============================================================
# Step 2: Verificar variables de entorno
# ============================================================
if [ "$PROD_ONLY" = false ]; then
  step "Step 2: Verificando variables de entorno (.env)"

  REQUIRED_VARS=("DATABASE_URL" "DIRECT_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL")
  MISSING=()

  if [ ! -f ".env" ]; then
    warn "No existe .env. Copiando de .env.example..."
    cp .env.example .env
    error "Edita .env con tus credenciales reales de Supabase y vuelve a ejecutar."
    exit 1
  fi

  for var in "${REQUIRED_VARS[@]}"; do
    VALUE=$(grep -E "^${var}=" .env 2>/dev/null | head -1 | sed -E 's/^[^=]+=("?)(.*)\1$/\2/' | head -c 10)
    if [ -z "$VALUE" ] || [ "$VALUE" = '""' ]; then
      MISSING+=("$var")
    fi
  done

  if [ ${#MISSING[@]} -gt 0 ]; then
    error "Faltan variables requeridas en .env:"
    for var in "${MISSING[@]}"; do
      echo "  - $var"
    done
    echo ""
    error "Edita .env y vuelve a ejecutar."
    exit 1
  fi

  # Validar que DATABASE_URL sea PostgreSQL
  DB_URL=$(grep -E "^DATABASE_URL=" .env | head -1 | sed -E 's/^DATABASE_URL="?([^"]+)"?$/\1/')
  if [[ ! "$DB_URL" =~ ^postgresql:// ]]; then
    error "DATABASE_URL debe ser PostgreSQL (empezar con postgresql://)"
    error "Actual: $DB_URL"
    exit 1
  fi

  log "Variables requeridas presentes ✅"
  log "DATABASE_URL: ${DB_URL:0:30}..."
  log "NEXTAUTH_URL: $(grep -E '^NEXTAUTH_URL=' .env | sed -E 's/^NEXTAUTH_URL="?([^"]+)"?$/\1/')"
fi

# ============================================================
# Step 3: Push del schema a Supabase
# ============================================================
if [ "$SKIP_DB" = false ]; then
  step "Step 3: Sincronizando schema con Supabase (prisma db:push)"

  warn "Esto modificará la base de datos de Supabase."
  warn "Si es la primera vez, creará todas las tablas."
  warn "Si ya existe data, puede haber migraciones destructivas."
  read -p "¿Continuar? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Saltando db:push."
  else
    log "Ejecutando prisma db:push..."
    bun run db:push
    log "Schema sincronizado con Supabase ✅"
  fi

  # Seed opcional
  read -p "¿Cargar datos seed (empresa demo, 2 sucursales, 3 admins, 8 empleados)? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Ejecutando seed..."
    bun run db:seed
    log "Seed completado ✅"
    log ""
    log "Credenciales creadas:"
    log "  Admin General:    admin@control.com / Admin#2025"
    log "  Admin Matriz:     admin.matriz@control.com / Matriz#2025"
    log "  Admin Sucursal 1: admin.sucursal1@control.com / Suc1#2025"
    log "  Empleados:        EMP-001..EMP-008 / Empleado#2025"
  fi
fi

# ============================================================
# Step 4: Deploy a Vercel
# ============================================================
step "Step 4: Deploy a Vercel"

# Verificar login
if ! vercel whoami &> /dev/null; then
  warn "No estás logueado en Vercel. Ejecutando vercel login..."
  vercel login
fi

CURRENT_USER=$(vercel whoami 2>/dev/null || echo "")
log "Cuenta Vercel: $CURRENT_USER"

# Linkear proyecto si no está linkeado
if [ ! -d ".vercel" ]; then
  warn "Proyecto no linkeado a Vercel. Ejecutando vercel link..."
  vercel link
fi

# Configurar variables de entorno en Vercel si no existen
info "Verificando variables de entorno en Vercel..."
ENV_VARS_TO_SET=("DATABASE_URL" "DIRECT_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL" "REALTIME_SERVICE_URL" "NEXT_PUBLIC_REALTIME_URL")

# Leer valores del .env local para setear en Vercel
declare -A ENV_VALUES
for var in "${ENV_VARS_TO_SET[@]}"; do
  VALUE=$(grep -E "^${var}=" .env 2>/dev/null | head -1 | sed -E "s/^${var}=\"?([^\"]*)\"?\$/\1/")
  if [ -n "$VALUE" ]; then
    ENV_VALUES[$var]="$VALUE"
  fi
done

# Verificar cuáles faltan en Vercel
MISSING_IN_VERCEL=()
for var in "${ENV_VARS_TO_SET[@]}"; do
  if ! vercel env ls "$var" production 2>/dev/null | grep -q "$var"; then
    if [ -n "${ENV_VALUES[$var]}" ]; then
      MISSING_IN_VERCEL+=("$var")
    fi
  fi
done

if [ ${#MISSING_IN_VERCEL[@]} -gt 0 ]; then
  warn "Faltan estas variables en Vercel (las subiremos desde .env):"
  for var in "${MISSING_IN_VERCEL[@]}"; do
    echo "  - $var"
  done
  read -p "¿Subirlas a Vercel ahora? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    for var in "${MISSING_IN_VERCEL[@]}"; do
      log "Subiendo $var..."
      echo "${ENV_VALUES[$var]}" | vercel env add "$var" production preview development 2>/dev/null || true
    done
    log "Variables subidas a Vercel ✅"
  fi
else
  log "Todas las variables ya están en Vercel ✅"
fi

# Deploy preview primero
if [ "$PROD_ONLY" = false ]; then
  info "Haciendo deploy preview..."
  vercel --yes
  log "Deploy preview completado ✅"
fi

# Deploy a producción
info "Haciendo deploy a producción..."
read -p "¿Confirmar deploy a producción (--prod)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  vercel --prod --yes
  log "Deploy a producción completado ✅"
else
  warn "Saltando deploy a producción."
fi

# Obtener URL de producción
PROD_URL=$(vercel ls 2>/dev/null | grep "Ready" | head -1 | awk '{print $2}' || echo "")
if [ -n "$PROD_URL" ]; then
  log "URL de producción: https://$PROD_URL"
fi

# ============================================================
# Step 5: Instrucciones para servicio realtime (Railway)
# ============================================================
step "Step 5: Servicio Realtime (Railway/Render)"

cat << 'RAILWAY_INSTRUCTIONS'

📦 El servicio de WebSockets (Socket.io) NO puede ir en Vercel
   (Vercel es serverless, no soporta conexiones persistentes).

   Debes desplegarlo en Railway o Render. Sigue estos pasos:

   ────────────────────────────────────────────────────────────
   OPCIÓN A: Railway (recomendado, más simple)
   ────────────────────────────────────────────────────────────

   1. Crea cuenta en https://railway.app (login con GitHub)
   2. New Project → Deploy from GitHub repo
   3. Selecciona tu repo y el directorio: mini-services/realtime-service
   4. Railway detecta automáticamente el Dockerfile
   5. En "Variables", añade:
        NEXTAUTH_SECRET    = <mismo valor que en Vercel>
        CORS_ORIGIN        = <URL de tu app en Vercel>
                          (ej: https://control-asistencia.vercel.app)
        NODE_ENV           = production
   6. Railway te dará una URL pública, ej:
        https://control-asistencia-realtime.up.railway.app
   7. Verifica el health check:
        curl https://<tu-url>.up.railway.app/health
        → debe retornar {"status":"ok",...}
   8. En Vercel Dashboard, añade/actualiza:
        REALTIME_SERVICE_URL       = https://<tu-url>.up.railway.app
        NEXT_PUBLIC_REALTIME_URL   = https://<tu-url>.up.railway.app

   ────────────────────────────────────────────────────────────
   OPCIÓN B: Render
   ────────────────────────────────────────────────────────────

   1. Crea cuenta en https://render.com
   2. New + → Web Service → conectar repo GitHub
   3. Root Directory: mini-services/realtime-service
   4. Runtime: Docker
   5. Plan: Starter ($7/mes)
   6. Variables de entorno: mismas que Railway (ver arriba)
   7. URL pública: https://control-asistencia-realtime.onrender.com
   8. Actualiza vars en Vercel (igual que Railway)

RAILWAY_INSTRUCTIONS

read -p "¿Ya desplegaste el servicio realtime? ¿Configurar vars en Vercel? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  read -p "URL del servicio realtime (ej: https://xxx.up.railway.app): " REALTIME_URL_INPUT
  if [ -n "$REALTIME_URL_INPUT" ]; then
    log "Actualizando REALTIME_SERVICE_URL y NEXT_PUBLIC_REALTIME_URL en Vercel..."
    # Borrar existentes
    vercel env rm REALTIME_SERVICE_URL production preview development -y 2>/dev/null || true
    vercel env rm NEXT_PUBLIC_REALTIME_URL production preview development -y 2>/dev/null || true
    # Agregar nuevas
    echo "$REALTIME_URL_INPUT" | vercel env add REALTIME_SERVICE_URL production preview development
    echo "$REALTIME_URL_INPUT" | vercel env add NEXT_PUBLIC_REALTIME_URL production preview development
    log "Variables actualizadas ✅"
    warn "Para que tengan efecto, necesitas redeployar:"
    warn "  vercel --prod --yes"
    read -p "¿Redeployar ahora? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      vercel --prod --yes
      log "Redeploy completado ✅"
    fi
  fi
fi

# ============================================================
# Step 6: Verificación final
# ============================================================
step "Step 6: Verificación final"

# Volver a obtener URL de producción
PROD_URL=$(vercel ls 2>/dev/null | grep "Ready" | head -1 | awk '{print $2}' || echo "")

if [ -z "$PROD_URL" ]; then
  warn "No se pudo obtener la URL de producción automáticamente."
  warn "Búscala en https://vercel.com/dashboard"
  PROD_URL="tu-proyecto.vercel.app"
fi

APP_URL="https://$PROD_URL"

cat << EOF

╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🎉 ¡Deploy completado!                                 ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║   App URL:      $APP_URL
║                                                          ║
║   Health check: $APP_URL/api/health
║   Login:        $APP_URL/
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║   Verificaciones manuales recomendadas:                  ║
║                                                          ║
║   1. Abrir $APP_URL/api/health
║      → debe retornar {"status":"ok","version":"2.2.0"}   ║
║                                                          ║
║   2. Login con admin@control.com / Admin#2025            ║
║      → dashboard debe cargar con 11 items de navegación  ║
║                                                          ║
║   3. Abrir DevTools > Console                            ║
║      → NO debe haber errores de realtime (si configuraste ║
║        Railway correctamente, verás "[realtime] Conectado")║
║                                                          ║
║   4. Probar check-in desde el portal empleado            ║
║      → admin debe ver toast instantáneo (sin polling)    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

📋 Próximos pasos:
   - Configurar MFA TOTP para admins (opcional, recomendado)
     Panel Admin → Configuración → Seguridad → Activar MFA
   - Configurar datos de la empresa (razón social, RFC)
     Panel Admin → Empresa y Feriados
   - Crear usuarios Supervisor si necesitas
     Panel Admin → Usuarios y Roles → Nuevo usuario → Rol: Supervisor

📚 Documentación:
   - Guía completa:      ./DEPLOY.md
   - Variables de entorno: ./.env.example
   - Diagrama del sistema: $APP_URL/diagrama/sistema.html
   - PDF del proyecto:    $APP_URL/Proyecto-Asistencias-v2.2.pdf

EOF

log "Script finalizado."
