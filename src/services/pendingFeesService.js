import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { auditLog } from './auditLogService'

// n8n webhook URL for sending pending fee notifications
const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/pending-fees'

// ─── Excel Parsing ─────────────────────────────────────────────

/**
 * Parse the pending fees Excel file
 * Expected structure:
 *   Row 1: blank
 *   Row 2: "Cuotas Pendientes Oficina por Agente"
 *   Row 4: header row — #, Nombre Agente, Correo Electronico, [Month1], [Month2], ..., Total
 *   Row 5+: agent data
 *   Last row: TOTALES
 *
 * Returns { months: string[], agents: AgentFee[] }
 */
export function parsePendingFeesExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' })
                const sheet = wb.Sheets[wb.SheetNames[0]]
                const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

                if (raw.length < 5) {
                    throw new Error('El archivo no tiene suficientes filas')
                }

                // Find the header row (contains "Nombre Agente" or similar)
                let headerRowIdx = -1
                for (let i = 0; i < Math.min(10, raw.length); i++) {
                    const rowStr = (raw[i] || []).map(c => String(c).toLowerCase()).join('|')
                    if (rowStr.includes('nombre') && rowStr.includes('agente')) {
                        headerRowIdx = i
                        break
                    }
                }
                if (headerRowIdx === -1) {
                    throw new Error('No se encontró la fila de encabezados (Nombre Agente)')
                }

                const headers = raw[headerRowIdx].map(h => String(h).trim())

                // Find column indices
                const nameColIdx = headers.findIndex(h => /nombre/i.test(h) && /agente/i.test(h))
                const emailColIdx = headers.findIndex(h => /correo/i.test(h) || /email/i.test(h))
                const totalColIdx = headers.findIndex(h => /^total$/i.test(h))

                if (nameColIdx === -1) throw new Error('No se encontró la columna "Nombre Agente"')
                if (totalColIdx === -1) throw new Error('No se encontró la columna "Total"')

                // Month columns are between email/name and total
                const monthStartIdx = Math.max(nameColIdx, emailColIdx) + 1
                const months = []
                for (let i = monthStartIdx; i < totalColIdx; i++) {
                    if (headers[i]) months.push(headers[i])
                }

                // Parse agent rows
                const agents = []
                for (let i = headerRowIdx + 1; i < raw.length; i++) {
                    const row = raw[i]
                    if (!row || row.length === 0) continue

                    const name = String(row[nameColIdx] || '').trim()
                    if (!name || /^total/i.test(name)) continue // Skip empty and TOTALES row

                    const email = String(row[emailColIdx] || '').trim()
                    const totalFromExcel = parseMoneyValue(row[totalColIdx])

                    // Parse monthly amounts and calculate a local total
                    const monthlyAmounts = {}
                    let calculatedTotal = 0
                    for (let m = 0; m < months.length; m++) {
                        const colIdx = monthStartIdx + m
                        const amount = parseMoneyValue(row[colIdx])
                        monthlyAmounts[months[m]] = amount
                        calculatedTotal += amount
                    }

                    // Use calculated total if it is > 0, otherwise fallback to excel total
                    // This fixes cases where the Excel's "Total" column is 0 despite having monthly amounts
                    const finalTotal = calculatedTotal > 0 ? calculatedTotal : totalFromExcel

                    agents.push({
                        _row: i + 1,
                        name,
                        email,
                        months: monthlyAmounts,
                        total: finalTotal,
                        hasPendingFees: finalTotal > 0,
                    })
                }

                console.log('[PendingFees] Parsed:', agents.length, 'agents,', months.length, 'months')
                resolve({ months, agents })
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
    })
}

/**
 * Parse a money value — handles numbers, strings like "$43.519", "94.688", etc
 */
function parseMoneyValue(val) {
    if (typeof val === 'number') return Math.round(val)
    if (!val) return 0
    const cleaned = String(val)
        .replace(/[$\s]/g, '')
        .replace(/\./g, '') // thousands separator
        .replace(/,/g, '.') // decimal separator
        .trim()
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : Math.round(num)
}

// ─── Agent Phone Lookup ────────────────────────────────────────

/**
 * Look up agent phone numbers from the profiles table
 * Returns a Map<normalizedEmail, { phone, fullName }>
 */
export async function lookupAgentPhones(agents) {
    const { data: profiles } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone, role')
        .eq('role', 'agent')

    if (!profiles || profiles.length === 0) return {}

    const phoneMap = {}

    for (const agent of agents) {
        if (!agent.email) continue

        const normEmail = agent.email.toLowerCase().trim()
        const match = profiles.find(p => p.email?.toLowerCase().trim() === normEmail)

        if (match) {
            phoneMap[normEmail] = {
                phone: match.phone || '',
                fullName: `${match.first_name || ''} ${match.last_name || ''}`.trim(),
            }
        }
    }

    console.log('[PendingFees] Phone lookups:', Object.keys(phoneMap).length, '/', agents.length)
    return phoneMap
}

// ─── Format Helpers ────────────────────────────────────────────

/**
 * Format number as Chilean peso (no decimals)
 */
export function formatCLP(num) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num)
}

/**
 * Format number with thousands separator (no $ sign)
 */
function formatNumber(num) {
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(num)
}

// ─── Email HTML Builder ───────────────────────────────────────

/**
 * Build the pending fees email HTML matching the current format:
 * - Greeting with agent name
 * - Reminder about pending office fees
 * - Table showing only months with amounts > 0 and the total
 * - Payment instructions (Leasity + bank transfer)
 * - Receipt request
 */
export function buildPendingFeeEmailHTML(agent, months) {
    // Filter months with amounts > 0
    const activeMonths = months.filter(m => (agent.months[m] || 0) > 0)

    // Build the month headers
    const monthHeaders = activeMonths.map(m =>
        `<th style="padding:8px 14px;text-align:center;font-size:13px;font-weight:600;color:#333;border-bottom:2px solid #ddd;">${m}</th>`
    ).join('')

    // Build the month values
    const monthValues = activeMonths.map(m => {
        const val = agent.months[m] || 0
        return `<td style="padding:10px 14px;text-align:center;font-size:14px;color:#333;border-bottom:1px solid #eee;">${formatNumber(val)}</td>`
    }).join('')

    // Total cell with red background when > 0
    const totalStyle = agent.total > 0
        ? 'background:#e53e3e;color:#fff;font-weight:bold;'
        : 'color:#333;font-weight:bold;'

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:680px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#003DA5,#0056D6);padding:32px 30px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Cuotas Pendientes de Oficina</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Recordatorio de pago</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 30px;">
        <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.7;">
            Buenos días <strong>${agent.name}</strong>,
        </p>
        <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.7;">
            Por medio de la presente queremos recordarte que tienes pendiente las cuotas de la oficina según detalle, cuotas que deben ser canceladas los primeros cinco días de cada mes y te solicitamos regularizar esta situación lo más pronto posible.
        </p>

        <!-- Fees Table -->
        <div style="overflow-x:auto;margin-bottom:24px;">
            <table style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                    <tr style="background:#f0f4ff;">
                        ${monthHeaders}
                        <th style="padding:8px 14px;text-align:center;font-size:13px;font-weight:700;color:#333;border-bottom:2px solid #ddd;background:#f8d7da;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        ${monthValues}
                        <td style="padding:10px 14px;text-align:center;font-size:15px;border-bottom:1px solid #eee;${totalStyle}">${formatNumber(agent.total)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Importance message -->
        <div style="margin:24px 0;padding:16px;background-color:#fdf2f2;border-left:4px solid #de350b;border-radius:4px;">
            <p style="margin:0 0 12px;color:#333;font-size:13px;line-height:1.6;font-weight:bold;">
                IMPORTANTE:
            </p>
            <p style="margin:0 0 12px;color:#444;font-size:13px;line-height:1.6;">
                El pago de la cuota mensual es una obligación establecida desde el inicio de la asociación con la oficina. Esta cuota permite costear los servicios y herramientas que se ponen a disposición de cada agente para el desarrollo de su negocio, tales como formar parte de la red inmobiliaria más grande de Chile y del mundo, acceso a espacio de trabajo, plataformas tecnológicas, soporte administrativo y comercial, coaching personalizado, implementación de tecnologías de vanguardia para el soporte y automatización de la gestión del agente, capacitaciones, eventos, refrigerios e inversión constante en nuevas herramientas y servicios, entre muchos otros.
            </p>
            <p style="margin:0;color:#444;font-size:13px;line-height:1.6;">
                Mantener esta cuota al día es fundamental para el correcto funcionamiento de la oficina y para asegurar la continuidad de los servicios disponibles para todos los agentes.
            </p>
        </div>

        <!-- Payment Instructions -->
        <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.7;">
            Si no realizas el pago a través de la plataforma Leasity, los datos para realizar la transferencia o depósito bancario son: 
            <strong>Cuenta Corriente del Banco Estado Número 34700039899</strong> a nombre de 
            <strong>Grupo Exclusive SPA</strong>, RUT <strong>76.834.757-3</strong>, EMAIL: 
            <a href="mailto:info@remax-exclusive.cl" style="color:#003DA5;text-decoration:none;font-weight:600;">info@remax-exclusive.cl</a>.
        </p>

        <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.7;">
            Una vez que realices el pago, agradeceré me puedas enviar copia del comprobante del mismo para poder ingresarla en nuestros registros.
        </p>

        <p style="margin:0 0 0;color:#555;font-size:13px;line-height:1.7;font-style:italic;">
            <strong>Nota:</strong> En caso de que ya hayas realizado el pago mediante transferencia, te agradecería que pudieras compartir el comprobante correspondiente, a fin de registrar correctamente el abono y mantener tu cuenta al día.
        </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 30px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;color:#999;font-size:12px;">
            Este correo fue generado automáticamente. Si tiene alguna consulta, comuníquese con administración.
        </p>
        <p style="margin:8px 0 0;color:#bbb;font-size:11px;">RE/MAX Exclusive — Sistema Automatizado</p>
    </div>
</div>
</body>
</html>`
}

// ─── WhatsApp Message Builder ─────────────────────────────────

/**
 * Build a WhatsApp text message for pending fees
 */
export function buildWhatsAppMessage(agent, months) {
    const activeMonths = months.filter(m => (agent.months[m] || 0) > 0)
    const monthDetails = activeMonths.map(m => `  • ${m}: $${formatNumber(agent.months[m])}`).join('\n')

    return `Hola ${agent.name} 👋

Te recordamos que tienes *cuotas pendientes de la oficina* por un total de *$${formatNumber(agent.total)}*:

${monthDetails}

Las cuotas deben ser canceladas los primeros 5 días de cada mes. Puedes pagar a través de Leasity o por transferencia a:
📌 Cta. Cte. Banco Estado N° 34700039899
📌 Grupo Exclusive SPA
📌 RUT 76.834.757-3
📌 Email: info@remax-exclusive.cl

Una vez realizado el pago, por favor envía el comprobante. ¡Gracias! 🙏`
}

// ─── Send to n8n ──────────────────────────────────────────────

/**
 * Send pending fees data to n8n webhook for email + WhatsApp dispatch
 * @param {Array} agents - Array of agent fee objects with html and whatsapp_message
 * @param {boolean} sendWhatsApp - Whether to also send WhatsApp
 */
export async function sendPendingFeeNotifications(agents, sendWhatsApp = true) {
    const payload = {
        send_whatsapp: sendWhatsApp,
        agents: agents.map(a => ({
            name: a.name,
            email: a.email,
            phone: a.phone || '',
            html: a.html,
            total: a.total,
            months: a.months,
            whatsapp_message: a.whatsapp_message || '',
        })),
    }

    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Error enviando cuotas: ${response.status} ${text}`)
        }

        auditLog.info('admin', 'pending-fees.sent', `Cuotas pendientes enviadas a ${agents.length} agentes`, {
            module: 'pendingFeesService',
            details: {
                agentCount: agents.length,
                totalAmount: agents.reduce((s, a) => s + a.total, 0),
                whatsappEnabled: sendWhatsApp,
            }
        })

        return response.json()
    } catch (err) {
        auditLog.error('admin', 'pending-fees.send.failed', err.message, {
            module: 'pendingFeesService',
            details: { error: err.message, agentCount: agents.length }
        })
        throw err
    }
}
