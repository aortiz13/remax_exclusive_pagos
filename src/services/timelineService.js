import { supabase } from './supabase'

/**
 * Unified Timeline Service
 * Aggregates events from all CRM data sources into a single sorted timeline.
 */

// ── Fetch helpers ──────────────────────────────────────────────

async function fetchActions(contactId, propertyId) {
    let query = supabase
        .from('crm_actions')
        .select(`
            id, action_type, action_date, note, call_result,
            deal_type, closing_value, gross_fees, is_conversation_starter,
            property_id, mandate_id, created_at,
            crm_action_contacts ( contact_id, contacts:contact_id ( first_name, last_name ) ),
            properties:property_id ( address, commune )
        `)
        .order('action_date', { ascending: false })

    if (contactId) {
        // Need actions linked to this contact via crm_action_contacts
        const { data: links } = await supabase
            .from('crm_action_contacts')
            .select('action_id')
            .eq('contact_id', contactId)
        const actionIds = links?.map(l => l.action_id) || []
        if (actionIds.length === 0) return []
        query = query.in('id', actionIds)
    } else if (propertyId) {
        query = query.eq('property_id', propertyId)
    }

    const { data, error } = await query
    if (error) { console.error('Timeline: actions error', error); return [] }

    return (data || []).map(a => {
        const contactNames = a.crm_action_contacts
            ?.map(ac => ac.contacts ? `${ac.contacts.first_name} ${ac.contacts.last_name}` : null)
            .filter(Boolean)
            .join(', ')

        let description = a.note || ''
        if (a.call_result) description += description ? ` — Resultado: ${a.call_result}` : `Resultado: ${a.call_result}`

        return {
            id: `action-${a.id}`,
            type: 'accion',
            typeLabel: 'Acción',
            date: a.action_date,
            title: a.action_type,
            description,
            color: 'indigo',
            meta: {
                contactNames,
                propertyAddress: a.properties?.address,
                dealType: a.deal_type,
                closingValue: a.closing_value,
                grossFees: a.gross_fees,
                isConversationStarter: a.is_conversation_starter,
                mandateId: a.mandate_id,
                propertyId: a.property_id,
            }
        }
    })
}

async function fetchTasks(contactId, propertyId) {
    let query = supabase
        .from('crm_tasks')
        .select(`
            id, action, description, execution_date, completed, completed_at, task_type,
            contact_id, property_id, location, created_at,
            contacts:contact_id ( first_name, last_name ),
            properties:property_id ( address )
        `)
        .order('execution_date', { ascending: false })

    if (contactId) query = query.eq('contact_id', contactId)
    else if (propertyId) query = query.eq('property_id', propertyId)

    const { data, error } = await query
    if (error) { console.error('Timeline: tasks error', error); return [] }

    return (data || []).map(t => ({
        id: `task-${t.id}`,
        type: 'tarea',
        typeLabel: 'Tarea',
        date: t.completed && t.completed_at ? t.completed_at : t.execution_date,
        title: t.action,
        description: t.description || '',
        color: t.completed ? 'green' : 'orange',
        meta: {
            completed: t.completed,
            completedAt: t.completed_at,
            executionDate: t.execution_date,
            taskType: t.task_type,
            location: t.location,
            contactName: t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : null,
            propertyAddress: t.properties?.address,
            propertyId: t.property_id,
            contactId: t.contact_id,
        }
    }))
}

async function fetchContactActivities(contactId) {
    if (!contactId) return []

    const { data, error } = await supabase
        .from('contact_activities')
        .select('id, type, description, created_at')
        .eq('contact_id', contactId)
        .neq('type', 'task_completed')
        .order('created_at', { ascending: false })

    if (error) { console.error('Timeline: contact_activities error', error); return [] }

    return (data || []).map(a => ({
        id: `activity-${a.id}`,
        type: 'actividad',
        typeLabel: 'Actividad',
        date: a.created_at,
        title: a.type,
        description: a.description || '',
        color: 'cyan',
        meta: {}
    }))
}

async function fetchEmails(contactId, propertyId) {
    // Emails are linked to contacts via email_threads.contact_id
    if (!contactId) return []

    const { data: threads, error: thError } = await supabase
        .from('email_threads')
        .select('id, subject, contact_id')
        .eq('contact_id', contactId)

    if (thError || !threads?.length) return []

    const threadIds = threads.map(t => t.id)
    const threadMap = Object.fromEntries(threads.map(t => [t.id, t]))

    // Fetch latest message per thread (limit total)
    const { data: messages, error: msgError } = await supabase
        .from('email_messages')
        .select('id, thread_id, from_address, to_address, subject, snippet, received_at')
        .in('thread_id', threadIds)
        .order('received_at', { ascending: false })
        .limit(100)

    if (msgError) { console.error('Timeline: emails error', msgError); return [] }

    // Group by thread, keep only latest per thread
    const seenThreads = new Set()
    const uniqueMessages = []
    for (const m of (messages || [])) {
        if (!seenThreads.has(m.thread_id)) {
            seenThreads.add(m.thread_id)
            uniqueMessages.push(m)
        }
    }

    return uniqueMessages.map(m => ({
        id: `email-${m.id}`,
        type: 'correo',
        typeLabel: 'Correo',
        date: m.received_at,
        title: m.subject || threadMap[m.thread_id]?.subject || '(Sin asunto)',
        description: m.snippet || '',
        color: 'rose',
        meta: {
            from: m.from_address,
            to: m.to_address,
            threadId: m.thread_id,
        }
    }))
}

async function fetchMandates(contactId, propertyId) {
    let query = supabase
        .from('mandates')
        .select(`
            id, created_at, address, commune, region, price, currency,
            capture_type, operation_type, status, review_status,
            start_date, capture_end_date, file_urls,
            contact_id, property_id,
            contacts:contact_id ( first_name, last_name ),
            properties:property_id ( address )
        `)
        .order('created_at', { ascending: false })

    if (contactId) query = query.eq('contact_id', contactId)
    else if (propertyId) query = query.eq('property_id', propertyId)

    const { data, error } = await query
    if (error) { console.error('Timeline: mandates error', error); return [] }

    return (data || []).map(m => ({
        id: `mandate-${m.id}`,
        type: 'mandato',
        typeLabel: 'Mandato',
        date: m.created_at,
        title: `Mandato — ${m.operation_type || 'Sin tipo'} — ${m.address || ''}`,
        description: `Estado: ${m.status || '-'} | Captación: ${m.capture_type || '-'}`,
        color: 'amber',
        meta: {
            price: m.price,
            currency: m.currency,
            status: m.status,
            reviewStatus: m.review_status,
            operationType: m.operation_type,
            captureType: m.capture_type,
            startDate: m.start_date,
            endDate: m.capture_end_date,
            commune: m.commune,
            region: m.region,
            address: m.address,
            fileUrls: m.file_urls || [],
            contactName: m.contacts ? `${m.contacts.first_name} ${m.contacts.last_name}` : null,
            propertyAddress: m.properties?.address || m.address,
            propertyId: m.property_id,
            contactId: m.contact_id,
        }
    }))
}

async function fetchEvaluaciones(contactId, propertyId) {
    let query = supabase
        .from('evaluaciones_comerciales')
        .select(`
            id, created_at, status, notes,
            contact_id, property_id, request_id,
            contacts:contact_id ( first_name, last_name ),
            properties:property_id ( address )
        `)
        .order('created_at', { ascending: false })

    if (contactId) query = query.eq('contact_id', contactId)
    else if (propertyId) query = query.eq('property_id', propertyId)

    const { data, error } = await query
    if (error) { console.error('Timeline: evaluaciones error', error); return [] }

    return (data || []).map(e => ({
        id: `eval-${e.id}`,
        type: 'evaluacion',
        typeLabel: 'Evaluación',
        date: e.created_at,
        title: `Evaluación Comercial`,
        description: e.notes || `Estado: ${e.status || '-'}`,
        color: 'violet',
        meta: {
            status: e.status,
            requestId: e.request_id,
            contactName: e.contacts ? `${e.contacts.first_name} ${e.contacts.last_name}` : null,
            propertyAddress: e.properties?.address,
            propertyId: e.property_id,
            contactId: e.contact_id,
        }
    }))
}

async function fetchActivityLogs(contactId, propertyId) {
    let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })

    if (propertyId) query = query.eq('property_id', propertyId)
    else if (contactId) query = query.eq('contact_id', contactId)

    const { data, error } = await query
    if (error) { console.error('Timeline: activity_logs error', error); return [] }

    return (data || []).map(l => {
        const isNote = l.action === 'Nota'
        return {
            id: `log-${l.id}`,
            type: isNote ? 'nota' : 'log',
            typeLabel: isNote ? 'Nota' : 'Registro',
            date: l.created_at,
            title: isNote ? 'Nota' : (l.action || 'Actividad'),
            description: l.description || '',
            color: isNote ? 'amber' : 'slate',
            meta: {
                entityType: l.entity_type,
                details: l.details,
                propertyId: l.property_id,
                contactId: l.contact_id,
            }
        }
    })
}

// ── Main aggregator ────────────────────────────────────────────

export async function fetchUnifiedTimeline({ contactId, propertyId }) {
    const results = await Promise.all([
        fetchActions(contactId, propertyId),
        fetchTasks(contactId, propertyId),
        fetchContactActivities(contactId),
        fetchEmails(contactId, propertyId),
        fetchMandates(contactId, propertyId),
        fetchEvaluaciones(contactId, propertyId),
        fetchActivityLogs(contactId, propertyId),
    ])

    const all = results.flat()

    // Sort descending by date
    all.sort((a, b) => new Date(b.date) - new Date(a.date))

    return all
}

// ── Available event types for filter UI ────────────────────────

export const EVENT_TYPES = [
    { key: 'accion', label: 'Acciones', color: 'blue' },
    { key: 'tarea', label: 'Tareas', color: 'amber' },
    { key: 'nota', label: 'Notas', color: 'amber' },
    { key: 'actividad', label: 'Actividades', color: 'slate' },
    { key: 'correo', label: 'Correos', color: 'slate' },
    { key: 'mandato', label: 'Mandatos', color: 'blue' },
    { key: 'evaluacion', label: 'Evaluaciones', color: 'slate' },
    { key: 'log', label: 'Registros', color: 'slate' },
]
