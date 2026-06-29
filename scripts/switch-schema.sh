#!/usr/bin/env bash
# ============================================================
# switch-schema.sh — Alterna entre SQLite (dev) y PostgreSQL (prod)
# ============================================================
#
# Uso:
#   ./scripts/switch-schema.sh sqlite     # desarrollo local
#   ./scripts/switch-schema.sh postgres   # producción Vercel/Supabase
#   ./scripts/switch-schema.sh status     # mostrar actual
#
# Cómo funciona:
#   - Mantiene dos copias: schema.prisma (activo) y schema.<provider>.prisma
#   - Al cambiar, sobrescribe schema.prisma con el de destino
#   - Ejecuta `prisma generate` automáticamente
# ============================================================

set -e

SCHEMA_FILE="prisma/schema.prisma"
SQLITE_BACKUP="prisma/schema.sqlite.prisma"
PG_BACKUP="prisma/schema.postgres.prisma"

cd "$(dirname "$0")/.."

# Crear backup del schema actual si no existe
ensure_backups() {
  local current_provider
  current_provider=$(grep -E '^\s*provider\s*=' "$SCHEMA_FILE" | head -1 | sed -E 's/.*=\s*"([^"]+)".*/\1/')

  if [ "$current_provider" = "sqlite" ] && [ ! -f "$SQLITE_BACKUP" ]; then
    cp "$SCHEMA_FILE" "$SQLITE_BACKUP"
    echo "📋 Backup de schema SQLite creado: $SQLITE_BACKUP"
  elif [ "$current_provider" = "postgresql" ] && [ ! -f "$PG_BACKUP" ]; then
    cp "$SCHEMA_FILE" "$PG_BACKUP"
    echo "📋 Backup de schema PostgreSQL creado: $PG_BACKUP"
  fi
}

show_status() {
  local current_provider
  current_provider=$(awk '/^datasource db {/,/}/' "$SCHEMA_FILE" | grep -E '^\s*provider\s*=' | head -1 | sed -E 's/.*=\s*"([^"]+)".*/\1/')
  echo "Schema actual: $SCHEMA_FILE"
  echo "  Provider: $current_provider"
  if [ "$current_provider" = "sqlite" ]; then
    echo "  ⚙️  Modo: DESARROLLO LOCAL (SQLite)"
    echo "  💾 DB: $(awk '/^datasource db {/,/}/' "$SCHEMA_FILE" | grep -E '^\s*url\s*=' | sed -E 's/.*=\s*"?([^"]+)"?.*/\1/')"
  else
    echo "  ⚙️  Modo: PRODUCCIÓN (PostgreSQL)"
    echo "  💾 DB: \${DATABASE_URL} (Supabase/Neon/etc)"
  fi
}

switch_to() {
  local target=$1
  local source_file

  if [ "$target" = "sqlite" ]; then
    source_file="$SQLITE_BACKUP"
  elif [ "$target" = "postgres" ]; then
    source_file="$PG_BACKUP"
  else
    echo "❌ Target inválido: $target (usar: sqlite | postgres)"
    exit 1
  fi

  if [ ! -f "$source_file" ]; then
    echo "❌ No existe el backup: $source_file"
    exit 1
  fi

  cp "$source_file" "$SCHEMA_FILE"
  echo "✅ Schema cambiado a: $target"
  echo "   Copiado de: $source_file → $SCHEMA_FILE"

  # Regenerar Prisma Client
  echo "🔄 Regenerando Prisma Client..."
  if command -v bun &> /dev/null; then
    bun run db:generate 2>&1 | tail -3
  else
    npx prisma generate 2>&1 | tail -3
  fi
  echo ""
  show_status
}

# ============================================================
# Main
# ============================================================

case "${1:-status}" in
  sqlite)
    ensure_backups
    switch_to sqlite
    ;;
  postgres|postgresql|pg|prod)
    ensure_backups
    switch_to postgres
    ;;
  status|"")
    show_status
    ;;
  *)
    echo "Uso: $0 {sqlite|postgres|status}"
    exit 1
    ;;
esac
