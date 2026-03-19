import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    fetchCandidateById, updateCandidate, updatePipelineStage,
    fetchPipelineHistory, fetchEmailLogs, fetchWhatsappLogs, logEmailSent, sendRecruitmentEmail,
    PIPELINE_STAGES, CANDIDATE_SOURCES
} from '../../services/recruitmentService'
import { fetchRecruitmentTasks, createRecruitmentTask, TASK_TYPES, TASK_PRIORITIES } from '../../services/recruitmentTaskService'
import { fetchTemplates, renderTemplate } from '../../services/recruitmentTemplateService'
import { useAuth } from '../../context/AuthContext'
import {
    ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, User, Save,
    Clock, ChevronRight, Edit3, X, Check, MessageSquare, Send,
    CalendarCheck, CalendarClock, Trophy, XCircle, Bookmark, Star,
    UserCheck, UserX, Zap, Building, GraduationCap, Car, Globe, FileText,
    CheckCircle2, Circle, ClipboardList, ExternalLink, Plus, AlertCircle,
    Search, StickyNote, Pin, Trash2
} from 'lucide-react'

const STAGE_ICONS = {
    'Nuevo': Zap, 'Reunión Agendada': CalendarClock, 'Reunión Confirmada': CalendarCheck,
    'Aprobado': UserCheck, 'Desaprobado': UserX, 'Ganado': Trophy,
    'Perdido': XCircle, 'Seguimiento': Bookmark,
}

const STAGE_BADGE = {
    'Nuevo': 'bg-blue-50 text-blue-700 border-blue-200',
    'Reunión Agendada': 'bg-sky-50 text-sky-700 border-sky-200',
    'Reunión Confirmada': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Aprobado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Desaprobado': 'bg-red-50 text-red-700 border-red-200',
    'Ganado': 'bg-green-50 text-green-700 border-green-200',
    'Perdido': 'bg-slate-100 text-slate-600 border-slate-200',
    'Seguimiento': 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function RecruitmentCandidateDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { profile } = useAuth()
    const [candidate, setCandidate] = useState(null)
    const [history, setHistory] = useState([])
    const [emailLogs, setEmailLogs] = useState([])
    const [whatsappLogs, setWhatsappLogs] = useState([])
    const [tasks, setTasks] = useState([])
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [editForm, setEditForm] = useState({})
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('timeline')

    useEffect(() => { loadAll() }, [id])

    const loadAll = async () => {
        setLoading(true)
        try {
            const [c, h, e, w, t, n] = await Promise.all([
                fetchCandidateById(id),
                fetchPipelineHistory(id),
                fetchEmailLogs(id),
                fetchWhatsappLogs(id),
                fetchRecruitmentTasks({ candidateId: id }).catch(() => []),
                supabase.from('recruitment_candidate_notes').select('*, creator:profiles(full_name)').eq('candidate_id', id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).then(r => {
                    if (r.error) return supabase.from('recruitment_candidate_notes').select('*').eq('candidate_id', id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).then(r2 => r2.data || [])
                    return r.data || []
                }),
            ])
            setCandidate(c); setEditForm(c); setHistory(h); setEmailLogs(e); setWhatsappLogs(w); setTasks(t); setNotes(n)
        } catch (err) {
            console.error(err); toast.error('Error al cargar candidato')
        }
        setLoading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const updated = await updateCandidate(id, {
                first_name: editForm.first_name, last_name: editForm.last_name,
                email: editForm.email, phone: editForm.phone, whatsapp: editForm.whatsapp,
                city: editForm.city, age: editForm.age, rut: editForm.rut,
                job_title: editForm.job_title, linkedin_url: editForm.linkedin_url, notes: editForm.notes,
            })
            setCandidate(updated); setEditing(false); toast.success('Candidato actualizado')
        } catch (err) { console.error(err); toast.error('Error al guardar') }
        setSaving(false)
    }

    const handleStageChange = async (newStage) => {
        if (!candidate || candidate.pipeline_stage === newStage) return
        const fromStage = candidate.pipeline_stage
        try {
            await updatePipelineStage(id, fromStage, newStage, profile?.id)
            setCandidate(prev => ({ ...prev, pipeline_stage: newStage }))
            const h = await fetchPipelineHistory(id)
            setHistory(h); toast.success(`Movido a "${newStage}"`)
        } catch { toast.error('Error al cambiar estado') }
    }

    const set = (k, v) => setEditForm(prev => ({ ...prev, [k]: v }))
    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
    const fmtShort = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    if (!candidate) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <User className="w-16 h-16 text-slate-200" />
                <p className="text-slate-400 font-medium">Candidato no encontrado</p>
                <button onClick={() => navigate('/recruitment/pipeline')} className="text-primary font-medium text-sm hover:underline">Volver al pipeline</button>
            </div>
        )
    }

    const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim()
    const initials = `${(candidate.first_name || '?')[0]}${(candidate.last_name || '')[0] || ''}`.toUpperCase()
    const StageIcon = STAGE_ICONS[candidate.pipeline_stage] || Star

    return (
        <div className="space-y-5 max-w-6xl mx-auto">
            {/* Back */}
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver
            </button>

            {/* ═══ Two Column Layout ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ─── LEFT: Profile Sidebar ─────────────────────────── */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Profile Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Header - RE/MAX Blue */}
                        <div className="bg-gradient-to-br from-[#003DA5] to-[#002D7A] p-5 relative">
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30" />
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold bg-white/15 backdrop-blur-sm border border-white/20">
                                    {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-lg font-bold text-white truncate">{fullName || 'Sin nombre'}</h1>
                                    {candidate.job_title && (
                                        <p className="text-xs text-blue-200 truncate">{candidate.job_title}</p>
                                    )}
                                </div>
                                {!editing && (
                                    <button onClick={() => setEditing(true)}
                                        className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition-colors border border-white/10">
                                        <Edit3 className="w-3.5 h-3.5 text-white" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stage badge */}
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${STAGE_BADGE[candidate.pipeline_stage] || ''}`}>
                                <StageIcon className="w-3.5 h-3.5" />
                                {candidate.pipeline_stage}
                            </div>
                            <span className="text-[10px] text-slate-400">
                                {candidate.source && `vía ${candidate.source}`}
                            </span>
                        </div>

                        {/* Contact info */}
                        {editing ? (
                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <EditField label="Nombre" value={editForm.first_name} onChange={v => set('first_name', v)} />
                                    <EditField label="Apellido" value={editForm.last_name} onChange={v => set('last_name', v)} />
                                </div>
                                <EditField label="Email" value={editForm.email} onChange={v => set('email', v)} type="email" />
                                <div className="grid grid-cols-2 gap-2">
                                    <EditField label="Teléfono" value={editForm.phone} onChange={v => set('phone', v)} />
                                    <EditField label="WhatsApp" value={editForm.whatsapp} onChange={v => set('whatsapp', v)} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <EditField label="Ciudad" value={editForm.city} onChange={v => set('city', v)} />
                                    <EditField label="Edad" value={editForm.age} onChange={v => set('age', v)} type="number" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <EditField label="RUT" value={editForm.rut} onChange={v => set('rut', v)} />
                                    <EditField label="Cargo" value={editForm.job_title} onChange={v => set('job_title', v)} />
                                </div>
                                <EditField label="LinkedIn" value={editForm.linkedin_url} onChange={v => set('linkedin_url', v)} />
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Notas</label>
                                    <textarea value={editForm.notes || ''} onChange={e => set('notes', e.target.value)} rows={2}
                                        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => { setEditing(false); setEditForm(candidate) }}
                                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
                                        Cancelar
                                    </button>
                                    <button onClick={handleSave} disabled={saving}
                                        className="flex-1 px-3 py-2 rounded-lg bg-[#003DA5] text-white text-xs font-semibold disabled:opacity-50 transition-all">
                                        <Save className="w-3 h-3 inline mr-1" />{saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 space-y-2">
                                {candidate.email && <ContactRow icon={Mail} value={candidate.email} />}
                                {candidate.phone && <ContactRow icon={Phone} value={candidate.phone} />}
                                {candidate.whatsapp && <ContactRow icon={MessageSquare} value={candidate.whatsapp} label="WhatsApp" />}
                                {candidate.city && <ContactRow icon={MapPin} value={candidate.city} />}
                                {candidate.rut && <ContactRow icon={FileText} value={candidate.rut} label="RUT" />}
                                {candidate.age && <ContactRow icon={User} value={`${candidate.age} años`} />}
                                {candidate.linkedin_url && (
                                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary hover:bg-blue-50 transition-colors">
                                        <Globe className="w-4 h-4 text-slate-400" />
                                        <span className="truncate">LinkedIn</span>
                                        <ExternalLink className="w-3 h-3 ml-auto text-slate-300" />
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Notes */}
                        {!editing && candidate.notes && (
                            <div className="px-4 pb-4">
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notas</p>
                                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{candidate.notes}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stage Selector */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Cambiar estado</p>
                        <div className="flex flex-wrap gap-1.5">
                            {PIPELINE_STAGES.map(s => {
                                const active = candidate.pipeline_stage === s.id
                                return (
                                    <button key={s.id} onClick={() => handleStageChange(s.id)}
                                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                                            active
                                                ? `${STAGE_BADGE[s.id]} font-semibold shadow-sm`
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 cursor-pointer'}`}>
                                        {active && <Check className="w-3 h-3" />}
                                        {s.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Quick Dates */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Fechas</p>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Creado</span>
                            <span className="text-slate-700 font-medium">{fmtShort(candidate.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Actualizado</span>
                            <span className="text-slate-700 font-medium">{fmtShort(candidate.updated_at)}</span>
                        </div>
                        {candidate.meeting_date && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5" />Reunión</span>
                                <span className="text-slate-700 font-medium">{fmtShort(candidate.meeting_date)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── RIGHT: Main Content ───────────────────────────── */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Tabs Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="border-b border-slate-100 px-5">
                            <div className="flex gap-0">
                                {[
                                    { id: 'timeline', label: 'Timeline', icon: Clock, count: history.length + tasks.length + emailLogs.length + notes.length },
                                    { id: 'cv', label: 'CV / Datos', icon: FileText },
                                    { id: 'tasks', label: 'Tareas', icon: ClipboardList, count: tasks.length },
                                    { id: 'emails', label: 'Emails', icon: Mail, count: emailLogs.length },
                                    { id: 'notes', label: 'Notas', icon: StickyNote, count: notes.length },
                                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, count: whatsappLogs.length },
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                                            activeTab === tab.id
                                                ? 'border-[#003DA5] text-[#003DA5]'
                                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}>
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                        {tab.count > 0 && (
                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-5">
                            {activeTab === 'timeline' && <TimelineTab history={history} tasks={tasks} emails={emailLogs} notes={notes} />}
                            {activeTab === 'cv' && <CvTab candidate={candidate} />}
                            {activeTab === 'tasks' && <TasksTab tasks={tasks} navigate={navigate} candidateId={id} profileId={profile?.id} onTaskCreated={loadAll} />}
                            {activeTab === 'emails' && <EmailsTab logs={emailLogs} candidate={candidate} onEmailSent={loadAll} />}
                            {activeTab === 'notes' && <NotesTab notes={notes} candidateId={id} profileId={profile?.id} onNotesChanged={loadAll} />}
                            {activeTab === 'whatsapp' && <WhatsAppTab logs={whatsappLogs} />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContactRow({ icon: Icon, value, label }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <Icon className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
                {label && <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none">{label}</p>}
                <p className="text-sm text-slate-700 truncate">{value}</p>
            </div>
        </div>
    )
}

function EditField({ label, value, onChange, type = 'text' }) {
    return (
        <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
            <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
    )
}

function TimelineTab({ history, tasks = [], emails = [], notes = [] }) {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    const [expandedId, setExpandedId] = useState(null)
    const [filterType, setFilterType] = useState('')

    // Merge all events into a single chronological list
    const events = [
        ...history.map(h => ({
            id: `pipeline-${h.id}`, type: 'pipeline', date: h.created_at,
            title: h.from_stage ? `${h.from_stage} → ${h.to_stage}` : `Etapa: ${h.to_stage}`,
            actor: h.profiles ? `${h.profiles.first_name || ''} ${h.profiles.last_name || ''}`.trim() : 'Sistema',
            icon: STAGE_ICONS[h.to_stage] || ChevronRight,
            iconBg: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600',
            raw: h,
        })),
        ...tasks.map(t => ({
            id: `task-${t.id}`, type: 'task', date: t.created_at,
            title: t.title,
            subtitle: t.task_type,
            actor: t.assignee ? `${t.assignee.first_name || ''} ${t.assignee.last_name || ''}`.trim() : '',
            icon: ClipboardList,
            iconBg: t.completed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200',
            iconColor: t.completed ? 'text-green-600' : 'text-amber-600',
            raw: t,
        })),
        ...emails.map(e => ({
            id: `email-${e.id}`, type: 'email', date: e.sent_at || e.created_at,
            title: e.subject || '(Sin asunto)',
            subtitle: e.email_type,
            actor: e.to_email || '',
            icon: Mail,
            iconBg: e.opened_at ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200',
            iconColor: e.opened_at ? 'text-blue-600' : 'text-slate-500',
            raw: e,
        })),
        ...notes.map(n => ({
            id: `note-${n.id}`, type: 'note', date: n.created_at,
            title: n.content.length > 80 ? n.content.substring(0, 80) + '...' : n.content,
            actor: n.creator?.full_name || '',
            icon: StickyNote,
            iconBg: n.is_pinned ? 'bg-amber-50 border-amber-200' : 'bg-yellow-50 border-yellow-200',
            iconColor: n.is_pinned ? 'text-amber-600' : 'text-yellow-600',
            raw: n,
        })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))

    const TYPE_LABELS = { pipeline: 'Pipeline', task: 'Tarea', email: 'Email', note: 'Nota' }
    const filteredEvents = filterType ? events.filter(e => e.type === filterType) : events

    if (events.length === 0) {
        return <p className="text-sm text-slate-400 text-center py-8">Sin actividad registrada</p>
    }

    return (
        <div className="space-y-2">
            {/* Type filter */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <button onClick={() => setFilterType('')}
                    className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${!filterType ? 'bg-[#003DA5] text-white border-[#003DA5]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    Todo ({events.length})
                </button>
                {Object.keys(TYPE_LABELS).map(t => {
                    const count = events.filter(e => e.type === t).length
                    if (count === 0) return null
                    return (
                        <button key={t} onClick={() => setFilterType(filterType === t ? '' : t)}
                            className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${filterType === t ? 'bg-[#003DA5] text-white border-[#003DA5]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                            {TYPE_LABELS[t]} ({count})
                        </button>
                    )
                })}
            </div>

            {/* Events list */}
            <div className="space-y-0">
                {filteredEvents.map((ev, i) => {
                    const isExpanded = expandedId === ev.id
                    const EvIcon = ev.icon
                    return (
                        <div key={ev.id} className="flex gap-3 relative">
                            {i < filteredEvents.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />}
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${ev.iconBg}`}>
                                <EvIcon className={`w-3.5 h-3.5 ${ev.iconColor}`} />
                            </div>
                            <div className="flex-1 pb-4">
                                <button onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                                    className="w-full text-left group">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 group-hover:text-[#003DA5] transition-colors">{ev.title}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {ev.actor && `${ev.actor} · `}{fmt(ev.date)}
                                                {ev.subtitle && ` · ${ev.subtitle}`}
                                            </p>
                                        </div>
                                        <ChevronRight className={`w-3 h-3 text-slate-300 transition-transform mt-1 shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                </button>

                                {/* Expanded detail */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden">
                                            <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                                                {ev.type === 'pipeline' && (
                                                    <>
                                                        <div className="flex items-center gap-1.5">
                                                            {ev.raw.from_stage && (
                                                                <>
                                                                    <span className={`text-[10px] font-medium px-1.5 py-[2px] rounded border ${STAGE_BADGE[ev.raw.from_stage] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{ev.raw.from_stage}</span>
                                                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                                                </>
                                                            )}
                                                            <span className={`text-[10px] font-semibold px-1.5 py-[2px] rounded border ${STAGE_BADGE[ev.raw.to_stage] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{ev.raw.to_stage}</span>
                                                        </div>
                                                        {ev.raw.notes && <p className="text-slate-500 italic">"{ev.raw.notes}"</p>}
                                                    </>
                                                )}
                                                {ev.type === 'task' && (
                                                    <>
                                                        {ev.raw.description && <p className="text-slate-600">{ev.raw.description}</p>}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                                                                ev.raw.priority === 'alta' ? 'bg-red-50 text-red-600 border-red-200' :
                                                                ev.raw.priority === 'baja' ? 'bg-green-50 text-green-600 border-green-200' :
                                                                'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                                                Prioridad: {ev.raw.priority}
                                                            </span>
                                                            {ev.raw.completed && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200">✓ Completada</span>}
                                                            {ev.raw.execution_date && <span className="text-[9px] text-slate-500">📅 {fmt(ev.raw.execution_date)}</span>}
                                                        </div>
                                                        {ev.raw.location && <p className="text-slate-500">📍 {ev.raw.location}</p>}
                                                        {ev.raw.notes && <p className="text-slate-500 italic">"{ev.raw.notes}"</p>}
                                                    </>
                                                )}
                                                {ev.type === 'email' && (
                                                    <>
                                                        <p className="text-slate-600"><strong>Para:</strong> {ev.raw.to_email}</p>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {ev.raw.opened_at && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">👁️ Abierto {fmt(ev.raw.opened_at)}</span>}
                                                            {ev.raw.clicked_at && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200">🖱️ Click {fmt(ev.raw.clicked_at)}</span>}
                                                        </div>
                                                        {ev.raw.body_html && <p className="text-slate-500 line-clamp-3 whitespace-pre-wrap">{ev.raw.body_html.substring(0, 200)}</p>}
                                                    </>
                                                )}
                                                {ev.type === 'note' && (
                                                    <>
                                                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{ev.raw.content}</p>
                                                        {ev.raw.is_pinned && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">📌 Fijada</span>}
                                                    </>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function CvTab({ candidate }) {
    const exp = candidate.experience_json
    const edu = candidate.education_json

    return (
        <div className="space-y-5">
            {candidate.cv_summary && (
                <div>
                    <h3 className="font-semibold text-slate-700 text-sm mb-2 flex items-center gap-2"><FileText className="w-4 h-4" />Resumen</h3>
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">{candidate.cv_summary}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-5">
                {candidate.skills && candidate.skills.length > 0 && (
                    <div>
                        <h3 className="font-semibold text-slate-700 text-sm mb-2">Habilidades</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {candidate.skills.map((s, i) => (
                                <span key={i} className="px-2 py-0.5 bg-blue-50 text-[#003DA5] text-xs rounded-md border border-blue-200 font-medium">{s}</span>
                            ))}
                        </div>
                    </div>
                )}

                {candidate.languages && candidate.languages.length > 0 && (
                    <div>
                        <h3 className="font-semibold text-slate-700 text-sm mb-2">Idiomas</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {candidate.languages.map((l, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-700 text-xs rounded-md border border-slate-200 font-medium">{l}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {Array.isArray(exp) && exp.length > 0 && (
                <div>
                    <h3 className="font-semibold text-slate-700 text-sm mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4" />Experiencia</h3>
                    <div className="space-y-2">
                        {exp.map((e, i) => (
                            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="font-medium text-slate-800 text-sm">{e.puesto || e.position}</p>
                                <p className="text-xs text-slate-500">{e.empresa || e.company} · {e.periodo || e.period}</p>
                                {e.descripcion && <p className="text-xs text-slate-500 mt-1">{e.descripcion}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {Array.isArray(edu) && edu.length > 0 && (
                <div>
                    <h3 className="font-semibold text-slate-700 text-sm mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4" />Formación</h3>
                    <div className="space-y-2">
                        {edu.map((e, i) => (
                            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="font-medium text-slate-800 text-sm">{e.centroEstudio || e.school}</p>
                                <p className="text-xs text-slate-500">{e.titulo || e.degree} · {e.periodo || e.period}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!candidate.cv_summary && (!exp || exp.length === 0) && (!edu || edu.length === 0) && (
                <p className="text-sm text-slate-400 text-center py-8">Sin datos de CV disponibles</p>
            )}

            {/* Boolean flags */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                    { label: 'Trabajo fijo', value: candidate.trabajo_fijo_actual },
                    { label: 'Interés negocio propio', value: candidate.interesa_negocio_propio },
                    { label: 'Exp. bienes raíces', value: candidate.experiencia_bienes_raices },
                    { label: 'Licencia conducir', value: candidate.has_drivers_license },
                    { label: 'Vehículo propio', value: candidate.has_vehicle },
                    { label: 'Disponible viajar', value: candidate.willing_to_travel },
                ].filter(x => x.value !== null && x.value !== undefined).map(x => (
                    <div key={x.label} className={`p-2 rounded-lg border text-xs font-medium text-center ${x.value ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {x.value ? '✓' : '✗'} {x.label}
                    </div>
                ))}
            </div>
        </div>
    )
}

function TasksTab({ tasks, navigate, candidateId, profileId, onTaskCreated }) {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ title: '', description: '', task_type: 'Tarea', priority: 'media', execution_date: '', end_date: '', is_all_day: false, reminder_minutes: '', location: '', notes: '' })

    const REMINDER_OPTIONS = [
        { value: '', label: 'Sin recordatorio' },
        { value: '5', label: '5 min antes' },
        { value: '15', label: '15 min antes' },
        { value: '30', label: '30 min antes' },
        { value: '60', label: '1 hora antes' },
        { value: '1440', label: '1 día antes' },
    ]

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!form.title.trim()) { toast.error('Título obligatorio'); return }
        setSaving(true)
        try {
            await createRecruitmentTask({
                ...form,
                candidate_id: candidateId,
                assigned_to: profileId,
                execution_date: form.execution_date ? new Date(form.execution_date).toISOString() : null,
                end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
                reminder_minutes: form.reminder_minutes ? parseInt(form.reminder_minutes) : null,
            })
            toast.success('Tarea creada')
            setForm({ title: '', description: '', task_type: 'Tarea', priority: 'media', execution_date: '', end_date: '', is_all_day: false, reminder_minutes: '', location: '', notes: '' })
            setShowForm(false)
            onTaskCreated()
        } catch (err) { console.error(err); toast.error('Error al crear tarea') }
        setSaving(false)
    }

    return (
        <div className="space-y-3">
            {/* Header with action */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">{tasks.length} tarea{tasks.length !== 1 ? 's' : ''}</p>
                <button onClick={() => setShowForm(!showForm)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        showForm ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-[#003DA5] text-white hover:bg-[#002D7A]'}`}>
                    {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {showForm ? 'Cerrar' : 'Nueva Tarea'}
                </button>
            </div>

            {/* Full create form */}
            <AnimatePresence>
                {showForm && (
                    <motion.form onSubmit={handleCreate}
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="p-3.5 bg-gradient-to-b from-blue-50/80 to-white rounded-xl border border-blue-200 space-y-3 shadow-sm">
                            {/* Title */}
                            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Título de la tarea..." autoFocus />

                            {/* Description */}
                            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-primary outline-none resize-none leading-relaxed"
                                placeholder="Descripción (opcional)..." />

                            {/* Type + Priority */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-400 font-medium mb-0.5 block">Tipo</label>
                                    <select value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))}
                                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs">
                                        {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 font-medium mb-0.5 block">Prioridad</label>
                                    <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs">
                                        {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* All-day + Dates */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={form.is_all_day} onChange={e => setForm(p => ({ ...p, is_all_day: e.target.checked }))}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-[#003DA5] focus:ring-primary" />
                                    <span className="text-xs text-slate-600">Todo el día</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-medium mb-0.5 block">Fecha inicio</label>
                                        <input type={form.is_all_day ? 'date' : 'datetime-local'} value={form.execution_date}
                                            onChange={e => setForm(p => ({ ...p, execution_date: e.target.value }))}
                                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-medium mb-0.5 block">Fecha fin</label>
                                        <input type={form.is_all_day ? 'date' : 'datetime-local'} value={form.end_date}
                                            onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs" />
                                    </div>
                                </div>
                            </div>

                            {/* Reminder + Location */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-400 font-medium mb-0.5 block">Recordatorio</label>
                                    <select value={form.reminder_minutes} onChange={e => setForm(p => ({ ...p, reminder_minutes: e.target.value }))}
                                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs">
                                        {REMINDER_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 font-medium mb-0.5 block">Ubicación</label>
                                    <input type="text" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                                        placeholder="Lugar o link..." />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[10px] text-slate-400 font-medium mb-0.5 block">Notas</label>
                                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-primary outline-none resize-none"
                                    placeholder="Notas adicionales..." />
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">Cancelar</button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-[#003DA5] text-white rounded-lg disabled:opacity-50 hover:bg-[#002D7A] transition-all shadow-sm">
                                    <Plus className="w-3 h-3" />{saving ? 'Creando...' : 'Crear Tarea'}
                                </button>
                            </div>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Task list */}
            {tasks.length === 0 && !showForm ? (
                <div className="text-center py-6">
                    <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Sin tareas asociadas</p>
                </div>
            ) : (
                tasks.map(t => {
                    const isOverdue = t.execution_date && !t.completed && new Date(t.execution_date) < new Date()
                    return (
                        <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            t.completed ? 'bg-slate-50 border-slate-100 opacity-60' : isOverdue ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200'}`}>
                            {t.completed
                                ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                : <Circle className={`w-4 h-4 shrink-0 ${isOverdue ? 'text-red-400' : 'text-slate-300'}`} />}
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${t.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.title}</p>
                                {t.execution_date && (
                                    <p className={`text-[10px] ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                                        {fmt(t.execution_date)}{isOverdue && ' · Vencida'}
                                    </p>
                                )}
                            </div>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                t.priority === 'alta' ? 'bg-red-50 text-red-600 border-red-200' :
                                t.priority === 'baja' ? 'bg-green-50 text-green-600 border-green-200' :
                                'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                {t.priority}
                            </span>
                        </div>
                    )
                })
            )}
        </div>
    )
}

function EmailsTab({ logs, candidate, onEmailSent }) {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    const [showCompose, setShowCompose] = useState(false)
    const [sending, setSending] = useState(false)
    const [emailForm, setEmailForm] = useState({ subject: '', body: '', email_type: 'Manual' })
    const [templates, setTemplates] = useState([])
    const [selectedTemplateId, setSelectedTemplateId] = useState('')
    const [selectedEmail, setSelectedEmail] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('')

    useEffect(() => {
        fetchTemplates().then(setTemplates).catch(() => {})
    }, [])

    const handleTemplateSelect = (templateId) => {
        setSelectedTemplateId(templateId)
        if (!templateId) return
        const tpl = templates.find(t => t.id === templateId)
        if (!tpl) return
        const rendered = renderTemplate(tpl, candidate)
        setEmailForm(prev => ({
            ...prev,
            subject: rendered.subject,
            body: rendered.body,
            email_type: tpl.category || 'Manual',
        }))
    }

    const EMAIL_TYPES = ['Manual', 'Invitación', 'Confirmación', 'Seguimiento', 'Bienvenida', 'Aprobación', 'Rechazo', 'Agradecimiento']

    const handleSend = async (e) => {
        e.preventDefault()
        if (!emailForm.subject.trim()) { toast.error('El asunto es obligatorio'); return }
        if (!candidate?.email) { toast.error('El candidato no tiene email'); return }
        setSending(true)
        try {
            await sendRecruitmentEmail({
                candidateId: candidate.id,
                toEmail: candidate.email,
                subject: emailForm.subject,
                bodyHtml: emailForm.body,
                templateId: selectedTemplateId || null,
            })
            toast.success(`Email enviado a ${candidate.email}`)
            setEmailForm({ subject: '', body: '', email_type: 'Manual' })
            setSelectedTemplateId('')
            setShowCompose(false)
            onEmailSent()
        } catch (err) {
            console.error(err)
            // Fallback: log locally if API fails
            try {
                await logEmailSent(candidate.id, {
                    email_type: emailForm.email_type,
                    subject: emailForm.subject,
                    body_html: emailForm.body,
                    to_email: candidate.email,
                    status: 'failed',
                })
            } catch {}
            toast.error(err.message || 'Error al enviar email')
        }
        setSending(false)
    }

    const handleReply = (email) => {
        setEmailForm({
            subject: `Re: ${email.subject || ''}`,
            body: `\n\n───── Mensaje original ─────\n${email.body_html || ''}\n`,
            email_type: email.email_type || 'Manual',
        })
        setSelectedEmail(null)
        setShowCompose(true)
    }

    const handleResend = (email) => {
        setEmailForm({
            subject: email.subject || '',
            body: email.body_html || '',
            email_type: email.email_type || 'Manual',
        })
        setSelectedEmail(null)
        setShowCompose(true)
    }

    const getStatusBadge = (email) => {
        if (email.clicked_at) return { label: 'Click', color: 'bg-green-50 text-green-700 border-green-200', icon: '🖱️' }
        if (email.opened_at) return { label: 'Abierto', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '👁️' }
        return { label: 'Enviado', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: '✉️' }
    }

    const getTypeBadgeColor = (type) => {
        const colors = {
            'Invitación': 'bg-blue-50 text-blue-600 border-blue-200',
            'Confirmación': 'bg-indigo-50 text-indigo-600 border-indigo-200',
            'Seguimiento': 'bg-amber-50 text-amber-600 border-amber-200',
            'Bienvenida': 'bg-green-50 text-green-600 border-green-200',
            'Aprobación': 'bg-emerald-50 text-emerald-600 border-emerald-200',
            'Rechazo': 'bg-red-50 text-red-600 border-red-200',
            'Agradecimiento': 'bg-purple-50 text-purple-600 border-purple-200',
        }
        return colors[type] || 'bg-slate-50 text-slate-600 border-slate-200'
    }

    // Filter emails
    const filteredLogs = logs.filter(l => {
        if (searchTerm && !l.subject?.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !l.email_type?.toLowerCase().includes(searchTerm.toLowerCase())) return false
        if (filterType && l.email_type !== filterType) return false
        return true
    })

    // Unique email types from logs
    const usedTypes = [...new Set(logs.map(l => l.email_type).filter(Boolean))]

    return (
        <div className="space-y-3">
            {/* ═══ Header Bar ═══ */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400 font-medium">{logs.length} email{logs.length !== 1 ? 's' : ''}</p>
                    {logs.length > 0 && (
                        <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200">
                                {logs.filter(l => l.opened_at).length} abiertos
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                                {logs.filter(l => l.clicked_at).length} clicks
                            </span>
                        </div>
                    )}
                </div>
                <button onClick={() => { setShowCompose(!showCompose); setSelectedEmail(null) }}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        showCompose ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-[#003DA5] text-white hover:bg-[#002D7A]'}`}>
                    {showCompose ? <X className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                    {showCompose ? 'Cerrar' : 'Redactar'}
                </button>
            </div>

            {/* ═══ Compose Form ═══ */}
            <AnimatePresence>
                {showCompose && (
                    <motion.form onSubmit={handleSend}
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="p-3.5 bg-gradient-to-b from-blue-50/80 to-white rounded-xl border border-blue-200 space-y-2.5 shadow-sm">
                            {/* Template selector */}
                            {templates.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-[#003DA5] shrink-0" />
                                    <select value={selectedTemplateId} onChange={e => handleTemplateSelect(e.target.value)}
                                        className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-primary outline-none">
                                        <option value="">📋 Seleccionar plantilla...</option>
                                        {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                                    </select>
                                </div>
                            )}

                            {/* To + Type row */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 flex-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs">
                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-slate-500">Para:</span>
                                    <strong className="text-slate-700">{candidate?.email || 'Sin email'}</strong>
                                </div>
                                <select value={emailForm.email_type} onChange={e => setEmailForm(p => ({ ...p, email_type: e.target.value }))}
                                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs w-32 shrink-0">
                                    {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {/* Subject */}
                            <input type="text" value={emailForm.subject} onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Asunto del email..." />

                            {/* Body */}
                            <textarea value={emailForm.body} onChange={e => setEmailForm(p => ({ ...p, body: e.target.value }))} rows={6}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none resize-none leading-relaxed"
                                placeholder="Escribe el cuerpo del email..." />

                            {!candidate?.email && (
                                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                                    <AlertCircle className="w-3.5 h-3.5" /> El candidato no tiene email registrado
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-1.5">
                                    {selectedTemplateId && (
                                        <span className="text-[9px] text-[#003DA5] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-medium">
                                            📋 {templates.find(t => t.id === selectedTemplateId)?.name}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowCompose(false)}
                                        className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={sending || !candidate?.email}
                                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-[#003DA5] text-white rounded-lg disabled:opacity-50 hover:bg-[#002D7A] transition-all shadow-sm">
                                        <Send className="w-3 h-3" />{sending ? 'Enviando...' : 'Enviar Email'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* ═══ Email Detail View ═══ */}
            <AnimatePresence>
                {selectedEmail && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Detail header */}
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <button onClick={() => setSelectedEmail(null)}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                                <ArrowLeft className="w-3 h-3" /> Volver
                            </button>
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => handleReply(selectedEmail)}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#003DA5] bg-blue-50 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors">
                                    <Mail className="w-3 h-3" /> Responder
                                </button>
                                <button onClick={() => handleResend(selectedEmail)}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 bg-white rounded-md border border-slate-200 hover:bg-slate-50 transition-colors">
                                    <Send className="w-3 h-3" /> Reenviar
                                </button>
                            </div>
                        </div>

                        {/* Detail content */}
                        <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-bold text-slate-800">{selectedEmail.subject || '(Sin asunto)'}</h3>
                                {(() => { const s = getStatusBadge(selectedEmail); return (
                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${s.color}`}>
                                        {s.icon} {s.label}
                                    </span>
                                )})()}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span>Para: <strong>{selectedEmail.to_email || candidate?.email}</strong></span>
                                <span>·</span>
                                <span>{fmt(selectedEmail.sent_at)}</span>
                                {selectedEmail.email_type && (
                                    <>
                                        <span>·</span>
                                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${getTypeBadgeColor(selectedEmail.email_type)}`}>
                                            {selectedEmail.email_type}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Status timeline */}
                            <div className="flex items-center gap-4 py-2 px-3 bg-slate-50 rounded-lg text-[10px]">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-slate-600">Enviado {fmt(selectedEmail.sent_at)}</span>
                                </div>
                                {selectedEmail.opened_at && (
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <span className="text-slate-600">Abierto {fmt(selectedEmail.opened_at)}</span>
                                    </div>
                                )}
                                {selectedEmail.clicked_at && (
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                                        <span className="text-slate-600">Click {fmt(selectedEmail.clicked_at)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Email body */}
                            <div className="bg-white border border-slate-100 rounded-lg p-4">
                                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {selectedEmail.body_html || '(Sin contenido)'}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ Email List ═══ */}
            {!selectedEmail && (
                <>
                    {/* Search + Filter bar */}
                    {logs.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-[150px]">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por asunto..."
                                    className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            {usedTypes.length > 1 && (
                                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white">
                                    <option value="">Todos los tipos</option>
                                    {usedTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Email items */}
                    {filteredLogs.length === 0 && !showCompose ? (
                        <div className="text-center py-8">
                            <Mail className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                            <p className="text-sm text-slate-400">{searchTerm || filterType ? 'Sin resultados' : 'Sin emails registrados'}</p>
                            {!showCompose && !searchTerm && (
                                <button onClick={() => setShowCompose(true)}
                                    className="mt-2 text-xs text-[#003DA5] font-medium hover:underline">
                                    Enviar primer email →
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {filteredLogs.map(l => {
                                const status = getStatusBadge(l)
                                return (
                                    <div key={l.id} onClick={() => setSelectedEmail(l)}
                                        className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all group">
                                        {/* Status dot */}
                                        <div className="mt-1.5 shrink-0">
                                            <div className={`w-2.5 h-2.5 rounded-full ${
                                                l.clicked_at ? 'bg-green-500' : l.opened_at ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                        </div>
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-sm font-medium text-slate-700 truncate">{l.subject || '(Sin asunto)'}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${getTypeBadgeColor(l.email_type)}`}>
                                                    {l.email_type}
                                                </span>
                                                <span className="text-[10px] text-slate-400">{fmt(l.sent_at)}</span>
                                                {l.to_email && <span className="text-[10px] text-slate-400">→ {l.to_email}</span>}
                                            </div>
                                            {l.body_html && (
                                                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{l.body_html.substring(0, 100)}</p>
                                            )}
                                        </div>
                                        {/* Status badge + actions */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${status.color}`}>
                                                {status.icon} {status.label}
                                            </span>
                                            {l.ab_variant && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-200">
                                                    A/B {l.ab_variant}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function NotesTab({ notes, candidateId, profileId, onNotesChanged }) {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    const [showNew, setShowNew] = useState(false)
    const [newNote, setNewNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [editContent, setEditContent] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    const handleCreate = async () => {
        if (!newNote.trim()) return
        setSaving(true)
        try {
            await supabase.from('recruitment_candidate_notes').insert({
                candidate_id: candidateId,
                content: newNote.trim(),
                created_by: profileId,
            })
            toast.success('Nota agregada')
            setNewNote('')
            setShowNew(false)
            onNotesChanged()
        } catch (err) { console.error(err); toast.error('Error al guardar nota') }
        setSaving(false)
    }

    const handleUpdate = async (noteId) => {
        if (!editContent.trim()) return
        try {
            await supabase.from('recruitment_candidate_notes').update({
                content: editContent.trim(),
                updated_at: new Date().toISOString(),
            }).eq('id', noteId)
            toast.success('Nota actualizada')
            setEditingId(null)
            onNotesChanged()
        } catch (err) { console.error(err); toast.error('Error al actualizar') }
    }

    const handleDelete = async (noteId) => {
        try {
            await supabase.from('recruitment_candidate_notes').delete().eq('id', noteId)
            toast.success('Nota eliminada')
            setDeleteConfirm(null)
            onNotesChanged()
        } catch (err) { console.error(err); toast.error('Error al eliminar') }
    }

    const handleTogglePin = async (note) => {
        try {
            await supabase.from('recruitment_candidate_notes').update({
                is_pinned: !note.is_pinned,
            }).eq('id', note.id)
            onNotesChanged()
        } catch (err) { console.error(err) }
    }

    const filtered = notes.filter(n =>
        !searchTerm || n.content.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400 font-medium">{notes.length} nota{notes.length !== 1 ? 's' : ''}</p>
                <button onClick={() => setShowNew(!showNew)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        showNew ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-[#003DA5] text-white hover:bg-[#002D7A]'}`}>
                    {showNew ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {showNew ? 'Cerrar' : 'Nueva Nota'}
                </button>
            </div>

            {/* New Note Form */}
            <AnimatePresence>
                {showNew && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="p-3.5 bg-gradient-to-b from-amber-50/80 to-white rounded-xl border border-amber-200 space-y-2 shadow-sm">
                            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={4}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none resize-none leading-relaxed"
                                placeholder="Escribe una nota sobre este candidato..." autoFocus />
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400">{newNote.length} caracteres</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setShowNew(false); setNewNote('') }}
                                        className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                                        Cancelar
                                    </button>
                                    <button onClick={handleCreate} disabled={saving || !newNote.trim()}
                                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-[#003DA5] text-white rounded-lg disabled:opacity-50 hover:bg-[#002D7A] transition-all shadow-sm">
                                        <Save className="w-3 h-3" />{saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search */}
            {notes.length > 2 && (
                <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar notas..."
                        className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-primary outline-none" />
                </div>
            )}

            {/* Notes List */}
            {filtered.length === 0 ? (
                <div className="text-center py-8">
                    <StickyNote className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">{searchTerm ? 'Sin resultados' : 'Sin notas. Agrega la primera.'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(note => (
                        <div key={note.id}
                            className={`rounded-xl border transition-all ${
                                note.is_pinned ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}>

                            {editingId === note.id ? (
                                /* ── Editing mode ── */
                                <div className="p-3 space-y-2">
                                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none resize-none" autoFocus />
                                    <div className="flex justify-end gap-1.5">
                                        <button onClick={() => setEditingId(null)}
                                            className="px-2.5 py-1 text-[10px] text-slate-500 rounded-md hover:bg-slate-100">Cancelar</button>
                                        <button onClick={() => handleUpdate(note.id)}
                                            className="px-2.5 py-1 text-[10px] font-semibold bg-[#003DA5] text-white rounded-md">Guardar</button>
                                    </div>
                                </div>
                            ) : (
                                /* ── View mode ── */
                                <div className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap flex-1">{note.content}</p>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button onClick={() => handleTogglePin(note)}
                                                className={`p-1 rounded-md transition-colors ${note.is_pinned ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'}`}
                                                title={note.is_pinned ? 'Desfijar' : 'Fijar'}>
                                                <Pin className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => { setEditingId(note.id); setEditContent(note.content) }}
                                                className="p-1 rounded-md text-slate-300 hover:text-[#003DA5] hover:bg-blue-50 transition-colors">
                                                <Edit3 className="w-3 h-3" />
                                            </button>
                                            {deleteConfirm === note.id ? (
                                                <div className="flex items-center gap-0.5">
                                                    <button onClick={() => handleDelete(note.id)}
                                                        className="px-1.5 py-0.5 text-[9px] font-semibold bg-red-500 text-white rounded">Sí</button>
                                                    <button onClick={() => setDeleteConfirm(null)}
                                                        className="px-1.5 py-0.5 text-[9px] text-slate-500 rounded hover:bg-slate-100">No</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setDeleteConfirm(note.id)}
                                                    className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                                        {note.creator?.full_name && <span>{note.creator.full_name}</span>}
                                        <span>{fmt(note.created_at)}</span>
                                        {note.updated_at !== note.created_at && <span className="italic">(editado)</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function WhatsAppTab({ logs }) {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

    if (logs.length === 0) {
        return <p className="text-sm text-slate-400 text-center py-8">Sin mensajes WhatsApp registrados</p>
    }

    return (
        <div className="space-y-2">
            {logs.map(l => (
                <div key={l.id} className="flex items-start gap-3 p-3 bg-green-50/50 rounded-xl border border-green-100">
                    <div className="p-1.5 bg-green-100 rounded-lg"><MessageSquare className="w-3.5 h-3.5 text-green-600" /></div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{l.message_type}</p>
                        {l.message_content && <p className="text-xs text-slate-500 line-clamp-2">{l.message_content}</p>}
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmt(l.sent_at)} {l.delivered && '· ✓ Entregado'}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
