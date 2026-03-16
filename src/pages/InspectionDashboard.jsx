import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInspections, createInspection, getInspectionSchedule, getAdministradaProperties, syncAllAdministradaSchedules, createPublicInspection, getPublicInspectionUrl } from '../services/inspectionService'
import { supabase } from '../services/supabase'
import { toast } from 'sonner'
import {
    ClipboardCheck, Plus, Search, Filter, Calendar, User,
    MapPin, Clock, CheckCircle, AlertTriangle, Eye, ChevronDown,
    RefreshCw, Info, Building2, Link, UserPlus
} from 'lucide-react'

const STATUS_MAP = {
    draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: Clock },
    pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700', icon: Clock },
    completed: { label: 'Completada', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    sent: { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    overdue: { label: 'Vencida', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500', icon: Clock },
}

export default function InspectionDashboard() {
    const { user, profile } = useAuth()
    const navigate = useNavigate()

    const [inspections, setInspections] = useState([])
    const [schedule, setSchedule] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('inspections') // 'inspections' | 'schedule'
    const [statusFilter, setStatusFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [showNewModal, setShowNewModal] = useState(false)
    const [selectedPropertyId, setSelectedPropertyId] = useState('')
    const [creating, setCreating] = useState(false)
    const [administradaProps, setAdministradaProps] = useState([])
    const [syncing, setSyncing] = useState(false)
    const [agentFilter, setAgentFilter] = useState('')
    const [schedulePage, setSchedulePage] = useState(20)
    const [showAssignModal, setShowAssignModal] = useState(null) // schedule item to assign
    const [agents, setAgents] = useState([])
    const [selectedAgentId, setSelectedAgentId] = useState('')
    const [assigning, setAssigning] = useState(false)

    const isAdmin = ['superadministrador', 'tecnico', 'legal', 'comercial', 'administracion'].includes(profile?.role)

    const loadData = async () => {
        if (!isAdmin) return
        try {
            setLoading(true)
            const [inspData, schedData, adminProps] = await Promise.all([
                getInspections(isAdmin ? {} : { agentId: user?.id }),
                getInspectionSchedule(isAdmin ? {} : { agentId: user?.id }),
                getAdministradaProperties(),
            ])
            setInspections(inspData)
            setSchedule(schedData)
            setAdministradaProps(adminProps)
        } catch (err) {
            console.error('Error loading data:', err)
            toast.error('Error cargando datos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [user])

    // ─── Agent role: show "under construction" placeholder ──────────────
    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-[70vh]">
                <div className="text-center max-w-md mx-auto px-6">
                    {/* Animated icon */}
                    <div className="relative mx-auto w-24 h-24 mb-8">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#003DA5]/20 to-[#DC2626]/10 rounded-2xl animate-pulse" style={{ animationDuration: '3s' }} />
                        <div className="absolute inset-2 bg-white rounded-xl shadow-lg flex items-center justify-center">
                            <ClipboardCheck className="w-10 h-10 text-[#003DA5]/40" />
                        </div>
                        {/* Construction accent */}
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center shadow-md rotate-12">
                            <span className="text-sm">🔨</span>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-3">
                        Sección en Construcción
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-6">
                        Estamos trabajando en el módulo de Inspecciones para agentes. Pronto estará disponible con todas las funcionalidades.
                    </p>

                    {/* RE/MAX branded divider */}
                    <div className="flex items-center gap-3 justify-center mb-6">
                        <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#003DA5]/30" />
                        <div className="w-2 h-2 rounded-full bg-[#003DA5]/30" />
                        <div className="w-2 h-2 rounded-full bg-[#DC2626]/30" />
                        <div className="w-2 h-2 rounded-full bg-[#003DA5]/30" />
                        <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#003DA5]/30" />
                    </div>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-2.5 bg-[#003DA5] text-white rounded-xl text-sm font-semibold hover:bg-[#002d7a] transition-colors shadow-lg shadow-blue-500/20"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        )
    }

    const handleSync = async () => {
        setSyncing(true)
        try {
            const results = await syncAllAdministradaSchedules()
            if (results.generated > 0) {
                toast.success(`Se generaron ${results.generated} inspecciones programadas`)
                await loadData()
            } else if (results.skipped > 0) {
                toast.info('No se generaron nuevas inspecciones. Verifique que las propiedades tengan fechas de contrato.')
            } else {
                toast.info('Todas las inspecciones ya están programadas')
            }
            if (results.errors.length > 0) {
                console.error('Sync errors:', results.errors)
                toast.error(`${results.errors.length} propiedad(es) con errores. Ver consola.`)
            }
        } catch (err) {
            console.error('Sync error:', err)
            toast.error('Error al sincronizar programación')
        } finally {
            setSyncing(false)
        }
    }

    const openNewModal = () => {
        setSelectedPropertyId('')
        setShowNewModal(true)
    }

    const handleGeneratePublicLink = async (scheduleItem) => {
        try {
            const inspection = await createPublicInspection(scheduleItem.property_id)
            const url = getPublicInspectionUrl(inspection.public_token)
            await navigator.clipboard.writeText(url)
            toast.success('Enlace copiado al portapapeles', {
                description: 'Comparta este enlace con el inspector externo',
            })
        } catch (err) {
            console.error('Error generating public link:', err)
            toast.error('Error al generar enlace público')
        }
    }

    const openAssignModal = async (schedItem) => {
        setShowAssignModal(schedItem)
        setSelectedAgentId('')
        if (agents.length === 0) {
            const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, role')
                .in('role', ['agente', 'superadministrador', 'tecnico', 'comercial', 'legal', 'administracion'])
                .order('first_name')
            setAgents(data || [])
        }
    }

    const handleAssignAgent = async () => {
        if (!selectedAgentId || !showAssignModal) return
        setAssigning(true)
        try {
            await supabase
                .from('inspection_schedule')
                .update({ agent_id: selectedAgentId })
                .eq('id', showAssignModal.id)

            await supabase
                .from('properties')
                .update({ agent_id: selectedAgentId, updated_at: new Date().toISOString() })
                .eq('id', showAssignModal.property_id)

            const agentName = agents.find(a => a.id === selectedAgentId)
            toast.success(`Inspección derivada a ${agentName?.first_name || ''} ${agentName?.last_name || ''}`)
            setShowAssignModal(null)
            await loadData()
        } catch (err) {
            console.error('Error assigning agent:', err)
            toast.error('Error al derivar inspección')
        } finally {
            setAssigning(false)
        }
    }

    const StatusBadge = ({ status }) => {
        const config = STATUS_MAP[status] || STATUS_MAP.draft
        const Icon = config.icon
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
            </span>
        )
    }

    // Only show inspections from 5 days ago onwards
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    fiveDaysAgo.setHours(0, 0, 0, 0)
    const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0]

    const filteredInspections = inspections.filter(i => {
        // Date filter: only show if inspection_date is within last 5 days or future, or if no date (draft)
        if (i.inspection_date && i.inspection_date < fiveDaysAgoStr) return false
        if (statusFilter && i.status !== statusFilter) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            return (
                (i.address || '').toLowerCase().includes(q) ||
                (i.owner_name || '').toLowerCase().includes(q) ||
                (i.tenant_name || '').toLowerCase().includes(q) ||
                (i.agent?.first_name || '').toLowerCase().includes(q) ||
                (i.agent?.last_name || '').toLowerCase().includes(q)
            )
        }
        return true
    })

    const filteredSchedule = schedule.filter(s => {
        if (statusFilter && s.status !== statusFilter) return false
        if (agentFilter === '__none__' && s.agent_id) return false
        if (agentFilter && agentFilter !== '__none__' && s.agent_id !== agentFilter) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            return (
                (s.property?.address || '').toLowerCase().includes(q) ||
                (s.agent?.first_name || '').toLowerCase().includes(q)
            )
        }
        return true
    }).sort((a, b) => {
        const da = a.scheduled_date || ''
        const db = b.scheduled_date || ''
        return da.localeCompare(db)
    })

    const paginatedSchedule = filteredSchedule.slice(0, schedulePage)
    const hasMoreSchedule = schedulePage < filteredSchedule.length

    // Get unique agents from schedule for the filter dropdown
    const scheduleAgents = isAdmin ? [...new Map(
        schedule
            .filter(s => s.agent)
            .map(s => [s.agent.id, s.agent])
    ).values()] : []

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-[#003DA5] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">Cargando inspecciones...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#003DA5] to-[#002d7a] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <ClipboardCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Inspecciones de Propiedades</h1>
                        <p className="text-sm text-slate-500">
                            {inspections.length} inspección{inspections.length !== 1 ? 'es' : ''} registrada{inspections.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <button
                    onClick={openNewModal}
                    className="px-5 py-2.5 bg-[#003DA5] text-white rounded-xl text-sm font-bold hover:bg-[#002d7a] transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Inspección
                </button>
            </div>

            {/* Missing contract dates warning */}
            {(() => {
                const missingDates = administradaProps.filter(p => !p.contract_start_date)
                if (missingDates.length === 0) return null
                return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800">
                                {missingDates.length} propiedad{missingDates.length !== 1 ? 'es' : ''} administrada{missingDates.length !== 1 ? 's' : ''} sin fecha de contrato
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                                Para generar las inspecciones automáticas, ingrese la fecha de inicio del contrato de administración en cada propiedad.
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {missingDates.slice(0, 5).map(p => (
                                    <span key={p.id} className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full truncate max-w-[200px]">
                                        {p.address?.split(',')[0] || 'Sin dirección'}
                                    </span>
                                ))}
                                {missingDates.length > 5 && (
                                    <span className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                                        +{missingDates.length - 5} más
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 p-1 inline-flex gap-1">
                <button
                    onClick={() => { setActiveTab('inspections'); setStatusFilter('') }}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'inspections'
                        ? 'bg-[#003DA5] text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <ClipboardCheck className="w-4 h-4 inline mr-1.5" /> Inspecciones ({inspections.length})
                </button>
                <button
                    onClick={() => { setActiveTab('schedule'); setStatusFilter('') }}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'schedule'
                        ? 'bg-[#003DA5] text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <Calendar className="w-4 h-4 inline mr-1.5" /> Programación ({schedule.length})
                </button>
            </div>

            {/* Sync button for schedule tab */}
            {activeTab === 'schedule' && isAdmin && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar Programación'}
                    </button>
                    <span className="text-xs text-gray-500">
                        Genera inspecciones cada 6 meses desde la fecha de contrato
                    </span>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSchedulePage(20) }}
                        placeholder="Buscar por dirección, propietario, agente..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setSchedulePage(20) }}
                        className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                    >
                        <option value="">Todos los estados</option>
                        {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {isAdmin && activeTab === 'schedule' && (
                    <div className="relative">
                        <select
                            value={agentFilter}
                            onChange={e => { setAgentFilter(e.target.value); setSchedulePage(20) }}
                            className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                        >
                            <option value="">Todos los agentes</option>
                            <option value="__none__">Sin asignar</option>
                            {scheduleAgents.map(a => (
                                <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                )}
            </div>

            {/* Content */}
            {activeTab === 'inspections' ? (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {filteredInspections.length === 0 ? (
                        <div className="text-center py-16">
                            <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No hay inspecciones</p>
                            <p className="text-gray-400 text-sm mt-1">Cree una nueva inspección para comenzar</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Propiedad</th>
                                    <th className="text-left py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Agente</th>
                                    <th className="text-center py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                                    <th className="text-center py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th className="text-center py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInspections.map(insp => (
                                    <tr key={insp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <MapPin className="w-4 h-4 text-[#003DA5]" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900 truncate max-w-[250px]">
                                                        {insp.address || insp.property?.address || 'Sin dirección'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {insp.owner_name && `Prop: ${insp.owner_name}`}
                                                        {insp.tenant_name && ` · Arr: ${insp.tenant_name}`}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <User className="w-3.5 h-3.5 text-gray-500" />
                                                </div>
                                                <span className="text-sm text-gray-700">
                                                    {insp.agent ? `${insp.agent.first_name} ${insp.agent.last_name}` : '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="text-sm text-gray-600">
                                                    {insp.inspection_date ? new Date(insp.inspection_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                            <StatusBadge status={insp.status} />
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                            <button
                                                onClick={() => navigate(`/inspeccion/${insp.id}`)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-[#003DA5] hover:text-white text-gray-700 rounded-lg text-xs font-semibold transition-colors"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                {insp.status === 'draft' ? 'Editar' : 'Ver'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        {filteredSchedule.length === 0 ? (
                            <div className="text-center py-16">
                                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">No hay inspecciones programadas</p>
                                <p className="text-gray-400 text-sm mt-1">La programación automática se generará a partir de los contratos de arriendo</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <th className="text-left py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Propiedad</th>
                                        <th className="text-left py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Agente Asignado</th>
                                        <th className="text-center py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Próxima Inspección</th>
                                        <th className="text-center py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                                        <th className="text-center py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSchedule.map(sched => (
                                        <tr key={sched.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                        <MapPin className="w-4 h-4 text-[#003DA5]" />
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-900 truncate max-w-[250px]">
                                                        {sched.property?.address || 'Sin dirección'}
                                                        {sched.property?.commune ? `, ${sched.property.commune}` : ''}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="py-4 px-5">
                                                {sched.agent ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                                                            <User className="w-3.5 h-3.5 text-gray-500" />
                                                        </div>
                                                        <span className="text-sm text-gray-700">{sched.agent.first_name} {sched.agent.last_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-amber-600 font-medium">⚠️ Sin asignar</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="text-sm text-gray-600">
                                                        {sched.scheduled_date ? new Date(sched.scheduled_date + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                                <StatusBadge status={sched.status} />
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {sched.property?.is_office_property && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-semibold">
                                                            <Building2 className="w-3 h-3" /> Oficina
                                                        </span>
                                                    )}
                                                    {sched.property?.is_office_property && isAdmin && (
                                                        <button
                                                            onClick={() => handleGeneratePublicLink(sched)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                                            title="Generar enlace para inspector externo"
                                                        >
                                                            <Link className="w-3 h-3" /> Enlace
                                                        </button>
                                                    )}
                                                    {sched.property?.is_office_property && isAdmin && (
                                                        <button
                                                            onClick={() => openAssignModal(sched)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                                            title="Derivar inspección a un agente"
                                                        >
                                                            <UserPlus className="w-3 h-3" /> Derivar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-gray-400">
                            Mostrando {Math.min(schedulePage, filteredSchedule.length)} de {filteredSchedule.length}
                        </span>
                        {hasMoreSchedule && (
                            <button
                                onClick={() => setSchedulePage(prev => prev + 20)}
                                className="px-4 py-2 text-sm font-semibold text-[#003DA5] bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                            >
                                Cargar más ({filteredSchedule.length - schedulePage} restantes)
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* New Inspection Modal */}
            {showNewModal && (
                <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNewModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-slate-900">Nueva Inspección</h3>
                            <p className="text-sm text-gray-500 mt-1">Seleccione la propiedad administrada a inspeccionar</p>
                        </div>
                        <div className="p-6">
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Propiedad</label>
                            {administradaProps.length === 0 ? (
                                <div className="text-center py-6">
                                    <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No hay propiedades con estado "Administrada"</p>
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedPropertyId}
                                        onChange={e => setSelectedPropertyId(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    >
                                        <option value="">Seleccionar propiedad...</option>
                                        {administradaProps.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.address?.split(',').slice(0, 2).join(',')}{p.unit_number ? ` - ${p.unit_number}` : ''}
                                                {!p.contract_start_date ? ' ⚠️ Sin fecha contrato' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        Solo se muestran propiedades con estado "Administrada"
                                    </p>
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowNewModal(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (!selectedPropertyId) {
                                        toast.error('Seleccione una propiedad')
                                        return
                                    }
                                    setCreating(true)
                                    try {
                                        const data = await createInspection({
                                            propertyId: selectedPropertyId,
                                            agentId: user?.id,
                                        })
                                        toast.success('Inspección creada')
                                        setShowNewModal(false)
                                        navigate(`/inspeccion/${data.id}`)
                                    } catch (err) {
                                        console.error('Error creating inspection:', err)
                                        toast.error('Error al crear inspección')
                                    } finally {
                                        setCreating(false)
                                    }
                                }}
                                disabled={creating || !selectedPropertyId}
                                className="flex-1 px-4 py-2.5 bg-[#003DA5] text-white rounded-xl text-sm font-bold hover:bg-[#002d7a] transition-colors disabled:opacity-50"
                            >
                                {creating ? 'Creando...' : 'Crear Inspección'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Agent Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAssignModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-emerald-600" /> Derivar Inspección
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {showAssignModal.property?.address || 'Propiedad'}
                                {showAssignModal.scheduled_date && ` — ${new Date(showAssignModal.scheduled_date + 'T12:00:00').toLocaleDateString('es-CL')}`}
                            </p>
                        </div>
                        <div className="p-6">
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Seleccionar Agente</label>
                            <select
                                value={selectedAgentId}
                                onChange={e => setSelectedAgentId(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            >
                                <option value="">Seleccionar agente...</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.first_name} {a.last_name} ({a.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowAssignModal(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAssignAgent}
                                disabled={assigning || !selectedAgentId}
                                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                {assigning ? 'Derivando...' : 'Derivar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
