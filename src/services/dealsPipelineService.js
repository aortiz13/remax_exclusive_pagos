import { supabase } from './supabase'
import { logActivity } from './activityService'

// ─── Pipeline Stage Definitions ─────────────────────────────────────────────

export const PROPIETARIOS_STAGES = [
  { id: 'prospeccion',          label: 'Prospección',           order: 1,  color: 'blue',    sequential: true,  description: 'Búsqueda de clientes vendedores' },
  { id: 'reunion_captacion',    label: 'Reunión Captación',     order: 2,  color: 'indigo',  sequential: true,  description: 'Presentación de servicios al dueño' },
  { id: 'evaluacion_comercial', label: 'Evaluación Comercial',  order: 3,  color: 'violet',  sequential: true,  description: 'Análisis de valor de la propiedad' },
  { id: 'firma_captacion',      label: 'Firma Captación',       order: 4,  color: 'purple',  sequential: true,  description: 'Formalización del acuerdo' },
  { id: 'carta_intencion',      label: 'Carta de Intención',    order: 5,  color: 'cyan',    sequential: true,  description: 'Presentación de intención de compra' },
  { id: 'negociacion',          label: 'Negociación',           order: 6,  color: 'amber',   sequential: true,  description: 'Negociación entre partes' },
  { id: 'promesa',              label: 'Promesa',               order: 7,  color: 'orange',  sequential: true,  skippable: true, description: 'Promesa de compraventa' },
  { id: 'estudio_titulo',       label: 'Estudio de Título',     order: 8,  color: 'rose',    sequential: true,  skippable: true, description: 'Revisión legal del título' },
  { id: 'escritura',            label: 'Escritura',             order: 9,  color: 'emerald', sequential: true,  description: 'Escrituración oficial' },
  { id: 'monitoreo_entrega',    label: 'Monitoreo y Entrega',   order: 10, color: 'teal',    sequential: true,  description: 'Seguimiento post-venta y entrega' },
]

export const COMPRADORES_STAGES = [
  { id: 'captacion_comprador',   label: 'Captación Comprador',   order: 1, color: 'emerald', sequential: true,  description: 'Captación del comprador interesado' },
  { id: 'analisis_mercado',      label: 'Análisis de Mercado',   order: 2, color: 'teal',    sequential: true,  description: 'Estudio de mercado para el comprador' },
  { id: 'presentacion_opciones', label: 'Presentación Opciones', order: 3, color: 'cyan',    sequential: true,  description: 'Mostrar opciones que se ajusten' },
  { id: 'visitas',               label: 'Visitas',               order: 4, color: 'blue',    sequential: true,  description: 'Visitas a propiedades seleccionadas' },
  { id: 'carta_intencion',       label: 'Carta de Intención',    order: 5, color: 'indigo',  sequential: true,  description: 'Presentación de intención de compra' },
  { id: 'negociacion',           label: 'Negociación',           order: 6, color: 'amber',   sequential: true,  description: 'Negociación entre partes' },
  { id: 'promesa',               label: 'Promesa',               order: 7, color: 'orange',  sequential: true,  skippable: true, description: 'Promesa de compraventa' },
  { id: 'estudio_titulo',        label: 'Estudio de Título',     order: 8, color: 'rose',    sequential: true,  skippable: true, description: 'Revisión legal del título' },
  { id: 'escritura',             label: 'Escritura',             order: 9, color: 'emerald', sequential: true,  description: 'Escrituración oficial' },
]

export const ARRIENDOS_STAGES = [
  { id: 'prospeccion',           label: 'Prospección',                order: 1, color: 'amber',   sequential: true,  description: 'Búsqueda de propietarios o arrendatarios' },
  { id: 'reunion_captacion',     label: 'Reunión Captación',          order: 2, color: 'orange',  sequential: true,  description: 'Presentación de servicios' },
  { id: 'evaluacion_comercial',  label: 'Evaluación Comercial',       order: 3, color: 'rose',    sequential: true,  description: 'Análisis de valor del arriendo' },
  { id: 'firma_captacion',       label: 'Firma Captación',            order: 4, color: 'red',     sequential: true,  description: 'Formalización del acuerdo' },
  { id: 'estudio_antecedentes',  label: 'Estudio Antecedentes',       order: 5, color: 'violet',  sequential: true,  description: 'Estudio de antecedentes del arrendatario' },
  { id: 'negociacion',           label: 'Negociación',                order: 6, color: 'indigo',  sequential: true,  description: 'Negociación de términos' },
  { id: 'contrato_arriendo',     label: 'Contrato de Arriendo',       order: 7, color: 'blue',    sequential: true,  description: 'Firma del contrato de arriendo' },
  { id: 'entrega',               label: 'Entrega',                    order: 8, color: 'teal',    sequential: true,  description: 'Entrega de la propiedad al arrendatario' },
]

// Pipeline metadata
export const PIPELINE_TYPES = [
  { id: 'propietarios',  label: 'Propietarios',  description: 'Pipeline de vendedores y propietarios' },
  { id: 'compradores',   label: 'Compradores',   description: 'Pipeline de compradores' },
  { id: 'arriendos',     label: 'Arriendos',      description: 'Pipeline de arriendos' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getStagesForPipeline(pipelineType) {
  switch (pipelineType) {
    case 'propietarios': return PROPIETARIOS_STAGES
    case 'compradores':  return COMPRADORES_STAGES
    case 'arriendos':    return ARRIENDOS_STAGES
    default: return PROPIETARIOS_STAGES
  }
}

export function getFirstStage(pipelineType) {
  const stages = getStagesForPipeline(pipelineType)
  return stages[0]?.id || 'prospeccion'
}

function getStageLabelMap(pipelineType) {
  const stages = getStagesForPipeline(pipelineType)
  const map = {}
  stages.forEach(s => { map[s.id] = s.label })
  map['won'] = 'Ganado'
  map['lost'] = 'Perdido'
  return map
}

// ─── Pipeline Transitions Config ────────────────────────────────────────────

export const PIPELINE_TRANSITIONS = {
  propietarios: {
    question: '¿Deseas iniciar un proceso de venta o arriendo para esta propiedad?',
    options: [
      { targetPipeline: 'compradores', label: 'Iniciar proceso de Comprador', icon: 'ShoppingCart', startStage: null },
      { targetPipeline: 'arriendos',   label: 'Iniciar proceso de Arriendo', icon: 'Key',          startStage: null },
    ],
  },
  compradores: {
    question: '¿El comprador adquirió como inversión para arrendar?',
    options: [
      { targetPipeline: 'arriendos', label: 'Sí, iniciar proceso de Arriendo', icon: 'Key', startStage: 'evaluacion_comercial' },
    ],
  },
  arriendos: {
    question: '¿La oficina administrará esta propiedad?',
    options: [
      { targetPipeline: 'administracion', label: 'Sí, pasar a Administración', icon: 'Building2', startStage: null },
    ],
  },
}

// ─── Property Status Sync ───────────────────────────────────────────────────

/**
 * Sync property commercial status based on deal stage movements.
 * Called automatically when a deal moves to a new stage.
 */
export async function syncPropertyStatus(propertyId, toStage, pipelineType) {
  if (!propertyId) return

  const STAGE_TO_STATUS = {
    firma_captacion:    'Captada',
    negociacion:        'En Negociación',
  }

  const newStatus = STAGE_TO_STATUS[toStage]
  if (!newStatus) return

  try {
    // Get current status array
    const { data: prop } = await supabase
      .from('properties')
      .select('status')
      .eq('id', propertyId)
      .single()

    if (!prop) return

    const currentStatuses = prop.status || []
    if (currentStatuses.includes(newStatus)) return // already has it

    // Remove conflicting statuses and add new one
    const COMMERCIAL_STATUSES = ['Por Captar', 'Captada', 'Publicada', 'En Negociación', 'En Venta', 'En Arriendo']
    const cleaned = currentStatuses.filter(s => !COMMERCIAL_STATUSES.includes(s))
    cleaned.push(newStatus)

    await supabase
      .from('properties')
      .update({ status: cleaned, updated_at: new Date().toISOString() })
      .eq('id', propertyId)
  } catch (err) {
    console.error('Error syncing property status:', err)
  }
}

/**
 * Mark property as sold/rented when deal is won.
 */
export async function syncPropertyWonStatus(propertyId, pipelineType) {
  if (!propertyId) return

  const STATUS_MAP = {
    compradores: 'Vendida',
    arriendos:   'Arrendada',
  }

  const winStatus = STATUS_MAP[pipelineType]
  if (!winStatus) return

  try {
    const { data: prop } = await supabase
      .from('properties')
      .select('status')
      .eq('id', propertyId)
      .single()

    if (!prop) return

    const COMMERCIAL_STATUSES = ['Por Captar', 'Captada', 'Publicada', 'En Negociación', 'En Venta', 'En Arriendo']
    const cleaned = (prop.status || []).filter(s => !COMMERCIAL_STATUSES.includes(s))
    if (!cleaned.includes(winStatus)) cleaned.push(winStatus)

    await supabase
      .from('properties')
      .update({ status: cleaned, updated_at: new Date().toISOString() })
      .eq('id', propertyId)
  } catch (err) {
    console.error('Error syncing won property status:', err)
  }
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Fetch deals for a pipeline, optionally filtered by agent.
 * Admin roles see all deals; agents see only their own.
 */
export async function fetchDeals(pipelineType, { agentId, isAdmin, search, status } = {}) {
  let query = supabase
    .from('deals')
    .select(`
      *,
      contact:contact_id(id, first_name, last_name, email, phone, need, rating),
      property:property_id(id, address, commune, property_type),
      mandate:mandate_id(id, capture_type, status, start_date),
      agent:agent_id(id, first_name, last_name)
    `)
    .eq('pipeline_type', pipelineType)
    .order('updated_at', { ascending: false })

  // Agent sees only their own, admin sees all
  if (!isAdmin && agentId) {
    query = query.eq('agent_id', agentId)
  }

  // Status filter (default: active deals)
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error

  // Client-side search filtering
  let results = data || []
  if (search) {
    const term = search.toLowerCase()
    results = results.filter(d => {
      const contactName = `${d.contact?.first_name || ''} ${d.contact?.last_name || ''}`.toLowerCase()
      const propAddress = (d.property?.address || '').toLowerCase()
      const title = (d.title || '').toLowerCase()
      return contactName.includes(term) || propAddress.includes(term) || title.includes(term)
    })
  }

  return results
}

/**
 * Create a new deal in the first stage of the pipeline.
 * Auto-links mandate if one exists for the property.
 */
export async function createDeal({ pipelineType, contactId, propertyId, title, amount, notes, agentId }) {
  const firstStage = getFirstStage(pipelineType)

  // Auto-find mandate if propertyId is provided
  let mandateId = null
  if (propertyId) {
    const { data: mandates } = await supabase
      .from('mandates')
      .select('id')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (mandates && mandates.length > 0) {
      mandateId = mandates[0].id
    }
  }

  const { data, error } = await supabase
    .from('deals')
    .insert([{
      pipeline_type: pipelineType,
      current_stage: firstStage,
      contact_id: contactId || null,
      property_id: propertyId || null,
      mandate_id: mandateId,
      agent_id: agentId,
      title: title || null,
      amount: amount || null,
      notes: notes || null,
      status: 'active',
    }])
    .select(`
      *,
      contact:contact_id(id, first_name, last_name, email, phone, need, rating),
      property:property_id(id, address, commune, property_type),
      mandate:mandate_id(id, capture_type, status, start_date),
      agent:agent_id(id, first_name, last_name)
    `)
    .single()

  if (error) throw error

  // Log initial stage
  await logStageChange(data.id, null, firstStage, agentId)

  // Log to timeline
  const labels = getStageLabelMap(pipelineType)
  const pipeLabel = PIPELINE_TYPES.find(p => p.id === pipelineType)?.label || pipelineType
  await logActivity({
    action: 'Creó Deal',
    entity_type: 'Deal',
    entity_id: data.id,
    description: `Nuevo deal "${title || 'Sin título'}" en pipeline ${pipeLabel} — etapa: ${labels[firstStage]}`,
    contact_id: contactId || null,
    property_id: propertyId || null,
  })

  return data
}

/**
 * Move a deal to a new stage with history logging.
 */
export async function moveDealToStage(dealId, fromStage, toStage, pipelineType, changedBy, notes) {
  const { error } = await supabase
    .from('deals')
    .update({
      current_stage: toStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)

  if (error) throw error

  await logStageChange(dealId, fromStage, toStage, changedBy, notes)

  // Fetch deal for timeline context
  const { data: deal } = await supabase
    .from('deals')
    .select('id, title, contact_id, property_id, pipeline_type')
    .eq('id', dealId)
    .single()

  if (deal) {
    const labels = getStageLabelMap(pipelineType || deal.pipeline_type)
    const pipeLabel = PIPELINE_TYPES.find(p => p.id === (pipelineType || deal.pipeline_type))?.label || ''
    await logActivity({
      action: 'Movió Deal',
      entity_type: 'Deal',
      entity_id: deal.id,
      description: `De "${labels[fromStage] || fromStage}" a "${labels[toStage] || toStage}" en pipeline ${pipeLabel}`,
      contact_id: deal.contact_id,
      property_id: deal.property_id,
    })

    // Auto-sync property status based on stage
    await syncPropertyStatus(deal.property_id, toStage, deal.pipeline_type)
  }
}

/**
 * Skip a stage: mark it in skipped_stages array.
 */
export async function skipStage(dealId, stageId, changedBy) {
  // Get current skipped_stages
  const { data: deal, error: fetchErr } = await supabase
    .from('deals')
    .select('skipped_stages')
    .eq('id', dealId)
    .single()
  if (fetchErr) throw fetchErr

  const current = deal.skipped_stages || []
  if (current.includes(stageId)) return // already skipped

  const { error } = await supabase
    .from('deals')
    .update({
      skipped_stages: [...current, stageId],
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)

  if (error) throw error
}

/**
 * Close deal as won.
 */
export async function closeDealWon(dealId, changedBy) {
  const { data, error } = await supabase
    .from('deals')
    .update({
      status: 'won',
      current_stage: 'won',
      won_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)
    .select('*, contact:contact_id(id, first_name, last_name), property:property_id(id, address, commune)')
    .single()

  if (error) throw error
  await logStageChange(dealId, null, 'won', changedBy, 'Deal cerrado como ganado')

  // Sync property status (Vendida/Arrendada)
  if (data?.property_id) {
    await syncPropertyWonStatus(data.property_id, data.pipeline_type)
  }

  return data
}

/**
 * Close deal as lost.
 */
export async function closeDealLost(dealId, reason, changedBy) {
  const { error } = await supabase
    .from('deals')
    .update({
      status: 'lost',
      current_stage: 'lost',
      lost_reason: reason || null,
      lost_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)

  if (error) throw error
  await logStageChange(dealId, null, 'lost', changedBy, reason || 'Deal cerrado como perdido')
}

/**
 * Spawn a new deal in a target pipeline from a won deal (pipeline transition).
 * Inherits property, contact, agent from the source deal.
 */
export async function spawnDeal({ sourceDeal, targetPipeline, startStage, agentId }) {
  const firstStage = startStage || getFirstStage(targetPipeline)
  const sourceLabel = PIPELINE_TYPES.find(p => p.id === sourceDeal.pipeline_type)?.label || sourceDeal.pipeline_type
  const targetLabel = PIPELINE_TYPES.find(p => p.id === targetPipeline)?.label || targetPipeline

  // For arriendos transition from compradores → mark as administracion
  if (targetPipeline === 'administracion') {
    // Just update property status to Administrada
    if (sourceDeal.property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('status')
        .eq('id', sourceDeal.property_id)
        .single()

      if (prop) {
        const COMMERCIAL_STATUSES = ['Por Captar', 'Captada', 'Publicada', 'En Negociación', 'En Venta', 'En Arriendo', 'Arrendada']
        const cleaned = (prop.status || []).filter(s => !COMMERCIAL_STATUSES.includes(s))
        if (!cleaned.includes('Administrada')) cleaned.push('Administrada')

        await supabase
          .from('properties')
          .update({ status: cleaned, updated_at: new Date().toISOString() })
          .eq('id', sourceDeal.property_id)
      }
    }

    await logActivity({
      action: 'Transición Pipeline',
      entity_type: 'Deal',
      entity_id: sourceDeal.id,
      description: `Propiedad pasó a Administración desde pipeline ${sourceLabel}`,
      contact_id: sourceDeal.contact_id,
      property_id: sourceDeal.property_id,
    })

    return { transitioned: true, type: 'administracion' }
  }

  // Auto-find mandate
  let mandateId = null
  if (sourceDeal.property_id) {
    const { data: mandates } = await supabase
      .from('mandates')
      .select('id')
      .eq('property_id', sourceDeal.property_id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (mandates?.length > 0) mandateId = mandates[0].id
  }

  const title = `${targetLabel} — ${sourceDeal.property?.address || sourceDeal.title || 'Sin título'}`

  const { data, error } = await supabase
    .from('deals')
    .insert([{
      pipeline_type: targetPipeline,
      current_stage: firstStage,
      contact_id: sourceDeal.contact_id || null,
      property_id: sourceDeal.property_id || null,
      mandate_id: mandateId,
      agent_id: agentId,
      title,
      amount: sourceDeal.amount || null,
      status: 'active',
      spawned_from_deal_id: sourceDeal.id,
    }])
    .select('*, contact:contact_id(id, first_name, last_name), property:property_id(id, address, commune)')
    .single()

  if (error) throw error

  // Log initial stage
  await logStageChange(data.id, null, firstStage, agentId, `Generado desde deal ${sourceLabel}`)

  // Log to timeline
  const labels = getStageLabelMap(targetPipeline)
  await logActivity({
    action: 'Transición Pipeline',
    entity_type: 'Deal',
    entity_id: data.id,
    description: `Nuevo deal "${title}" generado en ${targetLabel} desde ${sourceLabel} — etapa: ${labels[firstStage]}`,
    contact_id: data.contact_id,
    property_id: data.property_id,
  })

  return data
}

/**
 * Reactivate a closed deal (won/lost) back to a specific stage.
 */
export async function reactivateDeal(dealId, toStage, changedBy) {
  const { error } = await supabase
    .from('deals')
    .update({
      status: 'active',
      current_stage: toStage,
      won_at: null,
      lost_at: null,
      lost_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)

  if (error) throw error
  await logStageChange(dealId, 'reactivated', toStage, changedBy, 'Deal reactivado')
}

/**
 * Update deal metadata (title, amount, notes, contact, property).
 */
export async function updateDeal(dealId, updates) {
  const { data, error } = await supabase
    .from('deals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── History ────────────────────────────────────────────────────────────────

async function logStageChange(dealId, fromStage, toStage, changedBy, notes) {
  const { error } = await supabase
    .from('deal_stage_history')
    .insert([{
      deal_id: dealId,
      from_stage: fromStage || null,
      to_stage: toStage,
      changed_by: changedBy || null,
      notes: notes || null,
    }])

  if (error) console.error('Error logging deal stage change:', error)
}

export async function fetchDealHistory(dealId) {
  const { data, error } = await supabase
    .from('deal_stage_history')
    .select('*, profiles:changed_by(first_name, last_name)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ─── Column Visual Styles (sober / muted) ───────────────────────────────────

export const STAGE_COLUMN_STYLES = {
  blue:    { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  indigo:  { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  violet:  { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  purple:  { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  cyan:    { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  teal:    { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  emerald: { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  amber:   { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  orange:  { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  rose:    { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  red:     { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
  slate:   { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-slate-50',  headerText: 'text-slate-700', headerIcon: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
}

// Special terminal column styles
export const TERMINAL_COLUMN_STYLES = {
  won:  { bg: 'bg-white/60', border: 'border-slate-200', headerBg: 'bg-emerald-50',  headerText: 'text-emerald-700', headerIcon: 'text-emerald-500', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-400', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-50' },
  lost: { bg: 'bg-white/60', border: 'border-slate-200', headerBg: 'bg-slate-50',    headerText: 'text-slate-600',   headerIcon: 'text-slate-400',   badge: 'bg-slate-100 text-slate-500 border-slate-200',      dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-100' },
}
