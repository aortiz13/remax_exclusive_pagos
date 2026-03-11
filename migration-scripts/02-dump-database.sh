#!/bin/bash
# ============================================
# Script 2: Dump de la Base de Datos
# Ejecutar LOCALMENTE en tu Mac
# ============================================
# Prerequisito: tener pg_dump instalado
# brew install postgresql@15

set -e

echo "============================================"
echo "  Supabase DB Dump"
echo "============================================"

# ── Configuración ──
SUPABASE_HOST="db.wdyfeolbuogoyngrvxkc.supabase.co"
SUPABASE_PORT="5432"
SUPABASE_USER="postgres"
SUPABASE_DB="postgres"
DUMP_FILE="supabase_full_backup.dump"

echo ""
echo "Host: ${SUPABASE_HOST}"
echo "Database: ${SUPABASE_DB}"
echo "Output: ${DUMP_FILE}"
echo ""
echo "NOTA: Se te va a pedir la contraseña de la DB."
echo "La encontrás en: Supabase Dashboard → Settings → Database → Database password"
echo ""

# ── Dump completo ──
# Excluimos los esquemas internos de Supabase que se recrean automáticamente
pg_dump \
  --host="${SUPABASE_HOST}" \
  --port="${SUPABASE_PORT}" \
  --username="${SUPABASE_USER}" \
  --dbname="${SUPABASE_DB}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --exclude-schema='supabase_*' \
  --exclude-schema='_supavisor' \
  --exclude-schema='_realtime' \
  --exclude-schema='_analytics' \
  --exclude-schema='pgbouncer' \
  --exclude-schema='pgsodium' \
  --exclude-schema='pgsodium_masks' \
  --exclude-schema='vault' \
  --exclude-schema='graphql' \
  --exclude-schema='graphql_public' \
  --exclude-schema='net' \
  --exclude-schema='extensions' \
  --exclude-schema='auth' \
  --exclude-schema='storage' \
  --file="${DUMP_FILE}"

echo ""
echo "✅ Dump completado: ${DUMP_FILE}"
echo "Tamaño: $(du -h ${DUMP_FILE} | cut -f1)"
echo ""

# ── También exportamos el esquema auth y storage por separado ──
echo "Exportando esquema auth..."
pg_dump \
  --host="${SUPABASE_HOST}" \
  --port="${SUPABASE_PORT}" \
  --username="${SUPABASE_USER}" \
  --dbname="${SUPABASE_DB}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --schema='auth' \
  --data-only \
  --file="supabase_auth_data.dump"

echo "✅ Auth data exportada: supabase_auth_data.dump"

echo ""
echo "Exportando datos de storage (metadata, no archivos)..."
pg_dump \
  --host="${SUPABASE_HOST}" \
  --port="${SUPABASE_PORT}" \
  --username="${SUPABASE_USER}" \
  --dbname="${SUPABASE_DB}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --schema='storage' \
  --data-only \
  --file="supabase_storage_metadata.dump"

echo "✅ Storage metadata exportada: supabase_storage_metadata.dump"

echo ""
echo "============================================"
echo "  Archivos generados:"
echo "  1. supabase_full_backup.dump (tablas public)"
echo "  2. supabase_auth_data.dump (usuarios)"
echo "  3. supabase_storage_metadata.dump (metadata archivos)"
echo "============================================"
echo ""
echo "Siguiente paso: subir estos archivos al servidor y restaurar."
