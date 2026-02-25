import { supabase } from './supabase'

/**
 * Updates a CRM contact with data filled in during a request submission.
 * Only updates fields that have a non-empty value, so existing contact data
 * is never overwritten with blanks.
 *
 * @param {string} contactId - The CRM contact UUID
 * @param {Object} fieldsMap - Map of { contactColumn: requestValue }
 * @param {string[]} [excludeFields] - Column names the agent opted out of syncing
 */
export async function updateContactFromRequestData(contactId, fieldsMap, excludeFields = []) {
    if (!contactId) return

    // Filter out empty/null/undefined values — only sync non-empty data
    // Also skip any fields the agent explicitly excluded
    const updates = {}
    for (const [column, value] of Object.entries(fieldsMap)) {
        if (excludeFields.includes(column)) continue
        if (value && String(value).trim()) {
            updates[column] = String(value).trim()
        }
    }

    if (Object.keys(updates).length === 0) return

    updates.updated_at = new Date().toISOString()

    try {
        const { error } = await supabase
            .from('contacts')
            .update(updates)
            .eq('id', contactId)

        if (error) {
            console.error('[contactSync] Error updating contact:', error)
        }
    } catch (err) {
        // Non-blocking: request submission should succeed even if sync fails
        console.error('[contactSync] Exception updating contact:', err)
    }
}

/**
 * Parses a full name string into first and last name.
 * E.g., "Juan Pérez García" → { first: "Juan", last: "Pérez García" }
 */
function parseFullName(fullName) {
    if (!fullName) return { first: '', last: '' }
    const parts = fullName.trim().split(/\s+/)
    const first = parts[0] || ''
    const last = parts.slice(1).join(' ') || ''
    return { first, last }
}

/**
 * Syncs Dueño (owner) contact fields from the arriendo request form.
 */
export function buildDueñoContactFields(formData) {
    const parsed = parseFullName(formData.dueñoNombre)
    return {
        first_name: parsed.first,
        last_name: parsed.last,
        rut: formData.dueñoRut,
        email: formData.dueñoEmail,
        phone: formData.dueñoTelefono,
        address: formData.dueñoDireccion,
        barrio_comuna: formData.dueñoComuna,
        bank_name: formData.bancoNombre,
        bank_account_type: formData.bancoTipoCuenta,
        bank_account_number: formData.bancoNroCuenta,
    }
}

/**
 * Syncs Arrendatario (tenant) contact fields from the arriendo request form.
 */
export function buildArrendatarioContactFields(formData) {
    return {
        first_name: formData.arrendatarioNombre,
        last_name: formData.arrendatarioApellido,
        rut: formData.arrendatarioRut,
        email: formData.arrendatarioEmail,
        phone: formData.arrendatarioTelefono,
        address: formData.arrendatarioDireccion,
        barrio_comuna: formData.arrendatarioComuna,
    }
}

/**
 * Syncs Vendedor/Dueño (Parte A) contact fields from the honorarios request form.
 */
export function buildParteAContactFields(formData, isVenta) {
    const prefix = isVenta ? 'vendedor' : 'dueño'
    const parsed = parseFullName(formData[`${prefix}Nombre`])
    return {
        first_name: parsed.first,
        last_name: parsed.last,
        rut: formData[`${prefix}Rut`],
        email: formData[`${prefix}Email`],
        phone: formData[`${prefix}Telefono`],
        address: formData[`${prefix}Direccion`],
        barrio_comuna: formData[`${prefix}Comuna`],
    }
}

/**
 * Syncs Comprador/Arrendatario (Parte B) contact fields from the honorarios request form.
 */
export function buildParteBContactFields(formData, isVenta) {
    const prefix = isVenta ? 'comprador' : 'arrendatario'
    const parsed = parseFullName(formData[`${prefix}Nombre`])
    return {
        first_name: parsed.first,
        last_name: parsed.last,
        rut: formData[`${prefix}Rut`],
        email: formData[`${prefix}Email`],
        phone: formData[`${prefix}Telefono`],
        address: formData[`${prefix}Direccion`],
        barrio_comuna: formData[`${prefix}Comuna`],
    }
}
