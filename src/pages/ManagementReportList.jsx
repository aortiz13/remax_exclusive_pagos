import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Badge } from '@/components/ui'
import { FileText, Clock, CheckCircle, AlertTriangle, Loader2, ChevronRight, Plus, Construction, Eye, User, Home, Lock, PauseCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import PropertyPickerInline from '../components/ui/PropertyPickerInline'

export default function ManagementReportList() {
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)

    const isAdmin = ['superadministrador', 'comercial', 'legal', 'tecnico'].includes(profile?.role)
    // Admin default filter: sent; Agent default filter: all
    const [filter, setFilter] = useState(isAdmin ? 'sent' : 'all')

    // --- New report modal state ---
    const [showNewModal, setShowNewModal] = useState(false)
    const [selectedProperty, setSelectedProperty] = useState(null)
    const [creatingReport, setCreatingReport] = useState(false)

    useEffect(() => {
        fetchReports()
    }, [user, filter])

    const fetchReports = async () => {
        if (!user) return
        setLoading(true)
        try {
            let query = supabase
                .from('management_reports')
                .select(`
                    *,
                    properties:property_id(address, commune),
                    owner:owner_contact_id(first_name, last_name, email)
                `)
                .order('due_date', { ascending: true })

            // Non-admin agents only see their own reports
            if (!isAdmin) {
                query = query.eq('agent_id', user.id)
            }

            // Admin: only fetch sent and overdue reports
            if (isAdmin) {
                if (filter === 'sent') {
                    query = query.eq('status', 'sent')
                } else if (filter === 'overdue') {
                    query = query.eq('status', 'overdue')
                }
            } else {
                if (filter === 'pending') {
                    // "Por enviar" includes both pending and overdue statuses
                    query = query.in('status', ['pending', 'overdue'])
                } else if (filter !== 'all') {
                    query = query.eq('status', filter)
                }
            }

            const { data, error } = await query
            if (error) throw error

            // For admin: enrich with agent names from profiles
            let enriched = data || []
            if (isAdmin && enriched.length > 0) {
                const agentIds = [...new Set(enriched.map(r => r.agent_id).filter(Boolean))]
                const { data: agentProfiles } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name')
                    .in('id', agentIds)
                const agentMap = Object.fromEntries((agentProfiles || []).map(a => [a.id, a]))
                enriched = enriched.map(r => ({ ...r, agent: agentMap[r.agent_id] || null }))
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
                            // Update stale owner_contact_id in background
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

            // For admin overdue filter: also include pending reports that are past due
            if (isAdmin && filter === 'overdue') {
                // Fetch pending reports that are overdue by date
                const { data: pendingData } = await supabase
                    .from('management_reports')
                    .select(`
                        *,
                        properties:property_id(address, commune),
                        owner:owner_contact_id(first_name, last_name, email)
                    `)
                    .eq('status', 'pending')
                    .order('due_date', { ascending: true })

                if (pendingData && pendingData.length > 0) {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const overduePending = pendingData.filter(r => {
                        const dueDate = new Date(r.due_date + 'T12:00:00')
                        return dueDate < today
                    })

                    if (overduePending.length > 0) {
                        // Enrich with agent names
                        const agentIds = [...new Set(overduePending.map(r => r.agent_id).filter(Boolean))]
                        if (agentIds.length > 0) {
                            const { data: agentProfiles } = await supabase
                                .from('profiles')
                                .select('id, first_name, last_name')
                                .in('id', agentIds)
                            const agentMap = Object.fromEntries((agentProfiles || []).map(a => [a.id, a]))
                            overduePending.forEach(r => { r.agent = agentMap[r.agent_id] || null })
                        }

                        // Resolve owners
                        const opPropertyIds = [...new Set(overduePending.map(r => r.property_id).filter(Boolean))]
                        if (opPropertyIds.length > 0) {
                            const { data: ownerLinks2 } = await supabase
                                .from('property_contacts')
                                .select('property_id, contact_id, contacts:contact_id(id, first_name, last_name, email)')
                                .in('property_id', opPropertyIds)
                                .eq('role', 'propietario')
                            if (ownerLinks2 && ownerLinks2.length > 0) {
                                const ownerMap2 = Object.fromEntries(ownerLinks2.map(l => [l.property_id, l]))
                                overduePending.forEach(r => {
                                    const link = ownerMap2[r.property_id]
                                    if (link?.contacts) r.owner = link.contacts
                                })
                            }
                        }

                        enriched = [...enriched, ...overduePending]
                    }
                }
            }

            setReports(enriched)
        } catch (err) {
            console.error('Error fetching reports:', err)
        } finally {
            setLoading(false)
        }
    }

    const statusConfig = {
        pending: { label: 'Por enviar', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
        overdue: { label: 'Atrasado', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
        sent: { label: 'Enviado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
        waiting_publication: { label: 'En pausa', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: PauseCircle }
    }

    const pendingReports = reports.filter(r => r.status === 'pending' || r.status === 'overdue')
    const pendingCount = pendingReports.length
    const overdueCount = pendingReports.filter(r => {
        if (r.status === 'overdue') return true
        const dueDate = new Date(r.due_date + 'T12:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return dueDate < today
    }).length
    const sent = reports.filter(r => r.status === 'sent').length
    const waiting = reports.filter(r => r.status === 'waiting_publication').length

    // Admin tabs
    const adminTabs = [
        { key: 'sent', label: 'Enviados' },
        { key: 'overdue', label: 'Atrasados' }
    ]

    // Agent tabs
    const agentTabs = [
        { key: 'all', label: 'Todos' },
        { key: 'pending', label: 'Por enviar' },
        { key: 'waiting_publication', label: 'En pausa' },
        { key: 'sent', label: 'Enviados' }
    ]

    const tabs = isAdmin ? adminTabs : agentTabs

    // --- Create on-demand report ---
    const handleCreateReport = async () => {
        if (!selectedProperty) {
            toast.error('Selecciona una propiedad')
            return
        }
        setCreatingReport(true)
        try {
            // 1. Resolve owner from property_contacts
            const { data: ownerLink } = await supabase
                .from('property_contacts')
                .select('contact_id')
                .eq('property_id', selectedProperty.id)
                .eq('role', 'propietario')
                .limit(1)
                .maybeSingle()

            // 2. Count existing reports for this property to get next report_number
            const { count } = await supabase
                .from('management_reports')
                .select('id', { count: 'exact', head: true })
                .eq('property_id', selectedProperty.id)
                .eq('agent_id', user.id)

            const nextNumber = (count || 0) + 1

            // 3. Due date = today + 15 days
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + 15)

            // 4. Insert
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

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Construction Banner */}
            <div className="rounded-xl p-4 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 shadow-sm">
                <div className="p-2 bg-amber-100 rounded-lg">
                    <Construction className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                    <p className="font-semibold text-sm text-slate-900">🚧 Sección en Construcción</p>
                    <p className="text-xs text-slate-500">Estamos mejorando esta sección. Algunas funciones pueden no estar disponibles aún.</p>
                </div>
            </div>

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
                            ? 'Seguimiento de informes periódicos de gestión'
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

            {/* Stats Cards */}
            <div className={cn("grid gap-4", isAdmin ? "grid-cols-2" : "grid-cols-3")}>
                {(isAdmin
                    ? [
                        { label: 'Atrasados', count: overdueCount, color: 'from-red-500 to-red-600', bg: 'bg-red-50' },
                        { label: 'Enviados', count: sent, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' }
                    ]
                    : [
                        { label: 'Por enviar', count: pendingCount, color: overdueCount > 0 ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600', bg: overdueCount > 0 ? 'bg-red-50' : 'bg-amber-50', sub: overdueCount > 0 ? `${overdueCount} atrasado${overdueCount !== 1 ? 's' : ''}` : null },
                        { label: 'En pausa', count: waiting, color: 'from-slate-400 to-slate-500', bg: 'bg-slate-50' },
                        { label: 'Enviados', count: sent, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' }
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
                            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            filter === tab.key
                                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        {tab.label}
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
                        {isAdmin && filter === 'overdue'
                            ? 'No hay informes atrasados'
                            : isAdmin && filter === 'sent'
                                ? 'No hay informes enviados'
                                : filter === 'pending'
                                    ? 'No hay informes por enviar'
                                    : filter === 'waiting_publication'
                                        ? 'No hay informes en pausa'
                                : 'No hay informes de gestión'
                        }
                    </p>
                    <p className="text-sm">
                        {isAdmin
                            ? 'Los informes aparecerán aquí cuando los agentes los gestionen'
                            : 'Los informes se crean automáticamente al registrar un mandato'
                        }
                    </p>
                </div>
            ) : isAdmin && filter === 'overdue' ? (
                /* Admin: Simplified overdue table — read-only, no navigation */
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-semibold text-red-700 dark:text-red-400">Informes Atrasados</span>
                        <span className="text-xs text-red-500 ml-auto">{reports.length} informe{reports.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-3 gap-4 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5" />
                            Propiedad
                        </div>
                        <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            Propietario
                        </div>
                        <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            Agente Responsable
                        </div>
                    </div>

                    {/* Table rows */}
                    {reports.map((report, i) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        >
                            <div className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                {report.properties?.address || 'Sin dirección'}
                                {report.properties?.commune && (
                                    <span className="text-xs text-slate-400 block truncate">{report.properties.commune}</span>
                                )}
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                {report.owner?.first_name} {report.owner?.last_name}
                                {report.owner?.email && (
                                    <span className="text-xs text-slate-400 block truncate">{report.owner.email}</span>
                                )}
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                {report.agent?.first_name} {report.agent?.last_name}
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                /* Normal report list (agent: all views; admin: sent reports) */
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
                                                {isAdmin && report.agent && (
                                                    <span className="text-slate-400 font-normal"> — {report.agent.first_name} {report.agent.last_name}</span>
                                                )}
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
                                        {isAdmin ? (
                                            <Eye className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        )}
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
