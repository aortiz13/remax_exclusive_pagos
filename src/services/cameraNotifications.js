/**
 * Camera 360° Notification Service
 * Sends events to n8n webhook which handles WhatsApp + Gmail delivery
 */

const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/camera-360-notifications'

/**
 * Send a camera notification event to n8n
 * @param {string} event - Event type
 * @param {object} booking - Booking data
 * @param {object} agent - Agent profile data { name, email, phone }
 * @param {string} adminNotes - Optional admin notes
 * @param {object} extra - Optional extra data
 */
export async function sendCameraNotification(event, booking, agent, adminNotes = '', extra = {}) {
    try {
        const payload = {
            event,
            booking: {
                id: booking.id,
                camera_unit: booking.camera_unit,
                booking_date: booking.booking_date,
                start_time: booking.start_time?.slice(0, 5),
                end_time: booking.end_time?.slice(0, 5),
                property_address: booking.property_address,
                status: booking.status,
                notes: booking.notes,
                is_urgent: booking.is_urgent || false,
                handoff_location: booking.handoff_location,
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
        }).catch(err => console.error('Camera notification failed:', err))

    } catch (err) {
        console.error('Error preparing camera notification:', err)
    }
}

/**
 * Event type constants
 */
export const CAMERA_EVENTS = {
    BOOKING_REQUESTED: 'booking_requested',
    BOOKING_APPROVED: 'booking_approved',
    BOOKING_REJECTED: 'booking_rejected',
    BOOKING_RESCHEDULED: 'booking_rescheduled',
    BOOKING_CANCELLED: 'booking_cancelled',
    URGENT_REQUEST: 'urgent_request',
    PICKUP_CONFIRMED: 'pickup_confirmed',
    RETURN_CONFIRMED: 'return_confirmed',
    EARLY_RETURN: 'early_return',
    RETURN_REMINDER: 'return_reminder',
    LATE_RETURN_ALERT: 'late_return_alert',
    PICKUP_REMINDER: 'pickup_reminder',
    NO_SHOW: 'no_show',
    WAITLIST_AVAILABLE: 'waitlist_available',
    WAITLIST_REQUESTED: 'waitlist_requested',
}
