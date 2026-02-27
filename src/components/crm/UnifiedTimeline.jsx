import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { fetchUnifiedTimeline, EVENT_TYPES } from '../../services/timelineService'
import TimelineEventModal from './TimelineEventModal'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { formatDistanceToNow, format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    Search, Filter, X, Calendar, ChevronDown, ChevronUp,
    Zap, CheckCircle2, Circle, Mail, FileSignature, ClipboardCheck,
    ScrollText, Activity, Home, User, ArrowUpRight, Clock,
    Briefcase, DollarSign, MapPin, Phone, MessageSquare, Tag,
    FileText, ExternalLink, Eye, StickyNote
} from 'lucide-react'

// ── Icon + color mapping ───────────────────────────────────────

const TYPE_CONFIG = {
    accion: {
        icon: Zap,
        accent: 'border-l-[#003aad]',
        bg: 'bg-white dark:bg-slate-900/60',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-[#003aad] dark:text-blue-400',
        chipBg: 'bg-blue-50 dark:bg-blue-950/40 text-[#003aad] dark:text-blue-400 border-blue-100 dark:border-blue-900',
        dot: 'bg-[#003aad]',
    },
    tarea: {
        icon: CheckCircle2,
        accent: 'border-l-amber-500',
        bg: 'bg-white dark:bg-slate-900/60',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-amber-600 dark:text-amber-400',
        chipBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900',
        dot: 'bg-amber-500',
    },
    actividad: {
        icon: Activity,
        accent: 'border-l-slate-400',
        bg: 'bg-white dark:bg-slate-900/60',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        chipBg: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400',
    },
    correo: {
        icon: Mail,
        accent: 'border-l-slate-500',
        bg: 'bg-white dark:bg-slate-900/60',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        chipBg: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-500',
    },
    mandato: {
        icon: FileSignature,
        accent: 'border-l-[#003aad]',
        bg: 'bg-white dark:bg-slate-900/60',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-[#003aad] dark:text-blue-400',
        chipBg: 'bg-blue-50 dark:bg-blue-950/40 text-[#003aad] dark:text-blue-400 border-blue-100 dark:border-blue-900',
        dot: 'bg-[#003aad]',
    },
    evaluacion: {
        icon: ClipboardCheck,
        accent: 'border-l-slate-500',
        bg: 'bg-white dark:bg-slate-900/60',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        chipBg: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-500',
    },
    nota: {
        icon: StickyNote,
        accent: 'border-l-amber-400',
        bg: 'bg-white dark:bg-slate-900/60',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-amber-600 dark:text-amber-400',
        chipBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900',
        dot: 'bg-amber-400',
    },
    log: {
        icon: ScrollText,
        accent: 'border-l-slate-300',
        bg: 'bg-white dark:bg-slate-900/60',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-slate-500 dark:text-slate-500',
        chipBg: 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400',
    },
}

// ── Helpers ────────────────────────────────────────────────────

function formatEventDate(iso) {
    if (!iso) return '-'
    try {
        return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es })
    } catch {
        return '-'
    }
}

function formatRelative(iso) {
    if (!iso) return ''
    try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es })
    } catch {
        return ''
    }
}

const PAGE_SIZE = 30

function getMandateFileUrl(filePath) {
    // Handle legacy entries stored as objects {path, index} instead of strings
    const path = typeof filePath === 'object' ? filePath?.path : filePath
    if (!path || typeof path !== 'string') return null
    const { data } = supabase.storage.from('mandates').getPublicUrl(path)
    return data?.publicUrl
}

// ── Component ──────────────────────────────────────────────────

const UnifiedTimeline = ({ contactId, propertyId }) => {
    const navigate = useNavigate()
    const [allEvents, setAllEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Filters
    const [activeTypes, setActiveTypes] = useState(new Set()) // empty = all
    const [searchText, setSearchText] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    // Pagination
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

    // Modal
    const [selectedEvent, setSelectedEvent] = useState(null)

    // ── Fetch ──────────────────────────────────────────────────

    const loadTimeline = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const events = await fetchUnifiedTimeline({ contactId, propertyId })
            setAllEvents(events)
        } catch (err) {
            console.error('Timeline load error:', err)
            setError('Error al cargar la línea de tiempo')
        } finally {
            setLoading(false)
        }
    }, [contactId, propertyId])

    useEffect(() => {
        loadTimeline()

        // Real-time subscription for activity_logs
        const channel = supabase
            .channel('unified_timeline_feed')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
                const n = payload.new
                if (
                    (propertyId && n.property_id === propertyId) ||
                    (contactId && n.contact_id === contactId)
                ) {
                    loadTimeline()
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [contactId, propertyId, loadTimeline])

    // ── Filtering ──────────────────────────────────────────────

    const filteredEvents = useMemo(() => {
        let result = allEvents

        // Type filter
        if (activeTypes.size > 0) {
            result = result.filter(e => activeTypes.has(e.type))
        }

        // Search filter
        if (searchText.trim()) {
            const q = searchText.toLowerCase()
            result = result.filter(e =>
                e.title?.toLowerCase().includes(q) ||
                e.description?.toLowerCase().includes(q) ||
                e.typeLabel?.toLowerCase().includes(q)
            )
        }

        // Date filters
        if (dateFrom) {
            const from = startOfDay(new Date(dateFrom))
            result = result.filter(e => e.date && isAfter(new Date(e.date), from))
        }
        if (dateTo) {
            const to = endOfDay(new Date(dateTo))
            result = result.filter(e => e.date && isBefore(new Date(e.date), to))
        }

        return result
    }, [allEvents, activeTypes, searchText, dateFrom, dateTo])

    const visibleEvents = filteredEvents.slice(0, visibleCount)
    const hasMore = visibleCount < filteredEvents.length

    // ── Type counts ────────────────────────────────────────────

    const typeCounts = useMemo(() => {
        const counts = {}
        allEvents.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1 })
        return counts
    }, [allEvents])

    // ── Filter toggle ──────────────────────────────────────────

    const toggleType = (key) => {
        setActiveTypes(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
        setVisibleCount(PAGE_SIZE)
    }

    const clearFilters = () => {
        setActiveTypes(new Set())
        setSearchText('')
        setDateFrom('')
        setDateTo('')
        setVisibleCount(PAGE_SIZE)
    }

    const hasActiveFilters = activeTypes.size > 0 || searchText || dateFrom || dateTo

    // ── Render ─────────────────────────────────────────────────

    if (loading && allEvents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-100 dark:border-slate-800" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#003aad] animate-spin" />
                </div>
                <span className="text-sm text-muted-foreground">Cargando línea de tiempo…</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center py-12 text-red-500">
                <p className="text-sm">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={loadTimeline}>Reintentar</Button>
            </div>
        )
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">

            {/* ── Summary bar ───────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''}
                    </span>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1 text-xs text-[#003aad] dark:text-blue-400 hover:underline"
                        >
                            <X className="w-3 h-3" /> Limpiar filtros
                        </button>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(prev => !prev)}
                    className="gap-1.5 text-xs h-8"
                >
                    <Filter className="w-3.5 h-3.5" />
                    Filtros
                    {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
            </div>

            {/* ── Filter panel ──────────────────────────────── */}
            {showFilters && (
                <div className="bg-gray-50/80 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">

                    {/* Type chips */}
                    <div>
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-2 block">
                            Tipo de evento
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {EVENT_TYPES.map(t => {
                                const config = TYPE_CONFIG[t.key]
                                const isActive = activeTypes.has(t.key)
                                const count = typeCounts[t.key] || 0
                                return (
                                    <button
                                        key={t.key}
                                        onClick={() => toggleType(t.key)}
                                        className={`
                                            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                                            ${isActive
                                                ? `${config.chipBg} ring-2 ring-offset-1 ring-offset-white dark:ring-offset-gray-900 ring-current shadow-sm`
                                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }
                                        `}
                                    >
                                        <config.icon className="w-3 h-3" />
                                        {t.label}
                                        {count > 0 && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/30 dark:bg-black/20' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Search + Date range */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="relative sm:col-span-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Buscar en timeline…"
                                value={searchText}
                                onChange={e => { setSearchText(e.target.value); setVisibleCount(PAGE_SIZE) }}
                                className="pl-9 h-9 text-sm bg-white dark:bg-gray-900"
                            />
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={e => { setDateFrom(e.target.value); setVisibleCount(PAGE_SIZE) }}
                                className="pl-9 h-9 text-sm bg-white dark:bg-gray-900"
                                title="Desde"
                            />
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={e => { setDateTo(e.target.value); setVisibleCount(PAGE_SIZE) }}
                                className="pl-9 h-9 text-sm bg-white dark:bg-gray-900"
                                title="Hasta"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Empty state ───────────────────────────────── */}
            {filteredEvents.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <ScrollText className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium">
                        {hasActiveFilters ? 'No hay eventos que coincidan con los filtros aplicados.' : 'No hay actividad registrada aún.'}
                    </p>
                    {hasActiveFilters && (
                        <Button variant="link" size="sm" className="mt-2" onClick={clearFilters}>
                            Limpiar filtros
                        </Button>
                    )}
                </div>
            )}

            {/* ── Timeline ──────────────────────────────────── */}
            {visibleEvents.length > 0 && (
                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-300 via-slate-200 to-slate-100 dark:from-slate-600 dark:via-slate-700 dark:to-slate-800 rounded-full" />

                    <div className="space-y-1">
                        {visibleEvents.map((event, idx) => {
                            const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.log
                            const Icon = config.icon

                            return (
                                <div
                                    key={event.id}
                                    className="relative pl-12 group animate-in fade-in slide-in-from-left-1"
                                    style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                                >
                                    {/* Dot */}
                                    <div className={`absolute left-[13px] top-4 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${config.dot} transition-transform group-hover:scale-125`} />

                                    <div
                                        className={`p-3.5 rounded-xl border border-l-[3px] transition-all duration-200 hover:shadow-md cursor-pointer ${config.bg} ${config.border} ${config.accent} group-hover:translate-x-0.5`}
                                        onClick={() => setSelectedEvent(event)}
                                    >

                                        {/* Top Row */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ${config.chipBg} border`}>
                                                    <Icon className="w-3 h-3" />
                                                    {event.typeLabel}
                                                </span>
                                                {event.type === 'tarea' && (
                                                    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${event.meta?.completed
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                        }`}>
                                                        {event.meta?.completed ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
                                                        {event.meta?.completed ? 'Completada' : 'Pendiente'}
                                                    </span>
                                                )}
                                                {event.type === 'mandato' && event.meta?.status && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                        {event.meta.status}
                                                    </span>
                                                )}
                                                {event.type === 'evaluacion' && event.meta?.status && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                        {event.meta.status}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                    {formatEventDate(event.date)}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/70">
                                                    {formatRelative(event.date)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Title */}
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-2 leading-snug">
                                            {event.title}
                                        </h4>

                                        {/* Description */}
                                        {event.description && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap line-clamp-3">
                                                {event.description}
                                            </p>
                                        )}

                                        {/* Meta tags row */}
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {event.meta?.contactNames && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <User className="w-2.5 h-2.5" /> {event.meta.contactNames}
                                                </span>
                                            )}
                                            {event.meta?.contactName && (
                                                <span
                                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); event.meta.contactId && navigate(`/crm/contact/${event.meta.contactId}`) }}
                                                >
                                                    <User className="w-2.5 h-2.5" /> {event.meta.contactName}
                                                </span>
                                            )}
                                            {event.meta?.propertyAddress && (
                                                <span
                                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); event.meta.propertyId && navigate(`/crm/property/${event.meta.propertyId}`) }}
                                                >
                                                    <Home className="w-2.5 h-2.5" /> {event.meta.propertyAddress}
                                                </span>
                                            )}
                                            {event.meta?.dealType && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <Briefcase className="w-2.5 h-2.5" /> {event.meta.dealType}
                                                </span>
                                            )}
                                            {event.meta?.grossFees && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <DollarSign className="w-2.5 h-2.5" /> ${new Intl.NumberFormat('es-CL').format(event.meta.grossFees)}
                                                </span>
                                            )}
                                            {event.meta?.location && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <MapPin className="w-2.5 h-2.5" /> {event.meta.location}
                                                </span>
                                            )}
                                            {event.meta?.from && event.type === 'correo' && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <Mail className="w-2.5 h-2.5" /> {event.meta.from}
                                                </span>
                                            )}
                                            {event.meta?.isConversationStarter && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <MessageSquare className="w-2.5 h-2.5" /> Inicio conversación
                                                </span>
                                            )}
                                        </div>

                                        {/* Inline mandate documents */}
                                        {event.type === 'mandato' && event.meta?.fileUrls?.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {event.meta.fileUrls.map((url, i) => (
                                                    <a
                                                        key={i}
                                                        href={getMandateFileUrl(url)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-lg text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                        Doc {i + 1}
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}

                                        {/* Detail block for activity_log details */}
                                        {event.type === 'log' && event.meta?.details && Object.keys(event.meta.details).length > 0 && (
                                            <div className="mt-2 text-[11px] bg-gray-100/80 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 space-y-1">
                                                {Object.entries(event.meta.details).filter(([k]) => k !== 'id').map(([key, value]) => (
                                                    <div key={key} className="flex gap-2">
                                                        <span className="font-semibold text-gray-500 shrink-0 capitalize">{key}:</span>
                                                        <span className="truncate">{String(value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Click hint */}
                                        <div className="flex items-center gap-1 mt-2.5 text-[10px] text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Eye className="w-3 h-3" />
                                            Click para ver detalles
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Load more ─────────────────────────────────── */}
            {hasMore && (
                <div className="flex justify-center pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-xs"
                        onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                        Cargar más ({filteredEvents.length - visibleCount} restantes)
                    </Button>
                </div>
            )}
            {/* ── Event Detail Modal ─────────────────────── */}
            <TimelineEventModal
                event={selectedEvent}
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
            />
        </div>
    )
}

export default UnifiedTimeline
