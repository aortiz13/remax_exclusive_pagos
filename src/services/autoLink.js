import { supabase } from './supabase'

/**
 * Auto-links a contact to a property in the property_contacts table
 * if the relationship doesn't already exist.
 * 
 * @param {string} contactId - UUID of the contact
 * @param {string} propertyId - UUID of the property
 * @param {string} role - Role like 'propietario', 'arrendatario', 'vendedor', 'comprador'
 * @param {string} agentId - UUID of the agent creating the link
 */
export async function autoLinkContactProperty(contactId, propertyId, role, agentId) {
    if (!contactId || !propertyId || !role) return

    try {
        // Check if relationship already exists
        const { data: existing } = await supabase
            .from('property_contacts')
            .select('id')
            .eq('contact_id', contactId)
            .eq('property_id', propertyId)
            .eq('role', role)
            .maybeSingle()

        // Only create if it doesn't exist
        if (!existing) {
            await supabase.from('property_contacts').insert({
                contact_id: contactId,
                property_id: propertyId,
                role,
                agent_id: agentId
            })

            // If the role is propietario, also update the property's owner_id
            if (role === 'propietario') {
                await supabase.from('properties')
                    .update({ owner_id: contactId })
                    .eq('id', propertyId)
            }
        }
    } catch (error) {
        // Silently fail - don't block form submission for auto-link
        console.error('Auto-link contact-property failed:', error)
    }
}
