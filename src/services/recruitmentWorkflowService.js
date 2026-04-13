import { supabase } from './supabase'
import { PIPELINE_STAGES } from './recruitmentService'

// ─── Node Type Catalog ──────────────────────────────────────────

export const NODE_TYPES_CATALOG = [
  {
    category: 'Triggers',
    icon: 'Zap',
    types: [
      {
        type: 'trigger',
        label: 'Trigger',
        icon: 'Zap',
        color: '#f59e0b',
        description: 'Inicio del flujo — cuando un candidato entra a una etapa',
        defaultConfig: { stage_id: 'nuevo_lead' },
      },
    ],
  },
  {
    category: 'Comunicación',
    icon: 'Mail',
    types: [
      {
        type: 'gmail',
        label: 'Gmail',
        icon: 'Mail',
        color: '#ea4335',
        description: 'Enviar un email vía Gmail',
        defaultConfig: { subject: '', body: '', template: '', to_field: 'email' },
      },
      {
        type: 'whatsapp',
        label: 'WhatsApp',
        icon: 'MessageSquare',
        color: '#25d366',
        description: 'Enviar un mensaje o video por WhatsApp',
        defaultConfig: { message: '', include_video: false, video_url: '' },
      },
    ],
  },
  {
    category: 'Timing',
    icon: 'Clock',
    types: [
      {
        type: 'wait',
        label: 'Esperar',
        icon: 'Clock',
        color: '#8b5cf6',
        description: 'Esperar un tiempo antes de continuar',
        defaultConfig: { duration: 1, unit: 'days' },
      },
    ],
  },
  {
    category: 'Lógica',
    icon: 'GitBranch',
    types: [
      {
        type: 'split',
        label: 'Split 50/50',
        icon: 'GitBranch',
        color: '#06b6d4',
        description: 'Dividir 50% de los candidatos a una rama y 50% a otra',
        defaultConfig: { ratio_a: 50, ratio_b: 50, label_a: 'Rama A', label_b: 'Rama B' },
      },
    ],
  },
  {
    category: 'Acciones',
    icon: 'Calendar',
    types: [
      {
        type: 'move_stage',
        label: 'Mover a Etapa',
        icon: 'ArrowRight',
        color: '#8b5cf6',
        description: 'Mover candidato a otra etapa del pipeline',
        defaultConfig: { target_stage_id: '', auto_notify: true },
      },
      {
        type: 'calendar',
        label: 'Calendario',
        icon: 'Calendar',
        color: '#3b82f6',
        description: 'Crear evento o agendar reunión en Google Calendar',
        defaultConfig: { event_title: '', duration_minutes: 30, type: 'meet' },
      },
      {
        type: 'send_form',
        label: 'Enviar Formulario',
        icon: 'ClipboardList',
        color: '#14b8a6',
        description: 'Enviar formulario al candidato (ej: CV, datos personales)',
        defaultConfig: { form_type: 'cv_completo', form_url: '', message: '' },
      },
    ],
  },
]

// Flat lookups
export const ALL_NODE_TYPES = NODE_TYPES_CATALOG.flatMap(c => c.types)

export function getNodeTypeMeta(type) {
  return ALL_NODE_TYPES.find(t => t.type === type) || {
    type, label: type, icon: 'Zap', color: '#94a3b8', description: '', defaultConfig: {},
  }
}

// ─── Default initial workflow ───────────────────────────────────

function buildDefaultWorkflow() {
  const nodes = [
    {
      id: 'trigger_1',
      type: 'trigger',
      position: { x: 400, y: 60 },
      data: {
        nodeType: 'trigger',
        label: 'Nuevo Lead',
        config: { stage_id: 'nuevo_lead' },
      },
    },
    {
      id: 'gmail_1',
      type: 'gmail',
      position: { x: 400, y: 220 },
      data: {
        nodeType: 'gmail',
        label: 'Email Bienvenida',
        config: { subject: 'Bienvenido a RE/MAX Exclusive', body: '', template: 'email_ab_test', to_field: 'email' },
      },
    },
    {
      id: 'wait_1',
      type: 'wait',
      position: { x: 400, y: 380 },
      data: {
        nodeType: 'wait',
        label: 'Esperar 1 día',
        config: { duration: 1, unit: 'days' },
      },
    },
    {
      id: 'whatsapp_1',
      type: 'whatsapp',
      position: { x: 400, y: 540 },
      data: {
        nodeType: 'whatsapp',
        label: 'Video WhatsApp',
        config: { message: 'Hola {{nombre}}, te comparto este video sobre RE/MAX Exclusive', include_video: true, video_url: '' },
      },
    },
    {
      id: 'wait_2',
      type: 'wait',
      position: { x: 400, y: 700 },
      data: {
        nodeType: 'wait',
        label: 'Esperar 2 días',
        config: { duration: 2, unit: 'days' },
      },
    },
    {
      id: 'split_1',
      type: 'split',
      position: { x: 400, y: 860 },
      data: {
        nodeType: 'split',
        label: 'A/B Split 50/50',
        config: { ratio_a: 50, ratio_b: 50, label_a: 'Email Seguimiento', label_b: 'WhatsApp Seguimiento' },
      },
    },
    {
      id: 'gmail_2',
      type: 'gmail',
      position: { x: 180, y: 1040 },
      data: {
        nodeType: 'gmail',
        label: 'Email Seguimiento',
        config: { subject: 'Seguimiento — RE/MAX Exclusive', body: '', template: 'seguimiento_a', to_field: 'email' },
      },
    },
    {
      id: 'whatsapp_2',
      type: 'whatsapp',
      position: { x: 620, y: 1040 },
      data: {
        nodeType: 'whatsapp',
        label: 'WhatsApp Seguimiento',
        config: { message: 'Hola {{nombre}}, ¿pudiste ver el video?', include_video: false, video_url: '' },
      },
    },
    {
      id: 'calendar_1',
      type: 'calendar',
      position: { x: 400, y: 1220 },
      data: {
        nodeType: 'calendar',
        label: 'Agendar Pre-filtro',
        config: { event_title: 'Pre-filtro Meet — {{nombre}}', duration_minutes: 15, type: 'meet' },
      },
    },
  ]

  const edges = [
    { id: 'e_trigger1_gmail1', source: 'trigger_1', target: 'gmail_1', sourceHandle: 'output', targetHandle: 'input' },
    { id: 'e_gmail1_wait1', source: 'gmail_1', target: 'wait_1', sourceHandle: 'output_yes', targetHandle: 'input' },
    { id: 'e_wait1_wa1', source: 'wait_1', target: 'whatsapp_1', sourceHandle: 'output', targetHandle: 'input' },
    { id: 'e_wa1_wait2', source: 'whatsapp_1', target: 'wait_2', sourceHandle: 'output_yes', targetHandle: 'input' },
    { id: 'e_wait2_split1', source: 'wait_2', target: 'split_1', sourceHandle: 'output', targetHandle: 'input' },
    { id: 'e_split1_gmail2', source: 'split_1', target: 'gmail_2', sourceHandle: 'output_a', targetHandle: 'input' },
    { id: 'e_split1_wa2', source: 'split_1', target: 'whatsapp_2', sourceHandle: 'output_b', targetHandle: 'input' },
    { id: 'e_gmail2_cal', source: 'gmail_2', target: 'calendar_1', sourceHandle: 'output_yes', targetHandle: 'input' },
    { id: 'e_wa2_cal', source: 'whatsapp_2', target: 'calendar_1', sourceHandle: 'output_yes', targetHandle: 'input' },
  ]

  return { nodes, edges }
}

// ─── CRUD ───────────────────────────────────────────────────────

/**
 * Load the active workflow. If none exists, create the default one.
 */
export async function loadWorkflow() {
  const { data, error } = await supabase
    .from('recruitment_workflow_definitions')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (data) {
    return {
      id: data.id,
      name: data.name,
      nodes: data.nodes || [],
      edges: data.edges || [],
    }
  }

  // No workflow exists — create default
  const def = buildDefaultWorkflow()
  const { data: created, error: createError } = await supabase
    .from('recruitment_workflow_definitions')
    .insert([{
      name: 'Workflow Principal',
      nodes: def.nodes,
      edges: def.edges,
      is_active: true,
    }])
    .select()
    .single()

  if (createError) throw createError

  return {
    id: created.id,
    name: created.name,
    nodes: created.nodes,
    edges: created.edges,
  }
}

/**
 * Save the current workflow state (nodes + edges).
 */
export async function saveWorkflow(workflowId, nodes, edges) {
  const { data, error } = await supabase
    .from('recruitment_workflow_definitions')
    .update({
      nodes,
      edges,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workflowId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Generate a unique node ID.
 */
export function generateNodeId(nodeType) {
  return `${nodeType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
