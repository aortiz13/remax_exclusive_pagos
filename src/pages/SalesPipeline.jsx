import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
    Search, Calendar, RotateCcw, User, Mail, Phone, MapPin,
    ExternalLink, TrendingUp, UserCheck, UserX, Archive, Eye,
    ChevronDown, ChevronUp, Star, Tag, Zap, Users, Filter,
    GripVertical, Clock, Briefcase, Columns3, Check, EyeOff
} from 'lucide-react'

// ─── Pipeline Column Definitions ──────────────────────────────────────────────

const PIPELINE_COLUMNS = [
    { id: 'Activo', title: 'Activo', icon: Zap, description: 'Leads activos en trabajo' },
    { id: 'En Seguimiento', title: 'En Seguimiento', icon: Eye, description: 'En proceso de seguimiento' },
    { id: 'Cliente (Cerrado)', title: 'Cliente (Cerrado)', icon: UserCheck, description: 'Cierre exitoso' },
    { id: 'Inactivo', title: 'Inactivo', icon: UserX, description: 'Sin actividad reciente' },
    { id: 'Archivado', title: 'Archivado', icon: Archive, description: 'Descartado / archivado' },
]

const COLUMN_STYLES = {
    'Activo': {
        bg: 'bg-white/60 dark:bg-slate-900/40',
        border: 'border-blue-100 dark:border-blue-900/40',
        headerBg: 'bg-gradient-to-r from-blue-600 to-blue-500',
        badge: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        dot: 'bg-blue-500',
        ring: 'ring-blue-200/60 dark:ring-blue-700/40',
        iconBg: 'bg-blue-500/15',
    },
    'En Seguimiento': {
        bg: 'bg-white/60 dark:bg-slate-900/40',
        border: 'border-amber-100 dark:border-amber-900/40',
        headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
        badge: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500',
        ring: 'ring-amber-200/60 dark:ring-amber-700/40',
        iconBg: 'bg-amber-500/15',
    },
    'Cliente (Cerrado)': {
        bg: 'bg-white/60 dark:bg-slate-900/40',
        border: 'border-emerald-100 dark:border-emerald-900/40',
        headerBg: 'bg-gradient-to-r from-emerald-600 to-green-500',
        badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        ring: 'ring-emerald-200/60 dark:ring-emerald-700/40',
        iconBg: 'bg-emerald-500/15',
    },
    'Inactivo': {
        bg: 'bg-white/60 dark:bg-slate-900/40',
        border: 'border-slate-200 dark:border-slate-700/50',
        headerBg: 'bg-gradient-to-r from-slate-500 to-slate-400',
        badge: 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        dot: 'bg-slate-400',
        ring: 'ring-slate-200/60 dark:ring-slate-600/40',
        iconBg: 'bg-slate-400/15',
    },
    'Archivado': {
        bg: 'bg-white/60 dark:bg-slate-900/40',
        border: 'border-rose-100 dark:border-rose-900/40',
        headerBg: 'bg-gradient-to-r from-rose-500 to-pink-500',
        badge: 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
        dot: 'bg-rose-400',
        ring: 'ring-rose-200/60 dark:ring-rose-700/40',
        iconBg: 'bg-rose-400/15',
    },
}

const RATING_STYLES = {
    'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
    'A': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
    'B': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
    'C': 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
    'D': 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'pipeline_visible_columns'

function loadVisibleColumns() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            const parsed = JSON.parse(saved)
            // Validate: must be array of known IDs with at least 1
            const valid = parsed.filter(id => PIPELINE_COLUMNS.some(c => c.id === id))
            if (valid.length > 0) return valid
        }
    } catch { /* ignore */ }
    return PIPELINE_COLUMNS.map(c => c.id)
}

export default function SalesPipeline() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)

    // Drag state
    const [draggedId, setDraggedId] = useState(null)
    const [dragOverCol, setDragOverCol] = useState(null)

    // Column visibility (persisted per agent)
    const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns)
    const [showColumnMenu, setShowColumnMenu] = useState(false)

    const toggleColumn = (colId) => {
        setVisibleColumns(prev => {
            const next = prev.includes(colId)
                ? prev.filter(id => id !== colId)
                : [...prev, colId]
            // Prevent hiding all columns
            if (next.length === 0) {
                toast.error('Debes mantener al menos una columna visible')
                return prev
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            return next
        })
    }

    const showAllColumns = () => {
        const all = PIPELINE_COLUMNS.map(c => c.id)
        setVisibleColumns(all)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    }

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterNeed, setFilterNeed] = useState('all')
    const [filterSource, setFilterSource] = useState('all')
    const [filterRating, setFilterRating] = useState('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    // ─── Fetch ────────────────────────────────────────────────────────────────

    const fetchContacts = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('Error fetching contacts:', error)
            toast.error('Error al cargar contactos')
        } else {
            setContacts(data || [])
        }
        setLoading(false)
    }, [])

    useEffect(() => { fetchContacts() }, [fetchContacts])

    // ─── Unique filter values ─────────────────────────────────────────────────

    const uniqueNeeds = useMemo(() => [...new Set(contacts.map(c => c.need).filter(Boolean))].sort(), [contacts])
    const uniqueSources = useMemo(() => [...new Set(contacts.map(c => c.source).filter(Boolean))].sort(), [contacts])
    const uniqueRatings = useMemo(() => [...new Set(contacts.map(c => c.rating).filter(Boolean))].sort(), [contacts])

    // ─── Filter Logic ─────────────────────────────────────────────────────────

    const hasActiveFilters = searchTerm || filterStatus !== 'all' || filterNeed !== 'all' ||
        filterSource !== 'all' || filterRating !== 'all' || dateFrom || dateTo

    const clearAllFilters = () => {
        setSearchTerm(''); setFilterStatus('all'); setFilterNeed('all')
        setFilterSource('all'); setFilterRating('all'); setDateFrom(''); setDateTo('')
    }

    const filtered = useMemo(() => contacts.filter(c => {
        const term = searchTerm.toLowerCase()
        const matchSearch = !searchTerm ||
            c.first_name?.toLowerCase().includes(term) ||
            c.last_name?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.phone?.includes(searchTerm) ||
            c.barrio_comuna?.toLowerCase().includes(term) ||
            c.address?.toLowerCase().includes(term)

        const matchStatus = filterStatus === 'all' || c.status === filterStatus
        const matchNeed = filterNeed === 'all' || c.need === filterNeed
        const matchSource = filterSource === 'all' || c.source === filterSource
        const matchRating = filterRating === 'all' || c.rating === filterRating

        let matchDate = true
        if (dateFrom) matchDate = matchDate && new Date(c.created_at) >= new Date(dateFrom)
        if (dateTo) {
            const toEnd = new Date(dateTo); toEnd.setHours(23, 59, 59, 999)
            matchDate = matchDate && new Date(c.created_at) <= toEnd
        }
        return matchSearch && matchStatus && matchNeed && matchSource && matchRating && matchDate
    }), [contacts, searchTerm, filterStatus, filterNeed, filterSource, filterRating, dateFrom, dateTo])

    const getColumnContacts = (colId) => filtered.filter(c => (c.status || 'Activo') === colId)

    // ─── Drag & Drop ──────────────────────────────────────────────────────────

    const handleDragStart = (e, contactId) => {
        setDraggedId(contactId)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', contactId)
        setTimeout(() => { if (e.target) e.target.style.opacity = '0.5' }, 0)
    }

    const handleDragEnd = (e) => {
        if (e.target) e.target.style.opacity = '1'
        setDraggedId(null); setDragOverCol(null)
    }

    const handleDragOver = (e, colId) => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(colId)
    }

    const handleDragLeave = () => setDragOverCol(null)

    const handleDrop = async (e, targetStatus) => {
        e.preventDefault(); setDragOverCol(null)
        const contactId = e.dataTransfer.getData('text/plain')
        const contact = contacts.find(c => c.id === contactId)
        if (!contact || (contact.status || 'Activo') === targetStatus) { setDraggedId(null); return }

        setContacts(prev => prev.map(c =>
            c.id === contactId ? { ...c, status: targetStatus, updated_at: new Date().toISOString() } : c
        ))
        setDraggedId(null)

        const { error } = await supabase
            .from('contacts')
            .update({ status: targetStatus, updated_at: new Date().toISOString() })
            .eq('id', contactId)

        if (error) {
            toast.error('Error al actualizar estado')
            setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: contact.status } : c))
            return
        }
        toast.success(`Movido a "${targetStatus}"`, { icon: '✓' })
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">
            {/* ─── Header ────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Pipeline de Ventas
                    </h1>
                    <p className="text-muted-foreground mt-0.5">
                        Arrastra contactos entre columnas para actualizar su estado
                    </p>
                </div>

                {/* Summary Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm">
                        <Users className="w-4 h-4 text-slate-400" />
                        {filtered.length} contactos
                    </div>
                    {PIPELINE_COLUMNS.map(col => {
                        const count = getColumnContacts(col.id).length
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

            {/* ─── Filter Bar ────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Search */}
                    <div className="relative w-full sm:w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar nombre, correo, teléfono..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                        />
                    </div>

                    {/* Filter toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters
                            ? 'bg-primary/10 border-primary/30 text-primary dark:bg-primary/20'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-400'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtros Avanzados
                        {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                    </button>

                    {/* Column visibility toggle */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnMenu(!showColumnMenu)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${showColumnMenu
                                ? 'bg-primary/10 border-primary/30 text-primary dark:bg-primary/20'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-400'
                                }`}
                        >
                            <Columns3 className="w-4 h-4" />
                            Columnas
                            {visibleColumns.length < PIPELINE_COLUMNS.length && (
                                <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-full">
                                    {visibleColumns.length}/{PIPELINE_COLUMNS.length}
                                </span>
                            )}
                        </button>

                        {/* Column menu dropdown */}
                        <AnimatePresence>
                            {showColumnMenu && (
                                <>
                                    {/* Backdrop */}
                                    <div className="fixed inset-0 z-40" onClick={() => setShowColumnMenu(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 overflow-hidden"
                                    >
                                        <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Columnas visibles</span>
                                            {visibleColumns.length < PIPELINE_COLUMNS.length && (
                                                <button
                                                    onClick={showAllColumns}
                                                    className="text-[10px] font-medium text-primary hover:underline"
                                                >
                                                    Mostrar todas
                                                </button>
                                            )}
                                        </div>
                                        <div className="py-1">
                                            {PIPELINE_COLUMNS.map(col => {
                                                const isVisible = visibleColumns.includes(col.id)
                                                const colors = COLUMN_STYLES[col.id]
                                                const count = getColumnContacts(col.id).length
                                                return (
                                                    <button
                                                        key={col.id}
                                                        onClick={() => toggleColumn(col.id)}
                                                        className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left ${!isVisible ? 'opacity-50' : ''
                                                            }`}
                                                    >
                                                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${isVisible
                                                                ? 'bg-primary border-primary'
                                                                : 'border-slate-300 dark:border-slate-600'
                                                            }`}>
                                                            {isVisible && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                        </div>
                                                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 font-medium">{col.title}</span>
                                                        <span className="text-[10px] text-slate-400 tabular-nums">{count}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-lg transition-colors border border-red-200 dark:border-red-900/40"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Expandable Advanced Filters */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shadow-sm">
                            <FilterSelect label="Estado" value={filterStatus} onChange={setFilterStatus}
                                options={PIPELINE_COLUMNS.map(c => ({ value: c.id, label: c.title }))} />
                            <FilterSelect label="Necesidad" value={filterNeed} onChange={setFilterNeed}
                                options={uniqueNeeds.map(n => ({ value: n, label: n }))} />
                            <FilterSelect label="Fuente" value={filterSource} onChange={setFilterSource}
                                options={uniqueSources.map(s => ({ value: s, label: s }))} />
                            <FilterSelect label="Clasificación" value={filterRating} onChange={setFilterRating}
                                options={uniqueRatings.map(r => ({ value: r, label: r }))} />
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Desde</label>
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary cursor-pointer" />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Hasta</label>
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary cursor-pointer" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Kanban Board ───────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-[3px] border-slate-200 border-t-primary rounded-full animate-spin" />
                        <span className="text-muted-foreground text-sm">Cargando pipeline...</span>
                    </div>
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x">
                    {PIPELINE_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => {
                        const items = getColumnContacts(col.id)
                        const colors = COLUMN_STYLES[col.id]
                        const isOver = dragOverCol === col.id

                        return (
                            <div
                                key={col.id}
                                className={`
                                    flex-shrink-0 w-[300px] snap-start rounded-2xl border transition-all duration-200 flex flex-col
                                    ${colors.border} ${colors.bg} backdrop-blur-sm
                                    ${isOver ? `ring-2 ${colors.ring} border-dashed scale-[1.005]` : ''}
                                `}
                                onDragOver={e => handleDragOver(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={e => handleDrop(e, col.id)}
                            >
                                {/* Column Header */}
                                <div className={`${colors.headerBg} rounded-t-[14px] px-4 py-3 flex items-center justify-between`}>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white/20 rounded-lg">
                                            <col.icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                                        </div>
                                        <span className="font-semibold text-white text-[13px]">{col.title}</span>
                                    </div>
                                    <span className="bg-white/25 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                                        {items.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="flex-1 p-2.5 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-none min-h-[100px]">
                                    <AnimatePresence mode="popLayout">
                                        {items.length === 0 ? (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex flex-col items-center justify-center py-8 text-slate-300 dark:text-slate-600"
                                            >
                                                <div className={`p-3 rounded-full ${colors.iconBg} mb-2`}>
                                                    <col.icon className="w-6 h-6 opacity-50" />
                                                </div>
                                                <p className="text-xs font-medium text-slate-400">Sin contactos</p>
                                                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">Arrastra aquí</p>
                                            </motion.div>
                                        ) : items.map(contact => (
                                            <PipelineCard
                                                key={contact.id}
                                                contact={contact}
                                                isDragged={draggedId === contact.id}
                                                onDragStart={handleDragStart}
                                                onDragEnd={handleDragEnd}
                                                onNavigate={() => navigate(`/crm/contact/${contact.id}`)}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Filter Select Helper ─────────────────────────────────────────────────────

function FilterSelect({ label, value, onChange, options }) {
    return (
        <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary cursor-pointer appearance-none"
            >
                <option value="all">Todos</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    )
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────

function PipelineCard({ contact, isDragged, onDragStart, onDragEnd, onNavigate }) {
    const [expanded, setExpanded] = useState(false)
    const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    const initials = `${(contact.first_name || '?')[0]}${(contact.last_name || '')[0] || ''}`.toUpperCase()

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : null

    // Consistent avatar hue from name
    const hue = fullName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    const ratingCls = RATING_STYLES[contact.rating] || 'bg-slate-50 text-slate-600 border-slate-200'

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: isDragged ? 0.4 : 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            draggable
            onDragStart={e => onDragStart(e, contact.id)}
            onDragEnd={onDragEnd}
            className={`
                group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700
                hover:shadow-md transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing
                ${isDragged ? 'shadow-lg ring-2 ring-primary/30 rotate-[1deg]' : 'shadow-sm hover:border-slate-300 dark:hover:border-slate-600'}
            `}
        >
            <div className="p-3">
                {/* Row: Avatar + Info + Grip */}
                <div className="flex items-start gap-2.5">
                    <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 52%), hsl(${hue + 25}, 65%, 42%))` }}
                    >
                        {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] text-slate-900 dark:text-white truncate leading-tight">
                            {fullName || 'Sin nombre'}
                        </p>
                        {contact.email && (
                            <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                <Mail className="w-3 h-3 shrink-0 opacity-60" />
                                {contact.email}
                            </p>
                        )}
                        {contact.phone && (
                            <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                <Phone className="w-3 h-3 shrink-0 opacity-60" />
                                {contact.phone}
                            </p>
                        )}
                    </div>

                    <GripVertical className="w-3.5 h-3.5 text-slate-200 dark:text-slate-700 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Tags */}
                {(contact.rating || contact.need || contact.source) && (
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                        {contact.rating && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-[1px] rounded border ${ratingCls}`}>
                                {contact.rating}
                            </span>
                        )}
                        {contact.need && (
                            <span className="text-[10px] font-medium px-1.5 py-[1px] rounded bg-violet-50 text-violet-600 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800">
                                {contact.need}
                            </span>
                        )}
                        {contact.source && (
                            <span className="text-[10px] font-medium px-1.5 py-[1px] rounded bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800">
                                {contact.source}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-2 space-y-1 border-t border-slate-100 dark:border-slate-700/50 pt-2 text-[11px] text-slate-500">
                            {contact.profession && (
                                <p className="flex items-center gap-1.5">
                                    <Briefcase className="w-3 h-3 opacity-50" />
                                    {contact.profession}
                                </p>
                            )}
                            {(contact.barrio_comuna || contact.address) && (
                                <p className="flex items-center gap-1.5 truncate">
                                    <MapPin className="w-3 h-3 opacity-50 shrink-0" />
                                    {[contact.barrio_comuna, contact.address].filter(Boolean).join(' · ')}
                                </p>
                            )}
                            {contact.last_contact_date && (
                                <p className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 opacity-50" />
                                    Último contacto: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(contact.last_contact_date)}</span>
                                </p>
                            )}
                            {contact.next_contact_date && (
                                <p className="flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 opacity-50" />
                                    Próximo: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(contact.next_contact_date)}</span>
                                </p>
                            )}
                            {contact.observations && (
                                <p className="italic text-slate-400 line-clamp-2 mt-1">"{contact.observations}"</p>
                            )}
                            <p className="text-[10px] text-slate-400 pt-0.5">
                                Creado: {formatDate(contact.created_at)}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                <button
                    onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
                    onPointerDown={e => e.stopPropagation()}
                    className="flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors font-medium py-0.5"
                >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? 'Menos' : 'Más'}
                </button>

                <button
                    onClick={e => { e.stopPropagation(); onNavigate() }}
                    onPointerDown={e => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
                >
                    Ver detalle
                    <ExternalLink className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    )
}
