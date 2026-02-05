
import { supabase } from './supabase'

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('activity_logs').insert({
            actor_id: user.id,
            action,
            entity_type,
            entity_id,
            description,
            details,
            property_id,
            contact_id
        })
        if (error) console.error('Error insert activity:', error)
    } catch (err) {
        console.error('Error logging activity:', err)
    }
}
