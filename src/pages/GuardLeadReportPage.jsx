import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Card, CardContent, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, Badge } from '@/components/ui'
import { toast } from 'sonner'
import { Shield, FileText, Clock, CheckCircle2, AlertCircle, Loader2, Send, User, Calendar, MessageSquare, ExternalLink, Filter, Users, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

// Single 24h business-day milestone (reuses report_2d columns)
const REPORT_MILESTONE = { key: '2d', label: '24h', color: 'amber' }

// Calculate next business day after assignment
function getNextBusinessDay(assignedAt) {
    const date = new Date(assignedAt)
    date.setDate(date.getDate() + 1) // +1 day
    const day = date.getDay()
    if (day === 6) date.setDate(date.getDate() + 2) // Sat → Mon
    if (day === 0) date.setDate(date.getDate() + 1) // Sun → Mon
    return date
}

export default function GuardLeadReportPage() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [allLeads, setAllLeads] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingNotes, setEditingNotes] = useState(null)
    const [notesText, setNotesText] = useState('')
    const [saving, setSaving] = useState(false)
    const [agents, setAgents] = useState([])

    // Filters
    const [filterType, setFilterType] = useState('all') // all | guard | non-guard
    const [filterAgent, setFilterAgent] = useState('all')
    const [filterDateFrom, setFilterDateFrom] = useState('')
    const [filterDateTo, setFilterDateTo] = useState('')

    const isAdmin = ['superadministrador', 'comercial', 'legal', 'administracion', 'tecnico'].includes(profile?.role)

    useEffect(() => { fetchLeads() }, [])
    useEffect(() => { if (isAdmin) fetchAgents() }, [isAdmin])

    async function fetchLeads() {
        setLoading(true)
        let query = supabase
            .from('shift_guard_leads')
            .select(`
                *,
                agent:profiles!shift_guard_leads_agent_id_fkey(id, first_name, last_name, email, phone),
                contact:contacts!shift_guard_leads_contact_id_fkey(id, first_name, last_name, phone, email, source, status, need, observations),
                external_lead:external_leads!shift_guard_leads_external_lead_id_fkey(id, raw_data, status, short_id)
            `)
            .order('assigned_at', { ascending: false })

        if (!isAdmin) {
            query = query.eq('agent_id', profile.id)
        }

        const { data, error } = await query
        if (error) { toast.error('Error: ' + error.message) }
        setAllLeads(data || [])
        setLoading(false)
    }

    async function fetchAgents() {
        const { data } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('role', 'agent')
            .order('first_name')
        setAgents(data || [])
    }

    // Apply filters
    const filteredLeads = useMemo(() => {
        return allLeads.filter(lead => {
            // Type filter
            if (filterType === 'guard' && !lead.is_guard) return false
            if (filterType === 'non-guard' && lead.is_guard) return false

            // Agent filter
            if (filterAgent !== 'all' && lead.agent_id !== filterAgent) return false

            // Date range filter
            if (filterDateFrom) {
                const leadDate = new Date(lead.assigned_at).toISOString().split('T')[0]
                if (leadDate < filterDateFrom) return false
            }
            if (filterDateTo) {
                const leadDate = new Date(lead.assigned_at).toISOString().split('T')[0]
                if (leadDate > filterDateTo) return false
            }

            return true
        })
    }, [allLeads, filterType, filterAgent, filterDateFrom, filterDateTo])

    function getReportStatus(lead) {
        if (lead.report_2d_sent) return 'sent'
        const dueDate = getNextBusinessDay(lead.assigned_at)
        if (new Date() >= dueDate) return 'due'
        return 'upcoming'
    }

    function getDueDate(lead) {
        return getNextBusinessDay(lead.assigned_at)
    }

    function openNotesModal(lead, milestone) {
        const existingNotes = lead[`report_${milestone.key}_agent_notes`] || ''
        setNotesText(existingNotes)
        setEditingNotes({ leadId: lead.id, milestone: milestone.key, leadName: getLeadName(lead) })
    }

    function getLeadName(lead) {
        if (lead.contact) return `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim()
        const raw = lead.external_lead?.raw_data
        if (Array.isArray(raw) && raw[0]) return raw[0]?.['Datos Contacto']?.nombre_apellido || 'Lead'
        return 'Lead'
    }

    async function saveNotes() {
        if (!editingNotes) return
        setSaving(true)
        const updateData = {}
        updateData[`report_${editingNotes.milestone}_agent_notes`] = notesText
        const { error } = await supabase.from('shift_guard_leads').update(updateData).eq('id', editingNotes.leadId)
        if (error) { toast.error('Error: ' + error.message) }
        else { toast.success('Notas guardadas correctamente.') }
        setSaving(false)
        setEditingNotes(null)
        fetchLeads()
    }

    const statusBadge = (status) => {
        if (status === 'sent') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Enviado</span>
        if (status === 'due') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><AlertCircle className="w-3 h-3" /> Pendiente</span>
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500"><Clock className="w-3 h-3" /> Próximo</span>
    }

    const hasActiveFilters = filterType !== 'all' || filterAgent !== 'all' || filterDateFrom || filterDateTo

    const clearFilters = () => {
        setFilterType('all')
        setFilterAgent('all')
        setFilterDateFrom('')
        setFilterDateTo('')
    }

    // Stats based on filtered results
    const guardCount = filteredLeads.filter(l => l.is_guard).length
    const nonGuardCount = filteredLeads.filter(l => !l.is_guard).length
    const pendingCount = filteredLeads.filter(l => getReportStatus(l) === 'due').length
    const sentCount = filteredLeads.filter(l => l.report_2d_sent).length

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-500" />
                    Leads Asignados
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                    {isAdmin ? 'Seguimiento de todos los leads derivados a agentes' : 'Tus leads recibidos'}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-center">
                    <div className="text-2xl font-bold text-violet-600">{filteredLeads.length}</div>
                    <div className="text-[10px] text-violet-600 font-semibold uppercase tracking-wider">Total</div>
                </div>
                <div className="px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-center">
                    <div className="text-2xl font-bold text-orange-600">{guardCount}</div>
                    <div className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Guardia</div>
                </div>
                <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
                    <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
                    <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Reporte Pendiente</div>
                </div>
                <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{sentCount}</div>
                    <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Reportes Enviados</div>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Filtros</span>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="ml-auto text-xs text-blue-500 hover:text-blue-700 font-medium">
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Type filter */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Tipo</label>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="guard">🛡 Guardia</SelectItem>
                                    <SelectItem value="non-guard">📨 Derivado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Agent filter (admin only) */}
                        {isAdmin && (
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Agente</label>
                                <Select value={filterAgent} onValueChange={setFilterAgent}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {agents.map(a => (
                                            <SelectItem key={a.id} value={a.id}>
                                                {a.first_name} {a.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Date from */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Desde</label>
                            <Input
                                type="date"
                                value={filterDateFrom}
                                onChange={(e) => setFilterDateFrom(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Date to */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Hasta</label>
                            <Input
                                type="date"
                                value={filterDateTo}
                                onChange={(e) => setFilterDateTo(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Lead Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                </div>
            ) : filteredLeads.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-slate-400">
                        <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>{hasActiveFilters ? 'No hay leads que coincidan con los filtros.' : 'No hay leads asignados registrados.'}</p>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="mt-2 text-sm text-blue-500 hover:text-blue-700 font-medium">
                                Limpiar filtros
                            </button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredLeads.map((lead, i) => {
                        const status = getReportStatus(lead)
                        const dueDate = getDueDate(lead)
                        const hasNotes = !!lead.report_2d_agent_notes
                        const sentAt = lead.report_2d_sent_at
                        return (
                            <motion.div key={lead.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                                <Card className="overflow-hidden">
                                    <CardContent className="p-0">
                                        <div className="flex items-stretch">
                                            {/* Lead Info */}
                                            <div className="flex-1 p-5 border-r border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
                                                        lead.is_guard
                                                            ? "bg-gradient-to-br from-orange-500 to-amber-600"
                                                            : "bg-gradient-to-br from-blue-500 to-indigo-600"
                                                    )}>
                                                        {getLeadName(lead).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-slate-900 dark:text-white">{getLeadName(lead)}</h3>
                                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(lead.assigned_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            {isAdmin && lead.agent && (
                                                                <span className="ml-2 text-violet-600">
                                                                    <User className="w-3 h-3 inline mr-0.5" />
                                                                    {`${lead.agent.first_name || ''} ${lead.agent.last_name || ''}`.trim()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {lead.contact && (
                                                    <div className="text-xs text-slate-500 space-y-0.5">
                                                        {lead.contact.phone && <p>📞 {lead.contact.phone}</p>}
                                                        {lead.contact.email && <p>📧 {lead.contact.email}</p>}
                                                        {lead.contact.status && <p>Estado: <span className="font-medium text-slate-700 dark:text-slate-300">{lead.contact.status}</span></p>}
                                                    </div>
                                                )}
                                                <div className="mt-2 flex items-center gap-2">
                                                    {lead.is_guard ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                                            <Shield className="w-3 h-3" /> Guardia
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                                            <Send className="w-3 h-3" /> Derivado
                                                        </span>
                                                    )}
                                                    {lead.contact?.source && lead.contact.source !== 'Guardia' && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                                            {lead.contact.source}
                                                        </span>
                                                    )}
                                                    {lead.contact_id && (
                                                        <button
                                                            onClick={() => navigate(`/crm/contact/${lead.contact_id}`)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> Ver Perfil
                                                        </button>
                                                    )}
                                                    {isAdmin && lead.external_lead && lead.external_lead.status === 'pending' && (
                                                        <button
                                                            onClick={() => navigate(`/busqueda/${lead.external_lead.short_id || lead.external_lead.id}`)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                                                        >
                                                            <Users className="w-3 h-3" /> Derivar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Single 24h Report Status */}
                                            <div className={cn(
                                                "flex flex-col items-center justify-center px-6 py-4 min-w-[160px]",
                                                status === 'due' && 'bg-red-50/50 dark:bg-red-950/10',
                                                status === 'sent' && 'bg-emerald-50/50 dark:bg-emerald-950/10'
                                            )}>
                                                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Reporte 24h</div>
                                                <div className="mb-1">{statusBadge(status)}</div>
                                                <div className="text-[10px] text-slate-400 mb-2">
                                                    {status === 'sent' && sentAt
                                                        ? new Date(sentAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                                        : dueDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                                    }
                                                </div>
                                                {status !== 'sent' && !isAdmin && (
                                                    <Button
                                                        size="sm"
                                                        variant={hasNotes ? 'outline' : 'default'}
                                                        className={cn("h-6 text-[10px]", hasNotes ? 'border-violet-300 text-violet-600' : 'bg-violet-600 hover:bg-violet-700 text-white')}
                                                        onClick={() => openNotesModal(lead, REPORT_MILESTONE)}
                                                    >
                                                        <MessageSquare className="w-3 h-3 mr-0.5" />
                                                        {hasNotes ? 'Editar Nota' : 'Agregar Nota'}
                                                    </Button>
                                                )}
                                                {hasNotes && (
                                                    <div className="mt-1 text-[10px] text-violet-500 font-medium">✎ Nota agregada</div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Notes Modal */}
            <AlertDialog open={!!editingNotes} onOpenChange={(open) => { if (!open) setEditingNotes(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-violet-500" />
                            Nota para Reporte — {editingNotes?.leadName}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            Esta nota se incluirá en el reporte automático que se enviará a comercial a las 12pm.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-6 pb-2">
                        <textarea
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            placeholder="Escribe tu nota aquí... (ej: El cliente está interesado pero pidió más tiempo para decidir)"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-violet-600 hover:bg-violet-700" onClick={saveNotes} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                            Guardar Nota
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
