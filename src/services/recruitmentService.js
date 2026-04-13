import { supabase } from './supabase'

// ─── Candidates CRUD ─────────────────────────────────────────────

export async function fetchCandidates({ stage, source, search, dateFrom, dateTo } = {}) {
  let query = supabase
    .from('recruitment_candidates')
    .select('*')
    .order('updated_at', { ascending: false })

  if (stage && stage !== 'all') query = query.eq('pipeline_stage', stage)
  if (source && source !== 'all') query = query.eq('source', source)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,rut.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function fetchCandidateById(id) {
  const { data, error } = await supabase
    .from('recruitment_candidates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createCandidate(candidate) {
  const { data, error } = await supabase
    .from('recruitment_candidates')
    .insert([{
      ...candidate,
      pipeline_stage: candidate.pipeline_stage || 'nuevo_lead',
      source: candidate.source || 'Manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) throw error

  // Log initial pipeline entry
  await logPipelineChange(data.id, null, 'nuevo_lead', candidate._changed_by)

  return data
}

export async function updateCandidate(id, updates) {
  const { data, error } = await supabase
    .from('recruitment_candidates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCandidate(id) {
  const { error } = await supabase
    .from('recruitment_candidates')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ─── Pipeline Stage Changes ─────────────────────────────────────

export async function updatePipelineStage(candidateId, fromStage, toStage, changedBy, notes) {
  // Update candidate
  const { error: updateError } = await supabase
    .from('recruitment_candidates')
    .update({
      pipeline_stage: toStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidateId)

  if (updateError) throw updateError

  // Log the change
  await logPipelineChange(candidateId, fromStage, toStage, changedBy, notes)

  // Execute automation rules (fire-and-forget, do not block UI)
  try {
    const { executeStageAutomation } = await import('./recruitmentAutomation')
    const { data: candidate } = await supabase
      .from('recruitment_candidates')
      .select('*')
      .eq('id', candidateId)
      .single()
    if (candidate) {
      executeStageAutomation(candidate, fromStage, toStage).catch(err =>
        console.error('[Automation] Background error:', err.message)
      )
    }
  } catch (err) {
    console.error('[Automation] Import/fetch error:', err.message)
  }
}

async function logPipelineChange(candidateId, fromStage, toStage, changedBy, notes) {
  const { error } = await supabase
    .from('recruitment_pipeline_history')
    .insert([{
      candidate_id: candidateId,
      from_stage: fromStage,
      to_stage: toStage,
      changed_by: changedBy || null,
      notes: notes || null,
    }])

  if (error) console.error('Error logging pipeline change:', error)
}

// ─── Pipeline History ───────────────────────────────────────────

export async function fetchPipelineHistory(candidateId) {
  const { data, error } = await supabase
    .from('recruitment_pipeline_history')
    .select('*, profiles:changed_by(first_name, last_name)')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ─── Email Logs ─────────────────────────────────────────────────

export async function fetchEmailLogs(candidateId) {
  const { data, error } = await supabase
    .from('recruitment_email_logs')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('sent_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function logEmailSent(candidateId, { email_type, subject, body_html, to_email }) {
  const { data, error } = await supabase
    .from('recruitment_email_logs')
    .insert([{
      candidate_id: candidateId,
      email_type: email_type || 'Manual',
      subject,
      body_html,
      to_email,
      sent_at: new Date().toISOString(),
      status: 'sent',
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── WhatsApp Logs ──────────────────────────────────────────────

export async function fetchWhatsappLogs(candidateId) {
  const { data, error } = await supabase
    .from('recruitment_whatsapp_logs')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('sent_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ─── Stats ──────────────────────────────────────────────────────

export async function fetchRecruitmentStats() {
  const { data, error } = await supabase
    .from('recruitment_candidates')
    .select('pipeline_stage, source')

  if (error) throw error

  const stats = {
    total: data.length,
    byStage: {},
    bySource: {},
  }

  data.forEach(c => {
    stats.byStage[c.pipeline_stage] = (stats.byStage[c.pipeline_stage] || 0) + 1
    stats.bySource[c.source] = (stats.bySource[c.source] || 0) + 1
  })

  return stats
}

// ─── Funnel Metrics ─────────────────────────────────────────────

export async function fetchFunnelMetrics() {
  // Count candidates per stage
  const { data: candidates, error } = await supabase
    .from('recruitment_candidates')
    .select('pipeline_stage, source, created_at')

  if (error) throw error

  const stageCounts = {}
  PIPELINE_STAGES.forEach(s => { stageCounts[s.id] = 0 })
  candidates.forEach(c => {
    if (stageCounts[c.pipeline_stage] !== undefined) stageCounts[c.pipeline_stage]++
  })

  // Calculate drop-off between sequential stages
  const sequential = PIPELINE_STAGES.filter(s => s.sequential)
  const funnel = sequential.map((stage, i) => {
    const count = stageCounts[stage.id] || 0
    const prevCount = i > 0 ? (stageCounts[sequential[i - 1].id] || 0) : count
    const dropOff = prevCount > 0 ? ((prevCount - count) / prevCount * 100).toFixed(1) : 0
    const advanceRate = prevCount > 0 ? (count / prevCount * 100).toFixed(1) : 0
    return { stage: stage.id, label: stage.label, count, dropOff, advanceRate }
  })

  return { stageCounts, funnel, total: candidates.length }
}

export async function fetchConversionBySource() {
  const { data, error } = await supabase
    .from('recruitment_candidates')
    .select('pipeline_stage, source')

  if (error) throw error

  const map = {}
  data.forEach(c => {
    const s = c.source || 'Sin fuente'
    if (!map[s]) map[s] = { total: 0, won: 0, lost: 0 }
    map[s].total++
    if (c.pipeline_stage === 'ganado') map[s].won++
    if (c.pipeline_stage === 'perdido') map[s].lost++
  })

  return Object.entries(map)
    .map(([source, stats]) => ({
      source,
      ...stats,
      convRate: stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : '0',
    }))
    .sort((a, b) => b.total - a.total)
}

// ─── Stage Actions (Workflow configuration) ─────────────────────

export async function fetchStageActions(stageId) {
  let query = supabase
    .from('recruitment_stage_actions')
    .select('*')
    .order('action_order', { ascending: true })

  if (stageId) query = query.eq('stage_id', stageId)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function upsertStageAction(action) {
  const payload = {
    stage_id: action.stage_id,
    action_order: action.action_order || 0,
    action_type: action.action_type,
    config: action.config || {},
    is_active: action.is_active !== false,
    updated_at: new Date().toISOString(),
  }

  if (action.id) {
    const { data, error } = await supabase
      .from('recruitment_stage_actions')
      .update(payload)
      .eq('id', action.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('recruitment_stage_actions')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteStageAction(id) {
  const { error } = await supabase
    .from('recruitment_stage_actions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Constants ──────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  { id: 'nuevo_lead',          label: 'Nuevo Lead',           color: 'blue',    icon: 'Zap',           sequential: true,  description: 'Leads recién ingresados desde cualquier fuente' },
  { id: 'contacto_inicial',    label: 'Contacto Inicial',     color: 'indigo',  icon: 'Mail',          sequential: true,  description: 'Email A/B + Video WhatsApp enviados' },
  { id: 'pre_filtro',          label: 'Pre-filtro',           color: 'cyan',    icon: 'Video',         sequential: true,  description: 'Videollamada 10min con Karen' },
  { id: 'formulario_cv',       label: 'Formulario + CV',      color: 'violet',  icon: 'FileText',      sequential: true,  description: 'Candidato llena formulario nativo + sube CV' },
  { id: 'reunion_presencial',  label: 'Reunión Presencial',   color: 'amber',   icon: 'Users',         sequential: true,  description: 'Reunión 60min con Broker (Mar/Jue)' },
  { id: 'cierre_comercial',    label: 'Cierre Comercial',     color: 'orange',  icon: 'CreditCard',    sequential: true,  description: 'Cobro inmediato / Link de pago' },
  { id: 'ganado',              label: 'Ganado',               color: 'emerald', icon: 'Trophy',        sequential: false, description: 'Pagó y se formalizó ✅' },
  { id: 'perdido',             label: 'Perdido',              color: 'slate',   icon: 'XCircle',       sequential: false, description: 'No avanzó en alguna etapa ❌' },
  { id: 'seguimiento',         label: 'Seguimiento',          color: 'rose',    icon: 'RefreshCw',     sequential: false, description: 'Re-contactar en el futuro 🔄' },
]

export const CANDIDATE_SOURCES = [
  'Web',
  'Computrabajo',
  'LinkedIn',
  'Trabajando',
  'Referido',
  'Manual',
]

// ─── Recruitment Email helpers ──────────────────────────────────

export async function sendRecruitmentEmail({ candidateId, toEmail, subject, bodyHtml, templateId, abVariant }) {
  const { data, error } = await supabase.functions.invoke('gmail-send-recruitment', {
    body: { candidateId, toEmail, subject, bodyHtml, templateId, abVariant },
  })
  if (error) throw new Error(error.message || 'Error al enviar email')
  return data
}

export async function getRecruitmentAccountStatus() {
  const { data, error } = await supabase.functions.invoke('gmail-recruitment-status', {})
  if (error) throw new Error(error.message || 'Error al verificar cuenta')
  return data
}
