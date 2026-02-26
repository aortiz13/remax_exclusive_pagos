/**
 * Shift/Guard (Turnos/Guardias) Notification Service
 * Sends events to n8n webhook which handles WhatsApp + Gmail delivery
 */

const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/shift-notifications'

const SHIFT_LABELS = { 1: 'Turno 1 (09:00 – 13:00)', 2: 'Turno 2 (13:00 – 18:00)' }

/**
 * Send a shift notification event to n8n
 * @param {string} event - Event type from SHIFT_EVENTS
 * @param {object} shift - Shift booking data
 * @param {object} agent - Agent profile data { name, email, phone }
 * @param {string} adminNotes - Optional admin notes
 * @param {object} extra - Optional extra data
 */
export async function sendShiftNotification(event, shift, agent, adminNotes = '', extra = {}) {
    try {
        const payload = {
            event,
            shift: {
                id: shift.id,
                booking_date: shift.booking_date,
                shift_number: shift.shift,
                shift_label: SHIFT_LABELS[shift.shift] || `Turno ${shift.shift}`,
                status: shift.status,
                agent_notes: shift.agent_notes,
            },
            agent: {
                name: agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim(),
                email: agent.email,
                phone: agent.phone || '',
            },
            admin_notes: adminNotes,
            ...extra,
            timestamp: new Date().toISOString(),
        }

        // Fire and forget — don't block the UI
        fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(err => console.error('Shift notification failed:', err))

    } catch (err) {
        console.error('Error preparing shift notification:', err)
    }
}

/**
 * Event type constants
 */
export const SHIFT_EVENTS = {
    SHIFT_REQUESTED: 'shift_requested',
    SHIFT_APPROVED: 'shift_approved',
    SHIFT_REJECTED: 'shift_rejected',
    SHIFT_CANCELLED: 'shift_cancelled',
    SHIFTS_PUBLISHED: 'shifts_published',
}
