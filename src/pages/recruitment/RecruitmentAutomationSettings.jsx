import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Zap, Mail, ClipboardList, Plus, Trash2, ToggleLeft, ToggleRight,
    ChevronDown, ChevronRight, Settings, BarChart3, Clock, ArrowRight,
    CalendarCheck, UserCheck, Edit3, Save, X
} from 'lucide-react'
import { fetchAutomationRules, upsertAutomationRule, deleteAutomationRule, fetchABMetrics } from '../../services/recruitmentAutomation'
import { fetchTemplates } from '../../services/recruitmentTemplateService'

const PIPELINE_STAGES = ['Nuevo', 'Reunión Agendada', 'Reunión Confirmada', 'Aprobado', 'Rechazado']
const STAGE_COLORS = {
    'Nuevo': 'from-blue-500 to-blue-600',
    'Reunión Agendada': 'from-indigo-500 to-indigo-600',
    'Reunión Confirmada': 'from-cyan-500 to-cyan-600',
    'Aprobado': 'from-green-500 to-green-600',
    'Rechazado': 'from-red-500 to-red-600',
}
const STAGE_ICONS = {
    'Nuevo': Zap,
    'Reunión Agendada': CalendarCheck,
    'Reunión Confirmada': CalendarCheck,
    'Aprobado': UserCheck,
    'Rechazado': X,
}

export default function RecruitmentAutomationSettings() {
    const [rules, setRules] = useState([])
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [expandedStage, setExpandedStage] = useState(null)
    const [editingRule, setEditingRule] = useState(null)
    const [abMetrics, setAbMetrics] = useState({})

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [rulesData, templatesData] = await Promise.all([
                fetchAutomationRules(),
                fetchTemplates(),
            ])
            setRules(rulesData)
            setTemplates(templatesData)
        } catch (err) {
            console.error(err)
            toast.error('Error al cargar reglas')
        }
        setLoading(false)
    }

    const handleToggleRule = async (rule) => {
        try {
            await upsertAutomationRule({ ...rule, is_active: !rule.is_active })
            toast.success(rule.is_active ? 'Regla desactivada' : 'Regla activada')
            loadData()
        } catch { toast.error('Error al cambiar estado') }
    }

    const handleSaveRule = async (rule) => {
        try {
            await upsertAutomationRule(rule)
            toast.success('Regla guardada')
            setEditingRule(null)
            loadData()
        } catch { toast.error('Error al guardar') }
    }

    const handleDeleteRule = async (id) => {
        if (!confirm('¿Eliminar esta regla de automatización?')) return
        try {
            await deleteAutomationRule(id)
            toast.success('Regla eliminada')
            loadData()
        } catch { toast.error('Error al eliminar') }
    }

    const loadABMetrics = async (rule) => {
        if (!rule.ab_enabled || !rule.template_id || !rule.ab_template_b_id) return
        try {
            const metrics = await fetchABMetrics(rule.template_id, rule.ab_template_b_id)
            setAbMetrics(prev => ({ ...prev, [rule.id]: metrics }))
        } catch { /* ignore */ }
    }

    const getRulesForStage = (stage) => rules.filter(r => r.trigger_stage === stage)

    if (loading) return (
        <div className="flex items-center justify-center h-96">
            <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full" />
        </div>
    )

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#003DA5] to-[#002D7A] rounded-xl flex items-center justify-center">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Automatización de Reclutamiento</h1>
                        <p className="text-sm text-slate-500">Configura qué pasa al mover un candidato entre etapas</p>
                    </div>
                </div>
            </div>

            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700">
                        <p className="font-semibold mb-1">¿Cómo funciona?</p>
                        <p>Al mover un candidato a una etapa del pipeline, se ejecutan automáticamente las reglas configuradas aquí.
                        Los emails se envían desde <strong>emprendedores@remax-exclusive.cl</strong>.</p>
                    </div>
                </div>
            </div>

            {/* Cron reminders status */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" /> Recordatorios automáticos (cron)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-green-800">📧 Confirmación día de reunión</p>
                        <p className="text-xs text-green-600 mt-1">Diario a las 8am · Candidatos con reunión hoy</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-amber-800">🔄 Seguimiento sin respuesta</p>
                        <p className="text-xs text-amber-600 mt-1">Cada 2 horas · Candidatos sin respuesta en 48h</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-red-800">⚠️ Candidatos estancados</p>
                        <p className="text-xs text-red-600 mt-1">Lunes 9am · En "Nuevo" hace +7 días sin contacto</p>
                    </div>
                </div>
            </div>

            {/* Rules by stage */}
            <div className="space-y-3">
                {PIPELINE_STAGES.map(stage => {
                    const stageRules = getRulesForStage(stage)
                    const isExpanded = expandedStage === stage
                    const StageIcon = STAGE_ICONS[stage] || Zap

                    return (
                        <div key={stage} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            {/* Stage header */}
                            <button
                                onClick={() => setExpandedStage(isExpanded ? null : stage)}
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${STAGE_COLORS[stage]} flex items-center justify-center`}>
                                        <StageIcon className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-400">Al mover a →</span>
                                            <span className="font-bold text-slate-800">{stage}</span>
                                        </div>
                                        <p className="text-xs text-slate-400">{stageRules.length} regla{stageRules.length !== 1 ? 's' : ''} configurada{stageRules.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {stageRules.length > 0 && (
                                        <div className="flex gap-1">
                                            {stageRules.filter(r => r.action_type === 'send_email').length > 0 && (
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-200">
                                                    {stageRules.filter(r => r.action_type === 'send_email').length} email
                                                </span>
                                            )}
                                            {stageRules.filter(r => r.action_type === 'create_task').length > 0 && (
                                                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-full border border-amber-200">
                                                    {stageRules.filter(r => r.action_type === 'create_task').length} tarea
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                </div>
                            </button>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                        <div className="px-5 pb-4 space-y-3 border-t border-slate-100 pt-3">
                                            {/* Existing rules */}
                                            {stageRules.map(rule => (
                                                <RuleCard
                                                    key={rule.id}
                                                    rule={rule}
                                                    templates={templates}
                                                    abMetrics={abMetrics[rule.id]}
                                                    onToggle={() => handleToggleRule(rule)}
                                                    onEdit={() => setEditingRule({ ...rule })}
                                                    onDelete={() => handleDeleteRule(rule.id)}
                                                    onLoadMetrics={() => loadABMetrics(rule)}
                                                />
                                            ))}

                                            {/* Add rule buttons */}
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => setEditingRule({ trigger_stage: stage, action_type: 'send_email', is_active: true, ab_enabled: false, delay_minutes: 0 })}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Agregar Email
                                                </button>
                                                <button
                                                    onClick={() => setEditingRule({ trigger_stage: stage, action_type: 'create_task', is_active: true, task_type: 'Seguimiento' })}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Agregar Tarea
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingRule && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pl-[200px]"
                        onClick={() => setEditingRule(null)}
                    >
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="bg-gradient-to-r from-[#003DA5] to-[#002D7A] px-6 py-4 flex items-center justify-between">
                                <h2 className="font-bold text-white flex items-center gap-2">
                                    {editingRule.action_type === 'send_email' ? <Mail className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                                    {editingRule.id ? 'Editar Regla' : 'Nueva Regla'} — {editingRule.trigger_stage}
                                </h2>
                                <button onClick={() => setEditingRule(null)} className="text-white/80 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {editingRule.action_type === 'send_email' ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Plantilla de Email (A)</label>
                                            <select
                                                value={editingRule.template_id || ''}
                                                onChange={e => setEditingRule(prev => ({ ...prev, template_id: e.target.value || null }))}
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                            >
                                                <option value="">Seleccionar plantilla...</option>
                                                {templates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.category}</option>)}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setEditingRule(prev => ({ ...prev, ab_enabled: !prev.ab_enabled }))}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                {editingRule.ab_enabled ?
                                                    <ToggleRight className="w-6 h-6 text-blue-600" /> :
                                                    <ToggleLeft className="w-6 h-6 text-slate-300" />
                                                }
                                                <span className={`font-semibold ${editingRule.ab_enabled ? 'text-blue-700' : 'text-slate-400'}`}>
                                                    Prueba A/B
                                                </span>
                                            </button>
                                        </div>

                                        {editingRule.ab_enabled && (
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Plantilla B (variante)</label>
                                                <select
                                                    value={editingRule.ab_template_b_id || ''}
                                                    onChange={e => setEditingRule(prev => ({ ...prev, ab_template_b_id: e.target.value || null }))}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                                >
                                                    <option value="">Seleccionar variante B...</option>
                                                    {templates.filter(t => t.id !== editingRule.template_id).map(t => (
                                                        <option key={t.id} value={t.id}>{t.name} — {t.category}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Delay (minutos después del cambio)</label>
                                            <select
                                                value={editingRule.delay_minutes || 0}
                                                onChange={e => setEditingRule(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) }))}
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                            >
                                                <option value={0}>Inmediato</option>
                                                <option value={5}>5 minutos</option>
                                                <option value={15}>15 minutos</option>
                                                <option value={30}>30 minutos</option>
                                                <option value={60}>1 hora</option>
                                                <option value={120}>2 horas</option>
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Título de la tarea</label>
                                            <input
                                                type="text"
                                                value={editingRule.task_title || ''}
                                                onChange={e => setEditingRule(prev => ({ ...prev, task_title: e.target.value }))}
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                                placeholder="Ej: Enviar documentación de incorporación a {{nombre}}"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Variables: {'{{nombre}}'}, {'{{apellido}}'}, {'{{nombre_completo}}'}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de tarea</label>
                                            <select
                                                value={editingRule.task_type || 'Seguimiento'}
                                                onChange={e => setEditingRule(prev => ({ ...prev, task_type: e.target.value }))}
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                            >
                                                <option>Seguimiento</option>
                                                <option>Llamada</option>
                                                <option>Email</option>
                                                <option>Reunión</option>
                                                <option>Documentación</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 px-6 pb-5">
                                <button onClick={() => setEditingRule(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button
                                    onClick={() => handleSaveRule(editingRule)}
                                    className="px-4 py-2 text-sm font-semibold bg-[#003DA5] text-white rounded-lg hover:bg-[#002D7A] flex items-center gap-1.5"
                                >
                                    <Save className="w-3.5 h-3.5" /> Guardar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function RuleCard({ rule, templates, abMetrics, onToggle, onEdit, onDelete, onLoadMetrics }) {
    const isEmail = rule.action_type === 'send_email'

    return (
        <div className={`border rounded-xl p-4 transition-all ${rule.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEmail ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                        {isEmail ? <Mail className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-800">
                            {isEmail ? `Email: ${rule.template?.name || 'Sin plantilla'}` : `Tarea: ${rule.task_title || 'Sin título'}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            {isEmail && rule.ab_enabled && (
                                <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-bold rounded border border-purple-200">A/B TEST</span>
                            )}
                            {rule.delay_minutes > 0 && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" /> {rule.delay_minutes}min
                                </span>
                            )}
                            {isEmail && rule.template_b && (
                                <span className="text-[10px] text-slate-400">
                                    B: {rule.template_b.name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {isEmail && rule.ab_enabled && (
                        <button onClick={onLoadMetrics} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Ver métricas A/B">
                            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                    )}
                    <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button onClick={onToggle} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                        {rule.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                    </button>
                    <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                </div>
            </div>

            {/* A/B Metrics */}
            {abMetrics && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {['A', 'B'].map(variant => (
                        <div key={variant} className="bg-slate-50 rounded-lg p-2">
                            <p className="text-[10px] font-bold text-slate-500 mb-1">Variante {variant}</p>
                            <div className="flex gap-3 text-xs">
                                <span>📧 {abMetrics[variant]?.total || 0}</span>
                                <span>👁️ {abMetrics[variant]?.openRate || 0}%</span>
                                <span>🖱️ {abMetrics[variant]?.clickRate || 0}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
