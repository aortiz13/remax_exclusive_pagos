import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { Button, Card, CardContent, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, Badge } from '@/components/ui'
import { toast } from 'sonner'
import { Shield, FileText, Clock, CheckCircle2, AlertCircle, Loader2, Send, User, Calendar, MessageSquare, ExternalLink, Filter, Users, Search, Phone, Mail, MapPin, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

// Milestones for reports
const MILESTONES = [
    { key: '2d', label: '24h', color: 'amber' },
    { key: '15d', label: '15 días', color: 'blue' },
    { key: '30d', label: '30 días', color: 'indigo' }
]

// Calculate next business day or relative day
function getDueDate(assignedAt, days) {
    const date = new Date(assignedAt)
    if (days === 2) {
        // Business day logic for 24h/48h
        date.setDate(date.getDate() + 1)
        const day = date.getDay()
        if (day === 6) date.setDate(date.getDate() + 2) // Sat → Mon
        if (day === 0) date.setDate(date.getDate() + 1) // Sun → Mon
    } else {
        date.setDate(date.getDate() + days)
    }
    return date
}

export default function LeadList() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [allLeads, setAllLeads] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingNotes, setEditingNotes] = useState(null)
    const [notesText, setNotesText] = useState('')
    const [saving, setSaving] = useState(false)
    const [agents, setAgents] = useState([])
    const [searchTerm, setSearchTerm] = useState('')

    // Derivation modal
    const [derivingLead, setDerivingLead] = useState(null)
    const [selectedDeriveAgent, setSelectedDeriveAgent] = useState('')
    const [deriving, setDeriving] = useState(false)

    // Filters
    const [filterType, setFilterType] = useState('all') // all | guard | non-guard
    const [filterAgent, setFilterAgent] = useState('all')

    const isAdmin = ['superadministrador', 'comercial', 'legal', 'administracion', 'tecnico'].includes(profile?.role)

    useEffect(() => { fetchLeads() }, [])
    useEffect(() => { if (isAdmin) fetchAgents() }, [isAdmin])

    async function fetchLeads() {
        setLoading(true)
        try {
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
        } catch (err) {
            console.error('Error fetching leads:', err)
        } finally {
            setLoading(false)
        }
    }

    async function fetchAgents() {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name')
                .eq('role', 'agent')
                .order('first_name')
            setAgents(data || [])
        } catch (err) {
            console.error('Error fetching agents:', err)
        }
    }

    const filteredLeads = useMemo(() => {
        return allLeads.filter(lead => {
            // Search filter
            const name = getLeadName(lead).toLowerCase()
            if (searchTerm && !name.includes(searchTerm.toLowerCase())) return false

            // Type filter
            if (filterType === 'guard' && !lead.is_guard) return false
            if (filterType === 'non-guard' && lead.is_guard) return false
            if (filterType === 'pending' && lead.external_lead?.status !== 'pending') return false

            // Agent filter
            if (filterAgent !== 'all' && lead.agent_id !== filterAgent) return false

            return true
        })
    }, [allLeads, filterType, filterAgent, searchTerm])

    function getLeadName(lead) {
        if (lead.contact) return `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim()
        const raw = lead.external_lead?.raw_data
        if (Array.isArray(raw) && raw[0]) return raw[0]?.['Datos Contacto']?.nombre_apellido || 'Lead'
        return 'Lead'
    }

    function getMilestoneStatus(lead, key) {
        const isSent = lead[`report_${key}_sent`]
        if (isSent) return 'sent'
        
        const days = key === '2d' ? 2 : parseInt(key)
        const dueDate = getDueDate(lead.assigned_at, days)
        if (new Date() >= dueDate) return 'due'
        return 'upcoming'
    }

    function openNotesModal(lead, milestone) {
        setNotesText(lead[`report_${milestone.key}_agent_notes`] || '')
        setEditingNotes({ leadId: lead.id, milestone: milestone.key, leadName: getLeadName(lead) })
    }

    async function saveNotes() {
        if (!editingNotes) return
        setSaving(true)
        try {
            const updateData = {}
            updateData[`report_${editingNotes.milestone}_agent_notes`] = notesText
            // Mark milestone as sent when agent saves a note
            updateData[`report_${editingNotes.milestone}_sent`] = true
            updateData[`report_${editingNotes.milestone}_sent_at`] = new Date().toISOString()
            const { error } = await supabase.from('shift_guard_leads').update(updateData).eq('id', editingNotes.leadId)
            if (error) throw error
            toast.success('Notas guardadas correctamente.')
            fetchLeads()
            setEditingNotes(null)
        } catch (err) {
            toast.error('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const statusBadge = (status) => {
        if (status === 'sent') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Enviado</span>
        if (status === 'due') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"><AlertCircle className="w-3 h-3" /> Pendiente</span>
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><Clock className="w-3 h-3" /> Próximo</span>
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-end bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex-1 space-y-1 w-full">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Buscar Lead</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Nombre del lead..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500/20"
                        />
                    </div>
                </div>

                <div className="w-full md:w-48 space-y-1">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</label>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="guard">🛡 Guardia</SelectItem>
                            <SelectItem value="non-guard">📨 Derivado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isAdmin && (
                    <div className="w-full md:w-64 space-y-1">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Agente</label>
                        <Select value={filterAgent} onValueChange={setFilterAgent}>
                            <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los agentes</SelectItem>
                                {agents.map(a => (
                                    <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                    <p className="text-sm font-medium">Cargando listado de leads...</p>
                </div>
            ) : filteredLeads.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No se encontraron leads</h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">
                        {searchTerm || filterType !== 'all' || filterAgent !== 'all' 
                            ? 'Intenta ajustar los filtros para encontrar lo que buscas.'
                            : 'Aún no tienes leads asignados en el sistema.'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filteredLeads.map((lead, i) => (
                        <motion.div 
                            key={lead.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className="hover:border-blue-300 dark:hover:border-blue-900 transition-all group overflow-hidden border-slate-200 dark:border-slate-800">
                                <CardContent className="p-0">
                                    <div className="flex flex-col md:flex-row items-stretch">
                                        {/* Lead Info Section */}
                                        <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm bg-gradient-to-br",
                                                        lead.is_guard 
                                                            ? "from-orange-400 to-amber-600" 
                                                            : "from-blue-400 to-indigo-600"
                                                    )}>
                                                        {getLeadName(lead).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-blue-600 transition-colors">
                                                            {getLeadName(lead)}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(lead.assigned_at).toLocaleDateString('es-CL')}
                                                            </span>
                                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                            {lead.is_guard ? (
                                                                <Badge variant="outline" className="h-4 text-[9px] border-orange-200 text-orange-600 bg-orange-50 uppercase tracking-tighter px-1.5">Guardia</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="h-4 text-[9px] border-blue-200 text-blue-600 bg-blue-50 uppercase tracking-tighter px-1.5">Derivado</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-2 mt-2">
                                                {lead.contact?.phone && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                        {lead.contact.phone}
                                                    </div>
                                                )}
                                                {lead.contact?.email && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 overflow-hidden">
                                                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <span className="truncate">{lead.contact.email}</span>
                                                    </div>
                                                )}
                                                {lead.contact?.source && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                                        {lead.contact.source}
                                                    </div>
                                                )}
                                                {isAdmin && lead.agent && (
                                                    <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                                        <User className="w-3.5 h-3.5" />
                                                        {lead.agent.first_name} {lead.agent.last_name}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-4 flex items-center gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 text-[10px] gap-1.5 hover:bg-blue-50 text-blue-600 px-2"
                                                    onClick={() => navigate(`/crm/contact/${lead.contact_id}`)}
                                                >
                                                    <User className="w-3 h-3" /> Ver Contacto
                                                </Button>
                                                {lead.external_lead && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-7 text-[10px] gap-1.5 hover:bg-slate-100 text-slate-600 px-2"
                                                        onClick={() => navigate(`/nuevolead/${lead.external_lead.short_id || lead.external_lead.id}`)}
                                                    >
                                                        <FileText className="w-3 h-3" /> Ver Lead
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Reports Section */}
                                        <div className="md:w-[480px] p-5 flex items-center justify-between gap-4">
                                            {MILESTONES.map(milestone => {
                                                const status = getMilestoneStatus(lead, milestone.key)
                                                const hasNotes = !!lead[`report_${milestone.key}_agent_notes`]
                                                const days = milestone.key === '2d' ? 2 : parseInt(milestone.key)
                                                const dueDate = getDueDate(lead.assigned_at, days)

                                                return (
                                                    <div key={milestone.key} className="flex-1 flex flex-col items-center text-center">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">{milestone.label}</span>
                                                        <div className="mb-2">
                                                            {statusBadge(status)}
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 mb-2">
                                                            {status === 'sent' && lead[`report_${milestone.key}_sent_at`]
                                                                ? new Date(lead[`report_${milestone.key}_sent_at`]).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                                                : dueDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                                            }
                                                        </span>
                                                        
                                                        {!isAdmin && (
                                                            <button 
                                                                onClick={() => openNotesModal(lead, milestone)}
                                                                className={cn(
                                                                    "p-1.5 rounded-lg transition-all",
                                                                    hasNotes 
                                                                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40" 
                                                                        : "bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:bg-slate-800"
                                                                )}
                                                                title={hasNotes ? "Editar nota" : "Añadir nota"}
                                                            >
                                                                <MessageSquare className={cn("w-3.5 h-3.5", hasNotes && "fill-current")} />
                                                            </button>
                                                        )}
                                                        {isAdmin && hasNotes && (
                                                            <Badge variant="outline" className="text-[9px] text-slate-400 ring-0 bg-transparent py-0 h-4" title="Tiene notas">✎</Badge>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Notes Modal */}
            <AlertDialog open={!!editingNotes} onOpenChange={(open) => { if (!open) setEditingNotes(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-500" />
                            Nota para Reporte {editingNotes?.milestone} — {editingNotes?.leadName}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta nota se incluirá en el reporte periódico que se envía automáticamente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-6 pb-2">
                        <textarea
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            placeholder="Escribe el avance con este lead..."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-blue-600 hover:bg-blue-700" onClick={saveNotes} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                            Guardar Nota
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
