#!/bin/bash
# ============================================
# Script 3: Restaurar la DB en el servidor self-hosted
# Ejecutar EN EL SERVIDOR (vía SSH)
# ============================================

set -e

echo "============================================"
echo "  Restaurar DB en Supabase Self-Hosted"
echo "============================================"

# ── Configuración ──
# Si estás restaurando en el mismo servidor donde corre docker compose
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
POSTGRES_USER="postgres"
POSTGRES_DB="postgres"

echo ""
echo "Asegurate de que los dumps estén en el directorio actual:"
echo "  - supabase_full_backup.dump"
echo "  - supabase_auth_data.dump"
echo "  - supabase_storage_metadata.dump"
echo ""

read -p "¿Continuar? (s/n): " confirm
if [ "$confirm" != "s" ]; then
  echo "Cancelado."
  exit 0
fi

# ── Paso 1: Restaurar tablas públicas ──
echo ""
echo "[1/3] Restaurando tablas públicas..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --single-transaction \
  supabase_full_backup.dump || true

echo "✅ Tablas públicas restauradas"

# ── Paso 2: Restaurar datos de Auth ──
echo ""
echo "[2/3] Restaurando datos de autenticación..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-owner \
  --no-acl \
  --data-only \
  --single-transaction \
  supabase_auth_data.dump || true

echo "✅ Datos de auth restaurados"

# ── Paso 3: Restaurar metadata de Storage ──
echo ""
echo "[3/3] Restaurando metadata de storage..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-owner \
  --no-acl \
  --data-only \
  --single-transaction \
  supabase_storage_metadata.dump || true

echo "✅ Metadata de storage restaurada"

echo ""
echo "============================================"
echo "  ✅ Restauración completa"
echo "============================================"
echo ""
echo "Verificá la restauración:"
echo "  psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c '\\dt public.*'"
