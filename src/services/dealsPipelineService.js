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
      mandate:mandate_id(id, capture_type, status, capture_date),
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
      mandate:mandate_id(id, capture_type, status, capture_date),
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
  const { error } = await supabase
    .from('deals')
    .update({
      status: 'won',
      current_stage: 'won',
      won_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)

  if (error) throw error
  await logStageChange(dealId, null, 'won', changedBy, 'Deal cerrado como ganado')
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

// ─── Column Visual Styles ───────────────────────────────────────────────────

export const STAGE_COLUMN_STYLES = {
  blue:    { bg: 'bg-white/60', border: 'border-blue-100',    headerBg: 'bg-gradient-to-r from-blue-600 to-blue-500',       badge: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500',    ring: 'ring-blue-200/60',    iconBg: 'bg-blue-500/15' },
  indigo:  { bg: 'bg-white/60', border: 'border-indigo-100',  headerBg: 'bg-gradient-to-r from-indigo-600 to-indigo-500',   badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500',  ring: 'ring-indigo-200/60',  iconBg: 'bg-indigo-500/15' },
  violet:  { bg: 'bg-white/60', border: 'border-violet-100',  headerBg: 'bg-gradient-to-r from-violet-600 to-violet-500',   badge: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500',  ring: 'ring-violet-200/60',  iconBg: 'bg-violet-500/15' },
  purple:  { bg: 'bg-white/60', border: 'border-purple-100',  headerBg: 'bg-gradient-to-r from-purple-600 to-purple-500',   badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500',  ring: 'ring-purple-200/60',  iconBg: 'bg-purple-500/15' },
  cyan:    { bg: 'bg-white/60', border: 'border-cyan-100',    headerBg: 'bg-gradient-to-r from-cyan-600 to-cyan-500',       badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',       dot: 'bg-cyan-500',    ring: 'ring-cyan-200/60',    iconBg: 'bg-cyan-500/15' },
  teal:    { bg: 'bg-white/60', border: 'border-teal-100',    headerBg: 'bg-gradient-to-r from-teal-600 to-teal-500',       badge: 'bg-teal-50 text-teal-700 border-teal-200',       dot: 'bg-teal-500',    ring: 'ring-teal-200/60',    iconBg: 'bg-teal-500/15' },
  emerald: { bg: 'bg-white/60', border: 'border-emerald-100', headerBg: 'bg-gradient-to-r from-emerald-600 to-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-500/15' },
  amber:   { bg: 'bg-white/60', border: 'border-amber-100',   headerBg: 'bg-gradient-to-r from-amber-500 to-amber-400',     badge: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500',   ring: 'ring-amber-200/60',   iconBg: 'bg-amber-500/15' },
  orange:  { bg: 'bg-white/60', border: 'border-orange-100',  headerBg: 'bg-gradient-to-r from-orange-500 to-orange-400',   badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500',  ring: 'ring-orange-200/60',  iconBg: 'bg-orange-500/15' },
  rose:    { bg: 'bg-white/60', border: 'border-rose-100',    headerBg: 'bg-gradient-to-r from-rose-500 to-rose-400',       badge: 'bg-rose-50 text-rose-600 border-rose-200',       dot: 'bg-rose-400',    ring: 'ring-rose-200/60',    iconBg: 'bg-rose-400/15' },
  red:     { bg: 'bg-white/60', border: 'border-red-100',     headerBg: 'bg-gradient-to-r from-red-500 to-red-400',         badge: 'bg-red-50 text-red-600 border-red-200',           dot: 'bg-red-500',     ring: 'ring-red-200/60',     iconBg: 'bg-red-500/15' },
  slate:   { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-gradient-to-r from-slate-500 to-slate-400',     badge: 'bg-slate-50 text-slate-600 border-slate-200',     dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-400/15' },
}

// Special terminal column styles
export const TERMINAL_COLUMN_STYLES = {
  won:  { bg: 'bg-white/60', border: 'border-emerald-200', headerBg: 'bg-gradient-to-r from-emerald-600 to-green-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-500/15' },
  lost: { bg: 'bg-white/60', border: 'border-slate-200',   headerBg: 'bg-gradient-to-r from-slate-500 to-slate-400',   badge: 'bg-slate-50 text-slate-600 border-slate-200',       dot: 'bg-slate-400',   ring: 'ring-slate-200/60',   iconBg: 'bg-slate-400/15' },
}
