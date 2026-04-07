import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Card, CardContent, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'
import { toast } from 'sonner'
import { AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Camera, ChevronLeft, ChevronRight, Clock, CalendarDays,
    CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw,
    Filter, Zap, AlertTriangle, Wrench, Package, RotateCcw,
    UserCheck, MapPin, Eye, X, ChevronDown, Ban, ArrowRightLeft
} from 'lucide-react'
import { format, addDays, startOfWeek, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { sendCameraNotification, CAMERA_EVENTS } from '../services/cameraNotifications'
import { createCameraCalendarEvents, updateCameraCalendarEvents, deleteCameraCalendarEvents, completeCameraCalendarEvents } from '../services/cameraCalendarSync'

const STATUS_CONFIG = {
    pendiente: { color: 'bg-amber-100 text-amber-700 border-amber-300', bgCell: 'bg-amber-50', dot: 'bg-amber-500', label: 'Pendiente', icon: AlertCircle },
    aprobada: { color: 'bg-emerald-100 text-emerald-700 border-emerald-300', bgCell: 'bg-emerald-50', dot: 'bg-emerald-500', label: 'Aprobada', icon: CheckCircle2 },
    rechazada: { color: 'bg-red-100 text-red-700 border-red-300', bgCell: 'bg-red-50', dot: 'bg-red-500', label: 'Rechazada', icon: XCircle },
    completada: { color: 'bg-blue-100 text-blue-700 border-blue-300', bgCell: 'bg-blue-50', dot: 'bg-blue-500', label: 'Completada', icon: CheckCircle2 },
    cancelada: { color: 'bg-slate-100 text-slate-500 border-slate-300', bgCell: 'bg-slate-50', dot: 'bg-slate-400', label: 'Cancelada', icon: XCircle },
    lista_espera: { color: 'bg-purple-100 text-purple-700 border-purple-300', bgCell: 'bg-purple-50', dot: 'bg-purple-500', label: 'Lista de Espera', icon: Clock },
}

const TABS = ['calendario', 'lista', 'mantenimiento']

export default function AdminCameraSchedule() {
    const { user, profile } = useAuth()
    const [bookings, setBookings] = useState([])
    const [agents, setAgents] = useState({})
    const [cameraUnits, setCameraUnits] = useState([])
    const [loading, setLoading] = useState(true)
    const [weekOffset, setWeekOffset] = useState(0)
    const [statusFilter, setStatusFilter] = useState('all')
    const [activeTab, setActiveTab] = useState('calendario')

    // Action modals
    const [actionModal, setActionModal] = useState(null) // { booking, action: 'approve'|'reject'|'reschedule'|'cancel'|'transfer'|'detail' }
    const [transferData, setTransferData] = useState({ agent_id: '', booking_date: '', return_date: '', start_time: '', end_time: '', camera_unit: '' })
    const [adminNotes, setAdminNotes] = useState('')
    const [rescheduleData, setRescheduleData] = useState({})
    const [handoffData, setHandoffData] = useState({ agent_id: '', location: '' })
    const [maintenanceNotes, setMaintenanceNotes] = useState('')
    const [unitActiveBookings, setUnitActiveBookings] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [staleBookings, setStaleBookings] = useState([])

    // Late cancellation stats
    const [lateCancelStats, setLateCancelStats] = useState({})

    const weekStart = useMemo(() => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7), [weekOffset])
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

    useEffect(() => { fetchAll() }, [weekOffset])

    const fetchAll = async () => {
        setLoading(true)
        await Promise.all([fetchBookings(), fetchAgents(), fetchCameraUnits(), fetchLateCancelStats(), fetchStaleBookings()])
        setLoading(false)
    }

    const fetchBookings = async () => {
        const from = format(weekDays[0], 'yyyy-MM-dd')
        const to = format(weekDays[6], 'yyyy-MM-dd')
        const { data } = await supabase.from('camera_bookings').select('*')
            .gte('booking_date', from).lte('booking_date', to)
            .order('booking_date').order('start_time')
        setBookings(data || [])
    }

    const fetchAgents = async () => {
        const { data } = await supabase.from('profiles').select('id, first_name, last_name, email, phone')
        const map = {}
            ; (data || []).forEach(p => {
                map[p.id] = { name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), email: p.email, phone: p.phone }
            })
        setAgents(map)
    }

    const fetchCameraUnits = async () => {
        const { data: units } = await supabase.from('camera_units').select('*')
        setCameraUnits(units || [])

        // Fetch active booking details for units that are 'en_uso'
        const inUseBookingIds = (units || []).filter(u => u.status === 'en_uso' && u.current_booking_id).map(u => u.current_booking_id)
        if (inUseBookingIds.length > 0) {
            const { data: activeBookings } = await supabase.from('camera_bookings')
                .select('*')
                .in('id', inUseBookingIds)
            const map = {}
            ; (activeBookings || []).forEach(b => { map[b.id] = b })
            setUnitActiveBookings(map)
        }
    }

    const fetchLateCancelStats = async () => {
        const { data } = await supabase.from('camera_bookings').select('agent_id')
            .eq('is_late_cancellation', true)
        const stats = {}
            ; (data || []).forEach(b => { stats[b.agent_id] = (stats[b.agent_id] || 0) + 1 })
        setLateCancelStats(stats)
    }

    const fetchStaleBookings = async () => {
        const today = format(new Date(), 'yyyy-MM-dd')
        const { data } = await supabase.from('camera_bookings')
            .select('*')
            .eq('status', 'aprobada')
            .lt('return_date', today)
            .order('booking_date', { ascending: false })
        setStaleBookings(data || [])
    }

    const getBookingsForDayCamera = (date, camera) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        return bookings.filter(b => {
            const bReturn = b.return_date || b.booking_date
            return b.camera_unit === camera && b.booking_date <= dateStr && bReturn >= dateStr && b.status !== 'cancelada' && b.status !== 'rechazada'
        })
    }

    const filteredBookings = bookings.filter(b => statusFilter === 'all' || b.status === statusFilter)

    // === ADMIN ACTIONS ===

    const handleApprove = async (booking) => {
        setSubmitting(true)
        try {
            const { error } = await supabase.from('camera_bookings')
                .update({ status: 'aprobada', admin_notes: adminNotes || null, approver_id: user.id, updated_at: new Date().toISOString() })
                .eq('id', booking.id)
            if (error) throw error

            // Create CRM tasks for agent + comercial and sync to Google Calendar
            createCameraCalendarEvents(booking, booking.agent_id, user.id, adminNotes)

            const agent = agents[booking.agent_id] || {}
            sendCameraNotification(CAMERA_EVENTS.BOOKING_APPROVED, { ...booking, status: 'aprobada' }, agent, adminNotes)
            toast.success('✅ Reserva aprobada — evento creado en calendarios')
            setActionModal(null)
            setAdminNotes('')
            fetchAll()
        } catch (err) { console.error(err); toast.error('Error al aprobar') }
        finally { setSubmitting(false) }
    }

    const handleReject = async (booking) => {
        if (!adminNotes.trim()) { toast.error('Agrega un motivo de rechazo'); return }
        setSubmitting(true)
        try {
            const { error } = await supabase.from('camera_bookings')
                .update({ status: 'rechazada', admin_notes: adminNotes, approver_id: user.id, updated_at: new Date().toISOString() })
                .eq('id', booking.id)
            if (error) throw error

            // If it was previously approved, remove calendar events
            if (booking.crm_task_id_agent || booking.crm_task_id_comercial) {
                deleteCameraCalendarEvents(booking, booking.agent_id, user.id)
            }

            const agent = agents[booking.agent_id] || {}
            sendCameraNotification(CAMERA_EVENTS.BOOKING_REJECTED, { ...booking, status: 'rechazada' }, agent, adminNotes)
            toast.success('Reserva rechazada')
            setActionModal(null)
            setAdminNotes('')
            fetchAll()
        } catch (err) { console.error(err); toast.error('Error al rechazar') }
        finally { setSubmitting(false) }
    }

    const handleReschedule = async (booking) => {
        if (!rescheduleData.booking_date || !rescheduleData.start_time || !rescheduleData.end_time) {
            toast.error('Completa todos los campos de reprogramación'); return
        }
        setSubmitting(true)
        try {
            const note = `Reprogramado: ${booking.booking_date} ${booking.start_time?.slice(0, 5)}-${booking.end_time?.slice(0, 5)} → ${rescheduleData.booking_date} ${rescheduleData.start_time}-${rescheduleData.end_time}. ${adminNotes || ''}`
            const { error } = await supabase.from('camera_bookings')
                .update({
                    booking_date: rescheduleData.booking_date,
                    return_date: rescheduleData.return_date || rescheduleData.booking_date,
                    start_time: rescheduleData.start_time,
                    end_time: rescheduleData.end_time,
                    camera_unit: rescheduleData.camera_unit || booking.camera_unit,
                    admin_notes: note,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', booking.id)
            if (error) throw error

            // Update calendar events if they exist
            if (booking.crm_task_id_agent || booking.crm_task_id_comercial) {
                updateCameraCalendarEvents(booking, booking.agent_id, user.id, rescheduleData, note)
            }

            const agent = agents[booking.agent_id] || {}
            sendCameraNotification(CAMERA_EVENTS.BOOKING_RESCHEDULED, { ...booking, ...rescheduleData, status: booking.status }, agent, note)
            toast.success('✅ Reserva reprogramada — calendarios actualizados')
            setActionModal(null)
            setAdminNotes('')
            setRescheduleData({})
            fetchAll()
        } catch (err) { console.error(err); toast.error('Error al reprogramar') }
        finally { setSubmitting(false) }
    }

    const handleAdminCancel = async (booking) => {
        if (!adminNotes.trim()) { toast.error('Agrega un motivo de anulación'); return }
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase.from('camera_bookings')
                .update({
                    status: 'cancelada',
                    admin_notes: `Anulado por admin: ${adminNotes}`,
                    cancelled_at: now,
                    approver_id: user.id,
                    updated_at: now,
                })
                .eq('id', booking.id)
            if (error) throw error

            // If camera was in use, free it
            if (booking.pickup_confirmed_at && !booking.return_confirmed_at) {
                await supabase.from('camera_units')
                    .update({ status: 'disponible', current_booking_id: null, updated_at: now })
                    .eq('id', booking.camera_unit)
            }

            // Remove calendar events
            if (booking.crm_task_id_agent || booking.crm_task_id_comercial) {
                deleteCameraCalendarEvents(booking, booking.agent_id, user.id)
            }

            const agent = agents[booking.agent_id] || {}
            sendCameraNotification(CAMERA_EVENTS.BOOKING_CANCELLED_BY_ADMIN, { ...booking, status: 'cancelada' }, agent, adminNotes)

            // Auto-promote waitlist if exists
            const { data: waitlistEntries } = await supabase.from('camera_bookings')
                .select('*')
                .eq('waitlist_for', booking.id)
                .eq('status', 'lista_espera')
                .order('created_at')
                .limit(1)
            if (waitlistEntries?.length > 0) {
                const wl = waitlistEntries[0]
                await supabase.from('camera_bookings')
                    .update({ status: 'pendiente', waitlist_for: null, admin_notes: 'Promovido automáticamente desde lista de espera', updated_at: now })
                    .eq('id', wl.id)
                const wlAgent = agents[wl.agent_id] || {}
                sendCameraNotification(CAMERA_EVENTS.WAITLIST_AVAILABLE, wl, wlAgent, 'Tu pre-reserva fue promovida porque el horario se liberó.')
                toast.success('📋 Reserva en lista de espera promovida automáticamente')
            }

            toast.success('🚫 Reserva anulada por administración')
            setActionModal(null)
            setAdminNotes('')
            fetchAll()
        } catch (err) { console.error(err); toast.error('Error al anular la reserva') }
        finally { setSubmitting(false) }
    }

    const handleTransferBooking = async (booking) => {
        if (!transferData.agent_id) { toast.error('Selecciona el agente destino'); return }
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const originalAgent = agents[booking.agent_id] || {}
            const newAgent = agents[transferData.agent_id] || {}
            const transferNote = `Transferido de ${originalAgent.name || 'agente'} a ${newAgent.name || 'agente'}. ${adminNotes || ''}`

            const updatePayload = {
                agent_id: transferData.agent_id,
                admin_notes: transferNote,
                updated_at: now,
            }
            // Optional: change date/time/camera if provided
            if (transferData.booking_date) updatePayload.booking_date = transferData.booking_date
            if (transferData.return_date) updatePayload.return_date = transferData.return_date
            if (transferData.start_time) updatePayload.start_time = transferData.start_time
            if (transferData.end_time) updatePayload.end_time = transferData.end_time
            if (transferData.camera_unit) updatePayload.camera_unit = Number(transferData.camera_unit)

            const { error } = await supabase.from('camera_bookings')
                .update(updatePayload)
                .eq('id', booking.id)
            if (error) throw error

            // Remove old calendar events
            if (booking.crm_task_id_agent || booking.crm_task_id_comercial) {
                await deleteCameraCalendarEvents(booking, booking.agent_id, user.id)
            }

            // Create new calendar events for the new agent (only if approved)
            if (booking.status === 'aprobada') {
                const mergedBooking = { ...booking, ...updatePayload }
                createCameraCalendarEvents(mergedBooking, transferData.agent_id, user.id, transferNote)
            }

            // Notify both agents
            sendCameraNotification(CAMERA_EVENTS.BOOKING_TRANSFERRED, { ...booking, status: booking.status }, originalAgent, transferNote, { transfer_to: newAgent.name })
            sendCameraNotification(CAMERA_EVENTS.BOOKING_TRANSFERRED, { ...booking, ...updatePayload, status: booking.status }, newAgent, transferNote, { transfer_from: originalAgent.name })

            toast.success(`✅ Reserva transferida a ${newAgent.name || 'nuevo agente'}`)
            setActionModal(null)
            setAdminNotes('')
            setTransferData({ agent_id: '', booking_date: '', return_date: '', start_time: '', end_time: '', camera_unit: '' })
            fetchAll()
        } catch (err) { console.error(err); toast.error('Error al transferir la reserva') }
        finally { setSubmitting(false) }
    }

    const handleComplete = async (booking) => {
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase.from('camera_bookings')
                .update({ status: 'completada', return_confirmed_at: now, updated_at: now })
                .eq('id', booking.id)
            if (error) throw error

            await supabase.from('camera_units')
                .update({ status: 'disponible', current_booking_id: null, updated_at: now })
                .eq('id', booking.camera_unit)

            // Mark calendar events as completed
            if (booking.crm_task_id_agent || booking.crm_task_id_comercial) {
                completeCameraCalendarEvents(booking, booking.agent_id, user.id)
            }

            const agent = agents[booking.agent_id] || {}
            sendCameraNotification(CAMERA_EVENTS.RETURN_CONFIRMED, { ...booking, status: 'completada' }, agent)
            toast.success('✅ Completada — calendarios actualizados')
            setActionModal(null)
            fetchAll()
        } catch (err) { console.error(err); toast.error('Error al completar') }
        finally { setSubmitting(false) }
    }

    const handleBulkCleanStale = async () => {
        if (!window.confirm(`¿Marcar ${staleBookings.length} reserva(s) vencida(s) como completadas? Esto liberará las cámaras y permitirá nuevas solicitudes.`)) return
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const ids = staleBookings.map(b => b.id)
            const { error } = await supabase.from('camera_bookings')
                .update({ status: 'completada', return_confirmed_at: now, admin_notes: 'Limpieza automática — reserva vencida sin devolución registrada', updated_at: now })
                .in('id', ids)
            if (error) throw error

            // Free any cameras that might be stuck
            const cameraIds = [...new Set(staleBookings.map(b => b.camera_unit))]
            for (const camId of cameraIds) {
                await supabase.from('camera_units')
                    .update({ status: 'disponible', current_booking_id: null, updated_at: now })
                    .eq('id', camId)
                    .eq('status', 'en_uso')
            }

            toast.success(`✅ ${ids.length} reserva(s) vencida(s) limpiadas`)
            fetchAll()
        } catch (err) { console.error(err); toast.error('Error al limpiar reservas') }
        finally { setSubmitting(false) }
    }

    const handleSetHandoff = async (booking) => {
        if (!handoffData.agent_id) { toast.error('Selecciona un agente de traspaso'); return }
        setSubmitting(true)
        try {
            const { error } = await supabase.from('camera_bookings')
                .update({ handoff_agent_id: handoffData.agent_id, handoff_location: handoffData.location, updated_at: new Date().toISOString() })
                .eq('id', booking.id)
            if (error) throw error
            toast.success('✅ Traspaso configurado')
            setHandoffData({ agent_id: '', location: '' })
            fetchAll()
        } catch (err) { console.error(err); toast.error('Error') }
        finally { setSubmitting(false) }
    }

    const toggleMaintenance = async (unitId) => {
        const unit = cameraUnits.find(u => u.id === unitId)
        if (!unit) return
        const newStatus = unit.status === 'mantenimiento' ? 'disponible' : 'mantenimiento'
        try {
            const { error } = await supabase.from('camera_units')
                .update({ status: newStatus, maintenance_notes: newStatus === 'mantenimiento' ? maintenanceNotes : null, updated_at: new Date().toISOString() })
                .eq('id', unitId)
            if (error) throw error
            toast.success(newStatus === 'mantenimiento' ? '🔧 Cámara en mantenimiento' : '✅ Cámara disponible')
            setMaintenanceNotes('')
            fetchCameraUnits()
        } catch (err) { console.error(err); toast.error('Error') }
    }

    const handleForceRelease = async (unitId) => {
        if (!window.confirm('¿Estás seguro de liberar esta cámara manualmente? Esto reseteará su estado a Disponible sin completar ninguna reserva.')) return
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase.from('camera_units')
                .update({ status: 'disponible', current_booking_id: null, updated_at: now })
                .eq('id', unitId)
            if (error) throw error
            toast.success('✅ Cámara liberada forzosamente')
            fetchCameraUnits()
        } catch (err) { console.error(err); toast.error('Error al liberar') }
        finally { setSubmitting(false) }
    }

    // Check overdue returns
    const isOverdue = (b) => {
        if (b.status !== 'aprobada' || b.return_confirmed_at) return false
        const now = new Date()
        const returnDate = b.return_date || b.booking_date
        const endDT = new Date(`${returnDate}T${b.end_time}`)
        return now > endDT && b.pickup_confirmed_at
    }

    // === RENDER HELPERS ===

    function renderBookingChip(b) {
        const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pendiente
        const agent = agents[b.agent_id]
        const overdue = isOverdue(b)
        return (
            <div key={b.id}
                className={cn(
                    "p-1.5 rounded-lg border text-[9px] leading-tight cursor-pointer hover:shadow-md transition-all",
                    overdue ? "bg-red-100 border-red-400 ring-2 ring-red-400/30 animate-pulse" : cfg.color
                )}
                onClick={() => setActionModal({ booking: b, action: 'detail' })}
                title={`${agent?.name || 'Agente'} · ${b.start_time?.slice(0, 5)}-${b.end_time?.slice(0, 5)} · ${b.property_address}`}
            >
                <div className="font-bold flex items-center gap-0.5">
                    {b.is_urgent && <Zap className="w-2.5 h-2.5 text-red-600" />}
                    {overdue && <AlertTriangle className="w-2.5 h-2.5 text-red-600" />}
                    {b.start_time?.slice(0, 5)}-{b.end_time?.slice(0, 5)}
                </div>
                <div className="truncate opacity-80">{agent?.name || 'Agente'}</div>
                {b.pickup_confirmed_at && !b.return_confirmed_at && <div className="text-emerald-600 font-bold">🔑 En uso</div>}
                {b.return_confirmed_at && <div className="text-blue-600 font-bold">✅ Devuelta</div>}
            </div>
        )
    }

    function renderStatusBadge(status) {
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente
        const Icon = cfg.icon
        return (
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", cfg.color)}>
                <Icon className="w-3 h-3" /> {cfg.label}
            </span>
        )
    }

    // Role gate
    if (!profile || !['superadministrador', 'comercial', 'tecnico'].includes(profile.role)) {
        return <div className="p-8 text-center text-slate-500">No tienes acceso a esta página.</div>
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
                        <Camera className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda Cámara 360°</h1>
                        <p className="text-sm text-slate-500">Gestión de reservas y estado de cámaras</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Camera unit status indicators */}
                    {cameraUnits.map(u => (
                        <div key={u.id} className={cn("px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5",
                            u.status === 'disponible' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                u.status === 'en_uso' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    'bg-amber-100 text-amber-700 border-amber-200'
                        )}>
                            <div className={cn("w-2 h-2 rounded-full",
                                u.status === 'disponible' ? 'bg-emerald-500' :
                                    u.status === 'en_uso' ? 'bg-blue-500' : 'bg-amber-500'
                            )} />
                            Cám {u.id}: {u.status === 'disponible' ? 'Libre' : u.status === 'en_uso' ? 'En uso' : 'Mant.'}
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-1" /> Actualizar</Button>
                </div>
            </div>

            {/* Overdue Alert Banner */}
            {bookings.some(isOverdue) && (
                <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3 animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">⚠️ Hay devoluciones pendientes vencidas</p>
                        {bookings.filter(isOverdue).map(b => (
                            <p key={b.id} className="text-xs text-red-600 mt-1">
                                Cámara {b.camera_unit} — {agents[b.agent_id]?.name || 'Agente'} — debió devolver el {format(parseISO(b.return_date || b.booking_date), "d MMM", { locale: es })} a las {b.end_time?.slice(0, 5)}
                                <button onClick={() => setActionModal({ booking: b, action: 'detail' })} className="ml-2 underline font-bold">Ver</button>
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                {TABS.map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={cn("flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all capitalize",
                            activeTab === tab ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                        )}>
                        {tab === 'calendario' && <CalendarDays className="w-4 h-4 inline mr-1.5" />}
                        {tab === 'lista' && <Filter className="w-4 h-4 inline mr-1.5" />}
                        {tab === 'mantenimiento' && <Wrench className="w-4 h-4 inline mr-1.5" />}
                        {tab}
                    </button>
                ))}
            </div>

            {/* === TAB: CALENDARIO === */}
            {activeTab === 'calendario' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <button onClick={() => setWeekOffset(p => p - 1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-5 h-5" /></button>
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-700">{format(weekDays[0], "d MMM", { locale: es })} — {format(weekDays[6], "d MMM yyyy", { locale: es })}</p>
                            {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-600 hover:underline">Hoy</button>}
                        </div>
                        <button onClick={() => setWeekOffset(p => p + 1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="w-5 h-5" /></button>
                    </div>

                    {[1, 2].map(camera => {
                        const unit = cameraUnits.find(u => u.id === camera)
                        return (
                            <div key={camera}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Camera className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-bold text-slate-700">Cámara {camera}</span>
                                    {unit?.status === 'mantenimiento' && (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">🔧 Mantenimiento</span>
                                    )}
                                    {unit?.status === 'en_uso' && (
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">📸 En uso</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {weekDays.map(day => {
                                        const dayBookings = getBookingsForDayCamera(day, camera)
                                        return (
                                            <div key={format(day, 'yyyy-MM-dd')}
                                                className={cn("min-h-[90px] p-2 rounded-xl border transition-all",
                                                    isToday(day) ? "border-blue-300 bg-blue-50/30" : "border-slate-100 bg-white dark:bg-slate-900")}>
                                                <div className="text-center mb-1">
                                                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">{format(day, 'EEE', { locale: es })}</span>
                                                    <span className={cn("block text-sm font-bold", isToday(day) ? "text-blue-600" : "text-slate-700")}>{format(day, 'd')}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {dayBookings.map(renderBookingChip)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* === TAB: LISTA === */}
            {activeTab === 'lista' && (
                <div className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                        {['all', 'pendiente', 'aprobada', 'completada', 'rechazada', 'cancelada'].map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)}
                                className={cn("px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                                    statusFilter === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                                )}>
                                {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label}
                                {s !== 'all' && ` (${bookings.filter(b => b.status === s).length})`}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">Sin reservas para esta semana</div>
                    ) : (
                        <div className="space-y-2">
                            {filteredBookings.map(b => {
                                const agent = agents[b.agent_id]
                                const overdue = isOverdue(b)
                                const lateCancels = lateCancelStats[b.agent_id] || 0
                                return (
                                    <div key={b.id} className={cn(
                                        "flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer",
                                        overdue ? "bg-red-50 border-red-300 ring-2 ring-red-300/30" : "bg-white dark:bg-slate-900 border-slate-100"
                                    )} onClick={() => setActionModal({ booking: b, action: 'detail' })}>
                                        <div className={cn("w-1.5 h-12 rounded-full", STATUS_CONFIG[b.status]?.dot || 'bg-slate-400')} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-slate-900">{agent?.name || 'Agente'}</span>
                                                {b.is_urgent && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">🚨 URGENTE</span>}
                                                {overdue && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold animate-pulse">⚠️ VENCIDA</span>}
                                                {lateCancels > 0 && <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold" title="Cancelaciones tardías">⚡ {lateCancels} late</span>}
                                                {b.pickup_confirmed_at && !b.return_confirmed_at && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-bold">🔑 En uso</span>}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                📷 Cámara {b.camera_unit} · {format(parseISO(b.booking_date), "EEE d MMM", { locale: es })}{b.return_date && b.return_date !== b.booking_date ? ` → ${format(parseISO(b.return_date), "EEE d MMM", { locale: es })}` : ''} · {b.start_time?.slice(0, 5)}—{b.end_time?.slice(0, 5)}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate mt-0.5">📍 {b.property_address}</p>
                                        </div>
                                        {renderStatusBadge(b.status)}

                                        {/* Quick actions */}
                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            {b.status === 'pendiente' && (
                                                <>
                                                    <button onClick={() => { setActionModal({ booking: b, action: 'approve' }); setAdminNotes('') }}
                                                        className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors" title="Aprobar">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => { setActionModal({ booking: b, action: 'reject' }); setAdminNotes('') }}
                                                        className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors" title="Rechazar">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {b.status === 'aprobada' && b.pickup_confirmed_at && !b.return_confirmed_at && (
                                                <button onClick={() => handleComplete(b)}
                                                    className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors" title="Marcar completada">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            {(b.status === 'pendiente' || b.status === 'aprobada') && (
                                                <button onClick={() => { setActionModal({ booking: b, action: 'reschedule' }); setRescheduleData({ booking_date: b.booking_date, return_date: b.return_date || b.booking_date, start_time: b.start_time?.slice(0, 5), end_time: b.end_time?.slice(0, 5), camera_unit: b.camera_unit }) }}
                                                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors" title="Reagendar">
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            )}
                                            {(b.status === 'pendiente' || b.status === 'aprobada') && (
                                                <button onClick={() => { setActionModal({ booking: b, action: 'transfer' }); setTransferData({ agent_id: '', booking_date: b.booking_date, return_date: b.return_date || b.booking_date, start_time: b.start_time?.slice(0, 5), end_time: b.end_time?.slice(0, 5), camera_unit: String(b.camera_unit) }); setAdminNotes('') }}
                                                    className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors" title="Transferir">
                                                    <ArrowRightLeft className="w-4 h-4" />
                                                </button>
                                            )}
                                            {(b.status === 'pendiente' || b.status === 'aprobada') && (
                                                <button onClick={() => { setActionModal({ booking: b, action: 'cancel' }); setAdminNotes('') }}
                                                    className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors" title="Anular">
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* === TAB: MANTENIMIENTO === */}
            {activeTab === 'mantenimiento' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2].map(unitId => {
                        const unit = cameraUnits.find(u => u.id === unitId) || { id: unitId, status: 'disponible' }
                        return (
                            <Card key={unitId} className={cn("border-2",
                                unit.status === 'mantenimiento' ? "border-amber-300 bg-amber-50/30" :
                                    unit.status === 'en_uso' ? "border-blue-300 bg-blue-50/30" : "border-emerald-300 bg-emerald-50/30"
                            )}>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-3 rounded-xl",
                                                unit.status === 'mantenimiento' ? "bg-amber-100" :
                                                    unit.status === 'en_uso' ? "bg-blue-100" : "bg-emerald-100"
                                            )}>
                                                <Camera className={cn("w-6 h-6",
                                                    unit.status === 'mantenimiento' ? "text-amber-600" :
                                                        unit.status === 'en_uso' ? "text-blue-600" : "text-emerald-600"
                                                )} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">Cámara {unitId}</h3>
                                                <p className={cn("text-sm font-bold capitalize",
                                                    unit.status === 'mantenimiento' ? "text-amber-600" :
                                                        unit.status === 'en_uso' ? "text-blue-600" : "text-emerald-600"
                                                )}>{unit.status === 'disponible' ? '✅ Disponible' : unit.status === 'en_uso' ? '📸 En uso' : '🔧 En mantenimiento'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {unit.status === 'en_uso' && (
                                        <div className="space-y-3">
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-xs font-bold text-blue-700">Reserva Activa:</p>
                                                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">En Uso</span>
                                                </div>
                                                {unit.current_booking_id && unitActiveBookings[unit.current_booking_id] ? (
                                                    <>
                                                        <p className="text-xs text-blue-900 font-medium">Agente: {agents[unitActiveBookings[unit.current_booking_id].agent_id]?.name || 'Cargando...'}</p>
                                                        <p className="text-[10px] text-blue-600 truncate mt-0.5">📍 {unitActiveBookings[unit.current_booking_id].property_address}</p>
                                                        <p className="text-[10px] text-blue-600 bg-blue-100/50 p-1 rounded mt-1">
                                                            Retiro: {format(parseISO(unitActiveBookings[unit.current_booking_id].booking_date), "d MMM", { locale: es })} · {unitActiveBookings[unit.current_booking_id].start_time?.slice(0, 5)}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-blue-600 italic">No se encontró detalle de la reserva actual en esta vista.</p>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 gap-2">
                                                {unit.current_booking_id && unitActiveBookings[unit.current_booking_id] ? (
                                                    <Button onClick={() => handleComplete(unitActiveBookings[unit.current_booking_id])} disabled={submitting}
                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11">
                                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                                                        Confirmar Devolución
                                                    </Button>
                                                ) : (
                                                    <Button onClick={() => handleForceRelease(unitId)} variant="outline"
                                                        className="w-full border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-xl h-11">
                                                        <XCircle className="w-4 h-4 mr-2" /> Liberar Cámara (Forzar)
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {unit.status !== 'en_uso' && (
                                        <>
                                            {unit.status !== 'mantenimiento' && (
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold text-slate-600">Motivo de mantenimiento (opcional)</Label>
                                                    <input type="text" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                        placeholder="Ej: Batería dañada, trípode roto..."
                                                        value={maintenanceNotes} onChange={(e) => setMaintenanceNotes(e.target.value)} />
                                                </div>
                                            )}
                                            <Button onClick={() => toggleMaintenance(unitId)}
                                                className={cn("w-full text-white font-bold rounded-xl",
                                                    unit.status === 'mantenimiento' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
                                                )}>
                                                {unit.status === 'mantenimiento' ? (
                                                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Restaurar a Disponible</>
                                                ) : (
                                                    <><Wrench className="w-4 h-4 mr-2" /> Poner en Mantenimiento</>
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}

                    {/* Stale Bookings Cleanup */}
                    {staleBookings.length > 0 && (
                        <Card className="md:col-span-2 border-2 border-red-200 bg-red-50/30">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                        Reservas Vencidas sin Devolución ({staleBookings.length})
                                    </h3>
                                    <Button onClick={handleBulkCleanStale} disabled={submitting}
                                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl h-9 px-4">
                                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                                        Limpiar Todas
                                    </Button>
                                </div>
                                <p className="text-xs text-red-600 mb-3">
                                    Estas reservas ya pasaron su fecha de devolución pero nunca se confirmó la devolución en el sistema.
                                    Esto puede bloquear nuevas solicitudes para estos agentes.
                                </p>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {staleBookings.map(b => (
                                        <div key={b.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-red-100">
                                            <div className="w-1.5 h-10 rounded-full bg-red-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800">{agents[b.agent_id]?.name || 'Agente'}</p>
                                                <p className="text-xs text-slate-500">
                                                    📷 Cámara {b.camera_unit} · {format(parseISO(b.booking_date), "d MMM", { locale: es })}
                                                    {b.return_date && b.return_date !== b.booking_date ? ` → ${format(parseISO(b.return_date), "d MMM", { locale: es })}` : ''}
                                                    {' · '}{b.start_time?.slice(0, 5)}—{b.end_time?.slice(0, 5)}
                                                </p>
                                                <p className="text-[10px] text-slate-400 truncate">📍 {b.property_address}</p>
                                            </div>
                                            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                                                {b.pickup_confirmed_at ? '🔑 Sin devolver' : '⏳ Sin retirar'}
                                            </span>
                                            <Button onClick={() => handleComplete(b)} disabled={submitting}
                                                size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg h-8 px-3">
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Completar
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Late Cancellation Stats */}
                    <Card className="md:col-span-2 border-2 border-slate-200">
                        <CardContent className="pt-6">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" /> Cancelaciones Tardías por Agente
                            </h3>
                            {Object.keys(lateCancelStats).length === 0 ? (
                                <p className="text-sm text-slate-400">Sin cancelaciones tardías registradas</p>
                            ) : (
                                <div className="space-y-2">
                                    {Object.entries(lateCancelStats).sort((a, b) => b[1] - a[1]).map(([agentId, count]) => (
                                        <div key={agentId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <span className="text-sm font-medium text-slate-700">{agents[agentId]?.name || agentId}</span>
                                            <span className={cn("text-xs font-bold px-2 py-1 rounded-full",
                                                count >= 3 ? "bg-red-100 text-red-600" : count >= 2 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                                            )}>{count} cancelación{count > 1 ? 'es' : ''} tardía{count > 1 ? 's' : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* === ACTION MODALS === */}
            <AnimatePresence>
                {actionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActionModal(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">

                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {actionModal.action === 'approve' && '✅ Aprobar Reserva'}
                                    {actionModal.action === 'reject' && '❌ Rechazar Reserva'}
                                    {actionModal.action === 'reschedule' && '🔄 Reagendar'}
                                    {actionModal.action === 'cancel' && '🚫 Anular Reserva'}
                                    {actionModal.action === 'transfer' && '🔀 Transferir Reserva'}
                                    {actionModal.action === 'detail' && '📋 Detalle de Reserva'}
                                </h3>
                                <button onClick={() => setActionModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
                            </div>

                            {/* Booking Info */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900">{agents[actionModal.booking.agent_id]?.name || 'Agente'}</span>
                                    {renderStatusBadge(actionModal.booking.status)}
                                    {actionModal.booking.is_urgent && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">🚨 URGENTE</span>}
                                </div>
                                <p className="text-xs text-slate-500">📷 Cámara {actionModal.booking.camera_unit} · {format(parseISO(actionModal.booking.booking_date), "EEEE d 'de' MMMM yyyy", { locale: es })}{actionModal.booking.return_date && actionModal.booking.return_date !== actionModal.booking.booking_date ? ` → ${format(parseISO(actionModal.booking.return_date), "EEEE d 'de' MMMM", { locale: es })}` : ''}</p>
                                <p className="text-xs text-slate-500">🕐 {actionModal.booking.start_time?.slice(0, 5)} — {actionModal.booking.end_time?.slice(0, 5)}</p>
                                <p className="text-xs text-slate-500">📍 {actionModal.booking.property_address}</p>
                                {actionModal.booking.notes && <p className="text-xs text-slate-400 italic">💬 {actionModal.booking.notes}</p>}
                                {actionModal.booking.admin_notes && <p className="text-xs text-blue-600 italic">📝 Admin: {actionModal.booking.admin_notes}</p>}

                                {/* Condition checklists */}
                                {actionModal.booking.pickup_condition && (
                                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg">
                                        <p className="text-[10px] font-bold text-emerald-700">Retiro confirmado:</p>
                                        {Object.entries(actionModal.booking.pickup_condition).filter(([k]) => k !== 'notes' && k !== 'confirmed_at').map(([k, v]) => (
                                            <span key={k} className="text-[9px] text-emerald-600 mr-2">{v ? '✅' : '❌'} {k}</span>
                                        ))}
                                        {actionModal.booking.pickup_condition.notes && <p className="text-[9px] text-emerald-500 mt-1">📝 {actionModal.booking.pickup_condition.notes}</p>}
                                    </div>
                                )}
                                {actionModal.booking.return_condition && (
                                    <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                                        <p className="text-[10px] font-bold text-blue-700">Devolución confirmada:</p>
                                        {Object.entries(actionModal.booking.return_condition).filter(([k]) => k !== 'notes' && k !== 'confirmed_at' && k !== 'is_early').map(([k, v]) => (
                                            <span key={k} className="text-[9px] text-blue-600 mr-2">{v ? '✅' : '❌'} {k}</span>
                                        ))}
                                        {actionModal.booking.return_condition.is_early && <span className="text-[9px] text-emerald-600 font-bold ml-2">⚡ Anticipada</span>}
                                    </div>
                                )}

                                {/* Late cancel stats for this agent */}
                                {lateCancelStats[actionModal.booking.agent_id] > 0 && (
                                    <div className="mt-2 p-2 bg-amber-50 rounded-lg">
                                        <p className="text-[10px] font-bold text-amber-700">⚠️ Este agente tiene {lateCancelStats[actionModal.booking.agent_id]} cancelación(es) tardía(s)</p>
                                    </div>
                                )}
                            </div>

                            {/* Detail view — actions panel */}
                            {actionModal.action === 'detail' && (
                                <div className="space-y-3">
                                    {actionModal.booking.status === 'pendiente' && (
                                        <div className="flex gap-2 flex-wrap">
                                            <Button onClick={() => setActionModal({ ...actionModal, action: 'approve' })} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                                                <CheckCircle2 className="w-4 h-4 mr-1" /> Aprobar
                                            </Button>
                                            <Button onClick={() => setActionModal({ ...actionModal, action: 'reject' })} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                                                <XCircle className="w-4 h-4 mr-1" /> Rechazar
                                            </Button>
                                            <Button onClick={() => { setActionModal({ ...actionModal, action: 'reschedule' }); setRescheduleData({ booking_date: actionModal.booking.booking_date, return_date: actionModal.booking.return_date || actionModal.booking.booking_date, start_time: actionModal.booking.start_time?.slice(0, 5), end_time: actionModal.booking.end_time?.slice(0, 5), camera_unit: actionModal.booking.camera_unit }) }} variant="outline" className="flex-1">
                                                <RefreshCw className="w-4 h-4 mr-1" /> Reagendar
                                            </Button>
                                            <Button onClick={() => { setActionModal({ ...actionModal, action: 'transfer' }); setTransferData({ agent_id: '', booking_date: actionModal.booking.booking_date, return_date: actionModal.booking.return_date || actionModal.booking.booking_date, start_time: actionModal.booking.start_time?.slice(0, 5), end_time: actionModal.booking.end_time?.slice(0, 5), camera_unit: String(actionModal.booking.camera_unit) }); setAdminNotes('') }} variant="outline" className="flex-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                                                <ArrowRightLeft className="w-4 h-4 mr-1" /> Transferir
                                            </Button>
                                            <Button onClick={() => { setActionModal({ ...actionModal, action: 'cancel' }); setAdminNotes('') }} variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50">
                                                <Ban className="w-4 h-4 mr-1" /> Anular
                                            </Button>
                                        </div>
                                    )}
                                    {actionModal.booking.status === 'aprobada' && (
                                        <div className="space-y-3">
                                            {!actionModal.booking.return_confirmed_at && (
                                                <Button onClick={() => handleComplete(actionModal.booking)} disabled={submitting}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11">
                                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                                                    Confirmar Devolución
                                                </Button>
                                            )}
                                            {/* Admin actions for approved bookings */}
                                            <div className="flex gap-2 flex-wrap">
                                                <Button onClick={() => { setActionModal({ ...actionModal, action: 'reschedule' }); setRescheduleData({ booking_date: actionModal.booking.booking_date, return_date: actionModal.booking.return_date || actionModal.booking.booking_date, start_time: actionModal.booking.start_time?.slice(0, 5), end_time: actionModal.booking.end_time?.slice(0, 5), camera_unit: actionModal.booking.camera_unit }) }} variant="outline" className="flex-1">
                                                    <RefreshCw className="w-4 h-4 mr-1" /> Reagendar
                                                </Button>
                                                <Button onClick={() => { setActionModal({ ...actionModal, action: 'transfer' }); setTransferData({ agent_id: '', booking_date: actionModal.booking.booking_date, return_date: actionModal.booking.return_date || actionModal.booking.booking_date, start_time: actionModal.booking.start_time?.slice(0, 5), end_time: actionModal.booking.end_time?.slice(0, 5), camera_unit: String(actionModal.booking.camera_unit) }); setAdminNotes('') }} variant="outline" className="flex-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                                                    <ArrowRightLeft className="w-4 h-4 mr-1" /> Transferir
                                                </Button>
                                                <Button onClick={() => { setActionModal({ ...actionModal, action: 'cancel' }); setAdminNotes('') }} variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50">
                                                    <Ban className="w-4 h-4 mr-1" /> Anular
                                                </Button>
                                            </div>
                                            {/* Handoff config */}
                                            <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                                                <p className="text-xs font-bold text-slate-700 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Configurar Traspaso</p>
                                                <Select value={handoffData.agent_id || undefined} onValueChange={v => setHandoffData(p => ({ ...p, agent_id: v }))}>
                                                    <SelectTrigger className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm">
                                                        <SelectValue placeholder="Seleccionar agente de traspaso" />
                                                    </SelectTrigger>
                                                    <SelectContent className="z-[300]">
                                                        {Object.entries(agents).filter(([id]) => id !== actionModal.booking.agent_id).map(([id, a]) => (
                                                            <SelectItem key={id} value={id}>{a.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <input type="text" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                    placeholder="Lugar de traspaso (ej: Oficina RE/MAX)"
                                                    value={handoffData.location} onChange={(e) => setHandoffData(p => ({ ...p, location: e.target.value }))} />
                                                <Button onClick={() => handleSetHandoff(actionModal.booking)} size="sm" variant="outline" className="w-full text-xs">
                                                    <MapPin className="w-3.5 h-3.5 mr-1" /> Asignar Traspaso
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Approve form */}
                            {actionModal.action === 'approve' && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-600">Nota para el agente (opcional)</Label>
                                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2}
                                            placeholder="Ej: Retirar en oficina a las 9am..."
                                            value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                                    </div>
                                    <Button onClick={() => handleApprove(actionModal.booking)} disabled={submitting}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11">
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                        Confirmar Aprobación
                                    </Button>
                                </div>
                            )}

                            {/* Reject form */}
                            {actionModal.action === 'reject' && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-600">Motivo del rechazo <span className="text-red-500">*</span></Label>
                                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2}
                                            placeholder="Ej: La cámara no está disponible para esa fecha..."
                                            value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                                    </div>
                                    <Button onClick={() => handleReject(actionModal.booking)} disabled={submitting}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-11">
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                        Confirmar Rechazo
                                    </Button>
                                </div>
                            )}

                            {/* Reschedule form */}
                            {actionModal.action === 'reschedule' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Fecha retiro</Label>
                                            <input type="date" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                value={rescheduleData.booking_date || ''} onChange={(e) => setRescheduleData(p => ({ ...p, booking_date: e.target.value, return_date: p.return_date && p.return_date < e.target.value ? e.target.value : p.return_date }))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Fecha devolución</Label>
                                            <input type="date" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                value={rescheduleData.return_date || rescheduleData.booking_date || ''}
                                                min={rescheduleData.booking_date || ''}
                                                onChange={(e) => setRescheduleData(p => ({ ...p, return_date: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Cámara</Label>
                                            <Select value={String(rescheduleData.camera_unit || 1)} onValueChange={v => setRescheduleData(p => ({ ...p, camera_unit: Number(v) }))}>
                                                <SelectTrigger className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="z-[300]">
                                                    <SelectItem value="1">Cámara 1</SelectItem>
                                                    <SelectItem value="2">Cámara 2</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Hora retiro</Label>
                                            <input type="time" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                value={rescheduleData.start_time || ''} onChange={(e) => setRescheduleData(p => ({ ...p, start_time: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Hora devolución</Label>
                                            <input type="time" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                value={rescheduleData.end_time || ''} onChange={(e) => setRescheduleData(p => ({ ...p, end_time: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-600">Nota (opcional)</Label>
                                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2}
                                            value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                                    </div>
                                    <Button onClick={() => handleReschedule(actionModal.booking)} disabled={submitting}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-11">
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                        Confirmar Reagendamiento
                                    </Button>
                                </div>
                            )}

                            {/* Cancel (Admin) form */}
                            {actionModal.action === 'cancel' && (
                                <div className="space-y-3">
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                        <p className="text-sm text-red-700 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            <span>Esta acción <strong>anulará la reserva</strong> y notificará al agente. Si hay alguien en lista de espera, será promovido automáticamente.</span>
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-600">Motivo de la anulación <span className="text-red-500">*</span></Label>
                                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2}
                                            placeholder="Ej: No se va a utilizar esta semana, cámara necesita mantenimiento..."
                                            value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                                    </div>
                                    <Button onClick={() => handleAdminCancel(actionModal.booking)} disabled={submitting}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-11">
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                                        Confirmar Anulación
                                    </Button>
                                </div>
                            )}

                            {/* Transfer form */}
                            {actionModal.action === 'transfer' && (
                                <div className="space-y-3">
                                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                                        <p className="text-sm text-indigo-700 flex items-center gap-2">
                                            <ArrowRightLeft className="w-4 h-4 shrink-0" />
                                            <span>Transferir esta reserva a otro agente. Los calendarios se actualizarán automáticamente.</span>
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-600">Agente destino <span className="text-red-500">*</span></Label>
                                        <Select value={transferData.agent_id || undefined} onValueChange={v => setTransferData(p => ({ ...p, agent_id: v }))}>
                                            <SelectTrigger className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm">
                                                <SelectValue placeholder="Seleccionar agente" />
                                            </SelectTrigger>
                                            <SelectContent className="z-[300]">
                                                {Object.entries(agents).filter(([id]) => id !== actionModal.booking.agent_id).map(([id, a]) => (
                                                    <SelectItem key={id} value={id}>{a.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Fecha retiro (opcional)</Label>
                                            <input type="date" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                value={transferData.booking_date || ''} onChange={(e) => setTransferData(p => ({ ...p, booking_date: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Fecha devolución</Label>
                                            <input type="date" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                value={transferData.return_date || transferData.booking_date || ''}
                                                min={transferData.booking_date || ''}
                                                onChange={(e) => setTransferData(p => ({ ...p, return_date: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Hora retiro</Label>
                                            <input type="time" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                value={transferData.start_time || ''} onChange={(e) => setTransferData(p => ({ ...p, start_time: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Hora devolución</Label>
                                            <input type="time" className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                                value={transferData.end_time || ''} onChange={(e) => setTransferData(p => ({ ...p, end_time: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Cámara</Label>
                                            <Select value={transferData.camera_unit || '1'} onValueChange={v => setTransferData(p => ({ ...p, camera_unit: v }))}>
                                                <SelectTrigger className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="z-[300]">
                                                    <SelectItem value="1">Cámara 1</SelectItem>
                                                    <SelectItem value="2">Cámara 2</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-600">Nota (opcional)</Label>
                                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2}
                                            placeholder="Ej: Se reasigna porque el agente original no la necesita..."
                                            value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                                    </div>
                                    <Button onClick={() => handleTransferBooking(actionModal.booking)} disabled={submitting}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-11">
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                                        Confirmar Transferencia
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
