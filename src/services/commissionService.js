import * as XLSX from 'xlsx'

// n8n webhook URL for sending commission emails
const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/commission-payment'

// ─── Excel Parsing ─────────────────────────────────────────────
/**
 * Normalize string: lowercase, strip accents, trim
 */
function normalize(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

/**
 * Parse a money string like "$43.519" or "43519" into a number
 */
function parseMoney(val) {
    if (typeof val === 'number') return val
    if (!val) return 0
    const cleaned = String(val)
        .replace(/[$.]/g, '')  // Remove dollar sign and thousands dots
        .replace(/,/g, '.')    // Replace comma decimals with dot
        .trim()
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
}

/**
 * Parse the "Etiquetas" column to extract agent name and percentage
 * Format: "Propiedades, Karina Marmol, 50%" or "Propiedades, Agente Flavia Maciel, 50%"
 * Returns { agentName: string, percentage: number }
 */
function parseEtiquetas(etiquetas) {
    if (!etiquetas) return { agentName: '', percentage: 0 }

    const str = String(etiquetas).trim()

    // Split by comma and look for the percentage
    const parts = str.split(',').map(p => p.trim())

    let agentName = ''
    let percentage = 0

    for (const part of parts) {
        // Check if this part contains a percentage
        const pctMatch = part.match(/([\d.]+)\s*%/)
        if (pctMatch) {
            percentage = parseFloat(pctMatch[1])
            continue
        }
        // Skip generic labels like "Propiedades"
        const norm = normalize(part)
        if (norm === 'propiedades' || norm === 'propiedad' || norm === '') continue
        // Remove "Agente" prefix if present
        agentName = part.replace(/^agente\s+/i, '').trim()
    }

    return { agentName, percentage }
}

/**
 * Parse an Excel/CSV file for commission processing
 * Expected columns: ID, Mes, Codigo, Direccion, Monto Administracion, Estado, Etiquetas, Correo Agente
 */
export function parseCommissionExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
                const sheet = wb.Sheets[wb.SheetNames[0]]
                const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })

                const rows = raw.map((r, idx) => {
                    // Flexible column matching
                    const pick = (keys) => {
                        for (const k of Object.keys(r)) {
                            const kn = normalize(k)
                            for (const target of keys) {
                                if (kn.includes(normalize(target))) return r[k]
                            }
                        }
                        return ''
                    }

                    const montoRaw = pick(['monto administracion', 'monto admin', 'monto de administracion'])
                    const estado = String(pick(['estado']) || '').trim().toUpperCase()
                    const etiquetas = String(pick(['etiquetas', 'etiqueta']) || '').trim()
                    const correoAgente = String(pick(['correo agente', 'correo', 'email agente', 'email']) || '').trim()
                    const { agentName, percentage } = parseEtiquetas(etiquetas)

                    return {
                        _row: idx + 2,
                        id: String(pick(['id']) || '').trim(),
                        mes: String(pick(['mes']) || '').trim(),
                        codigo: String(pick(['codigo', 'código']) || '').trim(),
                        direccion: String(pick(['direccion', 'dirección']) || '').trim(),
                        monto_admin: parseMoney(montoRaw),
                        monto_admin_display: String(montoRaw).trim(),
                        estado,
                        etiquetas,
                        correo_agente: correoAgente,
                        agent_name: agentName,
                        percentage,
                    }
                }).filter(r => r.direccion)

                resolve(rows)
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
    })
}

/**
 * Auto-detect the month from the Excel data
 */
export function detectMonth(rows) {
    for (const row of rows) {
        if (row.mes) return row.mes
    }
    // Fallback to current month
    const now = new Date()
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${months[now.getMonth()]} ${now.getFullYear()}`
}

// ─── Commission Calculation ────────────────────────────────────
const IVA_RATE = 0.19

/**
 * Process rows into agent commission summaries
 * Returns array of { agentName, email, properties: [], total }
 */
export function processCommissions(rows) {
    const agentMap = {} // key = agent email (lowercase)

    for (const row of rows) {
        // Only process LIQUIDADO
        if (row.estado !== 'LIQUIDADO') continue
        if (!row.agent_name || row.percentage <= 0) continue
        if (row.monto_admin <= 0) continue

        const iva = Math.round(row.monto_admin * IVA_RATE)
        const neto = row.monto_admin - iva
        const comision = Math.round(neto * (row.percentage / 100))

        const key = normalize(row.correo_agente || row.agent_name)
        if (!agentMap[key]) {
            agentMap[key] = {
                agentName: row.agent_name,
                email: row.correo_agente,
                properties: [],
                total: 0,
            }
        }

        agentMap[key].properties.push({
            id: row.id,
            codigo: row.codigo,
            direccion: row.direccion,
            monto_admin: row.monto_admin,
            iva,
            neto,
            porcentaje: row.percentage,
            comision,
        })
        agentMap[key].total += comision
    }

    // Convert to sorted array
    return Object.values(agentMap).sort((a, b) => b.total - a.total)
}

// ─── Summary of skipped rows ──────────────────────────────────
/**
 * Get summary of rows that won't be processed
 */
export function getSkippedSummary(rows) {
    const expired = rows.filter(r => r.estado === 'EXPIRADO')
    const noAgent = rows.filter(r => r.estado === 'LIQUIDADO' && (!r.agent_name || r.percentage <= 0))
    const negative = rows.filter(r => r.estado === 'LIQUIDADO' && r.monto_admin < 0)
    const otherStatus = rows.filter(r => r.estado !== 'LIQUIDADO' && r.estado !== 'EXPIRADO' && r.estado)

    return { expired, noAgent, negative, otherStatus }
}

// ─── Send to n8n ──────────────────────────────────────────────
/**
 * Send commission data to n8n webhook for email dispatch
 */
export async function sendCommissionEmails(agents, month) {
    const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, agents }),
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Error enviando comisiones: ${response.status} ${text}`)
    }

    return response.json()
}

// ─── Format helpers ───────────────────────────────────────────
/**
 * Format number as Chilean peso
 */
export function formatCLP(num) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num)
}
