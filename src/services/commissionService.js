import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { extractAddressParts, normalize as normImport } from './adminImportService'

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

                // Log column headers for debugging
                if (raw.length > 0) {
                    console.log('[CommissionParser] Excel columns:', Object.keys(raw[0]))
                }

                const rows = raw.map((r, idx) => {
                    // Flexible column matching — prefers exact match, falls back to includes
                    const pick = (keys) => {
                        const colKeys = Object.keys(r)
                        // 1) exact match first
                        for (const k of colKeys) {
                            const kn = normalize(k)
                            for (const target of keys) {
                                if (kn === normalize(target)) return r[k]
                            }
                        }
                        // 2) includes match
                        for (const k of colKeys) {
                            const kn = normalize(k)
                            for (const target of keys) {
                                if (kn.includes(normalize(target))) return r[k]
                            }
                        }
                        return ''
                    }

                    const montoArriendoRaw = pick(['monto arriendo', 'monto de arriendo'])
                    const comisionAdminRaw = pick(['comision administracion', 'comisión administración', 'comision admin'])
                    const suscripcionLeasityRaw = pick(['suscripcion leasity', 'suscripción leasity'])
                    const estado = String(pick(['estado']) || '').trim().toUpperCase()
                    const etiquetas = String(pick(['etiquetas propiedad', 'etiquetas', 'etiqueta']) || '').trim()
                    const correoAgente = String(pick(['correo agente', 'correo', 'email agente', 'email']) || '').trim()
                    const { agentName, percentage } = parseEtiquetas(etiquetas)

                    // Address: exact "Propiedad" match first, then looser fallbacks
                    const direccion = String(pick(['propiedad', 'direccion', 'dirección', 'direccion propiedad', 'inmueble', 'domicilio']) || '').trim()

                    return {
                        _row: idx + 2,
                        id: String(pick(['id']) || '').trim(),
                        mes: String(pick(['mes', 'periodo', 'período']) || '').trim(),
                        codigo: String(pick(['codigo', 'código']) || '').trim(),
                        id_propiedad: String(pick(['id propiedad']) || '').trim(),
                        direccion,
                        monto_arriendo: parseMoney(montoArriendoRaw),
                        comision_admin: parseMoney(comisionAdminRaw),
                        suscripcion_leasity: parseMoney(suscripcionLeasityRaw),
                        estado,
                        etiquetas,
                        correo_agente: correoAgente,
                        agent_name: agentName,
                        percentage,
                    }
                }).filter(r => r.direccion || r.comision_admin > 0)

                resolve(rows)
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
    })
}

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/**
 * Auto-detect the month from the Excel data
 */
export function detectMonth(rows) {
    for (const row of rows) {
        if (row.mes) {
            // If it's a Date object (Excel dates), format it
            if (row.mes instanceof Date || (typeof row.mes === 'object' && row.mes.getMonth)) {
                return `${months[row.mes.getMonth()]} ${row.mes.getFullYear()}`
            }
            // If it's a string that looks like a date, try to parse
            const str = String(row.mes).trim()
            const dateTest = new Date(str)
            if (!isNaN(dateTest) && str.length > 10) {
                return `${months[dateTest.getMonth()]} ${dateTest.getFullYear()}`
            }
            return str
        }
    }
    // Fallback to current month
    const now = new Date()
    return `${months[now.getMonth()]} ${now.getFullYear()}`
}

// ─── Property Matching ─────────────────────────────────────────
/**
 * Match Excel rows against DB properties by address + depto
 * Returns a Map<direccion, { property, confidence }>
 */
export async function matchCommissionProperties(rows) {
    const { data: properties } = await supabase
        .from('properties')
        .select('id, address, commune, unit_number, status, agent_id')
        .order('address')

    const dbProps = (properties || []).map(p => ({
        ...p,
        _parts: extractAddressParts(p.address || ''),
        _commune: normalize(p.commune || ''),
        _unit: normalize(p.unit_number || ''),
    }))

    const matchMap = {} // key = excel row direccion

    for (const row of rows) {
        if (matchMap[row.direccion]) continue // already matched this address

        const rowParts = extractAddressParts(row.direccion)
        let bestMatch = null
        let bestScore = 0

        for (const prop of dbProps) {
            let score = 0

            // Street name comparison
            if (rowParts.street && prop._parts.street) {
                if (prop._parts.street.includes(rowParts.street) || rowParts.street.includes(prop._parts.street)) {
                    score += 40
                } else {
                    const excelWords = rowParts.street.split(/\s+/).filter(w => w.length > 2)
                    const dbWords = prop._parts.street.split(/\s+/).filter(w => w.length > 2)
                    const commonWords = excelWords.filter(w => dbWords.some(dw => dw.includes(w) || w.includes(dw)))
                    if (commonWords.length > 0) {
                        score += Math.min(35, commonWords.length * 15)
                    }
                }
            }

            // Number comparison
            if (rowParts.number && prop._parts.number && rowParts.number === prop._parts.number) {
                score += 30
            }

            // Depto/unit comparison
            if (rowParts.depto || prop._unit) {
                const normDepto = normalize(rowParts.depto || '')
                const normUnit = normalize(prop._unit || '')
                if (normDepto && normUnit) {
                    if (normUnit.includes(normDepto) || normDepto.includes(normUnit)) {
                        score += 20
                    } else {
                        score -= 15
                    }
                } else if (normDepto && !normUnit) {
                    score -= 5
                }
            }

            if (score > bestScore) {
                bestScore = score
                bestMatch = prop
            }
        }

        if (bestMatch && bestScore >= 50) {
            matchMap[row.direccion] = {
                property: bestMatch,
                confidence: bestScore,
            }
        } else {
            matchMap[row.direccion] = null
        }
    }

    return matchMap
}

// ─── Commission Calculation ────────────────────────────────────

// Valid states for processing (only liquidado variants)
const VALID_STATES = ['LIQUIDADO', 'LIQUIDADO MANUAL']
function isValidState(estado) {
    return VALID_STATES.includes(estado)
}

/**
 * Process rows into agent commission summaries
 * propertyMatches is optional Map from matchCommissionProperties()
 * Returns array of { agentName, email, properties: [], total }
 */
export function processCommissions(rows, propertyMatches = {}) {
    const agentMap = {} // key = agent email (lowercase)

    for (const row of rows) {
        // Only process valid states
        if (!isValidState(row.estado)) continue
        if (!row.agent_name || row.percentage <= 0) continue
        // Skip rows where comision_admin is 0 or negative
        if (row.comision_admin <= 0) continue

        const base = row.comision_admin - row.suscripcion_leasity
        const comision = Math.round(base * (row.percentage / 100))

        const key = normalize(row.correo_agente || row.agent_name)
        if (!agentMap[key]) {
            agentMap[key] = {
                agentName: row.agent_name,
                email: row.correo_agente,
                properties: [],
                total: 0,
            }
        }

        const match = propertyMatches[row.direccion] || null

        agentMap[key].properties.push({
            id: row.id,
            codigo: row.codigo,
            direccion: row.direccion,
            monto_arriendo: row.monto_arriendo,
            comision_admin: row.comision_admin,
            suscripcion_leasity: row.suscripcion_leasity,
            base,
            porcentaje: row.percentage,
            comision,
            // Property match info
            matched: !!match,
            matchConfidence: match?.confidence || 0,
            propertyId: match?.property?.id || null,
            propertyAddress: match?.property?.address || null,
            propertyUnit: match?.property?.unit_number || null,
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
    const noAgent = rows.filter(r => isValidState(r.estado) && (!r.agent_name || r.percentage <= 0))
    const negative = rows.filter(r => isValidState(r.estado) && r.comision_admin < 0)
    const otherStatus = rows.filter(r => !isValidState(r.estado) && r.estado)

    return { noAgent, negative, otherStatus }
}

// ─── Email HTML Builder ───────────────────────────────────────
/**
 * Build a professional HTML email for one agent's commission breakdown
 */
function buildCommissionEmailHTML(agent, month) {
    const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

    const propertyRows = agent.properties.map(p => `
        <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-size:13px;">${p.direccion}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#555;font-size:13px;">${fmt(p.monto_arriendo)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#555;font-size:13px;">${fmt(p.comision_admin)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#e67e22;font-size:13px;">${fmt(p.suscripcion_leasity)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#2980b9;font-size:13px;font-weight:600;">${p.porcentaje}%</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#27ae60;font-weight:bold;font-size:13px;">${fmt(p.comision)}</td>
        </tr>
    `).join('')

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:680px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#003DA5,#0056D6);padding:32px 30px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Liquidación de Comisiones</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${month}</p>
    </div>

    <!-- Greeting -->
    <div style="padding:28px 30px 10px;">
        <p style="margin:0;color:#333;font-size:15px;">Estimado/a <strong>${agent.agentName}</strong>,</p>
        <p style="margin:10px 0 0;color:#555;font-size:14px;line-height:1.6;">
            A continuación encontrará el detalle de su liquidación de comisiones correspondiente al periodo <strong>${month}</strong>.
        </p>
    </div>

    <!-- Table -->
    <div style="padding:10px 30px 20px;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
                <tr style="background:#f0f4ff;">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;font-weight:700;border-bottom:2px solid #d1d5db;">Propiedad</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#666;font-weight:700;border-bottom:2px solid #d1d5db;">Monto Arriendo</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#666;font-weight:700;border-bottom:2px solid #d1d5db;">Comisión Admin</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#666;font-weight:700;border-bottom:2px solid #d1d5db;">Cargo Leasity</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#666;font-weight:700;border-bottom:2px solid #d1d5db;">% Agente</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#666;font-weight:700;border-bottom:2px solid #d1d5db;">Comisión</th>
                </tr>
            </thead>
            <tbody>
                ${propertyRows}
            </tbody>
            <tfoot>
                <tr style="background:#f8fafc;">
                    <td colspan="5" style="padding:14px 12px;font-weight:bold;color:#333;font-size:14px;border-top:2px solid #d1d5db;">Total a Pagar</td>
                    <td style="padding:14px 12px;text-align:right;font-weight:bold;color:#27ae60;font-size:16px;border-top:2px solid #d1d5db;">${fmt(agent.total)}</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 30px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;color:#999;font-size:12px;">
            Este correo fue generado automáticamente. Si tiene alguna consulta, comuníquese con administración.
        </p>
        <p style="margin:8px 0 0;color:#bbb;font-size:11px;">RE/MAX Exclusive — Administración de Propiedades</p>
    </div>
</div>
</body>
</html>`
}

// ─── Send to n8n ──────────────────────────────────────────────
/**
 * Send commission data to n8n webhook for email dispatch
 * Sends pre-built HTML emails so n8n just forwards them
 */
export async function sendCommissionEmails(agents, month) {
    // Build payload with pre-rendered HTML per agent
    const agentsWithHtml = agents.map(agent => ({
        ...agent,
        html: buildCommissionEmailHTML(agent, month),
    }))

    const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, agents: agentsWithHtml }),
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
