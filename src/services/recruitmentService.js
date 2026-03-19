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
      pipeline_stage: candidate.pipeline_stage || 'Nuevo',
      source: candidate.source || 'Manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) throw error

  // Log initial pipeline entry
  await logPipelineChange(data.id, null, 'Nuevo', candidate._changed_by)

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

// ─── Constants ──────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  { id: 'Nuevo', label: 'Nuevo', color: 'blue', description: 'Leads recién ingresados' },
  { id: 'Reunión Agendada', label: 'Reunión Agendada', color: 'indigo', description: 'Invitación enviada' },
  { id: 'Reunión Confirmada', label: 'Reunión Confirmada', color: 'cyan', description: 'Confirmó asistencia' },
  { id: 'Aprobado', label: 'Aprobado', color: 'green', description: 'Pasó la reunión' },
  { id: 'Desaprobado', label: 'Desaprobado', color: 'red', description: 'No pasó la reunión' },
  { id: 'Ganado', label: 'Ganado', color: 'emerald', description: 'Proceso completado' },
  { id: 'Perdido', label: 'Perdido', color: 'slate', description: 'No avanzó' },
  { id: 'Seguimiento', label: 'Seguimiento', color: 'amber', description: 'Re-contactar futuro' },
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

