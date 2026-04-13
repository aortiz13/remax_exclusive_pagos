import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../../services/supabase'
import { fetchCandidates, PIPELINE_STAGES, fetchFunnelMetrics, fetchConversionBySource } from '../../services/recruitmentService'
import { fetchRecruitmentTasks } from '../../services/recruitmentTaskService'
import {
    Users, UserPlus, Trophy, ClipboardList, Clock, TrendingUp,
    AlertCircle, Zap, CalendarClock, CalendarCheck, Calendar,
    UserCheck, UserX, XCircle, Bookmark, Star, ChevronRight,
    Mail, FileText, Plus, MapPin, BarChart3, ArrowUpRight, ArrowDownRight,
    Timer, Send, MousePointerClick, ExternalLink
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────
const STAGE_COLORS = {
    'nuevo_lead':         { bg: 'bg-blue-500',    light: 'bg-blue-50 text-blue-700',      bar: '#3b82f6' },
    'contacto_inicial':   { bg: 'bg-indigo-500',  light: 'bg-indigo-50 text-indigo-700',  bar: '#6366f1' },
    'pre_filtro':         { bg: 'bg-cyan-500',    light: 'bg-cyan-50 text-cyan-700',      bar: '#06b6d4' },
    'formulario_cv':      { bg: 'bg-violet-500',  light: 'bg-violet-50 text-violet-700',  bar: '#8b5cf6' },
    'reunion_presencial': { bg: 'bg-amber-500',   light: 'bg-amber-50 text-amber-700',    bar: '#f59e0b' },
    'cierre_comercial':   { bg: 'bg-orange-500',  light: 'bg-orange-50 text-orange-700',  bar: '#f97316' },
    'ganado':             { bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700', bar: '#10b981' },
    'perdido':            { bg: 'bg-slate-400',   light: 'bg-slate-100 text-slate-600',    bar: '#94a3b8' },
    'seguimiento':        { bg: 'bg-rose-400',    light: 'bg-rose-50 text-rose-700',       bar: '#fb7185' },
}
const STAGE_ICONS = {
    'nuevo_lead': Zap, 'contacto_inicial': Mail, 'pre_filtro': CalendarCheck,
    'formulario_cv': FileText, 'reunion_presencial': CalendarClock, 'cierre_comercial': UserCheck,
    'ganado': Trophy, 'perdido': XCircle, 'seguimiento': Bookmark,
}

const DATE_RANGES = [
    { id: 'week', label: 'Esta semana' },
    { id: 'month', label: 'Este mes' },
    { id: '30d', label: '30 días' },
    { id: 'all', label: 'Todo' },
]

function getDateRange(rangeId) {
    const now = new Date()
    switch (rangeId) {
        case 'week': {
            const d = new Date(now); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0); return d
        }
        case 'month': {
            return new Date(now.getFullYear(), now.getMonth(), 1)
        }
        case '30d': {
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        }
        default: return new Date(2000, 0, 1)
    }
}

// ─── Component ───────────────────────────────────────────────
export default function RecruitmentDashboard() {
    const navigate = useNavigate()
    const [candidates, setCandidates] = useState([])
    const [tasks, setTasks] = useState([])
    const [history, setHistory] = useState([])
    const [emailLogs, setEmailLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [dateRange, setDateRange] = useState('all')

    useEffect(() => { loadAll() }, [])

    const loadAll = async () => {
        setLoading(true)
        try {
            const [cands, tsks, hist, emails] = await Promise.all([
                fetchCandidates(),
                fetchRecruitmentTasks({}),
                supabase.from('recruitment_pipeline_history')
                    .select('*, candidate:recruitment_candidates(id, first_name, last_name)')
                    .order('changed_at', { ascending: false })
                    .limit(50)
                    .then(r => r.data || []),
                supabase.from('recruitment_email_logs')
                    .select('*')
                    .order('sent_at', { ascending: false })
                    .then(r => r.data || []),
            ])
            setCandidates(cands)
            setTasks(tsks)
            setHistory(hist)
            setEmailLogs(emails)
        } catch (err) { console.error(err); toast.error('Error al cargar dashboard') }
        setLoading(false)
    }

    // ─── Date-filtered data ──────────────────────────────────
    const rangeStart = useMemo(() => getDateRange(dateRange), [dateRange])
    const filteredCandidates = useMemo(() =>
        candidates.filter(c => new Date(c.created_at) >= rangeStart), [candidates, rangeStart])
    const filteredHistory = useMemo(() =>
        history.filter(h => new Date(h.changed_at) >= rangeStart), [history, rangeStart])
    const filteredEmails = useMemo(() =>
        emailLogs.filter(e => new Date(e.sent_at) >= rangeStart), [emailLogs, rangeStart])

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // ─── KPI stats ────────────────────────────────────────────
    const total = filteredCandidates.length
    const newThisWeek = filteredCandidates.filter(c => new Date(c.created_at) >= weekAgo).length
    const wonCount = filteredCandidates.filter(c => c.pipeline_stage === 'ganado').length
    const conversionRate = total > 0 ? ((wonCount / total) * 100).toFixed(1) : '0'
    const pendingTasks = tasks.filter(t => !t.completed).length
    const overdueTasks = tasks.filter(t => !t.completed && t.execution_date && new Date(t.execution_date) < now)

    // ─── Stage counts ──────────────────────────────────────────
    const stageCounts = {}
    PIPELINE_STAGES.forEach(s => { stageCounts[s.id] = 0 })
    filteredCandidates.forEach(c => { if (stageCounts[c.pipeline_stage] !== undefined) stageCounts[c.pipeline_stage]++ })
    const maxStageCount = Math.max(...Object.values(stageCounts), 1)

    // ─── Source counts + conversion ─────────────────────────────
    const sourceStats = useMemo(() => {
        const map = {}
        filteredCandidates.forEach(c => {
            const s = c.source || 'Sin fuente'
            if (!map[s]) map[s] = { total: 0, won: 0 }
            map[s].total++
            if (c.pipeline_stage === 'ganado') map[s].won++
        })
        return Object.entries(map)
            .map(([source, stats]) => ({ source, ...stats, rate: stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(0) : '0' }))
            .sort((a, b) => b.total - a.total)
    }, [filteredCandidates])
    const maxSourceCount = Math.max(...sourceStats.map(s => s.total), 1)

    // ─── Stagnant candidates (>7 days without stage change) ───
    const stagnantCandidates = useMemo(() => {
        const latestChange = {}
        history.forEach(h => {
            if (!latestChange[h.candidate_id] || new Date(h.changed_at) > new Date(latestChange[h.candidate_id].changed_at)) {
                latestChange[h.candidate_id] = h
            }
        })
        return candidates
            .filter(c => c.pipeline_stage !== 'Ganado' && c.pipeline_stage !== 'Perdido' && c.pipeline_stage !== 'Desaprobado')
            .map(c => {
                const last = latestChange[c.id]
                const lastDate = last ? new Date(last.changed_at) : new Date(c.created_at)
                const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
                return { ...c, daysSince, lastDate }
            })
            .filter(c => c.daysSince >= 7)
            .sort((a, b) => b.daysSince - a.daysSince)
    }, [candidates, history])

    // ─── Today's / Tomorrow's meetings ─────────────────────────
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowEnd = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000)
    const upcomingMeetings = useMemo(() => {
        const fromCandidates = candidates
            .filter(c => c.meeting_date && new Date(c.meeting_date) >= todayStart && new Date(c.meeting_date) < tomorrowEnd)
            .map(c => ({
                id: c.id, name: `${c.first_name} ${c.last_name || ''}`.trim(),
                date: new Date(c.meeting_date), location: c.meeting_location,
                stage: c.pipeline_stage, type: 'candidate',
            }))
        const fromTasks = tasks
            .filter(t => !t.completed && t.task_type === 'Reunión' && t.execution_date &&
                new Date(t.execution_date) >= todayStart && new Date(t.execution_date) < tomorrowEnd)
            .map(t => ({
                id: t.id, name: t.candidate ? `${t.candidate.first_name} ${t.candidate.last_name || ''}`.trim() : t.title,
                date: new Date(t.execution_date), location: '', stage: t.candidate?.pipeline_stage,
                type: 'task', candidateId: t.candidate?.id,
            }))
        return [...fromCandidates, ...fromTasks].sort((a, b) => a.date - b.date)
    }, [candidates, tasks])

    // ─── Average time per stage ────────────────────────────────
    const avgTimePerStage = useMemo(() => {
        const transitions = {}
        history.forEach(h => {
            if (!h.from_stage || !h.to_stage) return
            if (!transitions[h.from_stage]) transitions[h.from_stage] = []
        })
        // Group sequential transitions per candidate
        const byCand = {}
        history.forEach(h => {
            if (!byCand[h.candidate_id]) byCand[h.candidate_id] = []
            byCand[h.candidate_id].push(h)
        })
        const stageDurations = {}
        Object.values(byCand).forEach(events => {
            const sorted = events.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at))
            for (let i = 0; i < sorted.length - 1; i++) {
                const stage = sorted[i].to_stage
                const days = (new Date(sorted[i + 1].changed_at) - new Date(sorted[i].changed_at)) / (1000 * 60 * 60 * 24)
                if (!stageDurations[stage]) stageDurations[stage] = []
                stageDurations[stage].push(days)
            }
        })
        return PIPELINE_STAGES
            .filter(s => stageDurations[s.id] && stageDurations[s.id].length > 0)
            .map(s => {
                const durations = stageDurations[s.id]
                const avg = durations.reduce((a, b) => a + b, 0) / durations.length
                return { stage: s.id, avg: avg.toFixed(1), count: durations.length }
            })
    }, [history])
    const maxAvgDays = Math.max(...avgTimePerStage.map(s => parseFloat(s.avg)), 1)

    // ─── Weekly trend (last 8 weeks) ────────────────────────────
    const weeklyTrend = useMemo(() => {
        const weeks = []
        for (let i = 7; i >= 0; i--) {
            const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
            const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
            const count = candidates.filter(c => {
                const d = new Date(c.created_at)
                return d >= start && d < end
            }).length
            weeks.push({
                label: `S${8 - i}`,
                count,
                startDate: start,
            })
        }
        return weeks
    }, [candidates])
    const maxWeekly = Math.max(...weeklyTrend.map(w => w.count), 1)

    // ─── Email metrics ──────────────────────────────────────────
    const emailStats = useMemo(() => {
        const total = filteredEmails.length
        const opened = filteredEmails.filter(e => e.opened_at).length
        const clicked = filteredEmails.filter(e => e.clicked_at).length
        return {
            total,
            opened,
            clicked,
            openRate: total > 0 ? ((opened / total) * 100).toFixed(0) : '0',
            clickRate: total > 0 ? ((clicked / total) * 100).toFixed(0) : '0',
        }
    }, [filteredEmails])

    // ─── Weekly summary ─────────────────────────────────────────
    const weeklySummary = useMemo(() => {
        const newCands = candidates.filter(c => new Date(c.created_at) >= weekAgo).length
        const stageChanges = history.filter(h => new Date(h.changed_at) >= weekAgo)
        const approvals = stageChanges.filter(h => h.to_stage === 'Aprobado').length
        const won = stageChanges.filter(h => h.to_stage === 'Ganado').length
        const lost = stageChanges.filter(h => h.to_stage === 'Perdido' || h.to_stage === 'Desaprobado').length
        const meetings = stageChanges.filter(h => h.to_stage === 'Reunión Agendada' || h.to_stage === 'Reunión Confirmada').length
        const emailsSent = emailLogs.filter(e => new Date(e.sent_at) >= weekAgo).length
        return { newCands, approvals, won, lost, meetings, emailsSent }
    }, [candidates, history, emailLogs])

    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-[#003DA5] rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-5 max-w-7xl mx-auto">
            {/* ═══ Header + Date Filter + Quick Actions ═══ */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard de Reclutamiento</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Resumen general del módulo de captación</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Quick Actions (#9) */}
                    <button onClick={() => navigate('/recruitment/candidates')}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
                        <UserPlus className="w-3.5 h-3.5" /> Nuevo Candidato
                    </button>
                    <button onClick={() => navigate('/recruitment/calendar')}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
                        <Calendar className="w-3.5 h-3.5" /> Agendar Reunión
                    </button>
                    <button onClick={() => navigate('/recruitment/templates')}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
                        <FileText className="w-3.5 h-3.5" /> Plantillas
                    </button>

                    {/* Date filter (#1) */}
                    <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                        {DATE_RANGES.map(r => (
                            <button key={r.id} onClick={() => setDateRange(r.id)}
                                className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                                    dateRange === r.id ? 'bg-[#003DA5] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ Weekly Summary (#8) ═══ */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-[#003DA5] to-[#002D7A] rounded-2xl p-4 text-white flex items-center gap-6 flex-wrap overflow-hidden relative">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
                <div className="flex items-center gap-2 shrink-0 relative z-10">
                    <BarChart3 className="w-5 h-5 opacity-80" />
                    <span className="text-sm font-bold">Esta semana</span>
                </div>
                {[
                    { v: weeklySummary.newCands, l: 'Nuevos' },
                    { v: weeklySummary.meetings, l: 'Reuniones' },
                    { v: weeklySummary.approvals, l: 'Aprobados' },
                    { v: weeklySummary.won, l: 'Ganados' },
                    { v: weeklySummary.lost, l: 'Perdidos' },
                    { v: weeklySummary.emailsSent, l: 'Emails' },
                ].map((s, i) => (
                    <div key={i} className="text-center relative z-10">
                        <p className="text-xl font-bold">{s.v}</p>
                        <p className="text-[10px] opacity-70">{s.l}</p>
                    </div>
                ))}
            </motion.div>

            {/* ═══ KPI Cards ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Candidatos', value: total, icon: Users, color: 'from-[#003DA5] to-[#002D7A]', sub: `${candidates.filter(c => !['Perdido', 'Desaprobado'].includes(c.pipeline_stage)).length} activos` },
                    { label: 'Nuevos (7 días)', value: newThisWeek, icon: UserPlus, color: 'from-emerald-500 to-emerald-600', sub: `de ${total} total` },
                    { label: 'Conversión', value: `${conversionRate}%`, icon: TrendingUp, color: 'from-amber-500 to-orange-500', sub: `${wonCount} ganados` },
                    { label: 'Tareas Pendientes', value: pendingTasks, icon: ClipboardList, color: overdueTasks.length > 0 ? 'from-red-500 to-red-600' : 'from-slate-600 to-slate-700', sub: overdueTasks.length > 0 ? `${overdueTasks.length} vencidas` : 'Todo al día' },
                ].map((kpi, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className={`bg-gradient-to-br ${kpi.color} rounded-xl p-4 shadow-md relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full -translate-y-4 translate-x-4" />
                        <kpi.icon className="w-4 h-4 text-white opacity-80 mb-1.5" />
                        <p className="text-2xl font-bold text-white">{kpi.value}</p>
                        <p className="text-[10px] text-white opacity-70 mt-0.5">{kpi.label}</p>
                        <p className="text-[9px] text-white opacity-50">{kpi.sub}</p>
                    </motion.div>
                ))}
            </div>

            {/* ═══ Row 1: Meetings + Stagnant ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Today's Meetings (#3) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-[#003DA5]" /> Reuniones Hoy/Mañana
                        </h2>
                        <button onClick={() => navigate('/recruitment/calendar')} className="text-[10px] text-[#003DA5] font-medium hover:underline flex items-center gap-0.5">
                            Calendario <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    {upcomingMeetings.length === 0 ? (
                        <div className="text-center py-5">
                            <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">Sin reuniones programadas</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {upcomingMeetings.map((m, i) => {
                                const isToday = m.date.toDateString() === now.toDateString()
                                return (
                                    <div key={`${m.type}-${m.id}-${i}`}
                                        onClick={() => m.type === 'candidate' ? navigate(`/recruitment/candidate/${m.id}`) : m.candidateId ? navigate(`/recruitment/candidate/${m.candidateId}`) : null}
                                        className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-[10px] font-bold ${isToday ? 'bg-[#003DA5]' : 'bg-indigo-400'}`}>
                                            {fmtTime(m.date)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                                            <p className="text-[10px] text-slate-400">
                                                {isToday ? 'Hoy' : 'Mañana'}
                                                {m.location && ` · ${m.location}`}
                                            </p>
                                        </div>
                                        {m.stage && (
                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STAGE_COLORS[m.stage]?.light || ''}`}>
                                                {m.stage}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Stagnant Candidates (#2) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-amber-500" /> Candidatos Estancados
                        </h2>
                        <span className="text-[10px] text-slate-400">&gt;7 días sin avance</span>
                    </div>
                    {stagnantCandidates.length === 0 ? (
                        <div className="text-center py-5">
                            <UserCheck className="w-8 h-8 text-slate-200 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">Todos los candidatos están avanzando 🎉</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                            {stagnantCandidates.slice(0, 8).map(c => (
                                <div key={c.id} onClick={() => navigate(`/recruitment/candidate/${c.id}`)}
                                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-50/50 cursor-pointer transition-colors">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${c.daysSince > 14 ? 'bg-red-500' : 'bg-amber-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{c.first_name} {c.last_name || ''}</p>
                                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STAGE_COLORS[c.pipeline_stage]?.light || ''}`}>
                                            {c.pipeline_stage}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-bold ${c.daysSince > 14 ? 'text-red-500' : 'text-amber-600'}`}>
                                        {c.daysSince}d
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Row 2: Pipeline Funnel + Avg Time ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Funnel (2 cols) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-bold text-slate-800 text-sm">Pipeline de Candidatos</h2>
                        <button onClick={() => navigate('/recruitment/pipeline')} className="text-[10px] text-[#003DA5] font-medium hover:underline flex items-center gap-0.5">
                            Pipeline <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {PIPELINE_STAGES.map((stage, i) => {
                            const count = stageCounts[stage.id] || 0
                            const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0
                            const Icon = STAGE_ICONS[stage.id] || Star
                            const colors = STAGE_COLORS[stage.id] || {}
                            return (
                                <motion.div key={stage.id} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                    className="flex items-center gap-2.5">
                                    <div className="w-28 flex items-center gap-1 shrink-0">
                                        <Icon className="w-3 h-3 text-slate-400" />
                                        <span className="text-[11px] font-medium text-slate-600 truncate">{stage.label}</span>
                                    </div>
                                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.7, delay: i * 0.04 }}
                                            className="h-full rounded-full flex items-center justify-end pr-1.5"
                                            style={{ backgroundColor: colors.bar || '#94a3b8', minWidth: count > 0 ? '24px' : 0 }}>
                                            {count > 0 && <span className="text-[9px] font-bold text-white">{count}</span>}
                                        </motion.div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>

                {/* Avg Time per Stage (#4) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h2 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                        <Timer className="w-4 h-4 text-[#003DA5]" /> Tiempo Promedio
                    </h2>
                    {avgTimePerStage.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-5">Sin datos suficientes</p>
                    ) : (
                        <div className="space-y-2">
                            {avgTimePerStage.map((s, i) => {
                                const pct = (parseFloat(s.avg) / maxAvgDays) * 100
                                const colors = STAGE_COLORS[s.stage] || {}
                                return (
                                    <div key={s.stage}>
                                        <div className="flex justify-between mb-0.5">
                                            <span className="text-[10px] font-medium text-slate-600 truncate">{s.stage}</span>
                                            <span className="text-[10px] font-bold text-slate-700">{s.avg}d</span>
                                        </div>
                                        <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.6, delay: i * 0.05 }}
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: colors.bar || '#94a3b8' }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Row 3: Weekly Trend + Sources + Email Stats ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Weekly Trend (#5) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h2 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Tendencia Semanal
                    </h2>
                    <div className="flex items-end gap-1.5 h-28">
                        {weeklyTrend.map((w, i) => {
                            const h = maxWeekly > 0 ? (w.count / maxWeekly) * 100 : 0
                            const isLast = i === weeklyTrend.length - 1
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[9px] font-bold text-slate-500">{w.count}</span>
                                    <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(h, 4)}%` }}
                                        transition={{ duration: 0.5, delay: i * 0.06 }}
                                        className={`w-full rounded-t-md ${isLast ? 'bg-[#003DA5]' : 'bg-blue-200'}`}
                                        style={{ minHeight: '3px' }} />
                                    <span className="text-[8px] text-slate-400">{w.label}</span>
                                </div>
                            )
                        })}
                    </div>
                    {weeklyTrend.length >= 2 && (() => {
                        const last = weeklyTrend[weeklyTrend.length - 1].count
                        const prev = weeklyTrend[weeklyTrend.length - 2].count
                        const diff = last - prev
                        return (
                            <div className={`flex items-center gap-1 mt-2 text-[10px] font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {diff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {diff >= 0 ? '+' : ''}{diff} vs semana anterior
                            </div>
                        )
                    })()}
                </div>

                {/* Sources + Conversion (#7) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h2 className="font-bold text-slate-800 text-sm mb-3">Fuentes + Conversión</h2>
                    {sourceStats.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-5">Sin datos</p>
                    ) : (
                        <div className="space-y-2.5">
                            {sourceStats.slice(0, 6).map((s, i) => {
                                const pct = (s.total / maxSourceCount) * 100
                                return (
                                    <div key={s.source}>
                                        <div className="flex justify-between mb-0.5">
                                            <span className="text-[10px] font-medium text-slate-600">{s.source}</span>
                                            <span className="text-[10px] text-slate-500">
                                                <strong className="text-slate-700">{s.total}</strong>
                                                {s.won > 0 && <span className="text-emerald-600 ml-1">({s.rate}% conv)</span>}
                                            </span>
                                        </div>
                                        <div className="bg-slate-100 rounded-full h-2 overflow-hidden relative">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.5, delay: i * 0.05 }}
                                                className="h-full rounded-full bg-[#003DA5]" />
                                            {s.won > 0 && (
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${(s.won / maxSourceCount) * 100}%` }}
                                                    transition={{ duration: 0.5, delay: i * 0.05 + 0.3 }}
                                                    className="h-full rounded-full bg-emerald-500 absolute top-0 left-0" />
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Email Metrics (#6) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h2 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-[#003DA5]" /> Métricas de Email
                    </h2>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                            { icon: Send, label: 'Enviados', value: emailStats.total, color: 'text-[#003DA5] bg-blue-50' },
                            { icon: Mail, label: 'Abiertos', value: `${emailStats.openRate}%`, color: 'text-emerald-600 bg-emerald-50' },
                            { icon: MousePointerClick, label: 'Clicks', value: `${emailStats.clickRate}%`, color: 'text-amber-600 bg-amber-50' },
                        ].map((m, i) => (
                            <div key={i} className="text-center p-2.5 rounded-xl border border-slate-100">
                                <div className={`w-7 h-7 rounded-lg ${m.color} flex items-center justify-center mx-auto mb-1.5`}>
                                    <m.icon className="w-3.5 h-3.5" />
                                </div>
                                <p className="text-lg font-bold text-slate-800">{m.value}</p>
                                <p className="text-[9px] text-slate-400">{m.label}</p>
                            </div>
                        ))}
                    </div>
                    {emailStats.total === 0 && (
                        <p className="text-[10px] text-slate-400 text-center">Sin emails en el período</p>
                    )}
                </div>
            </div>

            {/* ═══ Row 4: Overdue Tasks + Activity ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Overdue Tasks */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-500" /> Tareas Vencidas
                        </h2>
                        <button onClick={() => navigate('/recruitment/tasks')} className="text-[10px] text-[#003DA5] font-medium hover:underline flex items-center gap-0.5">
                            Todas <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    {overdueTasks.length === 0 ? (
                        <div className="text-center py-5">
                            <ClipboardList className="w-8 h-8 text-slate-200 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">Sin tareas vencidas 🎉</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                            {overdueTasks.slice(0, 6).map(t => {
                                const cn = t.candidate ? `${t.candidate.first_name} ${t.candidate.last_name || ''}`.trim() : '—'
                                return (
                                    <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-red-50/50 border border-red-100">
                                        <Clock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-700 truncate">{t.title}</p>
                                            <p className="text-[9px] text-red-500">{fmt(t.execution_date)} · {cn}</p>
                                        </div>
                                        <span className={`text-[9px] font-medium px-1 py-0.5 rounded border ${
                                            t.priority === 'alta' ? 'bg-red-50 text-red-600 border-red-200' :
                                            t.priority === 'baja' ? 'bg-green-50 text-green-600 border-green-200' :
                                            'bg-amber-50 text-amber-600 border-amber-200'}`}>{t.priority}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h2 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#003DA5]" /> Actividad Reciente
                    </h2>
                    {filteredHistory.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-5">Sin actividad reciente</p>
                    ) : (
                        <div className="space-y-0 relative max-h-[200px] overflow-y-auto">
                            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />
                            {filteredHistory.slice(0, 10).map((h, i) => {
                                const cn = h.candidate ? `${h.candidate.first_name} ${h.candidate.last_name || ''}`.trim() : 'Candidato'
                                const toColors = STAGE_COLORS[h.to_stage] || {}
                                return (
                                    <div key={h.id || i} className="flex items-start gap-2.5 py-1.5 pl-0.5 relative">
                                        <div className={`w-[9px] h-[9px] rounded-full border-2 border-white shadow-sm shrink-0 mt-1.5 z-10 ${STAGE_COLORS[h.to_stage]?.bg || 'bg-slate-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-slate-700">
                                                <span className="font-semibold">{cn}</span>
                                                {' → '}
                                                <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${toColors.light || 'bg-slate-100 text-slate-600'}`}>
                                                    {h.to_stage}
                                                </span>
                                            </p>
                                            <p className="text-[9px] text-slate-400">{fmt(h.changed_at)}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
