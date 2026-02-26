// ============================================================
// CÓDIGO ACTUALIZADO para el nodo "renombrarpdf" del workflow
// "Envío de mandatos" en n8n
// ============================================================
// CAMBIO: Ahora descarga archivos desde URLs de Supabase Storage
// en vez de decodificar base64 del payload del webhook.
// ============================================================

// 1. OBTENER DATOS
const data = $('Webhook').first().json.body || items[0].json;
const archivosArray = data.archivos || [];

// Asegurar que existe el objeto binary
if (!items[0].binary) {
    items[0].binary = {};
}

// 2. ELIMINAR EL HTML (index) del paso anterior
if (items[0].binary && items[0].binary.index) {
    delete items[0].binary.index;
}

// 3. FUNCIÓN PARA DETECTAR TIPO DE ARCHIVO
function detectarTipoArchivo(mimeType, fileName) {
    const mimeMap = {
        'application/pdf': { ext: 'pdf', mime: 'application/pdf' },
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        'application/msword': { ext: 'doc', mime: 'application/msword' },
        'image/png': { ext: 'png', mime: 'image/png' },
        'image/jpeg': { ext: 'jpg', mime: 'image/jpeg' },
        'image/webp': { ext: 'webp', mime: 'image/webp' },
        'text/plain': { ext: 'txt', mime: 'text/plain' },
        'text/csv': { ext: 'csv', mime: 'text/csv' }
    };

    if (mimeMap[mimeType]) return mimeMap[mimeType];

    // Fallback: intentar deducir por extensión del nombre
    if (fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const extMap = {
            'pdf': { ext: 'pdf', mime: 'application/pdf' },
            'docx': { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
            'xlsx': { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            'doc': { ext: 'doc', mime: 'application/msword' },
            'png': { ext: 'png', mime: 'image/png' },
            'jpg': { ext: 'jpg', mime: 'image/jpeg' },
            'jpeg': { ext: 'jpeg', mime: 'image/jpeg' },
            'webp': { ext: 'webp', mime: 'image/webp' },
        };
        if (extMap[ext]) return extMap[ext];
    }

    return { ext: 'bin', mime: 'application/octet-stream' };
}

// 4. DESCARGAR ARCHIVOS DESDE URLs Y ASIGNARLOS COMO BINARIOS
let binaryIndex = 0;

for (const archivo of archivosArray) {
    // Saltar archivos HTML (legacy filter)
    if (archivo.nombre === 'index.html' || archivo.tipo === 'text/html' || (archivo.nombre && archivo.nombre.endsWith('.html'))) {
        continue;
    }

    // Necesitamos una URL válida
    if (!archivo.url) continue;

    try {
        // Descargar el archivo desde la URL firmada de Supabase
        const response = await fetch(archivo.url);

        if (!response.ok) {
            console.log(`Error descargando ${archivo.nombre}: HTTP ${response.status}`);
            continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');

        const infoArchivo = detectarTipoArchivo(archivo.tipo, archivo.nombre);

        // Definir nombre
        let fileName = archivo.nombre || `archivo_${binaryIndex + 1}`;

        // Corregir extensión si falta
        if (!fileName.toLowerCase().endsWith('.' + infoArchivo.ext)) {
            fileName = `${fileName}.${infoArchivo.ext}`;
        }

        const binaryKey = `attachment_${binaryIndex}`;

        // Asignar al item binario
        items[0].binary[binaryKey] = {
            data: base64Data,
            mimeType: infoArchivo.mime,
            fileName: fileName,
            fileExtension: infoArchivo.ext
        };

        binaryIndex++;
    } catch (err) {
        console.log(`Error procesando archivo ${archivo.nombre}: ${err.message}`);
    }
}

return items;
