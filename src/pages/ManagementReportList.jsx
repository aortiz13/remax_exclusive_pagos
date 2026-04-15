import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Badge } from '@/components/ui'
import { FileText, Clock, CheckCircle, AlertTriangle, Loader2, ChevronRight, Plus, Eye, User, Home, Lock, PauseCircle, X, Search, Filter, Calendar, Mail, ExternalLink, SkipForward } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import PropertyPickerInline from '../components/ui/PropertyPickerInline'
import AdvancedFilterBuilder from '../components/crm/AdvancedFilterBuilder'
import useAdvancedFilters from '../hooks/useAdvancedFilters'
import { REPORT_FILTER_CONFIG } from '../components/crm/filterConfigs'

export default function ManagementReportList() {
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [allReports, setAllReports] = useState([])
    const [loading, setLoading] = useState(true)

    const isAdmin = ['superadministrador', 'comercial', 'legal', 'tecnico', 'administracion'].includes(profile?.role)
    // Admin default filter: all; Agent default filter: all
    const [filter, setFilter] = useState('all')

    // --- Advanced filters (AND/OR) ---
    const {
        filterGroups, activeFilterCount, hasActiveFilters,
        addFilter, removeFilter, updateFilter,
        addGroup, removeGroup, clearAll: clearAdvancedFilters,
        applyFilters,
    } = useAdvancedFilters(REPORT_FILTER_CONFIG)

    // --- New report modal state ---
    const [showNewModal, setShowNewModal] = useState(false)
    const [selectedProperty, setSelectedProperty] = useState(null)
    const [creatingReport, setCreatingReport] = useState(false)

    // --- Admin: detail drawer ---
    const [selectedReport, setSelectedReport] = useState(null)

    useEffect(() => {
        fetchReports()
    }, [user])

    const fetchAgents = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('role', 'agent')
            .order('first_name', { ascending: true })
        setAgents(data || [])
    }

    const fetchReports = async () => {
        if (!user) return
        setLoading(true)
        try {
            let query = supabase
                .from('management_reports')
                .select(`
                    *,
                    properties:property_id(address, commune, status),
                    owner:owner_contact_id(first_name, last_name, email)
                `)
                .order('due_date', { ascending: true })

            // Non-admin agents only see their own reports
            if (!isAdmin) {
                query = query.eq('agent_id', user.id)
            }

            // Agent filter for admins
            if (isAdmin && selectedAgentId !== 'all') {
                query = query.eq('agent_id', selectedAgentId)
            }

            // No status filter — always fetch all statuses for accurate counts

            const { data, error } = await query
            if (error) throw error

            let enriched = data || []

            // Enrich with agent names
            if (enriched.length > 0) {
                const agentIds = [...new Set(enriched.map(r => r.agent_id).filter(Boolean))]
                if (agentIds.length > 0) {
                    const { data: agentProfiles } = await supabase
                        .from('profiles')
                        .select('id, first_name, last_name')
                        .in('id', agentIds)
                    const agentMap = Object.fromEntries((agentProfiles || []).map(a => [a.id, a]))
                    enriched = enriched.map(r => ({ ...r, agent: agentMap[r.agent_id] || null }))
                }
            }

            // Dynamically resolve current owners from property_contacts
            const propertyIds = [...new Set(enriched.map(r => r.property_id).filter(Boolean))]
            if (propertyIds.length > 0) {
                const { data: ownerLinks } = await supabase
                    .from('property_contacts')
                    .select('property_id, contact_id, contacts:contact_id(id, first_name, last_name, email)')
                    .in('property_id', propertyIds)
                    .eq('role', 'propietario')

                if (ownerLinks && ownerLinks.length > 0) {
                    const ownerMap = Object.fromEntries(ownerLinks.map(l => [l.property_id, l]))
                    enriched = enriched.map(r => {
                        const link = ownerMap[r.property_id]
                        if (link?.contacts) {
                            if (link.contact_id !== r.owner_contact_id) {
                                supabase.from('management_reports')
                                    .update({ owner_contact_id: link.contact_id })
                                    .eq('id', r.id)
                                    .then(() => { })
                            }
                            return { ...r, owner: link.contacts }
                        }
                        return r
                    })
                }
            }

            // Mark reports that are overdue by date (pending but past due)
            // and add flat fields for advanced filtering
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            enriched = enriched.map(r => {
                const flat = {
                    ...r,
                    agent_name: r.agent ? `${r.agent.first_name || ''} ${r.agent.last_name || ''}`.trim() : '',
                    commune: r.properties?.commune || '',
                    property_type: r.properties?.property_type || '',
                    address: r.properties?.address || '',
                    owner_name: r.owner ? `${r.owner.first_name || ''} ${r.owner.last_name || ''}`.trim() : '',
                }
                if ((flat.status === 'pending') && flat.due_date) {
                    const dueDate = new Date(flat.due_date + 'T12:00:00')
                    if (dueDate < today) {
                        return { ...flat, _isOverdue: true }
                    }
                }
                return flat
            })

            setAllReports(enriched)
        } catch (err) {
            console.error('Error fetching reports:', err)
        } finally {
            setLoading(false)
        }
    }

    const statusConfig = {
        pending: { label: 'Por enviar', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock, dotColor: 'bg-amber-400' },
        overdue: { label: 'Atrasado', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle, dotColor: 'bg-red-500' },
        sent: { label: 'Enviado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, dotColor: 'bg-emerald-500' },
        waiting_publication: { label: 'En pausa', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: PauseCircle, dotColor: 'bg-slate-400' },
        skipped: { label: 'No realizado', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: SkipForward, dotColor: 'bg-orange-400' }
    }

    // --- Stats (always from ALL reports, not filtered) ---
    const pendingCount = allReports.filter(r => r.status === 'pending' || r.status === 'overdue' || r._isOverdue).length
    const overdueCount = allReports.filter(r => r.status === 'overdue' || r._isOverdue).length
    const sentCount = allReports.filter(r => r.status === 'sent').length
    const waitingCount = allReports.filter(r => r.status === 'waiting_publication').length
    const skippedCount = allReports.filter(r => r.status === 'skipped').length

    // --- Filtered reports for display ---
    const reports = useMemo(() => {
        // 1. Status tab filter
        let result = allReports
        if (filter === 'pending') result = result.filter(r => r.status === 'pending' || r.status === 'overdue' || r._isOverdue)
        else if (filter === 'overdue') result = result.filter(r => r.status === 'overdue' || r._isOverdue)
        else if (filter === 'sent') result = result.filter(r => r.status === 'sent')
        else if (filter === 'waiting_publication') result = result.filter(r => r.status === 'waiting_publication')
        else if (filter === 'skipped') result = result.filter(r => r.status === 'skipped')
        // 2. Advanced AND/OR filters
        if (hasActiveFilters) result = applyFilters(result)
        return result
    }, [allReports, filter, hasActiveFilters, applyFilters, filterGroups])

    // Admin tabs: show all statuses including overdue and skipped
    const adminTabs = [
        { key: 'all', label: 'Todos', count: allReports.length },
        { key: 'pending', label: 'Por enviar', count: pendingCount },
        { key: 'overdue', label: 'Atrasados', count: overdueCount },
        { key: 'sent', label: 'Enviados', count: sentCount },
        { key: 'skipped', label: 'No realizado', count: skippedCount },
        { key: 'waiting_publication', label: 'En pausa', count: waitingCount },
    ]

    // Agent tabs
    const agentTabs = [
        { key: 'all', label: 'Todos' },
        { key: 'pending', label: 'Por enviar' },
        { key: 'waiting_publication', label: 'En pausa' },
        { key: 'sent', label: 'Enviados' }
    ]

    const tabs = isAdmin ? adminTabs : agentTabs

    // Filter agents in dropdown
    const filteredAgents = useMemo(() => {
        if (!searchAgent) return agents
        const q = searchAgent.toLowerCase()
        return agents.filter(a =>
            `${a.first_name} ${a.last_name}`.toLowerCase().includes(q)
        )
    }, [agents, searchAgent])

    // --- Create on-demand report ---
    const handleCreateReport = async () => {
        if (!selectedProperty) {
            toast.error('Selecciona una propiedad')
            return
        }
        setCreatingReport(true)
        try {
            const { data: ownerLink } = await supabase
                .from('property_contacts')
                .select('contact_id')
                .eq('property_id', selectedProperty.id)
                .eq('role', 'propietario')
                .limit(1)
                .maybeSingle()

            const { count } = await supabase
                .from('management_reports')
                .select('id', { count: 'exact', head: true })
                .eq('property_id', selectedProperty.id)
                .eq('agent_id', user.id)

            const nextNumber = (count || 0) + 1
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + 15)

            const { data: newReport, error } = await supabase
                .from('management_reports')
                .insert({
                    property_id: selectedProperty.id,
                    agent_id: user.id,
                    owner_contact_id: ownerLink?.contact_id || null,
                    report_number: nextNumber,
                    due_date: dueDate.toISOString().split('T')[0],
                    status: 'pending',
                })
                .select('id')
                .single()

            if (error) throw error

            toast.success('Informe creado')
            setShowNewModal(false)
            setSelectedProperty(null)
            navigate(`/informes-gestion/${newReport.id}`)
        } catch (err) {
            console.error('Error creating report:', err)
            toast.error('Error al crear el informe')
        } finally {
            setCreatingReport(false)
        }
    }

    // Format date nicely
    const formatDate = (dateStr) => {
        if (!dateStr) return '—'
        const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    // Get real display status (accounting for date-based overdue)
    const getDisplayStatus = (report) => {
        if (report._isOverdue || report.status === 'overdue') return 'overdue'
        return report.status
    }

    const getDaysOverdue = (report) => {
        if (!report.due_date) return 0
        const dueDate = new Date(report.due_date + 'T12:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (dueDate >= today) return 0
        return Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        Informes de Gestión
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isAdmin
                            ? 'Vista consolidada de todos los informes de gestión por agente'
                            : 'Informes periódicos de gestión para propietarios deben ser enviados cada 15 días.'
                        }
                    </p>
                </div>
                {!isAdmin && (
                    <Button
                        onClick={() => { setShowNewModal(true); setSelectedProperty(null) }}
                        className="gap-2 shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo informe
                    </Button>
                )}
            </div>

            {/* New report modal */}
            <AnimatePresence>
                {showNewModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => { setShowNewModal(false); setSelectedProperty(null) }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-visible"
                        >
                            {/* Modal header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    Nuevo Informe de Gestión
                                </h2>
                                <button
                                    onClick={() => { setShowNewModal(false); setSelectedProperty(null) }}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>

                            {/* Modal body */}
                            <div className="px-6 py-5">
                                <p className="text-sm text-slate-500 mb-4">
                                    Selecciona la propiedad para la cual deseas generar un informe de gestión.
                                </p>
                                <PropertyPickerInline
                                    label="Propiedad *"
                                    value={selectedProperty?.id || ''}
                                    onSelectProperty={(property) => setSelectedProperty(property || null)}
                                />
                            </div>

                            {/* Modal footer */}
                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    variant="ghost"
                                    onClick={() => { setShowNewModal(false); setSelectedProperty(null) }}
                                    className="text-slate-500"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleCreateReport}
                                    disabled={!selectedProperty || creatingReport}
                                    className="gap-2 min-w-[140px]"
                                >
                                    {creatingReport ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</>
                                    ) : (
                                        <><Plus className="w-4 h-4" /> Crear informe</>
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Advanced Filters (AND/OR) */}
            {isAdmin && (
                <div className="flex items-center gap-3">
                    <AdvancedFilterBuilder
                        filterConfig={REPORT_FILTER_CONFIG}
                        filterGroups={filterGroups}
                        addFilter={addFilter}
                        removeFilter={removeFilter}
                        updateFilter={updateFilter}
                        addGroup={addGroup}
                        removeGroup={removeGroup}
                        clearAll={clearAdvancedFilters}
                        activeFilterCount={activeFilterCount}
                    />
                    {hasActiveFilters && (
                        <button
                            onClick={clearAdvancedFilters}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-slate-200 dark:border-slate-700"
                        >
                            <X className="w-3 h-3" />
                            Limpiar filtros
                        </button>
                    )}
                </div>
            )}

            {/* Stats Cards */}
            <div className={cn("grid gap-4", isAdmin ? "grid-cols-2 sm:grid-cols-6" : "grid-cols-3")}>
                {(isAdmin
                    ? [
                        { label: 'Total', count: allReports.length, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                        { label: 'Por enviar', count: pendingCount, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                        { label: 'Atrasados', count: overdueCount, color: 'from-red-500 to-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
                        { label: 'Enviados', count: sentCount, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                        { label: 'No realizado', count: skippedCount, color: 'from-orange-400 to-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                        { label: 'En pausa', count: waitingCount, color: 'from-slate-400 to-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/20' },
                    ]
                    : [
                        { label: 'Por enviar', count: pendingCount, color: overdueCount > 0 ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600', bg: overdueCount > 0 ? 'bg-red-50' : 'bg-amber-50', sub: overdueCount > 0 ? `${overdueCount} atrasado${overdueCount !== 1 ? 's' : ''}` : null },
                        { label: 'En pausa', count: waitingCount, color: 'from-slate-400 to-slate-500', bg: 'bg-slate-50' },
                        { label: 'Enviados', count: sentCount, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' }
                    ]
                ).map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn("rounded-xl p-4 border", stat.bg)}
                    >
                        <p className="text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }}>
                            <span className={cn("bg-gradient-to-r bg-clip-text text-transparent", stat.color)}>{stat.count}</span>
                        </p>
                        <p className="text-sm font-medium text-slate-600 mt-1">{stat.label}</p>
                        {stat.sub && <p className="text-xs font-medium text-red-500 mt-0.5">{stat.sub}</p>}
                    </motion.div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={cn(
                            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                            filter === tab.key
                                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        {tab.label}
                        {isAdmin && tab.count !== undefined && (
                            <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                filter === tab.key
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-200 text-slate-500"
                            )}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Reports List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">
                        {filter === 'pending'
                            ? 'No hay informes por enviar'
                            : filter === 'overdue'
                                ? 'No hay informes atrasados'
                                : filter === 'sent'
                                    ? 'No hay informes enviados'
                                    : filter === 'skipped'
                                        ? 'No hay informes no realizados'
                                        : filter === 'waiting_publication'
                                            ? 'No hay informes en pausa'
                                            : 'No hay informes de gestión'
                        }
                    </p>
                    <p className="text-sm">
                        {isAdmin
                            ? selectedAgentId !== 'all'
                                ? 'Prueba cambiando el filtro de agente o estado'
                                : 'Los informes aparecerán aquí cuando los agentes los gestionen'
                            : 'Los informes se crean automáticamente al registrar un mandato'
                        }
                    </p>
                </div>
            ) : isAdmin ? (
                /* ═══ Admin consolidated table view ═══ */
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {/* Table header */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-1 flex items-center gap-1">
                            Estado
                        </div>
                        <div className="col-span-1 flex items-center gap-1">
                            #
                        </div>
                        <div className="col-span-3 flex items-center gap-1">
                            <Home className="w-3.5 h-3.5" />
                            Propiedad
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            Propietario
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            Agente
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Fechas
                        </div>
                        <div className="col-span-1 text-right">
                            Acción
                        </div>
                    </div>

                    {/* Table rows */}
                    {reports.map((report, i) => {
                        const displayStatus = getDisplayStatus(report)
                        const cfg = statusConfig[displayStatus] || statusConfig.pending
                        const daysOverdue = getDaysOverdue(report)

                        return (
                            <motion.div
                                key={report.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.02 }}
                                className="group"
                            >
                                {/* Desktop row */}
                                <div
                                    onClick={() => navigate(`/informes-gestion/${report.id}`)}
                                    className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-blue-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                                >
                                    {/* Status */}
                                    <div className="col-span-1 flex items-center">
                                        <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border", cfg.color)}>
                                            {daysOverdue > 0 ? `${daysOverdue}d` : cfg.label}
                                        </span>
                                    </div>
                                    {/* Report number */}
                                    <div className="col-span-1 flex items-center">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                            #{report.report_number}
                                        </span>
                                    </div>
                                    {/* Property */}
                                    <div className="col-span-3 flex items-center min-w-0">
                                        <div className="truncate">
                                            <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{report.properties?.address || 'Sin dirección'}</p>
                                            {report.properties?.commune && (
                                                <p className="text-[11px] text-slate-400 truncate">{report.properties.commune}</p>
                                            )}
                                        </div>
                                    </div>
                                    {/* Owner */}
                                    <div className="col-span-2 flex items-center min-w-0">
                                        <div className="truncate">
                                            <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                                {report.owner?.first_name} {report.owner?.last_name}
                                            </p>
                                            {report.owner?.email && (
                                                <p className="text-[11px] text-slate-400 truncate">{report.owner.email}</p>
                                            )}
                                        </div>
                                    </div>
                                    {/* Agent */}
                                    <div className="col-span-2 flex items-center min-w-0">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                            {report.agent?.first_name} {report.agent?.last_name}
                                        </p>
                                    </div>
                                    {/* Dates */}
                                    <div className="col-span-2 flex items-center min-w-0">
                                        <div className="text-[11px] text-slate-500 space-y-0.5">
                                            <p className="truncate flex items-center gap-1">
                                                <Clock className="w-3 h-3 shrink-0" />
                                                {report.status === 'waiting_publication' ? 'En pausa' : `Enviar: ${formatDate(report.due_date)}`}
                                            </p>
                                            {report.sent_at && (
                                                <p className="truncate flex items-center gap-1 text-emerald-500">
                                                    <Mail className="w-3 h-3 shrink-0" />
                                                    Enviado: {formatDate(report.sent_at)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {/* Action */}
                                    <div className="col-span-1 flex items-center justify-end">
                                        <div className="p-1.5 rounded-lg text-slate-300 group-hover:text-blue-500 group-hover:bg-blue-100/50 transition-all">
                                            <Eye className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                {/* Mobile card */}
                                <div
                                    onClick={() => navigate(`/informes-gestion/${report.id}`)}
                                    className="sm:hidden px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 active:bg-blue-50/50 cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.color)}>
                                                    {daysOverdue > 0 ? `${daysOverdue}d atraso` : cfg.label}
                                                </span>
                                                <span className="text-xs font-bold text-slate-500">#{report.report_number}</span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                                {report.properties?.address || 'Sin dirección'}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {report.agent?.first_name} {report.agent?.last_name}
                                                {report.owner ? ` · ${report.owner.first_name} ${report.owner.last_name}` : ''}
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {report.status === 'waiting_publication' ? 'En pausa' : `Enviar: ${formatDate(report.due_date)}`}
                                                {report.sent_at && ` · Enviado: ${formatDate(report.sent_at)}`}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 mt-2 shrink-0" />
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}

                    {/* Row count footer */}
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t text-xs text-slate-400 text-right">
                        {reports.length} informe{reports.length !== 1 ? 's' : ''}
                        {selectedAgentId !== 'all' && ` · ${agents.find(a => a.id === selectedAgentId)?.first_name || 'Agente'}`}
                    </div>
                </div>
            ) : (
                /* Normal report list (agent: all views) */
                <div className="space-y-3">
                    {reports.map((report, i) => {
                        const cfg = statusConfig[report.status] || statusConfig.pending
                        const StatusIcon = cfg.icon
                        const isWaiting = report.status === 'waiting_publication'
                        const dueDate = isWaiting ? null : new Date(report.due_date + 'T12:00:00')
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const isOverdue = (report.status === 'pending' || report.status === 'overdue') && dueDate && dueDate < today
                        const daysOverdue = isOverdue ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)) : 0

                        // Auto-mark as overdue visually
                        const displayCfg = isWaiting ? statusConfig.waiting_publication : (isOverdue ? statusConfig.overdue : cfg)

                        return (
                            <motion.div
                                key={report.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => navigate(`/informes-gestion/${report.id}`)}
                                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-2 rounded-lg", isOverdue ? 'bg-red-100' : 'bg-blue-100')}>
                                            <StatusIcon className={cn("w-5 h-5", isOverdue ? 'text-red-600' : 'text-blue-600')} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                                Informe #{report.report_number}
                                            </h3>
                                            <p className="text-sm text-slate-500 flex items-center gap-1.5">
                                                {report.properties?.address || 'Propiedad sin dirección'}
                                                {report.properties?.commune && `, ${report.properties.commune}`}
                                                {report.property_id && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/crm/property/${report.property_id}`) }}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                                                        title="Ver propiedad"
                                                    >
                                                        <Home className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Propietario: {report.owner?.first_name} {report.owner?.last_name}
                                                {report.owner?.email && ` · ${report.owner.email}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border", displayCfg.color)}>
                                                {isOverdue ? `${daysOverdue}d de atraso` : displayCfg.label}
                                            </span>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {isWaiting ? 'Propiedad no publicada' : `Enviar: ${dueDate.toLocaleDateString('es-CL')}`}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
