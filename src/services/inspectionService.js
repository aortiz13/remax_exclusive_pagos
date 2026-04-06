import { supabase, getCustomPublicUrl } from './supabase'
import { getFormDataForPropertyType } from '../config/inspectionFormTemplates'

const BUCKET = 'inspection-photos'

/**
 * Get a single inspection with related data
 */
export async function getInspection(id) {
    const { data, error } = await supabase
        .from('property_inspections')
        .select(`
            *,
            property:properties(
                id, address, unit_number, commune, m2_total, m2_built, agent_id,
                owner:contacts!properties_owner_id_fkey(id, first_name, last_name, email, phone)
            ),
            agent:profiles!property_inspections_agent_id_fkey(id, first_name, last_name, email, phone),
            schedule:inspection_schedule!property_inspections_schedule_id_fkey(id, scheduled_date)
        `)
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

/**
 * Create a new inspection record
 */
export async function createInspection({ propertyId, scheduleId, agentId }) {
    // Get property data for snapshots
    const { data: property } = await supabase
        .from('properties')
        .select(`
            id, address, commune, status, property_type,
            owner:contacts!properties_owner_id_fkey(first_name, last_name)
        `)
        .eq('id', propertyId)
        .single()

    // Guard: only Administrada properties can have inspections
    if (!property?.status?.includes('Administrada')) {
        throw new Error('Solo las propiedades con estado "Administrada" pueden tener inspecciones')
    }

    // Get tenant from property_contacts
    const { data: tenantContact } = await supabase
        .from('property_contacts')
        .select('contact:contacts(first_name, last_name)')
        .eq('property_id', propertyId)
        .eq('role', 'arrendatario_residente')
        .limit(1)
        .maybeSingle()

    const ownerName = property?.owner
        ? `${property.owner.first_name || ''} ${property.owner.last_name || ''}`.trim()
        : ''
    const tenantName = tenantContact?.contact
        ? `${tenantContact.contact.first_name || ''} ${tenantContact.contact.last_name || ''}`.trim()
        : ''
    const address = property ? `${property.address || ''}${property.commune ? `, ${property.commune}` : ''}` : ''

    // Generate form_data based on property type
    const propertyType = property?.property_type || 'Departamento'
    const formData = getFormDataForPropertyType(propertyType) || getDefaultFormData()

    const { data, error } = await supabase
        .from('property_inspections')
        .insert({
            property_id: propertyId,
            schedule_id: scheduleId || null,
            agent_id: agentId,
            owner_name: ownerName,
            tenant_name: tenantName,
            address,
            form_data: formData,
        })
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Save / update an inspection (auto-save draft)
 */
export async function saveInspection(id, updates) {
    const { data, error } = await supabase
        .from('property_inspections')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Submit an inspection — marks as completed
 */
export async function submitInspection(id) {
    const { data, error } = await supabase
        .from('property_inspections')
        .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error

    // If linked to schedule, mark schedule as completed
    if (data.schedule_id) {
        await supabase
            .from('inspection_schedule')
            .update({ status: 'completed', inspection_id: id })
            .eq('id', data.schedule_id)
    }

    return data
}

/**
 * Mark inspection as sent (after PDF + email)
 */
export async function markInspectionSent(id, pdfUrl) {
    const { data, error } = await supabase
        .from('property_inspections')
        .update({
            status: 'sent',
            pdf_url: pdfUrl,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Upload a photo to inspection-photos bucket
 */
export async function uploadInspectionPhoto(file, inspectionId, section) {
    const ext = file.name.split('.').pop()
    const path = `${inspectionId}/${section}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false })

    if (error) throw error

    const url = getCustomPublicUrl(BUCKET, path)
    return { url, path, section }
}

/**
 * Upload signature (base64 PNG) to storage
 */
export async function uploadSignature(base64Data, inspectionId) {
    // Convert base64 to blob
    const byteCharacters = atob(base64Data.split(',')[1])
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/png' })

    const path = `${inspectionId}/firma_${Date.now()}.png`

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/png', cacheControl: '3600', upsert: true })

    if (error) throw error

    return getCustomPublicUrl(BUCKET, path)
}

/**
 * Get inspection schedule list with property & agent data
 */
export async function getInspectionSchedule(filters = {}) {
    let query = supabase
        .from('inspection_schedule')
        .select(`
            *,
            property:properties(id, address, commune, agent_id, is_office_property),
            agent:profiles(id, first_name, last_name, email),
            inspection:property_inspections!inspection_schedule_inspection_id_fkey(id, status, sent_at)
        `)
        .order('scheduled_date', { ascending: true })

    if (filters.status) {
        query = query.eq('status', filters.status)
    }
    if (filters.agentId) {
        query = query.eq('agent_id', filters.agentId)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
}

/**
 * Get all inspections (for dashboard)
 */
export async function getInspections(filters = {}) {
    let query = supabase
        .from('property_inspections')
        .select(`
            *,
            property:properties(id, address, commune),
            agent:profiles!property_inspections_agent_id_fkey(id, first_name, last_name)
        `)
        .order('created_at', { ascending: false })

    if (filters.status) {
        query = query.eq('status', filters.status)
    }
    if (filters.agentId) {
        query = query.eq('agent_id', filters.agentId)
    }
    if (filters.propertyId) {
        query = query.eq('property_id', filters.propertyId)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
}

/**
 * Default form data structure for a new inspection
 */
/**
 * Default form data — backwards-compatible wrapper
 * New inspections should use getFormDataForPropertyType() from inspectionFormTemplates.js
 */
export function getDefaultFormData() {
    return getFormDataForPropertyType('Departamento')
}

/**
 * Get only Administrada properties (for inspection property picker)
 */
export async function getAdministradaProperties(agentId = null) {
    let query = supabase
        .from('properties')
        .select('id, address, commune, unit_number, property_type, contract_start_date, contract_end_date, agent_id, status')
        .contains('status', ['Administrada'])

    if (agentId) {
        query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query
        .order('address')

    if (error) throw error
    return data || []
}

/**
 * Generate inspection schedule for a single property
 * Creates entries every 6 months from contract_start_date up to contract_end_date
 */
export async function generateInspectionSchedule(propertyId) {
    // Fetch property data
    const { data: property, error: pErr } = await supabase
        .from('properties')
        .select('id, contract_start_date, contract_end_date, last_inspection_date, agent_id, status')
        .eq('id', propertyId)
        .single()

    if (pErr) throw pErr
    if (!property?.status?.includes('Administrada')) return { created: 0, skipped: 'not_administrada' }
    if (!property.contract_start_date && !property.last_inspection_date) return { created: 0, skipped: 'no_start_date' }

    // Use the most recent date between contract_start_date and last_inspection_date
    const contractDate = property.contract_start_date ? new Date(property.contract_start_date + 'T12:00:00') : null
    const inspectionDate = property.last_inspection_date ? new Date(property.last_inspection_date + 'T12:00:00') : null
    let baseDate
    if (contractDate && inspectionDate) {
        baseDate = contractDate > inspectionDate ? contractDate : inspectionDate
    } else {
        baseDate = inspectionDate || contractDate
    }

    const start = baseDate
    const end = property.contract_end_date
        ? new Date(property.contract_end_date + 'T12:00:00')
        : new Date(start.getTime() + 5 * 365 * 24 * 60 * 60 * 1000) // default: 5 years if no end

    // Generate dates every 6 months
    const dates = []
    let cursor = new Date(start)
    cursor.setMonth(cursor.getMonth() + 6) // first inspection is 6 months after base date
    while (cursor <= end) {
        dates.push(cursor.toISOString().split('T')[0])
        cursor = new Date(cursor)
        cursor.setMonth(cursor.getMonth() + 6)
    }

    if (dates.length === 0) return { created: 0, skipped: 'no_dates_in_range' }

    // Fetch existing schedules to avoid duplicates
    const { data: existing } = await supabase
        .from('inspection_schedule')
        .select('scheduled_date')
        .eq('property_id', propertyId)

    const existingDates = new Set((existing || []).map(e => e.scheduled_date))
    const newEntries = dates
        .filter(d => !existingDates.has(d))
        .map(d => ({
            property_id: propertyId,
            agent_id: property.agent_id || null,
            scheduled_date: d,
            status: 'pending',
        }))

    if (newEntries.length === 0) return { created: 0, skipped: 'all_exist' }

    const { error } = await supabase.from('inspection_schedule').insert(newEntries)
    if (error) throw error

    return { created: newEntries.length }
}

/**
 * Sync schedules for ALL Administrada properties that have contract dates
 * Returns a summary of what was generated
 */
export async function syncAllAdministradaSchedules() {
    const properties = await getAdministradaProperties()
    const results = { total: properties.length, generated: 0, skipped: 0, errors: [] }

    for (const prop of properties) {
        try {
            const result = await generateInspectionSchedule(prop.id)
            results.generated += result.created
            if (result.skipped) results.skipped++
        } catch (err) {
            results.errors.push({ propertyId: prop.id, address: prop.address, error: err.message })
        }
    }

    return results
}

/**
 * Create a public inspection for an office property (external inspector, no auth)
 * Returns the inspection with its public_token
 */
export async function createPublicInspection(propertyId, agentId = null) {
    // Generate a UUID token
    const token = crypto.randomUUID()

    const { data: property } = await supabase
        .from('properties')
        .select('id, address, commune, unit_number, property_type')
        .eq('id', propertyId)
        .single()

    const address = property ? `${property.address || ''}${property.commune ? `, ${property.commune}` : ''}` : ''

    // Get property type for the right form template
    const propertyType = property?.property_type || 'Departamento'
    const formData = getFormDataForPropertyType(propertyType) || getDefaultFormData()

    const { data, error } = await supabase
        .from('property_inspections')
        .insert({
            property_id: propertyId,
            agent_id: agentId,
            address,
            public_token: token,
            form_data: formData,
            status: 'pending',
        })
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Get the public URL for an inspection token
 */
export function getPublicInspectionUrl(token) {
    return `${window.location.origin}/inspeccion-publica/${token}`
}

/**
 * Get inspection by public token (no auth needed)
 */
export async function getInspectionByToken(token) {
    const { data, error } = await supabase
        .from('property_inspections')
        .select('*, properties(address, commune, unit_number)')
        .eq('public_token', token)
        .single()

    if (error) throw error
    return data
}
