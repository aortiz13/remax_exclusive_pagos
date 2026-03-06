/**
 * Captación Notification Service
 * Sends events to n8n webhook which handles WhatsApp + Email delivery
 */

const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/captacion-vista'
import { auditLog } from './auditLogService'

/**
 * Send a captación-vista notification to n8n
 * @param {object} mandate - Mandate data
 * @param {object} agent - Agent profile { first_name, last_name, email, phone }
 */
export async function sendCaptacionVistaNotification(mandate, agent) {
    try {
        const payload = {
            event: 'captacion_vista',
            mandate: {
                id: mandate.id,
                address: mandate.address,
                commune: mandate.commune,
                region: mandate.region,
                price: mandate.price,
                currency: mandate.currency,
                capture_type: mandate.capture_type,
                operation_type: mandate.operation_type,
                start_date: mandate.start_date,
                capture_end_date: mandate.capture_end_date,
            },
            agent: {
                name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim(),
                email: agent.email,
                phone: agent.phone || '',
            },
            timestamp: new Date().toISOString(),
        }

        fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(() => {
            auditLog.info('crm', 'notification.captacion_vista', `Notificación captación enviada para mandato ${mandate.id}`, {
                module: 'captacionNotifications', details: { mandateId: mandate.id, agentEmail: agent.email }
            })
        }).catch(err => {
            console.error('Captación notification failed:', err)
            auditLog.error('crm', 'notification.captacion_vista.failed', `Error enviando notificación captación: ${err.message}`, {
                module: 'captacionNotifications', details: { mandateId: mandate.id, error: err.message }
            })
        })

    } catch (err) {
        console.error('Error preparing captación notification:', err)
        auditLog.error('crm', 'notification.captacion.exception', err.message, {
            module: 'captacionNotifications', details: { error: err.message }
        })
    }
}
