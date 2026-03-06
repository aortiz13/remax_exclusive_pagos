
import { supabase } from './supabase'
import { auditLog } from './auditLogService'

export const logActivity = async ({
    action, // 'Creó', 'Editó', 'Vinculó'
    entity_type, // 'Propiedad', 'Contacto'
    entity_id,
    description,
    details = {},
    property_id = null,
    contact_id = null
}) => {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        const { error } = await supabase.from('activity_logs').insert({
            actor_id: session.user.id,
            action,
            entity_type,
            entity_id,
            description,
            details,
            property_id,
            contact_id
        })
        if (error) {
            console.error('Error insert activity:', error)
            auditLog.error('crm', `activity.${action}.${entity_type}`, `Error al registrar actividad: ${description}`, {
                module: 'activityService',
                error_code: error.code,
                details: { error: error.message, entity_type, entity_id, action }
            })
        } else {
            auditLog.info('crm', `activity.${action}`, description, {
                module: 'activityService',
                details: { entity_type, entity_id, property_id, contact_id, ...details }
            })
        }
    } catch (err) {
        console.error('Error logging activity:', err)
        auditLog.error('crm', 'activity.exception', `Excepción al registrar actividad: ${err.message}`, {
            module: 'activityService',
            details: { error: err.message, action, entity_type }
        })
    }
}
