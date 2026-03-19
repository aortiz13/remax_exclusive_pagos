import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import isToday from 'date-fns/isToday'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase } from '../../services/supabase'
import { fetchCandidates } from '../../services/recruitmentService'
import { fetchRecruitmentTasks, createRecruitmentTask, TASK_TYPES, TASK_PRIORITIES } from '../../services/recruitmentTaskService'
import { useAuth } from '../../context/AuthContext'
import {
    ChevronLeft, ChevronRight, Plus, Clock, Calendar as CalendarIcon,
    User, X, Save, Users, MapPin, Search
} from 'lucide-react'

const locales = { 'es': es }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

const calendarStyles = `
    .rec-cal .rbc-calendar { font-family: inherit; }
    .rec-cal .rbc-header { padding: 10px 4px; font-weight: 600; font-size: 0.8rem; border-bottom: 1px solid #e2e8f0; text-transform: capitalize; }
    .rec-cal .rbc-today { background-color: #eff6ff; }
    .rec-cal .rbc-event { border-radius: 6px; font-size: 0.75rem; }
    .rec-cal .rbc-time-view, .rec-cal .rbc-month-view { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .rec-cal .rbc-current-time-indicator { background-color: #003DA5; height: 2px; }
    .rec-cal .rbc-current-time-indicator::before {
        content: ''; position: absolute; left: -5px; top: -3px;
        width: 8px; height: 8px; background-color: #003DA5; border-radius: 50%;
    }
`

export default function RecruitmentCalendar() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [events, setEvents] = useState([])
    const [candidates, setCandidates] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState(Views.WEEK)
    const [date, setDate] = useState(new Date())

    // Modal
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [form, setForm] = useState({
        title: '', task_type: 'Reunión', priority: 'media',
        candidate_id: '', execution_date: '', end_date: '',
        description: '', location: '',
    })
    const [saving, setSaving] = useState(false)
    const [candidateSearch, setCandidateSearch] = useState('')

    useEffect(() => { loadAll() }, [])

    const loadAll = async () => {
        setLoading(true)
        try {
            const [tasks, cands] = await Promise.all([
                fetchRecruitmentTasks({}),
                fetchCandidates(),
            ])
            setCandidates(cands)

            // Build events from tasks
            const taskEvents = tasks.map(t => {
                const start = new Date(t.execution_date)
                let end = t.end_date ? new Date(t.end_date) : new Date(start.getTime() + 60 * 60000)
                if (end <= start) end = new Date(start.getTime() + 30 * 60000)
                const candName = t.candidate ? `${t.candidate.first_name} ${t.candidate.last_name || ''}`.trim() : ''
                return {
                    id: `task-${t.id}`,
                    taskId: t.id,
                    title: `${t.title}${candName ? ` — ${candName}` : ''}`,
                    start, end,
                    type: t.task_type || 'Tarea',
                    completed: t.completed,
                    priority: t.priority,
                    candidate: t.candidate,
                    source: 'task',
                }
            })

            // Build events from candidates with meeting_date
            const meetingEvents = cands
                .filter(c => c.meeting_date)
                .map(c => {
                    const start = new Date(c.meeting_date)
                    const end = new Date(start.getTime() + 60 * 60000)
                    return {
                        id: `meeting-${c.id}`,
                        candidateId: c.id,
                        title: `📋 Reunión: ${c.first_name} ${c.last_name || ''}`,
                        start, end,
                        type: 'Reunión',
                        completed: false,
                        candidate: c,
                        location: c.meeting_location,
                        source: 'candidate',
                    }
                })

            setEvents([...taskEvents, ...meetingEvents])
        } catch (err) {
            console.error(err)
            toast.error('Error al cargar calendario')
        }
        setLoading(false)
    }

    const toLocal = (d) => {
        const pad = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    const handleSelectSlot = ({ start, end }) => {
        setSelectedEvent(null)
        const endWithDuration = start.getTime() === end.getTime()
            ? new Date(start.getTime() + 60 * 60000) : end
        setForm({
            title: '', task_type: 'Reunión', priority: 'media',
            candidate_id: '', description: '', location: '',
            execution_date: toLocal(start),
            end_date: toLocal(endWithDuration),
        })
        setCandidateSearch('')
        setModalOpen(true)
    }

    const handleSelectEvent = (event) => {
        if (event.source === 'candidate') {
            navigate(`/recruitment/candidate/${event.candidateId}`)
        } else {
            setSelectedEvent(event)
            setForm({
                title: event.title,
                task_type: event.type || 'Reunión',
                priority: event.priority || 'media',
                candidate_id: event.candidate?.id || '',
                execution_date: toLocal(event.start),
                end_date: toLocal(event.end),
                description: '',
                location: event.location || '',
            })
            setModalOpen(true)
        }
    }

    const handleSave = async () => {
        if (!form.title.trim()) { toast.error('Título obligatorio'); return }
        setSaving(true)
        try {
            await createRecruitmentTask({
                title: form.title,
                task_type: form.task_type,
                priority: form.priority,
                candidate_id: form.candidate_id || null,
                assigned_to: profile?.id,
                execution_date: new Date(form.execution_date).toISOString(),
                end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
                description: form.description,
            })
            toast.success('Evento creado')
            setModalOpen(false)
            loadAll()
        } catch (err) { console.error(err); toast.error('Error al crear evento') }
        setSaving(false)
    }

    const eventStyleGetter = (event) => {
        if (event.completed) {
            return {
                style: {
                    backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', color: '#94a3b8',
                    textDecoration: 'line-through', borderRadius: '6px', opacity: 0.7,
                    borderLeft: '4px solid #cbd5e1',
                }
            }
        }

        const isOverdue = event.start < new Date() && !event.completed
        let bg = '#003DA5', border = '#002D7A'

        if (event.type === 'Reunión') { bg = '#003DA5'; border = '#002D7A' }
        else if (event.type === 'Llamada') { bg = '#0ea5e9'; border = '#0284c7' }
        else if (event.type === 'Email') { bg = '#f43f5e'; border = '#e11d48' }
        else if (event.type === 'WhatsApp') { bg = '#22c55e'; border = '#16a34a' }
        else { bg = '#f59e0b'; border = '#d97706' }

        if (event.source === 'candidate') { bg = '#6366f1'; border = '#4f46e5' }

        return {
            style: {
                backgroundColor: `${bg}1A`, color: border,
                border: `1px solid ${bg}40`, borderLeft: `4px solid ${border}`,
                borderRadius: '6px', fontWeight: '500', fontSize: '0.75rem',
                padding: '2px 5px',
                ...(isOverdue ? { borderLeftColor: '#ef4444' } : {}),
            }
        }
    }

    const filteredCandidates = candidateSearch
        ? candidates.filter(c =>
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(candidateSearch.toLowerCase()) ||
            c.email?.toLowerCase().includes(candidateSearch.toLowerCase())
        ).slice(0, 6)
        : []

    const CustomToolbar = (toolbar) => (
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2">
                <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm items-center">
                    <button onClick={() => toolbar.onNavigate('PREV')} className="p-1.5 hover:bg-slate-100 rounded-md">
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <button onClick={() => toolbar.onNavigate('TODAY')}
                        className="px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md capitalize">
                        {isToday(toolbar.date) ? 'Hoy' : format(toolbar.date, "d 'de' MMM", { locale: es })}
                    </button>
                    <button onClick={() => toolbar.onNavigate('NEXT')} className="p-1.5 hover:bg-slate-100 rounded-md">
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                </div>
                <h2 className="text-lg font-bold text-slate-800 capitalize ml-2">{toolbar.label}</h2>
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                {[
                    { v: 'month', l: 'Mes' }, { v: 'week', l: 'Semana' },
                    { v: 'day', l: 'Día' }, { v: 'agenda', l: 'Agenda' },
                ].map(({ v, l }) => (
                    <button key={v} onClick={() => toolbar.onView(v)}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${toolbar.view === v ? 'bg-[#003DA5] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                        {l}
                    </button>
                ))}
            </div>
        </div>
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-[#003DA5] rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-4 max-w-7xl mx-auto">
            <style>{calendarStyles}</style>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Calendario de Reclutamiento</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Reuniones con candidatos y tareas del equipo</p>
                </div>
                <button onClick={() => handleSelectSlot({ start: new Date(), end: new Date(Date.now() + 60 * 60000) })}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#003DA5] to-[#002D7A] text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all">
                    <Plus className="w-4 h-4" /> Nuevo Evento
                </button>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 rec-cal" style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
                <Calendar
                    localizer={localizer}
                    events={events}
                    view={view}
                    onView={setView}
                    date={date}
                    onNavigate={setDate}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    selectable
                    eventPropGetter={eventStyleGetter}
                    components={{ toolbar: CustomToolbar }}
                    messages={{
                        today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
                        month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda',
                        noEventsInRange: 'Sin eventos en este rango',
                        showMore: (count) => `+${count} más`,
                    }}
                    culture="es"
                    step={30}
                    timeslots={2}
                    min={new Date(2025, 0, 1, 7, 0)}
                    max={new Date(2025, 0, 1, 21, 0)}
                />
            </div>

            {/* ═══ Event Modal ═══ */}
            <AnimatePresence>
                {modalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
                        onClick={() => setModalOpen(false)}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="bg-gradient-to-r from-[#003DA5] to-[#002D7A] px-5 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <CalendarIcon className="w-4 h-4" />
                                    <h2 className="font-bold text-sm">{selectedEvent ? 'Detalle del Evento' : 'Nuevo Evento'}</h2>
                                </div>
                                <button onClick={() => setModalOpen(false)} className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg">
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            </div>

                            <div className="p-5 space-y-3">
                                {/* Title */}
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Título</label>
                                    <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="Reunión con candidato..." readOnly={!!selectedEvent} />
                                </div>

                                {/* Type + Priority */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Tipo</label>
                                        <select value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" disabled={!!selectedEvent}>
                                            {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Prioridad</label>
                                        <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" disabled={!!selectedEvent}>
                                            {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Inicio</label>
                                        <input type="datetime-local" value={form.execution_date}
                                            onChange={e => setForm(p => ({ ...p, execution_date: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" disabled={!!selectedEvent} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Fin</label>
                                        <input type="datetime-local" value={form.end_date}
                                            onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" disabled={!!selectedEvent} />
                                    </div>
                                </div>

                                {/* Candidate picker */}
                                {!selectedEvent && (
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Candidato</label>
                                        {form.candidate_id ? (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50">
                                                <User className="w-3.5 h-3.5 text-[#003DA5]" />
                                                <span className="text-sm text-slate-700 flex-1">
                                                    {candidates.find(c => c.id === form.candidate_id)
                                                        ? `${candidates.find(c => c.id === form.candidate_id).first_name} ${candidates.find(c => c.id === form.candidate_id).last_name || ''}`
                                                        : 'Candidato seleccionado'}
                                                </span>
                                                <button onClick={() => setForm(p => ({ ...p, candidate_id: '' }))} className="text-slate-400 hover:text-red-500">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input type="text" value={candidateSearch}
                                                    onChange={e => setCandidateSearch(e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                                    placeholder="Buscar candidato..." />
                                                {filteredCandidates.length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg z-10 max-h-40 overflow-y-auto">
                                                        {filteredCandidates.map(c => (
                                                            <button key={c.id}
                                                                onClick={() => { setForm(p => ({ ...p, candidate_id: c.id })); setCandidateSearch('') }}
                                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex items-center gap-2">
                                                                <User className="w-3 h-3 text-slate-400" />
                                                                <span>{c.first_name} {c.last_name || ''}</span>
                                                                <span className="text-[10px] text-slate-400 ml-auto">{c.pipeline_stage}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedEvent?.candidate && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50">
                                        <User className="w-3.5 h-3.5 text-[#003DA5]" />
                                        <span className="text-sm text-slate-700">
                                            {selectedEvent.candidate.first_name} {selectedEvent.candidate.last_name || ''}
                                        </span>
                                        <button onClick={() => navigate(`/recruitment/candidate/${selectedEvent.candidate.id}`)}
                                            className="ml-auto text-[10px] text-[#003DA5] font-semibold hover:underline">
                                            Ver perfil →
                                        </button>
                                    </div>
                                )}

                                {/* Description (for new events only) */}
                                {!selectedEvent && (
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Notas</label>
                                        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                            rows={2} placeholder="Notas adicionales..." />
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                                <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700">
                                    {selectedEvent ? 'Cerrar' : 'Cancelar'}
                                </button>
                                {!selectedEvent && (
                                    <button onClick={handleSave} disabled={saving}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-[#003DA5] text-white rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-[#002D7A] transition-all">
                                        <Save className="w-3.5 h-3.5" /> {saving ? 'Creando...' : 'Crear Evento'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
