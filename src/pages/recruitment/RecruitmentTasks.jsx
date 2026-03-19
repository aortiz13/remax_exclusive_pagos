import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    fetchRecruitmentTasks, createRecruitmentTask, updateRecruitmentTask,
    toggleTaskCompleted, deleteRecruitmentTask,
    TASK_TYPES, TASK_PRIORITIES
} from '../../services/recruitmentTaskService'
import { fetchCandidates } from '../../services/recruitmentService'
import {
    Search, CheckCircle2, Circle, Plus, Filter, RotateCcw, Trash2,
    Clock, Calendar, User, Tag, AlertCircle, ChevronDown, ChevronUp,
    Phone, Mail, MessageSquare, Users, ClipboardList, X, Edit3, Eye,
    CalendarCheck, Flag, Save, ExternalLink
} from 'lucide-react'

const PRIORITY_STYLES = {
    alta:  { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
    media: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    baja:  { badge: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
}

const TYPE_ICONS = {
    Llamada: Phone, Email: Mail, WhatsApp: MessageSquare, Reunión: CalendarCheck,
    Seguimiento: Clock, 'Revisión CV': ClipboardList, 'Enviar formulario': Mail,
    'Verificar datos': Eye, Tarea: Tag,
}

export default function RecruitmentTasks() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [showNewModal, setShowNewModal] = useState(false)
    const [editingTask, setEditingTask] = useState(null)

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCompleted, setFilterCompleted] = useState('pending')
    const [filterPriority, setFilterPriority] = useState('all')
    const [filterType, setFilterType] = useState('all')
    const [showFilters, setShowFilters] = useState(false)

    const loadTasks = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchRecruitmentTasks()
            setTasks(data)
        } catch (err) {
            console.error(err)
            toast.error('Error al cargar tareas')
        }
        setLoading(false)
    }, [])

    useEffect(() => { loadTasks() }, [loadTasks])

    const hasFilters = searchTerm || filterCompleted !== 'pending' || filterPriority !== 'all' || filterType !== 'all'

    const filtered = useMemo(() => {
        return tasks.filter(t => {
            const term = searchTerm.toLowerCase()
            const ms = !searchTerm ||
                t.title?.toLowerCase().includes(term) ||
                t.description?.toLowerCase().includes(term) ||
                t.candidate?.first_name?.toLowerCase().includes(term) ||
                t.candidate?.last_name?.toLowerCase().includes(term)

            const mc = filterCompleted === 'all' ? true :
                filterCompleted === 'pending' ? !t.completed : t.completed
            const mp = filterPriority === 'all' || t.priority === filterPriority
            const mt = filterType === 'all' || t.task_type === filterType

            return ms && mc && mp && mt
        })
    }, [tasks, searchTerm, filterCompleted, filterPriority, filterType])

    const handleToggle = async (task) => {
        // Optimistic
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null } : t))
        try {
            await toggleTaskCompleted(task.id, task.completed)
            toast.success(task.completed ? 'Tarea reabierta' : 'Tarea completada ✓')
        } catch {
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed, completed_at: task.completed_at } : t))
            toast.error('Error al actualizar tarea')
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta tarea?')) return
        try {
            await deleteRecruitmentTask(id)
            setTasks(prev => prev.filter(t => t.id !== id))
            toast.success('Tarea eliminada')
        } catch {
            toast.error('Error al eliminar')
        }
    }

    const handleSaveTask = async (formData, isEditing) => {
        try {
            if (isEditing) {
                const updated = await updateRecruitmentTask(formData.id, formData)
                setTasks(prev => prev.map(t => t.id === formData.id ? updated : t))
                toast.success('Tarea actualizada')
            } else {
                const created = await createRecruitmentTask({ ...formData, assigned_to: profile?.id })
                setTasks(prev => [created, ...prev])
                toast.success('Tarea creada')
            }
            setShowNewModal(false)
            setEditingTask(null)
        } catch (err) {
            console.error(err)
            toast.error('Error al guardar tarea')
        }
    }

    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : null
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : null

    // Stats
    const pendingCount = tasks.filter(t => !t.completed).length
    const completedCount = tasks.filter(t => t.completed).length
    const todayCount = tasks.filter(t => {
        if (!t.execution_date) return false
        const td = new Date().toDateString()
        return new Date(t.execution_date).toDateString() === td && !t.completed
    }).length
    const overdueCount = tasks.filter(t => {
        if (!t.execution_date || t.completed) return false
        return new Date(t.execution_date) < new Date()
    }).length

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-[#003DA5] rounded-xl shadow-lg shadow-blue-900/20">
                            <ClipboardList className="w-6 h-6 text-white" />
                        </div>
                        Tareas de Reclutamiento
                    </h1>
                    <p className="text-muted-foreground mt-1">Gestiona las actividades del proceso de reclutamiento</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => { setEditingTask(null); setShowNewModal(true) }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#003DA5] hover:bg-[#002D7A] text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-900/25 hover:scale-[1.02] transition-all">
                        <Plus className="w-4 h-4" /> Nueva Tarea
                    </button>
                </div>
            </div>

            {/* Stats pills */}
            <div className="flex flex-wrap gap-2">
                <StatPill icon={Circle} label="Pendientes" value={pendingCount} color="blue" />
                <StatPill icon={CheckCircle2} label="Completadas" value={completedCount} color="green" />
                <StatPill icon={Calendar} label="Hoy" value={todayCount} color="amber" />
                {overdueCount > 0 && <StatPill icon={AlertCircle} label="Vencidas" value={overdueCount} color="red" />}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="relative w-full sm:w-64 lg:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Buscar tarea o candidato..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>

                {/* Quick filter tabs */}
                <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
                    {[
                        { id: 'pending', label: 'Pendientes' },
                        { id: 'completed', label: 'Completadas' },
                        { id: 'all', label: 'Todas' },
                    ].map(f => (
                        <button key={f.id} onClick={() => setFilterCompleted(f.id)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${filterCompleted === f.id
                                ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                <button onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters
                        ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <Filter className="w-4 h-4" /> Filtros
                    {(filterPriority !== 'all' || filterType !== 'all') && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                </button>

                {hasFilters && (
                    <button onClick={() => { setSearchTerm(''); setFilterCompleted('pending'); setFilterPriority('all'); setFilterType('all') }}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-200">
                        <RotateCcw className="w-3.5 h-3.5" /> Limpiar
                    </button>
                )}
            </div>

            <AnimatePresence>
                {showFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="p-4 bg-white rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Prioridad</label>
                                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary outline-none">
                                    <option value="all">Todas</option>
                                    {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Tipo</label>
                                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary outline-none">
                                    <option value="all">Todos</option>
                                    {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Task List */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-10 h-10 border-[3px] border-slate-200 border-t-primary rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
                    <ClipboardList className="w-12 h-12 text-slate-200 mb-3" />
                    <p className="font-medium text-slate-400">No hay tareas</p>
                    <p className="text-xs text-slate-300 mt-1">Crea una tarea para empezar</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {filtered.map(task => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                onToggle={() => handleToggle(task)}
                                onEdit={() => { setEditingTask(task); setShowNewModal(true) }}
                                onDelete={() => handleDelete(task.id)}
                                onNavigateCandidate={task.candidate?.id ? () => navigate(`/recruitment/candidate/${task.candidate.id}`) : null}
                                fmt={fmt}
                                fmtTime={fmtTime}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Task Modal */}
            <AnimatePresence>
                {showNewModal && (
                    <TaskModal
                        task={editingTask}
                        profileId={profile?.id}
                        onClose={() => { setShowNewModal(false); setEditingTask(null) }}
                        onSave={handleSaveTask}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onEdit, onDelete, onNavigateCandidate, fmt, fmtTime }) {
    const pStyles = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.media
    const TypeIcon = TYPE_ICONS[task.task_type] || Tag
    const isOverdue = task.execution_date && !task.completed && new Date(task.execution_date) < new Date()

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-white rounded-xl border shadow-sm transition-all hover:shadow-md group ${
                task.completed ? 'border-slate-100 opacity-60' : isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}
        >
            <div className="flex items-start gap-3 p-4">
                {/* Checkbox */}
                <button onClick={onToggle} className="mt-0.5 shrink-0 transition-transform hover:scale-110">
                    {task.completed
                        ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                        : <Circle className={`w-5 h-5 ${isOverdue ? 'text-red-400' : 'text-slate-300 hover:text-primary'}`} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {task.title}
                            </p>
                            {task.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
                            )}
                        </div>

                        {/* Actions (hover) */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {/* Type */}
                        <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-[2px] rounded bg-slate-50 text-slate-600 border border-slate-200">
                            <TypeIcon className="w-2.5 h-2.5" />{task.task_type}
                        </span>

                        {/* Priority */}
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-[2px] rounded border ${pStyles.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pStyles.dot}`} />
                            {task.priority}
                        </span>

                        {/* Date */}
                        {task.execution_date && (
                            <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-[2px] rounded border ${
                                isOverdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                <Calendar className="w-2.5 h-2.5" />
                                {fmt(task.execution_date)}
                                {fmtTime(task.execution_date) && ` ${fmtTime(task.execution_date)}`}
                            </span>
                        )}

                        {/* Candidate link */}
                        {task.candidate && (
                            <button onClick={onNavigateCandidate}
                                className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-[2px] rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors">
                                <User className="w-2.5 h-2.5" />
                                {task.candidate.first_name} {task.candidate.last_name}
                                <ExternalLink className="w-2 h-2" />
                            </button>
                        )}

                        {/* Overdue badge */}
                        {isOverdue && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-[2px] rounded bg-red-100 text-red-700 border border-red-200">
                                <AlertCircle className="w-2.5 h-2.5" /> Vencida
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color }) {
    const colors = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        red: 'bg-red-50 text-red-700 border-red-200',
    }
    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${colors[color]}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}: <span className="font-bold">{value}</span>
        </div>
    )
}

// ─── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({ task, profileId, onClose, onSave }) {
    const isEditing = !!task
    const [candidates, setCandidates] = useState([])
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        title: task?.title || '',
        description: task?.description || '',
        task_type: task?.task_type || 'Tarea',
        priority: task?.priority || 'media',
        candidate_id: task?.candidate_id || '',
        execution_date: task?.execution_date ? new Date(task.execution_date).toISOString().slice(0, 16) : '',
        end_date: task?.end_date ? new Date(task.end_date).toISOString().slice(0, 16) : '',
        is_all_day: task?.is_all_day || false,
        reminder_minutes: task?.reminder_minutes ?? 30,
        location: task?.location || '',
        notes: task?.notes || '',
    })

    useEffect(() => {
        fetchCandidates().then(setCandidates).catch(() => {})
    }, [])

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.title.trim()) { toast.error('El título es obligatorio'); return }
        setSaving(true)
        const payload = {
            ...form,
            candidate_id: form.candidate_id || null,
            execution_date: form.execution_date ? new Date(form.execution_date).toISOString() : null,
            end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        }
        if (isEditing) payload.id = task.id
        await onSave(payload, isEditing)
        setSaving(false)
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden"
                onClick={e => e.stopPropagation()}>

                {/* Header — compact */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-[#003DA5] rounded-lg">
                            <ClipboardList className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm">{isEditing ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200/50"><X className="w-4 h-4 text-slate-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
                    {/* Row 1: Title + Candidate */}
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-3">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Título *</label>
                            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Llamar a candidato..." />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Candidato</label>
                            <select value={form.candidate_id} onChange={e => set('candidate_id', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none">
                                <option value="">Sin candidato</option>
                                {candidates.map(c => (
                                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Type + Priority + Reminder */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Tipo</label>
                            <select value={form.task_type} onChange={e => set('task_type', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none">
                                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Prioridad</label>
                            <select value={form.priority} onChange={e => set('priority', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none">
                                {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Recordatorio</label>
                            <select value={form.reminder_minutes} onChange={e => set('reminder_minutes', parseInt(e.target.value))}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none">
                                <option value={0}>Sin recordatorio</option>
                                <option value={15}>15 min antes</option>
                                <option value={30}>30 min antes</option>
                                <option value={60}>1 hora antes</option>
                                <option value={1440}>1 día antes</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 3: Dates + All day */}
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Fecha / Hora</label>
                            <input type="datetime-local" value={form.execution_date} onChange={e => set('execution_date', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Fin (opcional)</label>
                            <input type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div className="flex items-end pb-0.5">
                            <label className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer w-full">
                                <input type="checkbox" checked={form.is_all_day} onChange={e => set('is_all_day', e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary" />
                                <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Todo el día</span>
                            </label>
                        </div>
                    </div>

                    {/* Row 4: Location */}
                    <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Ubicación</label>
                        <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Oficina RE/MAX Providencia" />
                    </div>

                    {/* Row 5: Description + Notes side by side */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Descripción</label>
                            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="Detalles..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Notas internas</label>
                            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="Notas..." />
                        </div>
                    </div>
                </form>

                {/* Footer — sticky outside scroll */}
                <div className="flex justify-end gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100">
                        Cancelar
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-5 py-2 rounded-xl bg-[#003DA5] hover:bg-[#002D7A] text-white text-sm font-semibold shadow-lg shadow-blue-900/25 disabled:opacity-50 transition-all">
                        <Save className="w-3.5 h-3.5 inline mr-1" />
                        {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Tarea'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}
