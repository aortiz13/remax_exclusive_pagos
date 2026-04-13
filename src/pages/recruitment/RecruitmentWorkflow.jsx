import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Zap, Mail, Phone, Video, FileText, Users, CreditCard, Trophy, XCircle,
  RefreshCw, ChevronRight, TrendingUp, Clock, BarChart3, X, Eye, Settings,
  Play, ArrowRight, Timer, User, Globe, Briefcase, MessageSquare,
  Plus, Trash2, Power, Save, GitBranch, Tag, Edit3, Bell, Smartphone,
  Plug, ClipboardList, Search, ChevronDown, GripVertical, Check, AlertCircle,
  ArrowLeft, Workflow, Calendar, Copy, Palette,
} from 'lucide-react'
import {
  loadWorkflow,
  saveWorkflow,
  NODE_TYPES_CATALOG,
  ALL_NODE_TYPES,
  getNodeTypeMeta,
  generateNodeId,
} from '../../services/recruitmentWorkflowService'
import { PIPELINE_STAGES } from '../../services/recruitmentService'

// ─── Icon Resolver ────────────────────────────────────────────────

const ICON_MAP = {
  Zap, Mail, Phone, Video, FileText, Users, CreditCard, Trophy, XCircle,
  RefreshCw, Clock, Timer, Globe, Briefcase, MessageSquare, Tag, Edit3,
  Bell, Smartphone, Plug, ClipboardList, GitBranch, ArrowRight, Play,
  Settings, Search, Calendar, Copy,
}
const resolveIcon = (name) => ICON_MAP[name] || Zap

// ─── Wait duration presets ────────────────────────────────────────

const WAIT_PRESETS = [
  { label: '1 día', duration: 1, unit: 'days' },
  { label: '2 días', duration: 2, unit: 'days' },
  { label: '3 días', duration: 3, unit: 'days' },
  { label: '1 semana', duration: 7, unit: 'days' },
]

// ════════════════════════════════════════════════════════════════════
//  CUSTOM NODE TYPES
// ════════════════════════════════════════════════════════════════════

// Handle style constants
const HANDLE_STYLE_INPUT = {
  width: 12, height: 12, background: '#94a3b8', border: '2.5px solid #fff',
  borderRadius: '50%', cursor: 'crosshair',
}
const HANDLE_STYLE_OUTPUT = {
  width: 12, height: 12, background: '#3b82f6', border: '2.5px solid #fff',
  borderRadius: '50%', cursor: 'crosshair',
}

/** ─── TRIGGER NODE ─────────────────────────────────────────── */
const TriggerNode = memo(({ data, selected }) => {
  const stageName = PIPELINE_STAGES.find(s => s.id === data.config?.stage_id)?.label || 'Nuevo Lead'
  return (
    <div className={`rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-200 w-[260px]
      ${selected ? 'ring-4 ring-amber-300/50 scale-[1.02] border-amber-400' : 'border-amber-200 hover:shadow-xl hover:border-amber-300'}`}>
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 flex items-center gap-2.5">
        <div className="p-1.5 bg-white/25 rounded-lg backdrop-blur-sm">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-white/70 font-bold uppercase tracking-widest leading-none">Trigger</p>
          <p className="text-white font-bold text-[13px] truncate mt-0.5">{data.label || 'Trigger'}</p>
        </div>
      </div>
      <div className="bg-white px-4 py-2.5">
        <p className="text-[11px] text-slate-500">
          Cuando candidato entra a <strong className="text-slate-700">{stageName}</strong>
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} id="output"
        style={{ ...HANDLE_STYLE_OUTPUT, background: '#f59e0b', bottom: -6 }} />
    </div>
  )
})
TriggerNode.displayName = 'TriggerNode'

/** Helper: stage badge shown on action nodes */
const StageBadge = ({ stageId }) => {
  if (!stageId) return null
  const stage = PIPELINE_STAGES.find(s => s.id === stageId)
  if (!stage) return null
  return (
    <div className="px-3.5 py-1.5 border-t border-slate-100 bg-slate-50">
      <p className="text-[9px] text-slate-400">Etapa: <strong className="text-slate-600">{stage.label}</strong></p>
    </div>
  )
}

/** Helper: dual output footer (Responde / No responde) */
const DualOutputFooter = ({ yesColor = '#10b981', noColor = '#ef4444' }) => (
  <div className="flex border-t border-slate-100">
    <div className="flex-1 px-3 py-1.5 text-center border-r border-slate-100 relative">
      <p className="text-[9px] font-bold text-emerald-500">✓ Responde</p>
      <Handle type="source" position={Position.Bottom} id="output_yes"
        style={{ ...HANDLE_STYLE_OUTPUT, background: yesColor, bottom: -6, left: '50%', transform: 'translateX(-50%)' }} />
    </div>
    <div className="flex-1 px-3 py-1.5 text-center relative">
      <p className="text-[9px] font-bold text-red-400">✗ No responde</p>
      <Handle type="source" position={Position.Bottom} id="output_no"
        style={{ ...HANDLE_STYLE_OUTPUT, background: noColor, bottom: -6, left: '50%', transform: 'translateX(-50%)' }} />
    </div>
  </div>
)

/** ─── GMAIL NODE ───────────────────────────────────────────── */
const GmailNode = memo(({ data, selected }) => (
  <div className={`rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-200 w-[260px]
    ${selected ? 'ring-4 ring-red-300/40 scale-[1.02] border-red-300' : 'border-slate-200 hover:shadow-xl hover:border-red-200'}`}>
    <Handle type="target" position={Position.Top} id="input"
      style={{ ...HANDLE_STYLE_INPUT, top: -6 }} />
    <div className="flex items-stretch bg-white">
      <div className="w-[52px] bg-gradient-to-b from-red-50 to-red-100 border-r border-red-100 flex items-center justify-center shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-red-200 flex items-center justify-center">
          <Mail className="w-4 h-4 text-red-500" strokeWidth={2} />
        </div>
      </div>
      <div className="flex-1 px-3.5 py-3 min-w-0">
        <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider leading-none">Gmail</p>
        <p className="text-[13px] font-semibold text-slate-800 truncate mt-1">{data.label || 'Enviar Email'}</p>
        <p className="text-[10px] text-slate-400 truncate mt-0.5">
          {data.config?.subject || data.config?.template || 'Sin configurar'}
        </p>
      </div>
    </div>
    <StageBadge stageId={data.config?.stage_id} />
    <DualOutputFooter yesColor="#10b981" noColor="#ef4444" />
  </div>
))
GmailNode.displayName = 'GmailNode'

/** ─── WHATSAPP NODE ────────────────────────────────────────── */
const WhatsAppNode = memo(({ data, selected }) => (
  <div className={`rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-200 w-[260px]
    ${selected ? 'ring-4 ring-green-300/40 scale-[1.02] border-green-300' : 'border-slate-200 hover:shadow-xl hover:border-green-200'}`}>
    <Handle type="target" position={Position.Top} id="input"
      style={{ ...HANDLE_STYLE_INPUT, top: -6 }} />
    <div className="flex items-stretch bg-white">
      <div className="w-[52px] bg-gradient-to-b from-green-50 to-green-100 border-r border-green-100 flex items-center justify-center shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-green-200 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-green-600" strokeWidth={2} />
        </div>
      </div>
      <div className="flex-1 px-3.5 py-3 min-w-0">
        <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider leading-none">WhatsApp</p>
        <p className="text-[13px] font-semibold text-slate-800 truncate mt-1">{data.label || 'Enviar WhatsApp'}</p>
        <p className="text-[10px] text-slate-400 truncate mt-0.5">
          {data.config?.message?.slice(0, 40) || 'Sin mensaje'}
          {data.config?.include_video ? ' 📹' : ''}
        </p>
      </div>
    </div>
    <StageBadge stageId={data.config?.stage_id} />
    <DualOutputFooter yesColor="#25d366" noColor="#ef4444" />
  </div>
))
WhatsAppNode.displayName = 'WhatsAppNode'

/** ─── WAIT NODE ────────────────────────────────────────────── */
const WaitNode = memo(({ data, selected }) => {
  const dur = data.config?.duration || 1
  const unit = data.config?.unit || 'days'
  const unitLabel = unit === 'days' ? (dur === 1 ? 'día' : 'días') : unit === 'hours' ? (dur === 1 ? 'hora' : 'horas') : 'min'
  return (
    <div className={`rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-200 w-[220px]
      ${selected ? 'ring-4 ring-violet-300/40 scale-[1.02] border-violet-300' : 'border-slate-200 hover:shadow-xl hover:border-violet-200'}`}>
      <Handle type="target" position={Position.Top} id="input"
        style={{ ...HANDLE_STYLE_INPUT, top: -6 }} />
      <div className="bg-white px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-violet-600" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider leading-none">Esperar</p>
          <p className="text-lg font-bold text-slate-800 leading-tight mt-0.5">{dur} {unitLabel}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="output"
        style={{ ...HANDLE_STYLE_OUTPUT, background: '#8b5cf6', bottom: -6 }} />
    </div>
  )
})
WaitNode.displayName = 'WaitNode'

/** ─── SPLIT 50/50 NODE ─────────────────────────────────────── */
const SplitNode = memo(({ data, selected }) => (
  <div className={`rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-200 w-[260px]
    ${selected ? 'ring-4 ring-cyan-300/40 scale-[1.02] border-cyan-300' : 'border-slate-200 hover:shadow-xl hover:border-cyan-200'}`}>
    <Handle type="target" position={Position.Top} id="input"
      style={{ ...HANDLE_STYLE_INPUT, top: -6 }} />
    <div className="bg-white">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 border border-cyan-200 flex items-center justify-center shrink-0">
          <GitBranch className="w-5 h-5 text-cyan-600" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-wider leading-none">Split A/B</p>
          <p className="text-[13px] font-semibold text-slate-800 mt-0.5">{data.label || 'Split 50/50'}</p>
        </div>
      </div>
      <div className="flex border-t border-slate-100">
        <div className="flex-1 px-3 py-2 text-center border-r border-slate-100 relative">
          <p className="text-[10px] font-bold text-blue-500">{data.config?.ratio_a || 50}%</p>
          <p className="text-[9px] text-slate-400 truncate">{data.config?.label_a || 'Rama A'}</p>
          <Handle type="source" position={Position.Bottom} id="output_a"
            style={{ ...HANDLE_STYLE_OUTPUT, background: '#3b82f6', bottom: -6, left: '50%', transform: 'translateX(-50%)' }} />
        </div>
        <div className="flex-1 px-3 py-2 text-center relative">
          <p className="text-[10px] font-bold text-orange-500">{data.config?.ratio_b || 50}%</p>
          <p className="text-[9px] text-slate-400 truncate">{data.config?.label_b || 'Rama B'}</p>
          <Handle type="source" position={Position.Bottom} id="output_b"
            style={{ ...HANDLE_STYLE_OUTPUT, background: '#f97316', bottom: -6, left: '50%', transform: 'translateX(-50%)' }} />
        </div>
      </div>
    </div>
  </div>
))
SplitNode.displayName = 'SplitNode'

/** ─── CALENDAR NODE ────────────────────────────────────────── */
const CalendarNode = memo(({ data, selected }) => (
  <div className={`rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-200 w-[260px]
    ${selected ? 'ring-4 ring-blue-300/40 scale-[1.02] border-blue-300' : 'border-slate-200 hover:shadow-xl hover:border-blue-200'}`}>
    <Handle type="target" position={Position.Top} id="input"
      style={{ ...HANDLE_STYLE_INPUT, top: -6 }} />
    <div className="flex items-stretch bg-white">
      <div className="w-[52px] bg-gradient-to-b from-blue-50 to-indigo-100 border-r border-blue-100 flex items-center justify-center shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-blue-200 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-blue-600" strokeWidth={2} />
        </div>
      </div>
      <div className="flex-1 px-3.5 py-3 min-w-0">
        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider leading-none">Calendario</p>
        <p className="text-[13px] font-semibold text-slate-800 truncate mt-1">{data.label || 'Agendar Reunión'}</p>
        <p className="text-[10px] text-slate-400 truncate mt-0.5">
          {data.config?.event_title || 'Sin título'} · {data.config?.duration_minutes || 30}min
        </p>
      </div>
    </div>
    <StageBadge stageId={data.config?.stage_id} />
    <DualOutputFooter yesColor="#3b82f6" noColor="#ef4444" />
  </div>
))
CalendarNode.displayName = 'CalendarNode'

/** ─── MOVE STAGE NODE ──────────────────────────────────────── */
const MoveStageNode = memo(({ data, selected }) => {
  const targetStage = PIPELINE_STAGES.find(s => s.id === data.config?.target_stage_id)
  const StageIcon = targetStage ? resolveIcon(targetStage.icon) : ArrowRight
  const stageColor = targetStage
    ? { blue: '#3b82f6', indigo: '#6366f1', cyan: '#06b6d4', violet: '#8b5cf6', amber: '#f59e0b', orange: '#f97316', emerald: '#10b981', slate: '#64748b', rose: '#f43f5e' }[targetStage.color] || '#8b5cf6'
    : '#8b5cf6'
  return (
    <div className={`rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-200 w-[260px]
      ${selected ? 'ring-4 ring-violet-300/40 scale-[1.02] border-violet-300' : 'border-slate-200 hover:shadow-xl hover:border-violet-200'}`}>
      <Handle type="target" position={Position.Top} id="input"
        style={{ ...HANDLE_STYLE_INPUT, top: -6 }} />
      <div className="bg-white px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: `${stageColor}15`, border: `1.5px solid ${stageColor}40` }}>
          <StageIcon className="w-5 h-5" style={{ color: stageColor }} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider leading-none" style={{ color: stageColor }}>Mover a Etapa</p>
          <p className="text-[13px] font-semibold text-slate-800 truncate mt-0.5">
            {targetStage?.label || 'Sin etapa seleccionada'}
          </p>
        </div>
      </div>
      {targetStage && (
        <div className="px-4 py-1.5 border-t border-slate-100 bg-slate-50">
          <p className="text-[9px] text-slate-400 truncate">{targetStage.description}</p>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="output"
        style={{ ...HANDLE_STYLE_OUTPUT, background: stageColor, bottom: -6 }} />
    </div>
  )
})
MoveStageNode.displayName = 'MoveStageNode'

/** ─── SEND FORM NODE ───────────────────────────────────────── */
const SendFormNode = memo(({ data, selected }) => {
  const FORM_LABELS = {
    cv_completo: 'Formulario + CV',
    datos_personales: 'Datos Personales',
    encuesta_salida: 'Encuesta de Salida',
    custom: 'Formulario Custom',
  }
  return (
    <div className={`rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-200 w-[260px]
      ${selected ? 'ring-4 ring-teal-300/40 scale-[1.02] border-teal-300' : 'border-slate-200 hover:shadow-xl hover:border-teal-200'}`}>
      <Handle type="target" position={Position.Top} id="input"
        style={{ ...HANDLE_STYLE_INPUT, top: -6 }} />
      <div className="flex items-stretch bg-white">
        <div className="w-[52px] bg-gradient-to-b from-teal-50 to-teal-100 border-r border-teal-100 flex items-center justify-center shrink-0">
          <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-teal-200 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-teal-600" strokeWidth={2} />
          </div>
        </div>
        <div className="flex-1 px-3.5 py-3 min-w-0">
          <p className="text-[10px] text-teal-500 font-bold uppercase tracking-wider leading-none">Formulario</p>
          <p className="text-[13px] font-semibold text-slate-800 truncate mt-1">{data.label || 'Enviar Formulario'}</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">
            {FORM_LABELS[data.config?.form_type] || 'Sin tipo'}
          </p>
        </div>
      </div>
      <StageBadge stageId={data.config?.stage_id} />
      <DualOutputFooter yesColor="#14b8a6" noColor="#ef4444" />
    </div>
  )
})
SendFormNode.displayName = 'SendFormNode'

// Register
const nodeTypes = {
  trigger: TriggerNode,
  gmail: GmailNode,
  whatsapp: WhatsAppNode,
  wait: WaitNode,
  split: SplitNode,
  calendar: CalendarNode,
  move_stage: MoveStageNode,
  send_form: SendFormNode,
}

// ════════════════════════════════════════════════════════════════════
//  NODE CONFIG PANEL (Right sidebar)
// ════════════════════════════════════════════════════════════════════

function NodeConfigPanel({ node, onUpdate, onDelete, onClose }) {
  const meta = getNodeTypeMeta(node.data.nodeType)
  const Icon = resolveIcon(meta.icon)
  const [label, setLabel] = useState(node.data.label || '')
  const [config, setConfig] = useState(node.data.config || {})

  useEffect(() => {
    setLabel(node.data.label || '')
    setConfig(node.data.config || {})
  }, [node.id])

  const set = (k, v) => setConfig(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    onUpdate(node.id, { ...node.data, label, config })
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: meta.color + '18' }}>
          <Icon className="w-5 h-5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">{meta.label}</p>
          <p className="text-[10px] text-slate-400">{meta.description}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Name */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre del nodo</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
        </div>

        {/* Type-specific config */}
        {node.data.nodeType === 'trigger' && (
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Etapa del pipeline</label>
            <select value={config.stage_id || 'nuevo_lead'} onChange={e => set('stage_id', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-300">
              {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}

        {node.data.nodeType === 'gmail' && (
          <>
            <StageSelector value={config.stage_id} onChange={v => set('stage_id', v)} />
            <CField label="Asunto" value={config.subject} onChange={v => set('subject', v)} placeholder="Asunto del email..." />
            <CField label="Plantilla" value={config.template} onChange={v => set('template', v)} placeholder="ej: email_bienvenida" />
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Enviar a campo</label>
              <select value={config.to_field || 'email'} onChange={e => set('to_field', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-300">
                <option value="email">Email principal</option>
                <option value="email_secondary">Email secundario</option>
              </select>
            </div>
            <CArea label="Cuerpo" value={config.body} onChange={v => set('body', v)} placeholder="Contenido del email..." />
          </>
        )}

        {node.data.nodeType === 'whatsapp' && (
          <>
            <StageSelector value={config.stage_id} onChange={v => set('stage_id', v)} />
            <CArea label="Mensaje" value={config.message} onChange={v => set('message', v)} placeholder="Hola {{nombre}}..." />
            <CToggle label="Incluir video" checked={config.include_video || false} onChange={v => set('include_video', v)} />
            {config.include_video && (
              <CField label="URL del video" value={config.video_url} onChange={v => set('video_url', v)} placeholder="https://..." />
            )}
          </>
        )}

        {node.data.nodeType === 'wait' && (
          <>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Presets rápidos</label>
              <div className="grid grid-cols-2 gap-2">
                {WAIT_PRESETS.map(p => (
                  <button key={p.label}
                    onClick={() => { set('duration', p.duration); set('unit', p.unit) }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all
                      ${config.duration === p.duration && config.unit === p.unit
                        ? 'bg-violet-100 border-violet-300 text-violet-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-200'
                      }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Duración</label>
                <input type="number" min={1} value={config.duration || 1} onChange={e => set('duration', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Unidad</label>
                <select value={config.unit || 'days'} onChange={e => set('unit', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-300">
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Días</option>
                </select>
              </div>
            </div>
          </>
        )}

        {node.data.nodeType === 'split' && (
          <>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">% Rama A</label>
                <input type="number" min={0} max={100} value={config.ratio_a || 50} onChange={e => { set('ratio_a', parseInt(e.target.value) || 0); set('ratio_b', 100 - (parseInt(e.target.value) || 0)) }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">% Rama B</label>
                <input type="number" min={0} max={100} value={config.ratio_b || 50} readOnly
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-slate-50 text-slate-500" />
              </div>
            </div>
            <CField label="Nombre Rama A" value={config.label_a} onChange={v => set('label_a', v)} placeholder="Rama A" />
            <CField label="Nombre Rama B" value={config.label_b} onChange={v => set('label_b', v)} placeholder="Rama B" />
          </>
        )}

        {node.data.nodeType === 'calendar' && (
          <>
            <StageSelector value={config.stage_id} onChange={v => set('stage_id', v)} />
            <CField label="Título del evento" value={config.event_title} onChange={v => set('event_title', v)} placeholder="Pre-filtro Meet — {{nombre}}" />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Duración (min)</label>
                <input type="number" min={5} value={config.duration_minutes || 30} onChange={e => set('duration_minutes', parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tipo</label>
                <select value={config.type || 'meet'} onChange={e => set('type', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="meet">Google Meet</option>
                  <option value="presencial">Presencial</option>
                  <option value="zoom">Zoom</option>
                </select>
              </div>
            </div>
          </>
        )}

        {node.data.nodeType === 'move_stage' && (
          <>
            <div className="p-3 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200">
              <label className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
                <ArrowRight className="w-3 h-3" />
                Etapa destino
              </label>
              <select value={config.target_stage_id || ''} onChange={e => set('target_stage_id', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-violet-200 text-sm outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                <option value="">Seleccionar etapa...</option>
                {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label} — {s.description}</option>)}
              </select>
              <p className="text-[9px] text-violet-400 mt-1">
                El candidato será movido a esta etapa del pipeline
              </p>
            </div>
            <CToggle label="Notificar al equipo" checked={config.auto_notify !== false} onChange={v => set('auto_notify', v)} />
          </>
        )}

        {node.data.nodeType === 'send_form' && (
          <>
            <StageSelector value={config.stage_id} onChange={v => set('stage_id', v)} />
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tipo de formulario</label>
              <select value={config.form_type || 'cv_completo'} onChange={e => set('form_type', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-300">
                <option value="cv_completo">Formulario + CV</option>
                <option value="datos_personales">Datos Personales</option>
                <option value="encuesta_salida">Encuesta de Salida</option>
                <option value="custom">Custom (URL externa)</option>
              </select>
            </div>
            {config.form_type === 'custom' && (
              <CField label="URL del formulario" value={config.form_url} onChange={v => set('form_url', v)} placeholder="https://forms.google.com/..." />
            )}
            <CArea label="Mensaje al candidato" value={config.message} onChange={v => set('message', v)} placeholder="Hola {{nombre}}, te enviamos este formulario..." />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2 shrink-0">
        <button onClick={() => onDelete(node.id)}
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 rounded-lg hover:bg-red-50 transition border border-red-200">
          <Trash2 className="w-3 h-3" />
          Eliminar
        </button>
        <div className="flex-1" />
        <button onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-slate-500 rounded-lg hover:bg-slate-100 transition">
          Cancelar
        </button>
        <button onClick={handleSave}
          className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-white rounded-lg bg-[#003DA5] hover:bg-[#002D7A] transition shadow-sm">
          <Check className="w-3 h-3" />
          Aplicar
        </button>
      </div>
    </div>
  )
}

// Config helpers
function StageSelector({ value, onChange }) {
  return (
    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
      <label className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5 flex items-center gap-1 block">
        <Briefcase className="w-3 h-3" />
        Asociar a etapa del pipeline
      </label>
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white">
        <option value="">Sin etapa asociada</option>
        {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <p className="text-[9px] text-blue-400 mt-1">
        Se activa cuando un candidato entra a esta etapa
      </p>
    </div>
  )
}
function CField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
    </div>
  )
}
function CArea({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
    </div>
  )
}
function CToggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-600">{label}</span>
      <button onClick={() => onChange(!checked)}
        className={`w-10 h-[22px] rounded-full transition-colors relative ${checked ? 'bg-green-500' : 'bg-slate-300'}`}>
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-[3px] transition-transform
          ${checked ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  NODE PALETTE (Left sidebar)
// ════════════════════════════════════════════════════════════════════

function NodePalette({ onAdd }) {
  return (
    <div className="w-[220px] bg-white/95 backdrop-blur-xl border-r border-slate-200 flex flex-col h-full shrink-0">
      <div className="px-4 py-3.5 border-b border-slate-100 shrink-0">
        <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-blue-500" />
          Nodos
        </h2>
        <p className="text-[10px] text-slate-400 mt-0.5">Arrastra o haz clic para agregar</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NODE_TYPES_CATALOG.map(cat => {
          const CatIcon = resolveIcon(cat.icon)
          return (
            <div key={cat.category}>
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <CatIcon className="w-3 h-3 text-slate-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{cat.category}</span>
              </div>
              <div className="space-y-1.5">
                {cat.types.map(nodeType => {
                  const NodeIcon = resolveIcon(nodeType.icon)
                  return (
                    <button
                      key={nodeType.type}
                      onClick={() => onAdd(nodeType.type)}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('application/reactflow-nodetype', nodeType.type)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-slate-100 bg-white
                        hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition-all group text-left cursor-grab active:cursor-grabbing"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                        style={{ background: nodeType.color + '15' }}>
                        <NodeIcon className="w-3.5 h-3.5 transition-colors" style={{ color: nodeType.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-700 group-hover:text-blue-700 transition leading-tight">{nodeType.label}</p>
                        <p className="text-[9px] text-slate-400 truncate leading-tight">{nodeType.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  INNER FLOW (needs ReactFlowProvider wrapping)
// ════════════════════════════════════════════════════════════════════

function WorkflowCanvas() {
  const navigate = useNavigate()
  const reactFlowWrapper = useRef(null)
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading] = useState(true)
  const [workflowId, setWorkflowId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Config panel
  const [selectedNode, setSelectedNode] = useState(null)

  // Multi-select tracking
  const [selectionCount, setSelectionCount] = useState(0)

  // ─── Load ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const wf = await loadWorkflow()
      setWorkflowId(wf.id)
      setNodes(wf.nodes || [])
      setEdges(wf.edges || [])
      setDirty(false)
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar workflow')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Connect (drag output → input) ──────────────────────
  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id: `e_${params.source}_${params.sourceHandle}_${params.target}_${Date.now()}`,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 16, height: 16 },
    }
    setEdges(eds => addEdge(newEdge, eds))
    setDirty(true)
  }, [])

  // ─── Add node from palette ──────────────────────────────
  const handleAddNode = useCallback((nodeType) => {
    const meta = getNodeTypeMeta(nodeType)
    const id = generateNodeId(nodeType)
    const newNode = {
      id,
      type: nodeType,
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 300 },
      data: {
        nodeType,
        label: meta.label,
        config: { ...meta.defaultConfig },
      },
    }
    setNodes(nds => [...nds, newNode])
    setDirty(true)
  }, [])

  // ─── Drop from drag ─────────────────────────────────────
  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const nodeType = e.dataTransfer.getData('application/reactflow-nodetype')
    if (!nodeType) return

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const meta = getNodeTypeMeta(nodeType)
    const id = generateNodeId(nodeType)

    const newNode = {
      id,
      type: nodeType,
      position,
      data: {
        nodeType,
        label: meta.label,
        config: { ...meta.defaultConfig },
      },
    }
    setNodes(nds => [...nds, newNode])
    setDirty(true)
  }, [screenToFlowPosition])

  // ─── Node click → config panel ──────────────────────────
  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node)
  }, [])

  // ─── Update node data ───────────────────────────────────
  const handleUpdateNode = useCallback((nodeId, newData) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: newData } : n
    ))
    setSelectedNode(null)
    setDirty(true)
    toast.success('Nodo actualizado')
  }, [])

  // ─── Delete node ────────────────────────────────────────
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
    setDirty(true)
    toast.success('Nodo eliminado')
  }, [])

  // ─── Delete edge on click ───────────────────────────────
  const onEdgeClick = useCallback((_, edge) => {
    setEdges(eds => eds.filter(e => e.id !== edge.id))
    setDirty(true)
  }, [])

  // ─── Multi-select change ────────────────────────────────
  const onSelectionChange = useCallback(({ nodes: selectedNodes }) => {
    setSelectionCount(selectedNodes?.length || 0)
  }, [])

  // ─── Bulk delete selected ───────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    const selectedIds = nodes.filter(n => n.selected).map(n => n.id)
    if (selectedIds.length === 0) return
    setNodes(nds => nds.filter(n => !n.selected))
    setEdges(eds => eds.filter(e => !selectedIds.includes(e.source) && !selectedIds.includes(e.target)))
    setSelectedNode(null)
    setSelectionCount(0)
    setDirty(true)
    toast.success(`${selectedIds.length} nodos eliminados`)
  }, [nodes])

  // ─── Track position changes as dirty ────────────────────
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes)
    const hasDrag = changes.some(c => c.type === 'position' && c.dragging)
    if (hasDrag) setDirty(true)
  }, [onNodesChange])

  // ─── Save ───────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!workflowId) return
    setSaving(true)
    try {
      // Clean nodes for serialization (strip internal ReactFlow props)
      const cleanNodes = nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }))
      const cleanEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type,
        animated: e.animated,
        style: e.style,
        markerEnd: e.markerEnd,
      }))
      await saveWorkflow(workflowId, cleanNodes, cleanEdges)
      setDirty(false)
      toast.success('Workflow guardado')
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar workflow')
    }
    setSaving(false)
  }, [workflowId, nodes, edges])

  // ─── Default edge options ───────────────────────────────
  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 16, height: 16 },
  }), [])

  // ─── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Cargando workflow...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left Palette */}
      <NodePalette onAdd={handleAddNode} />

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onSelectionChange={onSelectionChange}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.15}
          maxZoom={2}
          deleteKeyCode={['Backspace', 'Delete']}
          selectionOnDrag
          selectionMode="partial"
          panOnDrag={false}
          panActivationKeyCode="Meta"
          className="bg-slate-50"
          proOptions={{ hideAttribution: true }}
          connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5 5' }}
          connectionLineType="smoothstep"
          snapToGrid
          snapGrid={[20, 20]}
        >
          <Background gap={20} size={1.5} color="#dce3ed" variant="dots" />
          <Controls
            position="bottom-left"
            className="!bg-white !rounded-xl !border !border-slate-200 !shadow-lg overflow-hidden"
          />
          <MiniMap
            nodeColor={(n) => {
              const meta = getNodeTypeMeta(n.type)
              return meta.color || '#94a3b8'
            }}
            className="!bg-white !rounded-xl !border !border-slate-200 !shadow-lg"
            pannable
            zoomable
          />

          {/* ─── Top Toolbar ──────────────────────── */}
          <Panel position="top-left" className="!m-3">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-xl px-5 py-3.5 flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-[#003DA5] to-[#002D7A] rounded-xl shadow-lg shadow-blue-500/20">
                <Workflow className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900">Workflow de Reclutamiento</h1>
                <p className="text-[10px] text-slate-400">
                  {nodes.length} nodos · {edges.length} conexiones
                  {dirty && <span className="ml-2 text-amber-500 font-bold">● Sin guardar</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button onClick={() => navigate('/recruitment/pipeline')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
                  <Eye className="w-3.5 h-3.5" /> Pipeline
                </button>
                <button onClick={load}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
                  <RefreshCw className="w-3.5 h-3.5" /> Recargar
                </button>
                <button onClick={handleSave} disabled={!dirty || saving}
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm
                    ${dirty
                      ? 'bg-[#003DA5] hover:bg-[#002D7A] text-white'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}>
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </Panel>

          {/* ─── Selection Toolbar ─────────────────── */}
          {selectionCount > 1 && (
            <Panel position="top-center" className="!mt-20">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white/95 backdrop-blur-xl rounded-xl border border-slate-200 shadow-xl px-4 py-2.5 flex items-center gap-3"
              >
                <span className="text-xs font-semibold text-slate-700">
                  {selectionCount} nodos seleccionados
                </span>
                <button onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition">
                  <Trash2 className="w-3 h-3" />
                  Eliminar todos
                </button>
              </motion.div>
            </Panel>
          )}

          {/* ─── Hint Panel ───────────────────────── */}
          <Panel position="bottom-right" className="!m-3">
            <div className="bg-white/90 backdrop-blur rounded-xl border border-slate-200 shadow px-3 py-2 flex items-center gap-3 text-[10px] text-slate-400">
              <span>🖱️ Arrastra para seleccionar múltiples</span>
              <span>· ⌘+arrastrar para mover canvas</span>
              <span>· Conecta salidas → entradas</span>
              <span>· ⌫ para borrar</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right Config Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="border-l border-slate-200 shadow-xl overflow-hidden shrink-0 h-full"
          >
            <NodeConfigPanel
              node={selectedNode}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onClose={() => setSelectedNode(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  MAIN EXPORT (wrapped in provider)
// ════════════════════════════════════════════════════════════════════

export default function RecruitmentWorkflow() {
  return (
    <div className="h-[calc(100vh-120px)] -m-4 md:-m-8">
      <ReactFlowProvider>
        <WorkflowCanvas />
      </ReactFlowProvider>
    </div>
  )
}
