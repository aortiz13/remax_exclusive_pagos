import { supabase } from './supabase'

// ─── Templates CRUD ─────────────────────────────────────────────

export async function fetchTemplates() {
  const { data, error } = await supabase
    .from('recruitment_email_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name')

  if (error) throw error
  return data || []
}

export async function fetchTemplateById(id) {
  const { data, error } = await supabase
    .from('recruitment_email_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createTemplate(template) {
  const { data, error } = await supabase
    .from('recruitment_email_templates')
    .insert([{
      ...template,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTemplate(id, updates) {
  const { data, error } = await supabase
    .from('recruitment_email_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTemplate(id) {
  const { error } = await supabase
    .from('recruitment_email_templates')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ─── Template Rendering ────────────────────────────────────────────

export const TEMPLATE_VARIABLES = [
  { key: '{{nombre}}', label: 'Nombre', example: 'Juan' },
  { key: '{{apellido}}', label: 'Apellido', example: 'Pérez' },
  { key: '{{nombre_completo}}', label: 'Nombre completo', example: 'Juan Pérez' },
  { key: '{{email}}', label: 'Email', example: 'juan@email.com' },
  { key: '{{telefono}}', label: 'Teléfono', example: '+56 9 1234 5678' },
  { key: '{{ciudad}}', label: 'Ciudad', example: 'Santiago' },
  { key: '{{fecha_reunion}}', label: 'Fecha reunión', example: '20 de marzo, 2026 a las 10:00' },
  { key: '{{ubicacion_reunion}}', label: 'Ubicación reunión', example: 'Oficina RE/MAX Exclusive, Av. Providencia 1234' },
]

export const TEMPLATE_CATEGORIES = [
  'General',
  'Invitación',
  'Confirmación',
  'Aprobación',
  'Rechazo',
  'Bienvenida',
  'Seguimiento',
]

export function renderTemplate(template, candidate) {
  if (!template) return { subject: '', body: '' }

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '[Fecha por definir]'

  const vars = {
    '{{nombre}}': candidate?.first_name || '[Nombre]',
    '{{apellido}}': candidate?.last_name || '[Apellido]',
    '{{nombre_completo}}': `${candidate?.first_name || ''} ${candidate?.last_name || ''}`.trim() || '[Nombre Completo]',
    '{{email}}': candidate?.email || '[Email]',
    '{{telefono}}': candidate?.phone || candidate?.whatsapp || '[Teléfono]',
    '{{ciudad}}': candidate?.city || '[Ciudad]',
    '{{fecha_reunion}}': fmtDate(candidate?.meeting_date),
    '{{ubicacion_reunion}}': candidate?.meeting_location || '[Ubicación por definir]',
  }

  let subject = template.subject || ''
  let body = template.body_html || ''

  Object.entries(vars).forEach(([key, value]) => {
    subject = subject.replaceAll(key, value)
    body = body.replaceAll(key, value)
  })

  return { subject, body }
}
