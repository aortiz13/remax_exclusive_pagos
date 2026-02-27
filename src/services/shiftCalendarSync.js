/**
 * Shift/Guard Calendar Sync Helper
 * Creates/deletes crm_tasks entries for approved guard shifts
 * and syncs them to Google Calendar via the google-calendar-sync edge function.
 *
 * Follows the same pattern as cameraCalendarSync.js.
 *
 * IMPORTANT: Guard shift events in Google Calendar are read-only references.
 * Shift management must be done exclusively from the CRM platform.
 */

import { supabase } from './supabase'

const SHIFT_CONFIG = {
    1: { label: 'Turno 1', time: '09:00 – 13:00', startTime: '09:00:00', endTime: '13:00:00' },
    2: { label: 'Turno 2', time: '13:00 – 18:00', startTime: '13:00:00', endTime: '18:00:00' },
}

const SHIFT_EVENT_DESCRIPTION = (booking) => {
    const cfg = SHIFT_CONFIG[booking.shift] || SHIFT_CONFIG[1]
    return (
        `🛡️ Turno de Guardia — ${cfg.label}\n` +
        `📅 ${booking.booking_date}\n` +
        `🕐 ${cfg.time}\n` +
        (booking.agent_notes ? `💬 ${booking.agent_notes}\n` : '') +
        `\n📋 Responsabilidades:\n` +
        `• Atender leads asignados durante el turno\n` +
        `• Mantener informado al staff comercial\n` +
        `• Ingresar captaciones nuevas\n` +
        `\n⚠️ NO MOVER NI EDITAR DESDE GOOGLE CALENDAR.\n` +
        `La gestión de turnos se realiza exclusivamente desde la plataforma CRM RE/MAX.`
    )
}

/**
 * Create a CRM task for the agent when a shift is approved, then push to Google Calendar.
 * @param {object} booking - The shift_bookings row (must include id, booking_date, shift, agent_notes)
 * @param {string} agentId - The agent's profile ID
 * @returns {string|null} The created crm_task ID, or null on failure
 */
export async function createShiftCalendarEvent(booking, agentId) {
    const cfg = SHIFT_CONFIG[booking.shift] || SHIFT_CONFIG[1]
    const startDT = `${booking.booking_date}T${cfg.startTime}`
    const endDT = `${booking.booking_date}T${cfg.endTime}`
    const description = SHIFT_EVENT_DESCRIPTION(booking)

    const taskPayload = {
        agent_id: agentId,
        action: `🛡️ Turno de Guardia — ${cfg.label} (${cfg.time})`,
        execution_date: startDT,
        end_date: endDT,
        description,
        completed: false,
        task_type: 'event',
    }

    try {
        // Create CRM task for the agent
        const { data: task, error: taskErr } = await supabase
            .from('crm_tasks')
            .insert(taskPayload)
            .select('id')
            .single()

        if (taskErr) {
            console.error('Error creating shift calendar task:', taskErr)
            return null
        }

        const taskId = task?.id
        if (!taskId) return null

        // Link task ID back to the shift booking
        await supabase
            .from('shift_bookings')
            .update({ crm_task_id: taskId })
            .eq('id', booking.id)

        // Push to Google Calendar (fire and forget)
        supabase.functions.invoke('google-calendar-sync', {
            body: { agentId, action: 'push_to_google', taskId }
        }).catch(e => console.error('Google sync shift error:', e))

        return taskId
    } catch (err) {
        console.error('Error in createShiftCalendarEvent:', err)
        return null
    }
}

/**
 * Delete the CRM task and Google Calendar event when a shift is rejected or cancelled.
 * @param {object} booking - The shift_bookings row (must include id, crm_task_id)
 * @param {string} agentId - The agent's profile ID
 */
export async function deleteShiftCalendarEvent(booking, agentId) {
    if (!booking.crm_task_id) return

    try {
        // Read google_event_id from the task before deleting
        const { data: task } = await supabase
            .from('crm_tasks')
            .select('google_event_id')
            .eq('id', booking.crm_task_id)
            .single()

        // Delete from Google Calendar if it was synced
        if (task?.google_event_id) {
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId, action: 'delete_from_google', googleEventId: task.google_event_id }
            }).catch(e => console.error('Google delete shift error:', e))
        }

        // Delete the CRM task
        await supabase
            .from('crm_tasks')
            .delete()
            .eq('id', booking.crm_task_id)

        // Clear the reference from shift_bookings
        await supabase
            .from('shift_bookings')
            .update({ crm_task_id: null })
            .eq('id', booking.id)
    } catch (err) {
        console.error('Error in deleteShiftCalendarEvent:', err)
    }
}
