import { supabase } from './supabase'

// ─── CRUD ─────────────────────────────────────────────────────────

export async function fetchRecruitmentTasks({ assignedTo, candidateId, completed, dateFrom, dateTo, search } = {}) {
  let query = supabase
    .from('recruitment_tasks')
    .select('*, candidate:recruitment_candidates(id, first_name, last_name, email, pipeline_stage), assignee:profiles!recruitment_tasks_assigned_to_fkey(id, first_name, last_name)')
    .order('execution_date', { ascending: true, nullsFirst: false })

  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (candidateId) query = query.eq('candidate_id', candidateId)
  if (completed !== undefined) query = query.eq('completed', completed)
  if (dateFrom) query = query.gte('execution_date', dateFrom)
  if (dateTo) query = query.lte('execution_date', dateTo + 'T23:59:59')
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function fetchTaskById(id) {
  const { data, error } = await supabase
    .from('recruitment_tasks')
    .select('*, candidate:recruitment_candidates(id, first_name, last_name, email, pipeline_stage), assignee:profiles!recruitment_tasks_assigned_to_fkey(id, first_name, last_name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createRecruitmentTask(task) {
  const { data, error } = await supabase
    .from('recruitment_tasks')
    .insert([{
      ...task,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select('*, candidate:recruitment_candidates(id, first_name, last_name, email, pipeline_stage), assignee:profiles!recruitment_tasks_assigned_to_fkey(id, first_name, last_name)')
    .single()
  if (error) throw error
  return data
}

export async function updateRecruitmentTask(id, updates) {
  const { data, error } = await supabase
    .from('recruitment_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, candidate:recruitment_candidates(id, first_name, last_name, email, pipeline_stage), assignee:profiles!recruitment_tasks_assigned_to_fkey(id, first_name, last_name)')
    .single()
  if (error) throw error
  return data
}

export async function toggleTaskCompleted(id, currentCompleted) {
  return updateRecruitmentTask(id, {
    completed: !currentCompleted,
    completed_at: !currentCompleted ? new Date().toISOString() : null,
  })
}

export async function deleteRecruitmentTask(id) {
  const { error } = await supabase
    .from('recruitment_tasks')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Constants ──────────────────────────────────────────────────────

export const TASK_TYPES = [
  'Llamada',
  'Email',
  'WhatsApp',
  'Reunión',
  'Seguimiento',
  'Revisión CV',
  'Enviar formulario',
  'Verificar datos',
  'Tarea',
]

export const TASK_PRIORITIES = [
  { id: 'alta', label: 'Alta', color: 'red' },
  { id: 'media', label: 'Media', color: 'amber' },
  { id: 'baja', label: 'Baja', color: 'green' },
]
