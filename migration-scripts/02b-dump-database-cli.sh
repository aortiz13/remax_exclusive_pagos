#!/bin/bash
# ============================================
# Script 2B: Dump con Supabase CLI (MÁS ROBUSTO)
# Ejecutar LOCALMENTE en tu Mac
# ============================================
# Prerequisito: npx supabase (se instala automáticamente)
# NOTA: Este método es más robusto que pg_dump para Supabase

set -e

echo "============================================"
echo "  Supabase DB Dump (via Supabase CLI)"
echo "  Método más robusto y recomendado"
echo "============================================"

# ── Configuración ──
# Obtener la URL de conexión de: Supabase Dashboard → Settings → Database → Connection string → URI
DB_URL="postgresql://postgres:TU_PASSWORD@db.wdyfeolbuogoyngrvxkc.supabase.co:5432/postgres"

echo ""
echo "IMPORTANTE: Editá este script y reemplazá TU_PASSWORD con la contraseña de la DB."
echo "(Supabase Dashboard → Settings → Database → Database password)"
echo ""

DUMP_DIR="./supabase_dumps"
mkdir -p "${DUMP_DIR}"

# ── Paso 1: Exportar roles (usuarios y permisos de DB) ──
echo "[1/4] Exportando roles..."
npx supabase db dump --db-url "${DB_URL}" \
  -f "${DUMP_DIR}/roles.sql" \
  --role-only

echo "✅ Roles exportados: ${DUMP_DIR}/roles.sql"

# ── Paso 2: Exportar esquema (tablas, funciones, triggers, RLS, índices) ──
echo ""
echo "[2/4] Exportando esquema..."
npx supabase db dump --db-url "${DB_URL}" \
  -f "${DUMP_DIR}/schema.sql"

echo "✅ Esquema exportado: ${DUMP_DIR}/schema.sql"

# ── Paso 3: Exportar datos ──
echo ""
echo "[3/4] Exportando datos..."
npx supabase db dump --db-url "${DB_URL}" \
  -f "${DUMP_DIR}/data.sql" \
  --data-only

echo "✅ Datos exportados: ${DUMP_DIR}/data.sql"

# ── Paso 4: Exportar historial de migraciones ──
echo ""
echo "[4/4] Exportando historial de migraciones..."
npx supabase db dump --db-url "${DB_URL}" \
  -f "${DUMP_DIR}/migration_history.sql" \
  --schema supabase_migrations \
  --data-only

echo "✅ Historial de migraciones exportado: ${DUMP_DIR}/migration_history.sql"

echo ""
echo "============================================"
echo "  ✅ Dump completo"
echo "============================================"
echo ""
echo "  Archivos en ${DUMP_DIR}/:"
ls -lh "${DUMP_DIR}/"
echo ""
echo "  Tamaño total: $(du -sh ${DUMP_DIR} | cut -f1)"
echo ""
echo "  Siguiente paso:"
echo "  1. Subir estos archivos al servidor:"
echo "     scp -r ${DUMP_DIR} usuario@IP_SERVIDOR:/ruta/"
echo ""
echo "  2. Restaurar EN ORDEN en la nueva instancia:"
echo "     psql -h HOST -U postgres -d postgres -f roles.sql"
echo "     psql -h HOST -U postgres -d postgres -f schema.sql"
echo "     psql -h HOST -U postgres -d postgres -f data.sql"
echo "     psql -h HOST -U postgres -d postgres -f migration_history.sql"
