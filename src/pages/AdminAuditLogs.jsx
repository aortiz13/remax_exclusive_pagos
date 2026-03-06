
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Shield, ShieldCheck, ShieldAlert, AlertTriangle, Info, Bug,
    Search, Filter, X, ChevronDown, RefreshCw, Download,
    Activity, Users, AlertCircle, Clock, TrendingUp, TrendingDown,
    Calendar, Eye, ExternalLink, Copy, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PAGE_SIZE = 50

const LEVEL_CONFIG = {
    error: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-900', badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400', icon: AlertCircle },
    warning: { color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400', icon: AlertTriangle },
    info: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400', icon: Info },
    debug: { color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-200 dark:border-slate-800', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400', icon: Bug },
}

const CATEGORY_LABELS = {
    auth: 'Autenticación',
    api: 'API / Supabase',
    crm: 'CRM',
    navigation: 'Navegación',
    system: 'Sistema',
    request: 'Solicitudes',
    kpi: 'KPIs',
    email: 'Email',
    camera: 'Cámara 360°',
    calendar: 'Calendario',
    documents: 'Documentos',
    import: 'Importación',
}

export default function AdminAuditLogs() {
    const { profile } = useAuth()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [stats, setStats] = useState({ total24h: 0, errors24h: 0, warnings24h: 0, activeUsers: 0, errorsThisWeek: 0, errorsLastWeek: 0, daysSinceLastError: 0 })
    const [agents, setAgents] = useState([])
    const [selectedLog, setSelectedLog] = useState(null)
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [copiedId, setCopiedId] = useState(null)

    // Filters
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        timeFrom: '',
        timeTo: '',
        agentId: '',
        level: '',
        category: '',
        search: '',
    })
    const [showFilters, setShowFilters] = useState(false)

    const scrollRef = useRef(null)
    const autoRefreshRef = useRef(null)

    // Guard
    if (!profile || !['tecnico', 'superadministrador'].includes(profile.role)) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <Shield className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-600">Acceso Restringido</h2>
                    <p className="text-slate-400 mt-2">No tienes permisos para ver esta sección.</p>
                </div>
            </div>
        )
    }

    // ─── Fetch agents ────────────────────────────────────────────────────────
    useEffect(() => {
        supabase.from('profiles').select('id, first_name, last_name, email, role')
            .order('first_name')
            .then(({ data }) => setAgents(data || []))
    }, [])

    // ─── Build query ─────────────────────────────────────────────────────────
    const buildQuery = useCallback((countOnly = false) => {
        let q = supabase.from('system_audit_logs')

        if (countOnly) {
            q = q.select('id', { count: 'exact', head: true })
        } else {
            q = q.select('*')
        }

        if (filters.dateFrom) {
            const from = filters.timeFrom
                ? `${filters.dateFrom}T${filters.timeFrom}:00`
                : `${filters.dateFrom}T00:00:00`
            q = q.gte('created_at', from)
        }
        if (filters.dateTo) {
            const to = filters.timeTo
                ? `${filters.dateTo}T${filters.timeTo}:59`
                : `${filters.dateTo}T23:59:59`
            q = q.lte('created_at', to)
        }
        if (filters.agentId) q = q.eq('user_id', filters.agentId)
        if (filters.level) q = q.eq('level', filters.level)
        if (filters.category) q = q.eq('category', filters.category)
        if (filters.search) q = q.or(`message.ilike.%${filters.search}%,action.ilike.%${filters.search}%,module.ilike.%${filters.search}%`)

        return q
    }, [filters])

    // ─── Fetch stats ─────────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        const now = new Date()
        const h24 = new Date(now - 24 * 60 * 60 * 1000).toISOString()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
        const lastWeekStart = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

        const [total24hRes, errors24hRes, warnings24hRes, usersRes, errorsThisWeekRes, errorsLastWeekRes, lastErrorRes] = await Promise.all([
            supabase.from('system_audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', h24),
            supabase.from('system_audit_logs').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', h24),
            supabase.from('system_audit_logs').select('id', { count: 'exact', head: true }).eq('level', 'warning').gte('created_at', h24),
            supabase.from('system_audit_logs').select('user_id', { count: 'exact', head: true }).gte('created_at', h24).not('user_id', 'is', null),
            supabase.from('system_audit_logs').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', weekStart),
            supabase.from('system_audit_logs').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', lastWeekStart).lt('created_at', weekStart),
            supabase.from('system_audit_logs').select('created_at').eq('level', 'error').order('created_at', { ascending: false }).limit(1),
        ])

        let daysSince = 0
        if (lastErrorRes.data && lastErrorRes.data.length > 0) {
            const lastErr = new Date(lastErrorRes.data[0].created_at)
            daysSince = Math.floor((now - lastErr) / (24 * 60 * 60 * 1000))
        } else {
            daysSince = 999 // No errors ever
        }

        setStats({
            total24h: total24hRes.count || 0,
            errors24h: errors24hRes.count || 0,
            warnings24h: warnings24hRes.count || 0,
            activeUsers: usersRes.count || 0,
            errorsThisWeek: errorsThisWeekRes.count || 0,
            errorsLastWeek: errorsLastWeekRes.count || 0,
            daysSinceLastError: daysSince,
        })
    }, [])

    // ─── Fetch logs ──────────────────────────────────────────────────────────
    const fetchLogs = useCallback(async (append = false) => {
        if (!append) setLoading(true)
        else setLoadingMore(true)

        try {
            let q = buildQuery()
            q = q.order('created_at', { ascending: false })

            if (append && logs.length > 0) {
                q = q.lt('created_at', logs[logs.length - 1].created_at)
            }

            q = q.limit(PAGE_SIZE)
            const { data, error } = await q

            if (error) throw error

            if (append) {
                setLogs(prev => [...prev, ...(data || [])])
            } else {
                setLogs(data || [])
            }
            setHasMore((data || []).length === PAGE_SIZE)
        } catch (err) {
            console.error('Error fetching audit logs:', err)
            toast.error('Error al cargar logs de auditoría')
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [buildQuery, logs])

    // Initial load + refetch on filter change
    useEffect(() => {
        fetchLogs()
        fetchStats()
    }, [filters.dateFrom, filters.dateTo, filters.timeFrom, filters.timeTo, filters.agentId, filters.level, filters.category, filters.search])

    // Auto refresh
    useEffect(() => {
        if (autoRefresh) {
            autoRefreshRef.current = setInterval(() => {
                fetchLogs()
                fetchStats()
            }, 10000)
        }
        return () => {
            if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
        }
    }, [autoRefresh])

    // Infinite scroll
    const handleScroll = useCallback(() => {
        const el = scrollRef.current
        if (!el || loadingMore || !hasMore) return
        const { scrollTop, scrollHeight, clientHeight } = el
        if (scrollHeight - scrollTop - clientHeight < 300) {
            fetchLogs(true)
        }
    }, [fetchLogs, loadingMore, hasMore])

    const clearFilters = () => {
        setFilters({ dateFrom: '', dateTo: '', timeFrom: '', timeTo: '', agentId: '', level: '', category: '', search: '' })
    }

    const activeFilterCount = useMemo(() => {
        return Object.values(filters).filter(v => v !== '').length
    }, [filters])

    const formatTime = (isoStr) => {
        const d = new Date(isoStr)
        return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    // Export CSV
    const exportCSV = async () => {
        toast.loading('Exportando logs...')
        try {
            let q = buildQuery()
            q = q.order('created_at', { ascending: false }).limit(5000)
            const { data } = await q
            if (!data || data.length === 0) {
                toast.dismiss()
                toast.info('No hay logs para exportar')
                return
            }

            const headers = ['Fecha', 'Nivel', 'Categoría', 'Acción', 'Mensaje', 'Módulo', 'Path', 'Usuario', 'Email']
            const rows = data.map(l => [
                new Date(l.created_at).toISOString(),
                l.level,
                l.category,
                l.action,
                `"${(l.message || '').replace(/"/g, '""')}"`,
                l.module || '',
                l.path || '',
                l.user_name || '',
                l.user_email || '',
            ])
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.dismiss()
            toast.success(`${data.length} logs exportados`)
        } catch {
            toast.dismiss()
            toast.error('Error al exportar')
        }
    }

    // ─── Incident-free banner ────────────────────────────────────────────────
    const daysSafe = stats.daysSinceLastError
    const safeColor = daysSafe === 0 ? 'from-red-500 to-rose-600' : daysSafe <= 7 ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-green-500'
    const safeBorderColor = daysSafe === 0 ? 'border-red-300' : daysSafe <= 7 ? 'border-amber-300' : 'border-emerald-300'
    const safeIcon = daysSafe === 0 ? ShieldAlert : daysSafe <= 7 ? AlertTriangle : ShieldCheck

    const errorTrend = stats.errorsThisWeek - stats.errorsLastWeek
    const trendPositive = errorTrend <= 0

    return (
        <div className="space-y-6 pb-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/25">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        Auditoría del Sistema
                    </h1>
                    <p className="text-slate-500 mt-1.5 text-sm">Monitoreo en tiempo real de toda la actividad y errores de la plataforma</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                            autoRefresh
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shadow-sm"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} style={autoRefresh ? { animationDuration: '3s' } : {}} />
                        {autoRefresh ? 'Auto ON' : 'Auto OFF'}
                    </button>

                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Exportar
                    </button>

                    <button
                        onClick={() => { fetchLogs(); fetchStats() }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Incident-Free Banner */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("relative overflow-hidden rounded-2xl border p-5", safeBorderColor)}
            >
                <div className={cn("absolute inset-0 bg-gradient-to-r opacity-10", safeColor)} />
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-lg", safeColor)}>
                            {(() => { const Icon = safeIcon; return <Icon className="w-7 h-7 text-white" /> })()}
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className={cn("text-4xl font-black tabular-nums", daysSafe === 0 ? "text-red-600" : daysSafe <= 7 ? "text-amber-600" : "text-emerald-600")}>
                                    {daysSafe >= 999 ? '∞' : daysSafe}
                                </span>
                                <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                                    {daysSafe === 1 ? 'día' : 'días'} sin incidencias
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {daysSafe === 0 ? 'Se registraron errores hoy — revisa los detalles abajo' :
                                    daysSafe >= 999 ? '¡No se han registrado errores nunca! 🎉' :
                                        daysSafe > 7 ? '¡Excelente estabilidad del sistema! 🎉' :
                                            'El sistema está funcionando con algunas alertas'}
                            </p>
                        </div>
                    </div>

                    {/* Quick trend */}
                    <div className="text-right">
                        <div className={cn("flex items-center gap-1 text-sm font-semibold", trendPositive ? "text-emerald-600" : "text-red-600")}>
                            {trendPositive ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                            {Math.abs(errorTrend)} {trendPositive ? 'menos' : 'más'} errores
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">vs semana anterior</p>
                    </div>
                </div>
            </motion.div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Eventos (24h)', value: stats.total24h, icon: Activity, color: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-500/20' },
                    { label: 'Errores (24h)', value: stats.errors24h, icon: AlertCircle, color: 'from-red-500 to-rose-500', shadow: 'shadow-red-500/20', pulse: stats.errors24h > 0 },
                    { label: 'Warnings (24h)', value: stats.warnings24h, icon: AlertTriangle, color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
                    { label: 'Usuarios Activos', value: stats.activeUsers, icon: Users, color: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-500/20' },
                ].map((kpi, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-lg", kpi.color, kpi.shadow, kpi.pulse && "animate-pulse")}>
                            <kpi.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{kpi.value.toLocaleString()}</p>
                            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Filter toggle bar */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        Filtros
                        {activeFilterCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary text-white rounded-full">{activeFilterCount}</span>
                        )}
                        <ChevronDown className={cn("w-4 h-4 transition-transform", showFilters && "rotate-180")} />
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Quick search always visible */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar en logs..."
                                value={filters.search}
                                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                                className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 w-64 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            />
                        </div>

                        {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                                <X className="w-3 h-3" /> Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {/* Expanded filters */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 pt-4">
                                {/* Date From */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Desde</label>
                                    <input
                                        type="date"
                                        value={filters.dateFrom}
                                        onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                                {/* Date To */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Hasta</label>
                                    <input
                                        type="date"
                                        value={filters.dateTo}
                                        onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                                {/* Time From */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Hora Desde</label>
                                    <input
                                        type="time"
                                        value={filters.timeFrom}
                                        onChange={e => setFilters(f => ({ ...f, timeFrom: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                                {/* Time To */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Hora Hasta</label>
                                    <input
                                        type="time"
                                        value={filters.timeTo}
                                        onChange={e => setFilters(f => ({ ...f, timeTo: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                                {/* Agent */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Agente</label>
                                    <select
                                        value={filters.agentId}
                                        onChange={e => setFilters(f => ({ ...f, agentId: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">Todos</option>
                                        {agents.map(a => (
                                            <option key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.email})</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Level */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nivel</label>
                                    <select
                                        value={filters.level}
                                        onChange={e => setFilters(f => ({ ...f, level: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">Todos</option>
                                        <option value="error">🔴 Error</option>
                                        <option value="warning">🟡 Warning</option>
                                        <option value="info">🔵 Info</option>
                                        <option value="debug">⚪ Debug</option>
                                    </select>
                                </div>
                                {/* Category */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Categoría</label>
                                    <select
                                        value={filters.category}
                                        onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">Todas</option>
                                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[120px_80px_140px_120px_1fr] gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Fecha/Hora</span>
                    <span>Nivel</span>
                    <span>Agente</span>
                    <span>Categoría</span>
                    <span>Acción / Mensaje</span>
                </div>

                {/* Scrollable body */}
                <div ref={scrollRef} onScroll={handleScroll} className="max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-slate-400">
                            <RefreshCw className="w-6 h-6 animate-spin mr-3" />
                            Cargando logs...
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Shield className="w-12 h-12 mb-3 text-slate-300" />
                            <p className="font-semibold">No se encontraron logs</p>
                            <p className="text-sm mt-1">Ajusta los filtros o espera a que se generen eventos</p>
                        </div>
                    ) : (
                        <>
                            {logs.map((log, i) => {
                                const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info
                                const LevelIcon = cfg.icon
                                return (
                                    <motion.div
                                        key={log.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: Math.min(i * 0.01, 0.3) }}
                                        onClick={() => setSelectedLog(log)}
                                        className={cn(
                                            "grid grid-cols-[120px_80px_140px_120px_1fr] gap-2 px-5 py-3 cursor-pointer border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm",
                                            log.level === 'error' && "bg-red-50/50 dark:bg-red-950/10"
                                        )}
                                    >
                                        <span className="text-xs text-slate-500 tabular-nums font-medium truncate" title={new Date(log.created_at).toISOString()}>
                                            {formatTime(log.created_at)}
                                        </span>

                                        <span>
                                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", cfg.badge)}>
                                                <LevelIcon className="w-3 h-3" />
                                                {log.level}
                                            </span>
                                        </span>

                                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate" title={log.user_email || ''}>
                                            {log.user_name || log.user_email || '—'}
                                        </span>

                                        <span className="text-xs text-slate-500 truncate">
                                            {CATEGORY_LABELS[log.category] || log.category}
                                        </span>

                                        <div className="min-w-0">
                                            <span className="font-medium text-slate-800 dark:text-slate-200 text-xs truncate block">{log.action}</span>
                                            {log.message && (
                                                <span className="text-xs text-slate-500 truncate block">{log.message}</span>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}

                            {loadingMore && (
                                <div className="flex items-center justify-center py-4 text-slate-400 text-sm">
                                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    Cargando más...
                                </div>
                            )}

                            {!hasMore && logs.length > 0 && (
                                <div className="text-center py-4 text-xs text-slate-400">
                                    — Fin de los registros —
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedLog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => setSelectedLog(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            {(() => {
                                const cfg = LEVEL_CONFIG[selectedLog.level] || LEVEL_CONFIG.info
                                const LevelIcon = cfg.icon
                                return (
                                    <div className={cn("px-6 py-4 border-b flex items-center justify-between", cfg.bg, cfg.border)}>
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-xl", cfg.badge)}>
                                                <LevelIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white">{selectedLog.action}</h3>
                                                <p className="text-xs text-slate-500">{formatTime(selectedLog.created_at)}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                            <X className="w-5 h-5 text-slate-500" />
                                        </button>
                                    </div>
                                )
                            })()}

                            {/* Modal Body */}
                            <div className="overflow-y-auto p-6 space-y-4">
                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Nivel', value: selectedLog.level?.toUpperCase() },
                                        { label: 'Categoría', value: CATEGORY_LABELS[selectedLog.category] || selectedLog.category },
                                        { label: 'Usuario', value: selectedLog.user_name || '—' },
                                        { label: 'Email', value: selectedLog.user_email || '—' },
                                        { label: 'Módulo', value: selectedLog.module || '—' },
                                        { label: 'Path', value: selectedLog.path || '—' },
                                        ...(selectedLog.error_code ? [{ label: 'Código Error', value: selectedLog.error_code }] : []),
                                    ].map((item, i) => (
                                        <div key={i}>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 break-all">{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Message */}
                                {selectedLog.message && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mensaje</span>
                                        <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                                            {selectedLog.message}
                                        </div>
                                    </div>
                                )}

                                {/* Details JSON */}
                                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalles (JSON)</span>
                                            <button
                                                onClick={() => copyToClipboard(JSON.stringify(selectedLog.details, null, 2), selectedLog.id)}
                                                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
                                            >
                                                {copiedId === selectedLog.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                {copiedId === selectedLog.id ? 'Copiado' : 'Copiar'}
                                            </button>
                                        </div>
                                        <pre className="p-4 bg-slate-900 dark:bg-slate-950 text-green-400 rounded-xl text-xs overflow-x-auto max-h-80 font-mono leading-relaxed">
                                            {JSON.stringify(selectedLog.details, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Log ID */}
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-mono">ID: {selectedLog.id}</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
