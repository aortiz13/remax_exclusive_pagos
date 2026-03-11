/**
 * Shift/Guard Calendar Sync Helper
 * Creates/deletes crm_tasks entries for approved guard shifts
 * and syncs them to Google Calendar for BOTH agent and comercial users.
 *
 * Follows the same dual-task pattern as cameraCalendarSync.js.
 *
 * IMPORTANT: Guard shift events in Google Calendar are read-only references.
 * Shift management must be done exclusively from the CRM platform.
 */

import { supabase } from './supabase'
import { auditLog } from './auditLogService'

const SHIFT_CONFIG = {
    1: { label: 'Turno 1', time: '09:00 – 13:00', startTime: '09:00:00', endTime: '13:00:00' },
    2: { label: 'Turno 2', time: '13:00 – 18:00', startTime: '13:00:00', endTime: '18:00:00' },
}

const SHIFT_EVENT_DESCRIPTION = (booking, agentName = '') => {
    const cfg = SHIFT_CONFIG[booking.shift] || SHIFT_CONFIG[1]
    return (
        `🛡️ Turno de Guardia — ${cfg.label}\n` +
        `📅 ${booking.booking_date}\n` +
        `🕐 ${cfg.time}\n` +
        (agentName ? `👤 ${agentName}\n` : '') +
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
 * Create CRM tasks for both agent and comercial when a shift is approved,
 * then push both to Google Calendar.
 * @param {object} booking - The shift_bookings row (must include id, booking_date, shift, agent_notes)
 * @param {string} agentId - The agent's profile ID
 * @param {string} comercialId - The comercial's profile ID (Marinela)
 * @param {string} [agentName] - Agent display name for the event description
 * @returns {{ agentTaskId: string|null, comercialTaskId: string|null }}
 */
export async function createShiftCalendarEvent(booking, agentId, comercialId, agentName = '') {
    const cfg = SHIFT_CONFIG[booking.shift] || SHIFT_CONFIG[1]
    // Build timezone-aware datetimes so 09:00 means 09:00 local, not UTC
    const tzOffset = (() => {
        const d = new Date(`${booking.booking_date}T${cfg.startTime}`)
        const off = -d.getTimezoneOffset()
        const sign = off >= 0 ? '+' : '-'
        const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
        const m = String(Math.abs(off) % 60).padStart(2, '0')
        return `${sign}${h}:${m}`
    })()
    const startDT = `${booking.booking_date}T${cfg.startTime}${tzOffset}`
    const endDT = `${booking.booking_date}T${cfg.endTime}${tzOffset}`
    const description = SHIFT_EVENT_DESCRIPTION(booking, agentName)

    const taskPayload = (ownerId) => ({
        agent_id: ownerId,
        action: `🛡️ Turno de Guardia — ${cfg.label} (${cfg.time})${agentName ? ` · ${agentName}` : ''}`,
        execution_date: startDT,
        end_date: endDT,
        description,
        completed: false,
        task_type: 'event',
    })

    try {
        // Create CRM task for the agent
        const { data: agentTask, error: agentErr } = await supabase
            .from('crm_tasks')
            .insert(taskPayload(agentId))
            .select('id')
            .single()

        if (agentErr) {
            console.error('Error creating agent shift task:', agentErr)
            auditLog.error('system', 'shift.task.create.agent.failed', `Error creando tarea de turno para agente`, {
                module: 'shiftCalendarSync', error_code: agentErr.code,
                details: { bookingId: booking.id, agentId, error: agentErr.message }
            })
        }

        // Create CRM task for the comercial
        const { data: comercialTask, error: comercialErr } = await supabase
            .from('crm_tasks')
            .insert(taskPayload(comercialId))
            .select('id')
            .single()

        if (comercialErr) {
            console.error('Error creating comercial shift task:', comercialErr)
            auditLog.error('system', 'shift.task.create.comercial.failed', `Error creando tarea de turno para comercial`, {
                module: 'shiftCalendarSync', error_code: comercialErr.code,
                details: { bookingId: booking.id, comercialId, error: comercialErr.message }
            })
        }

        // Save task IDs in booking
        const agentTaskId = agentTask?.id || null
        const comercialTaskId = comercialTask?.id || null
        if (agentTaskId || comercialTaskId) {
            await supabase.from('shift_bookings').update({
                crm_task_id: agentTaskId,
                crm_task_id_comercial: comercialTaskId,
            }).eq('id', booking.id)
        }

        // Push to Google Calendar (fire and forget)
        if (agentTaskId) {
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId, action: 'push_to_google', taskId: agentTaskId }
            }).catch(e => {
                console.error('Google sync agent shift error:', e)
                auditLog.error('calendar', 'google.sync.shift.agent.failed', `Error sincronizando turno con Google Calendar (agente)`, {
                    module: 'shiftCalendarSync', details: { taskId: agentTaskId, error: e.message }
                })
            })
        }
        if (comercialTaskId) {
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: comercialId, action: 'push_to_google', taskId: comercialTaskId }
            }).catch(e => {
                console.error('Google sync comercial shift error:', e)
                auditLog.error('calendar', 'google.sync.shift.comercial.failed', `Error sincronizando turno con Google Calendar (comercial)`, {
                    module: 'shiftCalendarSync', details: { taskId: comercialTaskId, error: e.message }
                })
            })
        }

        auditLog.info('system', 'shift.task.created', `Tareas de turno creadas para booking ${booking.id}`, {
            module: 'shiftCalendarSync', details: { bookingId: booking.id, agentTaskId, comercialTaskId, agentId, comercialId }
        })

        return { agentTaskId, comercialTaskId }
    } catch (err) {
        console.error('Error in createShiftCalendarEvent:', err)
        auditLog.error('system', 'shift.create.exception', err.message, {
            module: 'shiftCalendarSync', details: { bookingId: booking.id, error: err.message }
        })
        return { agentTaskId: null, comercialTaskId: null }
    }
}

/**
 * Delete the CRM tasks and Google Calendar events for both agent and comercial
 * when a shift is rejected or cancelled.
 * @param {object} booking - The shift_bookings row (must include id, crm_task_id, crm_task_id_comercial)
 * @param {string} agentId - The agent's profile ID
 * @param {string} comercialId - The comercial's profile ID (Marinela)
 */
export async function deleteShiftCalendarEvent(booking, agentId, comercialId) {
    try {
        // Delete agent task + Google event
        if (booking.crm_task_id) {
            const { data: task } = await supabase
                .from('crm_tasks')
                .select('google_event_id')
                .eq('id', booking.crm_task_id)
                .single()

            if (task?.google_event_id) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId, action: 'delete_from_google', googleEventId: task.google_event_id }
                }).catch(e => console.error('Google delete agent shift error:', e))
            }

            await supabase.from('crm_tasks').delete().eq('id', booking.crm_task_id)
        }

        // Delete comercial task + Google event
        if (booking.crm_task_id_comercial) {
            const { data: task } = await supabase
                .from('crm_tasks')
                .select('google_event_id')
                .eq('id', booking.crm_task_id_comercial)
                .single()

            if (task?.google_event_id) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: comercialId, action: 'delete_from_google', googleEventId: task.google_event_id }
                }).catch(e => console.error('Google delete comercial shift error:', e))
            }

            await supabase.from('crm_tasks').delete().eq('id', booking.crm_task_id_comercial)
        }

        // Clear references from shift_bookings
        await supabase
            .from('shift_bookings')
            .update({ crm_task_id: null, crm_task_id_comercial: null })
            .eq('id', booking.id)
    } catch (err) {
        console.error('Error in deleteShiftCalendarEvent:', err)
        auditLog.error('system', 'shift.delete.exception', err.message, {
            module: 'shiftCalendarSync', details: { bookingId: booking.id, error: err.message }
        })
    }
}
