import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { fetchCandidates, updatePipelineStage, createCandidate, PIPELINE_STAGES, CANDIDATE_SOURCES } from '../../services/recruitmentService'
import {
    Search, RotateCcw, User, Mail, Phone, MapPin,
    ExternalLink, UserCheck, UserX, Eye,
    ChevronDown, ChevronUp, Filter, Plus,
    GripVertical, Clock, Briefcase, Columns3, Check,
    CalendarCheck, CalendarClock, Trophy, XCircle, Bookmark, Star, Users, Zap, X
} from 'lucide-react'

// ─── Column Visual Definitions ────────────────────────────────────────────────

const COLUMN_STYLES = {
    'Nuevo':                { bg: 'bg-white/60', border: 'border-blue-100', headerBg: 'bg-gradient-to-r from-blue-600 to-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', ring: 'ring-blue-200/60', iconBg: 'bg-blue-500/15' },
    'Reunión Agendada':     { bg: 'bg-white/60', border: 'border-indigo-100', headerBg: 'bg-gradient-to-r from-indigo-600 to-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', ring: 'ring-indigo-200/60', iconBg: 'bg-indigo-500/15' },
    'Reunión Confirmada':   { bg: 'bg-white/60', border: 'border-cyan-100', headerBg: 'bg-gradient-to-r from-cyan-600 to-cyan-500', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500', ring: 'ring-cyan-200/60', iconBg: 'bg-cyan-500/15' },
    'Aprobado':             { bg: 'bg-white/60', border: 'border-green-100', headerBg: 'bg-gradient-to-r from-green-600 to-green-500', badge: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500', ring: 'ring-green-200/60', iconBg: 'bg-green-500/15' },
    'Desaprobado':          { bg: 'bg-white/60', border: 'border-red-100', headerBg: 'bg-gradient-to-r from-red-500 to-rose-500', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', ring: 'ring-red-200/60', iconBg: 'bg-red-500/15' },
    'Ganado':               { bg: 'bg-white/60', border: 'border-emerald-100', headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-200/60', iconBg: 'bg-emerald-500/15' },
    'Perdido':              { bg: 'bg-white/60', border: 'border-slate-200', headerBg: 'bg-gradient-to-r from-slate-500 to-slate-400', badge: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400', ring: 'ring-slate-200/60', iconBg: 'bg-slate-400/15' },
    'Seguimiento':          { bg: 'bg-white/60', border: 'border-amber-100', headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', ring: 'ring-amber-200/60', iconBg: 'bg-amber-500/15' },
}

const STAGE_ICONS = {
    'Nuevo': Zap,
    'Reunión Agendada': CalendarClock,
    'Reunión Confirmada': CalendarCheck,
    'Aprobado': UserCheck,
    'Desaprobado': UserX,
    'Ganado': Trophy,
    'Perdido': XCircle,
    'Seguimiento': Bookmark,
}

const SOURCE_COLORS = {
    'Web': 'bg-violet-50 text-violet-600 border-violet-200',
    'Computrabajo': 'bg-orange-50 text-orange-600 border-orange-200',
    'LinkedIn': 'bg-sky-50 text-sky-600 border-sky-200',
    'Trabajando': 'bg-teal-50 text-teal-600 border-teal-200',
    'Referido': 'bg-pink-50 text-pink-600 border-pink-200',
    'Manual': 'bg-slate-50 text-slate-600 border-slate-200',
}

// ─── VISIBLE COLUMNS PERSISTENCE ──────────────────────────────────────────────

const VIS_KEY = 'recruitment_pipeline_visible_cols'
function loadVisible() {
    try {
        const s = localStorage.getItem(VIS_KEY)
        if (s) { const p = JSON.parse(s); if (p.length > 0) return p }
    } catch { /* ignore */ }
    return PIPELINE_STAGES.map(c => c.id)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RecruitmentPipeline() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [candidates, setCandidates] = useState([])
    const [loading, setLoading] = useState(true)

    // Drag state
    const [draggedId, setDraggedId] = useState(null)
    const [dragOverCol, setDragOverCol] = useState(null)

    // Column visibility
    const [visibleCols, setVisibleCols] = useState(loadVisible)
    const [showColMenu, setShowColMenu] = useState(false)

    // New candidate modal
    const [showNewModal, setShowNewModal] = useState(false)

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [filterSource, setFilterSource] = useState('all')
    const [showFilters, setShowFilters] = useState(false)

    const toggleCol = (id) => {
        setVisibleCols(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            if (next.length === 0) { toast.error('Al menos una columna'); return prev }
            localStorage.setItem(VIS_KEY, JSON.stringify(next))
            return next
        })
    }

    // ─── Fetch ────────────────────────────────────────────────────────────────

    const loadCandidates = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchCandidates()
            setCandidates(data)
        } catch (err) {
            console.error(err)
            toast.error('Error al cargar candidatos')
        }
        setLoading(false)
    }, [])

    useEffect(() => { loadCandidates() }, [loadCandidates])

    // ─── Filter Logic ─────────────────────────────────────────────────────────

    const filtered = useMemo(() => candidates.filter(c => {
        const term = searchTerm.toLowerCase()
        const matchSearch = !searchTerm ||
            c.first_name?.toLowerCase().includes(term) ||
            c.last_name?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.phone?.includes(searchTerm) ||
            c.rut?.includes(searchTerm)

        const matchSource = filterSource === 'all' || c.source === filterSource
        return matchSearch && matchSource
    }), [candidates, searchTerm, filterSource])

    const getColCandidates = (colId) => filtered.filter(c => (c.pipeline_stage || 'Nuevo') === colId)
    const hasFilters = searchTerm || filterSource !== 'all'

    // ─── Drag & Drop ──────────────────────────────────────────────────────────

    const handleDragStart = (e, cId) => {
        setDraggedId(cId)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', cId)
        setTimeout(() => { if (e.target) e.target.style.opacity = '0.5' }, 0)
    }
    const handleDragEnd = (e) => { if (e.target) e.target.style.opacity = '1'; setDraggedId(null); setDragOverCol(null) }
    const handleDragOver = (e, colId) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(colId) }
    const handleDragLeave = () => setDragOverCol(null)

    const handleDrop = async (e, targetStage) => {
        e.preventDefault(); setDragOverCol(null)
        const cId = e.dataTransfer.getData('text/plain')
        const candidate = candidates.find(c => c.id === cId)
        if (!candidate || (candidate.pipeline_stage || 'Nuevo') === targetStage) { setDraggedId(null); return }

        const fromStage = candidate.pipeline_stage || 'Nuevo'

        // Optimistic update
        setCandidates(prev => prev.map(c =>
            c.id === cId ? { ...c, pipeline_stage: targetStage, updated_at: new Date().toISOString() } : c
        ))
        setDraggedId(null)

        try {
            await updatePipelineStage(cId, fromStage, targetStage, profile?.id)
            toast.success(`Movido a "${targetStage}"`, { icon: '✓' })
        } catch {
            toast.error('Error al actualizar estado')
            setCandidates(prev => prev.map(c => c.id === cId ? { ...c, pipeline_stage: fromStage } : c))
        }
    }

    // ─── New Candidate ────────────────────────────────────────────────────────

    const handleNewCandidate = async (formData) => {
        try {
            const created = await createCandidate({ ...formData, _changed_by: profile?.id })
            setCandidates(prev => [created, ...prev])
            setShowNewModal(false)
            toast.success('Candidato creado exitosamente')
        } catch (err) {
            console.error(err)
            toast.error('Error al crear candidato')
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">
            {/* ─── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        Pipeline de Reclutamiento
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gestiona el proceso de nuevos agentes inmobiliarios
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* New candidate button */}
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Candidato
                    </button>

                    {/* Summary pills */}
                    <div className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm">
                        <Users className="w-4 h-4 text-slate-400" />
                        {filtered.length}
                    </div>
                    {PIPELINE_STAGES.map(col => {
                        const count = getColCandidates(col.id).length
                        if (count === 0) return null
                        const colors = COLUMN_STYLES[col.id]
                        return (
                            <div key={col.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${colors.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                                {count}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ─── Filter Bar ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative w-full sm:w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar nombre, correo, teléfono, RUT..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                        />
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtros
                        {hasFilters && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                    </button>

                    {/* Column visibility */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColMenu(!showColMenu)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${showColMenu
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Columns3 className="w-4 h-4" />
                            Columnas
                            {visibleCols.length < PIPELINE_STAGES.length && (
                                <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-full">
                                    {visibleCols.length}/{PIPELINE_STAGES.length}
                                </span>
                            )}
                        </button>

                        <AnimatePresence>
                            {showColMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowColMenu(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
                                    >
                                        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-700">Columnas visibles</span>
                                            {visibleCols.length < PIPELINE_STAGES.length && (
                                                <button onClick={() => { setVisibleCols(PIPELINE_STAGES.map(c => c.id)); localStorage.setItem(VIS_KEY, JSON.stringify(PIPELINE_STAGES.map(c => c.id))) }}
                                                    className="text-[10px] font-medium text-primary hover:underline">Mostrar todas</button>
                                            )}
                                        </div>
                                        <div className="py-1">
                                            {PIPELINE_STAGES.map(col => {
                                                const isVis = visibleCols.includes(col.id)
                                                const colors = COLUMN_STYLES[col.id]
                                                return (
                                                    <button key={col.id} onClick={() => toggleCol(col.id)}
                                                        className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left ${!isVis ? 'opacity-50' : ''}`}>
                                                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${isVis ? 'bg-primary border-primary' : 'border-slate-300'}`}>
                                                            {isVis && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                        </div>
                                                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                                        <span className="flex-1 text-sm text-slate-700 font-medium">{col.label}</span>
                                                        <span className="text-[10px] text-slate-400 tabular-nums">{getColCandidates(col.id).length}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {hasFilters && (
                        <button onClick={() => { setSearchTerm(''); setFilterSource('all') }}
                            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200">
                            <RotateCcw className="w-3.5 h-3.5" /> Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Expandable Filters */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="p-4 bg-white rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shadow-sm">
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Fuente</label>
                                <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                                    <option value="all">Todos</option>
                                    {CANDIDATE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Kanban Board ─────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-[3px] border-slate-200 border-t-primary rounded-full animate-spin" />
                        <span className="text-muted-foreground text-sm">Cargando pipeline...</span>
                    </div>
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x">
                    {PIPELINE_STAGES.filter(col => visibleCols.includes(col.id)).map(col => {
                        const items = getColCandidates(col.id)
                        const colors = COLUMN_STYLES[col.id]
                        const isOver = dragOverCol === col.id
                        const Icon = STAGE_ICONS[col.id] || Star

                        return (
                            <div
                                key={col.id}
                                className={`flex-shrink-0 w-[300px] snap-start rounded-2xl border transition-all duration-200 flex flex-col
                                    ${colors.border} ${colors.bg} backdrop-blur-sm
                                    ${isOver ? `ring-2 ${colors.ring} border-dashed scale-[1.005]` : ''}`}
                                onDragOver={e => handleDragOver(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={e => handleDrop(e, col.id)}
                            >
                                {/* Column Header */}
                                <div className={`${colors.headerBg} rounded-t-[14px] px-4 py-3 flex items-center justify-between`}>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white/20 rounded-lg">
                                            <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                                        </div>
                                        <span className="font-semibold text-white text-[13px]">{col.label}</span>
                                    </div>
                                    <span className="bg-white/25 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                                        {items.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="flex-1 p-2.5 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-none min-h-[100px]">
                                    <AnimatePresence mode="popLayout">
                                        {items.length === 0 ? (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                className="flex flex-col items-center justify-center py-8 text-slate-300">
                                                <div className={`p-3 rounded-full ${colors.iconBg} mb-2`}>
                                                    <Icon className="w-6 h-6 opacity-50" />
                                                </div>
                                                <p className="text-xs font-medium text-slate-400">Sin candidatos</p>
                                                <p className="text-[10px] text-slate-300 mt-0.5">Arrastra aquí</p>
                                            </motion.div>
                                        ) : items.map(candidate => (
                                            <CandidateCard
                                                key={candidate.id}
                                                candidate={candidate}
                                                isDragged={draggedId === candidate.id}
                                                onDragStart={handleDragStart}
                                                onDragEnd={handleDragEnd}
                                                onNavigate={() => navigate(`/recruitment/candidate/${candidate.id}`)}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ─── New Candidate Modal ────────────────────────────────── */}
            <AnimatePresence>
                {showNewModal && (
                    <NewCandidateModal
                        onClose={() => setShowNewModal(false)}
                        onSave={handleNewCandidate}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Candidate Card ───────────────────────────────────────────────────────────

function CandidateCard({ candidate, isDragged, onDragStart, onDragEnd, onNavigate }) {
    const [expanded, setExpanded] = useState(false)
    const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim()
    const initials = `${(candidate.first_name || '?')[0]}${(candidate.last_name || '')[0] || ''}`.toUpperCase()

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : null

    const hue = fullName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    const srcCls = SOURCE_COLORS[candidate.source] || 'bg-slate-50 text-slate-600 border-slate-200'

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: isDragged ? 0.4 : 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            draggable
            onDragStart={e => onDragStart(e, candidate.id)}
            onDragEnd={onDragEnd}
            className={`group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700
                hover:shadow-md transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing
                ${isDragged ? 'shadow-lg ring-2 ring-primary/30 rotate-[1deg]' : 'shadow-sm hover:border-slate-300'}`}
        >
            <div className="p-3">
                <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 52%), hsl(${hue + 25}, 65%, 42%))` }}>
                        {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] text-slate-900 dark:text-white truncate leading-tight">
                            {fullName || 'Sin nombre'}
                        </p>
                        {candidate.email && (
                            <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                                <Mail className="w-3 h-3 shrink-0 opacity-60" />
                                {candidate.email}
                            </p>
                        )}
                        {candidate.phone && (
                            <p className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                                <Phone className="w-3 h-3 shrink-0 opacity-60" />
                                {candidate.phone}
                            </p>
                        )}
                    </div>

                    <GripVertical className="w-3.5 h-3.5 text-slate-200 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Source tag */}
                {candidate.source && (
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                        <span className={`text-[10px] font-medium px-1.5 py-[1px] rounded border ${srcCls}`}>
                            {candidate.source}
                        </span>
                        {candidate.city && (
                            <span className="text-[10px] font-medium px-1.5 py-[1px] rounded bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />{candidate.city}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-3 pb-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                            {candidate.job_title && (
                                <p className="flex items-center gap-1.5"><Briefcase className="w-3 h-3 opacity-50" />{candidate.job_title}</p>
                            )}
                            {candidate.meeting_date && (
                                <p className="flex items-center gap-1.5"><Clock className="w-3 h-3 opacity-50" />Reunión: <span className="font-medium text-slate-700">{formatDate(candidate.meeting_date)}</span></p>
                            )}
                            {candidate.notes && (
                                <p className="italic text-slate-400 line-clamp-2 mt-1">"{candidate.notes}"</p>
                            )}
                            <p className="text-[10px] text-slate-400 pt-0.5">Creado: {formatDate(candidate.created_at)}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                <button onClick={e => { e.stopPropagation(); setExpanded(!expanded) }} onPointerDown={e => e.stopPropagation()}
                    className="flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors font-medium py-0.5">
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? 'Menos' : 'Más'}
                </button>
                <button onClick={e => { e.stopPropagation(); onNavigate() }} onPointerDown={e => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-md transition-colors">
                    Ver detalle <ExternalLink className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    )
}

// ─── New Candidate Modal ──────────────────────────────────────────────────────

function NewCandidateModal({ onClose, onSave }) {
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        city: '',
        source: 'Manual',
        notes: '',
        job_title: '',
    })
    const [saving, setSaving] = useState(false)

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.first_name.trim()) { toast.error('El nombre es obligatorio'); return }
        setSaving(true)
        await onSave(form)
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
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Nuevo Candidato</h3>
                            <p className="text-xs text-slate-500">Agregar candidato manualmente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200/50 transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Nombre *" value={form.first_name} onChange={v => set('first_name', v)} />
                        <Field label="Apellido" value={form.last_name} onChange={v => set('last_name', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Email" value={form.email} onChange={v => set('email', v)} type="email" />
                        <Field label="Teléfono" value={form.phone} onChange={v => set('phone', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Ciudad" value={form.city} onChange={v => set('city', v)} />
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Fuente</label>
                            <select value={form.source} onChange={e => set('source', e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary">
                                {CANDIDATE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <Field label="Cargo / Título" value={form.job_title} onChange={v => set('job_title', v)} />
                    <div>
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Notas</label>
                        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                            placeholder="Observaciones iniciales..." />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 transition-all">
                            {saving ? 'Guardando...' : 'Crear Candidato'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    )
}

function Field({ label, value, onChange, type = 'text' }) {
    return (
        <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary transition-all" />
        </div>
    )
}
