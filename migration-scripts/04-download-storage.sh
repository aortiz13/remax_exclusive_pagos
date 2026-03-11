#!/bin/bash
# ============================================
# Script 4: Descargar archivos de Storage
# Ejecutar LOCALMENTE en tu Mac
# ============================================
# Descarga todos los archivos de los buckets de Supabase Cloud

set -e

SUPABASE_URL="https://wdyfeolbuogoyngrvxkc.supabase.co"
SERVICE_ROLE_KEY="PEGAR_TU_SERVICE_ROLE_KEY_AQUI"

# Directorio donde guardar los archivos
STORAGE_DIR="./storage_backup"
mkdir -p "${STORAGE_DIR}"

# Buckets a migrar
BUCKETS=("agent_documents" "contracts" "documents" "email_attachments" "mandates" "tutorial-assets")

echo "============================================"
echo "  Descargando archivos de Storage"
echo "============================================"
echo ""
echo "IMPORTANTE: Necesitás tu SERVICE_ROLE_KEY."
echo "La encontrás en Supabase Dashboard → Settings → API → service_role key"
echo ""

for BUCKET in "${BUCKETS[@]}"; do
  echo "── Bucket: ${BUCKET} ──"
  mkdir -p "${STORAGE_DIR}/${BUCKET}"

  # Listar archivos del bucket
  FILES=$(curl -s \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
    -d '{"prefix":"","limit":10000}' \
    -H "Content-Type: application/json" | \
    python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if isinstance(data, list):
        for item in data:
            if item.get('name') and item.get('id'):
                print(item['name'])
except: pass
")

  if [ -z "$FILES" ]; then
    echo "  (vacío o requiere listar subdirectorios)"

    # Intentar listar usando la API de storage con offset
    curl -s \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
      -d '{"prefix":"","limit":10000,"sortBy":{"column":"name","order":"asc"}}' \
      -H "Content-Type: application/json" > "${STORAGE_DIR}/${BUCKET}/_listing.json"

    echo "  Listing guardado en: ${STORAGE_DIR}/${BUCKET}/_listing.json"
    continue
  fi

  COUNT=0
  while IFS= read -r FILE; do
    if [ -n "$FILE" ]; then
      echo "  Descargando: ${FILE}"
      # Crear directorio si el archivo está en un subdirectorio
      FILE_DIR=$(dirname "${FILE}")
      mkdir -p "${STORAGE_DIR}/${BUCKET}/${FILE_DIR}"

      curl -s -o "${STORAGE_DIR}/${BUCKET}/${FILE}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE}"

      COUNT=$((COUNT + 1))
    fi
  done <<< "$FILES"

  echo "  ✅ ${COUNT} archivos descargados"
  echo ""
done

echo "============================================"
echo "  ✅ Backup de Storage completo"
echo "  Directorio: ${STORAGE_DIR}"
echo "  Tamaño: $(du -sh ${STORAGE_DIR} | cut -f1)"
echo "============================================"
echo ""
echo "Siguiente paso: subir esta carpeta al servidor"
echo "  scp -r ${STORAGE_DIR} usuario@servidor:/ruta/supabase/"
