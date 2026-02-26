import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Card, CardContent, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui'
import { toast } from 'sonner'
import { Shield, FileText, Clock, CheckCircle2, AlertCircle, Loader2, Send, User, Calendar, MessageSquare, ExternalLink } from 'lucide-react'
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
    const [guardLeads, setGuardLeads] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingNotes, setEditingNotes] = useState(null) // { leadId, milestone }
    const [notesText, setNotesText] = useState('')
    const [saving, setSaving] = useState(false)

    const isAdmin = ['superadministrador', 'comercial', 'legal', 'administracion'].includes(profile?.role)

    useEffect(() => { fetchGuardLeads() }, [])

    async function fetchGuardLeads() {
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
        setGuardLeads(data || [])
        setLoading(false)
    }

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
        fetchGuardLeads()
    }

    const statusBadge = (status) => {
        if (status === 'sent') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Enviado</span>
        if (status === 'due') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><AlertCircle className="w-3 h-3" /> Pendiente</span>
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500"><Clock className="w-3 h-3" /> Próximo</span>
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-6 h-6 text-orange-500" />
                    Leads de Guardia
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                    {isAdmin ? 'Seguimiento de leads derivados durante turnos de guardia' : 'Tus leads recibidos durante turnos de guardia'}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-center">
                    <div className="text-2xl font-bold text-violet-600">{guardLeads.length}</div>
                    <div className="text-[10px] text-violet-600 font-semibold uppercase tracking-wider">Total Leads</div>
                </div>
                <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
                    <div className="text-2xl font-bold text-amber-600">
                        {guardLeads.filter(l => getReportStatus(l) === 'due').length}
                    </div>
                    <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Reportes Pendientes</div>
                </div>
                <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                        {guardLeads.filter(l => l.report_2d_sent).length}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Reportes Enviados</div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                </div>
            ) : guardLeads.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-slate-400">
                        <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No hay leads de guardia registrados.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {guardLeads.map((lead, i) => {
                        const status = getReportStatus(lead)
                        const dueDate = getDueDate(lead)
                        const hasNotes = !!lead.report_2d_agent_notes
                        const sentAt = lead.report_2d_sent_at
                        return (
                            <motion.div key={lead.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                <Card className="overflow-hidden">
                                    <CardContent className="p-0">
                                        <div className="flex items-stretch">
                                            {/* Lead Info */}
                                            <div className="flex-1 p-5 border-r border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
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
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                                        <Shield className="w-3 h-3" /> Guardia
                                                    </span>
                                                    {lead.contact_id && (
                                                        <button
                                                            onClick={() => navigate(`/crm/contact/${lead.contact_id}`)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> Ver Perfil
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
