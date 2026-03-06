/**
 * Camera Calendar Sync Helper
 * Creates/updates/deletes crm_tasks entries for camera bookings
 * and syncs them to Google Calendar for both agent and comercial users.
 * 
 * IMPORTANT: Camera events in Google Calendar are read-only references.
 * Camera management must be done exclusively from the CRM platform.
 */

import { supabase } from './supabase'
import { auditLog } from './auditLogService'

const CAMERA_EVENT_DESCRIPTION = (booking, adminNotes) => {
    const returnDate = booking.return_date || booking.booking_date
    const isMultiDay = returnDate !== booking.booking_date
    return (
        `📷 Cámara ${booking.camera_unit} — Sesión 360°\n` +
        `📍 ${booking.property_address || 'Sin dirección'}\n` +
        (isMultiDay
            ? `📅 Retiro: ${booking.booking_date} a las ${booking.start_time?.slice(0, 5)}\n` +
            `📅 Devolución: ${returnDate} a las ${booking.end_time?.slice(0, 5)}\n`
            : `🕐 ${booking.start_time?.slice(0, 5)} — ${booking.end_time?.slice(0, 5)}\n`) +
        (booking.notes ? `💬 ${booking.notes}\n` : '') +
        (adminNotes ? `📝 Admin: ${adminNotes}\n` : '') +
        `\n⚠️ NO MOVER NI EDITAR DESDE GOOGLE CALENDAR.\n` +
        `La gestión de la cámara se realiza exclusivamente desde la plataforma CRM RE/MAX.`
    )
}

/**
 * Create CRM tasks for both agent and comercial, then push to Google Calendar
 */
export async function createCameraCalendarEvents(booking, agentId, comercialId, adminNotes = '') {
    const returnDate = booking.return_date || booking.booking_date
    const startDT = `${booking.booking_date}T${booking.start_time}`
    const endDT = `${returnDate}T${booking.end_time}`
    const description = CAMERA_EVENT_DESCRIPTION(booking, adminNotes)

    const taskPayload = (ownerId) => ({
        agent_id: ownerId,
        action: `📷 Cámara 360° — ${booking.property_address || 'Sesión'}`,
        execution_date: startDT,
        end_date: endDT,
        description,
        completed: false,
        task_type: 'event',
        location: booking.property_address,
    })

    try {
        // Create task for agent
        const { data: agentTask, error: agentErr } = await supabase
            .from('crm_tasks')
            .insert(taskPayload(agentId))
            .select('id')
            .single()
        if (agentErr) {
            console.error('Error creating agent task:', agentErr)
            auditLog.error('camera', 'camera.task.create.agent.failed', `Error creando tarea cámara para agente`, {
                module: 'cameraCalendarSync', error_code: agentErr.code,
                details: { bookingId: booking.id, agentId, error: agentErr.message }
            })
        }

        // Create task for comercial
        const { data: comercialTask, error: comercialErr } = await supabase
            .from('crm_tasks')
            .insert(taskPayload(comercialId))
            .select('id')
            .single()
        if (comercialErr) {
            console.error('Error creating comercial task:', comercialErr)
            auditLog.error('camera', 'camera.task.create.comercial.failed', `Error creando tarea cámara para comercial`, {
                module: 'cameraCalendarSync', error_code: comercialErr.code,
                details: { bookingId: booking.id, comercialId, error: comercialErr.message }
            })
        }

        // Save task IDs in booking
        const agentTaskId = agentTask?.id || null
        const comercialTaskId = comercialTask?.id || null
        if (agentTaskId || comercialTaskId) {
            await supabase.from('camera_bookings').update({
                crm_task_id_agent: agentTaskId,
                crm_task_id_comercial: comercialTaskId,
            }).eq('id', booking.id)
        }

        // Push to Google Calendar (fire and forget)
        if (agentTaskId) {
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId, action: 'push_to_google', taskId: agentTaskId }
            }).catch(e => {
                console.error('Google sync agent error:', e)
                auditLog.error('calendar', 'google.sync.agent.failed', `Error sincronizando con Google Calendar (agente)`, {
                    module: 'cameraCalendarSync', details: { taskId: agentTaskId, error: e.message }
                })
            })
        }
        if (comercialTaskId) {
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: comercialId, action: 'push_to_google', taskId: comercialTaskId }
            }).catch(e => {
                console.error('Google sync comercial error:', e)
                auditLog.error('calendar', 'google.sync.comercial.failed', `Error sincronizando con Google Calendar (comercial)`, {
                    module: 'cameraCalendarSync', details: { taskId: comercialTaskId, error: e.message }
                })
            })
        }

        auditLog.info('camera', 'camera.booking.tasks_created', `Tareas de cámara creadas para booking ${booking.id}`, {
            module: 'cameraCalendarSync',
            details: { bookingId: booking.id, agentTaskId, comercialTaskId, address: booking.property_address }
        })

        return { agentTaskId, comercialTaskId }
    } catch (err) {
        console.error('Error in createCameraCalendarEvents:', err)
        auditLog.error('camera', 'camera.booking.create.exception', err.message, {
            module: 'cameraCalendarSync', details: { bookingId: booking.id, error: err.message }
        })
        return { agentTaskId: null, comercialTaskId: null }
    }
}

/**
 * Update CRM tasks when a booking is rescheduled
 */
export async function updateCameraCalendarEvents(booking, agentId, comercialId, newData, adminNotes = '') {
    const mergedBooking = { ...booking, ...newData }
    const returnDate = mergedBooking.return_date || mergedBooking.booking_date
    const startDT = `${mergedBooking.booking_date}T${mergedBooking.start_time}`
    const endDT = `${returnDate}T${mergedBooking.end_time}`
    const description = CAMERA_EVENT_DESCRIPTION(mergedBooking, adminNotes)

    const updatePayload = {
        action: `📷 Cámara 360° — ${mergedBooking.property_address || 'Sesión'}`,
        execution_date: startDT,
        end_date: endDT,
        description,
        location: mergedBooking.property_address,
    }

    try {
        // Update agent task
        if (booking.crm_task_id_agent) {
            await supabase.from('crm_tasks').update(updatePayload).eq('id', booking.crm_task_id_agent)
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId, action: 'push_to_google', taskId: booking.crm_task_id_agent }
            }).catch(e => console.error('Google sync agent error:', e))
        }

        // Update comercial task
        if (booking.crm_task_id_comercial) {
            await supabase.from('crm_tasks').update(updatePayload).eq('id', booking.crm_task_id_comercial)
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: comercialId, action: 'push_to_google', taskId: booking.crm_task_id_comercial }
            }).catch(e => console.error('Google sync comercial error:', e))
        }
    } catch (err) {
        console.error('Error in updateCameraCalendarEvents:', err)
        auditLog.error('camera', 'camera.booking.update.exception', err.message, {
            module: 'cameraCalendarSync', details: { bookingId: booking.id, error: err.message }
        })
    }
}

/**
 * Delete CRM tasks when a booking is cancelled or rejected
 */
export async function deleteCameraCalendarEvents(booking, agentId, comercialId) {
    try {
        // Delete agent task + Google event
        if (booking.crm_task_id_agent) {
            const { data: task } = await supabase.from('crm_tasks')
                .select('google_event_id').eq('id', booking.crm_task_id_agent).single()
            if (task?.google_event_id) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId, action: 'delete_from_google', googleEventId: task.google_event_id }
                }).catch(e => console.error('Google delete agent error:', e))
            }
            await supabase.from('crm_tasks').delete().eq('id', booking.crm_task_id_agent)
        }

        // Delete comercial task + Google event
        if (booking.crm_task_id_comercial) {
            const { data: task } = await supabase.from('crm_tasks')
                .select('google_event_id').eq('id', booking.crm_task_id_comercial).single()
            if (task?.google_event_id) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: comercialId, action: 'delete_from_google', googleEventId: task.google_event_id }
                }).catch(e => console.error('Google delete comercial error:', e))
            }
            await supabase.from('crm_tasks').delete().eq('id', booking.crm_task_id_comercial)
        }

        // Clear refs from booking
        await supabase.from('camera_bookings').update({
            crm_task_id_agent: null,
            crm_task_id_comercial: null,
        }).eq('id', booking.id)
    } catch (err) {
        console.error('Error in deleteCameraCalendarEvents:', err)
        auditLog.error('camera', 'camera.booking.delete.exception', err.message, {
            module: 'cameraCalendarSync', details: { bookingId: booking.id, error: err.message }
        })
    }
}

/**
 * Mark CRM tasks as completed when camera is returned
 */
export async function completeCameraCalendarEvents(booking, agentId, comercialId) {
    try {
        if (booking.crm_task_id_agent) {
            await supabase.from('crm_tasks').update({ completed: true }).eq('id', booking.crm_task_id_agent)
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId, action: 'push_to_google', taskId: booking.crm_task_id_agent }
            }).catch(e => console.error('Google sync agent error:', e))
        }
        if (booking.crm_task_id_comercial) {
            await supabase.from('crm_tasks').update({ completed: true }).eq('id', booking.crm_task_id_comercial)
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: comercialId, action: 'push_to_google', taskId: booking.crm_task_id_comercial }
            }).catch(e => console.error('Google sync comercial error:', e))
        }
    } catch (err) {
        console.error('Error in completeCameraCalendarEvents:', err)
        auditLog.error('camera', 'camera.booking.complete.exception', err.message, {
            module: 'cameraCalendarSync', details: { bookingId: booking.id, error: err.message }
        })
    }
}
