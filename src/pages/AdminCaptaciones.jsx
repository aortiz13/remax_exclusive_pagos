import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, getCustomPublicUrl } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Inbox, Eye, GripVertical, MapPin, DollarSign, Calendar, User,
    FileText, ExternalLink, Building2, Tag, ArrowRight, Clock,
    ChevronDown, ChevronUp, Search, Filter, X, RotateCcw
} from 'lucide-react'
import { sendCaptacionVistaNotification } from '../services/captacionNotifications'

const COLUMNS = [
    { id: 'recibido', title: 'Recibido', icon: Inbox, color: 'blue' },
    { id: 'visto', title: 'Visto', icon: Eye, color: 'green' },
]

const COLUMN_COLORS = {
    recibido: {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        dot: 'bg-blue-500',
        header: 'from-blue-500 to-blue-600',
    },
    visto: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
        dot: 'bg-emerald-500',
        header: 'from-emerald-500 to-emerald-600',
    },
}

export default function AdminCaptaciones() {
    const { profile } = useAuth()
    const [mandates, setMandates] = useState([])
    const [loading, setLoading] = useState(true)
    const [draggedId, setDraggedId] = useState(null)
    const [dragOverCol, setDragOverCol] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('all') // all, Exclusiva, Abierta
    const [filterOperation, setFilterOperation] = useState('all') // all, Venta, Arriendo
    const [filterAgent, setFilterAgent] = useState('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [expandedCards, setExpandedCards] = useState({})

    // Access guard
    const allowedRoles = ['superadministrador', 'legal', 'comercial']
    const hasAccess = allowedRoles.includes(profile?.role)

    const fetchMandates = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('mandates')
            .select(`
                *,
                agent:profiles!mandates_agent_id_fkey(id, first_name, last_name, email, phone, avatar_url),
                contact:contacts!mandates_contact_id_fkey(first_name, last_name, phone, email),
                property:properties!mandates_property_id_fkey(property_type, address, bedrooms, bathrooms, m2_total, m2_built)
            `)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching mandates:', error)
            toast.error('Error al cargar captaciones')
        } else {
            setMandates(data || [])
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (hasAccess) fetchMandates()
    }, [hasAccess, fetchMandates])

    // ─── Drag & Drop ──────────────────────────────────────────────────────────
    const handleDragStart = (e, mandateId) => {
        setDraggedId(mandateId)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', mandateId)
    }

    const handleDragOver = (e, colId) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverCol(colId)
    }

    const handleDragLeave = () => setDragOverCol(null)

    const handleDrop = async (e, targetStatus) => {
        e.preventDefault()
        setDragOverCol(null)
        const mandateId = e.dataTransfer.getData('text/plain')
        const mandate = mandates.find(m => m.id === mandateId)

        if (!mandate || mandate.review_status === targetStatus) {
            setDraggedId(null)
            return
        }

        // Only allow recibido → visto
        if (mandate.review_status !== 'recibido' || targetStatus !== 'visto') {
            toast.error('Solo se puede mover de Recibido a Visto')
            setDraggedId(null)
            return
        }

        // Optimistic update
        setMandates(prev => prev.map(m => m.id === mandateId ? { ...m, review_status: 'visto' } : m))
        setDraggedId(null)

        const { error } = await supabase
            .from('mandates')
            .update({ review_status: 'visto' })
            .eq('id', mandateId)

        if (error) {
            toast.error('Error al actualizar estado')
            setMandates(prev => prev.map(m => m.id === mandateId ? { ...m, review_status: 'recibido' } : m))
            return
        }

        toast.success('Captación marcada como vista')

        // Fire notification to agent
        if (mandate.agent) {
            sendCaptacionVistaNotification(mandate, mandate.agent)
        }
    }

    // ─── Quick action button (alternative to drag) ────────────────────────────
    const handleMarkAsVisto = async (mandate) => {
        if (mandate.review_status !== 'recibido') return

        setMandates(prev => prev.map(m => m.id === mandate.id ? { ...m, review_status: 'visto' } : m))

        const { error } = await supabase
            .from('mandates')
            .update({ review_status: 'visto' })
            .eq('id', mandate.id)

        if (error) {
            toast.error('Error al actualizar estado')
            setMandates(prev => prev.map(m => m.id === mandate.id ? { ...m, review_status: 'recibido' } : m))
            return
        }

        toast.success('Captación marcada como vista')

        if (mandate.agent) {
            sendCaptacionVistaNotification(mandate, mandate.agent)
        }
    }

    // ─── Unique agents for dropdown ────────────────────────────────────────────
    const uniqueAgents = [...new Map(
        mandates
            .filter(m => m.agent)
            .map(m => [m.agent.id, { id: m.agent.id, name: `${m.agent.first_name || ''} ${m.agent.last_name || ''}`.trim() }])
    ).values()].sort((a, b) => a.name.localeCompare(b.name))

    const hasActiveFilters = searchTerm || filterType !== 'all' || filterOperation !== 'all' || filterAgent !== 'all' || dateFrom || dateTo

    const clearAllFilters = () => {
        setSearchTerm('')
        setFilterType('all')
        setFilterOperation('all')
        setFilterAgent('all')
        setDateFrom('')
        setDateTo('')
    }

    // ─── Filtering ────────────────────────────────────────────────────────────
    const filtered = mandates.filter(m => {
        const matchSearch = !searchTerm ||
            m.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.commune?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.agent?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.agent?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchType = filterType === 'all' || m.capture_type === filterType
        const matchOperation = filterOperation === 'all' || m.operation_type === filterOperation
        const matchAgent = filterAgent === 'all' || m.agent?.id === filterAgent

        let matchDate = true
        if (dateFrom) {
            matchDate = matchDate && new Date(m.created_at) >= new Date(dateFrom)
        }
        if (dateTo) {
            const toEnd = new Date(dateTo)
            toEnd.setHours(23, 59, 59, 999)
            matchDate = matchDate && new Date(m.created_at) <= toEnd
        }

        return matchSearch && matchType && matchOperation && matchAgent && matchDate
    })

    const getColumnMandates = (colId) => filtered.filter(m => m.review_status === colId)

    const toggleExpanded = (id) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
    }

    // ─── File URL builder ─────────────────────────────────────────────────────
    const getFileUrl = (filePath) => {
        // Handle legacy entries stored as objects {path, index} instead of strings
        const path = typeof filePath === 'object' ? filePath?.path : filePath
        return getCustomPublicUrl('mandates', path)
    }

    if (!hasAccess) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <p className="text-slate-500 dark:text-slate-400 text-lg">No tienes acceso a esta sección.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                        Captaciones
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gestiona las captaciones recibidas de los agentes
                    </p>
                </div>

            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar dirección, comuna, agente..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>

                    {/* Date From */}
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                            title="Desde"
                        />
                    </div>

                    <span className="text-slate-400 text-xs font-medium">a</span>

                    {/* Date To */}
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                            title="Hasta"
                        />
                    </div>

                    {/* Agent Filter */}
                    <select
                        value={filterAgent}
                        onChange={e => setFilterAgent(e.target.value)}
                        className="appearance-none px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer max-w-[180px]"
                    >
                        <option value="all">Todos los agentes</option>
                        {uniqueAgents.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>

                    {/* Operation Type */}
                    <select
                        value={filterOperation}
                        onChange={e => setFilterOperation(e.target.value)}
                        className="appearance-none px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                    >
                        <option value="all">Venta / Arriendo</option>
                        <option value="Venta">Venta</option>
                        <option value="Arriendo">Arriendo</option>
                    </select>

                    {/* Capture Type */}
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="appearance-none px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                    >
                        <option value="all">Exclusiva / Abierta</option>
                        <option value="Exclusiva">Exclusiva</option>
                        <option value="Abierta">Abierta</option>
                    </select>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-lg transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Kanban Board */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                        <span className="text-slate-500 text-sm">Cargando captaciones...</span>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {COLUMNS.map(col => {
                        const items = getColumnMandates(col.id)
                        const colors = COLUMN_COLORS[col.id]

                        return (
                            <div
                                key={col.id}
                                onDragOver={e => handleDragOver(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={e => handleDrop(e, col.id)}
                                className={`
                                    rounded-2xl border-2 transition-all duration-300 min-h-[400px]
                                    ${colors.border} ${colors.bg}
                                    ${dragOverCol === col.id ? 'ring-4 ring-blue-300/50 dark:ring-blue-600/30 scale-[1.01]' : ''}
                                `}
                            >
                                {/* Column Header */}
                                <div className={`bg-gradient-to-r ${colors.header} rounded-t-xl px-5 py-4 flex items-center justify-between`}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <col.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="font-bold text-white text-lg">{col.title}</h3>
                                    </div>
                                    <span className="bg-white/25 backdrop-blur-sm text-white text-sm font-bold px-3 py-1 rounded-full">
                                        {items.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="p-4 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-none">
                                    <AnimatePresence mode="popLayout">
                                        {items.length === 0 ? (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex flex-col items-center justify-center py-12 text-slate-400"
                                            >
                                                <col.icon className="w-12 h-12 mb-3 opacity-30" />
                                                <p className="text-sm font-medium">Sin captaciones</p>
                                            </motion.div>
                                        ) : (
                                            items.map(mandate => (
                                                <MandateCard
                                                    key={mandate.id}
                                                    mandate={mandate}
                                                    isDragged={draggedId === mandate.id}
                                                    onDragStart={handleDragStart}
                                                    onMarkAsVisto={handleMarkAsVisto}
                                                    isExpanded={expandedCards[mandate.id]}
                                                    onToggleExpand={() => toggleExpanded(mandate.id)}
                                                    getFileUrl={getFileUrl}
                                                />
                                            ))
                                        )}
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

// ─── Mandate Card ─────────────────────────────────────────────────────────────

function MandateCard({ mandate, isDragged, onDragStart, onMarkAsVisto, isExpanded, onToggleExpand, getFileUrl }) {
    const agentName = mandate.agent
        ? `${mandate.agent.first_name || ''} ${mandate.agent.last_name || ''}`.trim()
        : 'Sin agente'

    const contactName = mandate.contact
        ? `${mandate.contact.first_name || ''} ${mandate.contact.last_name || ''}`.trim()
        : null

    const formatPrice = (price, currency) => {
        if (!price) return null
        const num = parseFloat(price)
        if (currency === 'UF') return `${num.toLocaleString('es-CL')} UF`
        if (currency === 'CLP') return `$${num.toLocaleString('es-CL')} CLP`
        return `${num.toLocaleString('es-CL')} ${currency}`
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return null
        return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const isRecibido = mandate.review_status === 'recibido'

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isDragged ? 0.5 : 1, y: 0, scale: isDragged ? 0.96 : 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            draggable={isRecibido}
            onDragStart={e => onDragStart(e, mandate.id)}
            className={`
                bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700
                shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden
                ${isRecibido ? 'cursor-grab active:cursor-grabbing' : ''}
                ${isDragged ? 'ring-2 ring-blue-500 rotate-1' : ''}
            `}
        >
            {/* Card Header */}
            <div className="px-4 pt-4 pb-3">
                {/* Agent + Type Badge row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md shadow-blue-500/20">
                            {agentName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{agentName}</p>
                            <p className="text-[11px] text-slate-400 truncate">{mandate.agent?.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${mandate.capture_type === 'Exclusiva'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                            {mandate.capture_type}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${mandate.operation_type === 'Venta'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                            : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300'
                            }`}>
                            {mandate.operation_type}
                        </span>
                    </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{mandate.address}</p>
                </div>

                {/* Price + Commune row */}
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    {formatPrice(mandate.price, mandate.currency) && (
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                            <DollarSign className="w-3.5 h-3.5" />
                            {formatPrice(mandate.price, mandate.currency)}
                        </span>
                    )}
                    {mandate.commune && (
                        <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {mandate.commune}
                        </span>
                    )}
                </div>
            </div>

            {/* Expandable Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-3 space-y-2.5 border-t border-slate-100 dark:border-slate-700 pt-3">
                            {/* Property Details */}
                            {mandate.property && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                    <p className="font-semibold text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wide">Propiedad</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {mandate.property.property_type && <span>Tipo: {mandate.property.property_type}</span>}
                                        {mandate.property.bedrooms && <span>{mandate.property.bedrooms} dorm.</span>}
                                        {mandate.property.bathrooms && <span>{mandate.property.bathrooms} baños</span>}
                                        {mandate.property.m2_total && <span>{mandate.property.m2_total} m² total</span>}
                                        {mandate.property.m2_built && <span>{mandate.property.m2_built} m² const.</span>}
                                    </div>
                                </div>
                            )}

                            {/* Contact */}
                            {contactName && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <User className="w-3.5 h-3.5" />
                                    <span>Contacto: <span className="font-medium text-slate-700 dark:text-slate-300">{contactName}</span></span>
                                    {mandate.contact?.phone && (
                                        <span className="text-slate-400">• {mandate.contact.phone}</span>
                                    )}
                                </div>
                            )}

                            {/* Dates */}
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Inicio: {formatDate(mandate.start_date) || '—'}
                                </span>
                                {mandate.capture_end_date && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Vence: {formatDate(mandate.capture_end_date)}
                                    </span>
                                )}
                            </div>

                            {/* Created */}
                            <div className="text-[11px] text-slate-400">
                                Registrado: {formatDate(mandate.created_at)}
                            </div>

                            {/* Files */}
                            {mandate.file_urls?.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="font-semibold text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wide">
                                        Documentos ({mandate.file_urls.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {mandate.file_urls.map((url, i) => (
                                            <a
                                                key={i}
                                                href={getFileUrl(url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                Doc {i + 1}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Card Footer */}
            <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <button
                    onClick={onToggleExpand}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isExpanded ? 'Menos' : 'Más detalles'}
                </button>

                {isRecibido && (
                    <button
                        onClick={() => onMarkAsVisto(mandate)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm shadow-emerald-500/20"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Marcar Visto
                        <ArrowRight className="w-3 h-3" />
                    </button>
                )}
            </div>
        </motion.div>
    )
}
