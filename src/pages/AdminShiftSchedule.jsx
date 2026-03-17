import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Card, CardContent, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui'
import { toast } from 'sonner'
import {
    Calendar, ChevronLeft, ChevronRight, CheckCircle2, X, Ban,
    AlertCircle, Loader2, Shield, Users, Clock, Send, Plus, Minus,
    ArrowRightLeft, UserPlus, XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { sendShiftNotification, SHIFT_EVENTS } from '../services/shiftNotifications'
import { createShiftCalendarEvent, deleteShiftCalendarEvent } from '../services/shiftCalendarSync'

const SHIFT_CONFIG = {
    1: { label: 'Turno 1', time: '09:00 – 13:00', color: 'from-amber-400 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-700' },
    2: { label: 'Turno 2', time: '13:00 – 18:00', color: 'from-blue-400 to-indigo-500', bg: 'bg-blue-50', text: 'text-blue-700' },
}

const STATUS_CONFIG = {
    pendiente: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle, label: 'Pendiente' },
    aprobado: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Aprobado' },
    rechazado: { color: 'bg-red-100 text-red-700 border-red-200', icon: Ban, label: 'Rechazado' },
    cancelado: { color: 'bg-slate-100 text-slate-500 border-slate-200', icon: X, label: 'Cancelado' },
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const DAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

export default function AdminShiftSchedule() {
    const { profile } = useAuth()
    const [weekOffset, setWeekOffset] = useState(0)
    const [bookings, setBookings] = useState([])
    const [availableSlots, setAvailableSlots] = useState([])
    const [loading, setLoading] = useState(true)
    const [publishing, setPublishing] = useState(false)
    const [tab, setTab] = useState('calendario')
    const [comercialId, setComercialId] = useState(null)

    // Slots selected for publishing (editing mode)
    const [editingAvailability, setEditingAvailability] = useState(false)
    const [selectedSlots, setSelectedSlots] = useState(new Set())

    // Dialog states
    const [showPublishDialog, setShowPublishDialog] = useState(false)
    const [showRejectDialog, setShowRejectDialog] = useState(false)
    const [rejectBooking, setRejectBooking] = useState(null)
    const [rejectNotes, setRejectNotes] = useState('')

    // Admin Cancel dialog
    const [showAdminCancelDialog, setShowAdminCancelDialog] = useState(false)
    const [adminCancelBooking, setAdminCancelBooking] = useState(null)
    const [adminCancelNotes, setAdminCancelNotes] = useState('')

    // Move Turno dialog
    const [showMoveDialog, setShowMoveDialog] = useState(false)
    const [moveBooking, setMoveBooking] = useState(null)
    const [moveTarget, setMoveTarget] = useState(null) // { date, shift }

    // Assign Agent dialog
    const [showAssignDialog, setShowAssignDialog] = useState(false)
    const [assignSlot, setAssignSlot] = useState(null) // { date, shift }
    const [eligibleAgents, setEligibleAgents] = useState([])
    const [selectedAgentId, setSelectedAgentId] = useState(null)
    const [agentSearch, setAgentSearch] = useState('')

    // Fetch comercial user (Marinela) on mount
    useEffect(() => {
        supabase.from('profiles').select('id').eq('role', 'comercial').limit(1).single()
            .then(({ data }) => { if (data) setComercialId(data.id) })
    }, [])

    const weekDates = useMemo(() => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const monday = new Date(today)
        monday.setDate(today.getDate() + mondayOffset + weekOffset * 7)
        return Array.from({ length: 5 }, (_, i) => {
            const d = new Date(monday)
            d.setDate(monday.getDate() + i)
            return d.toISOString().split('T')[0]
        })
    }, [weekOffset])

    const weekRangeLabel = useMemo(() => {
        if (!weekDates.length) return ''
        const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
        return `${fmt(weekDates[0])} – ${fmt(weekDates[4])}`
    }, [weekDates])

    useEffect(() => { fetchAll() }, [weekDates])

    async function fetchAll() {
        setLoading(true)
        const [{ data: bk }, { data: avail }] = await Promise.all([
            supabase
                .from('shift_bookings')
                .select('*, agent:profiles!shift_bookings_agent_id_fkey(id, first_name, last_name, email, phone)')
                .gte('booking_date', weekDates[0])
                .lte('booking_date', weekDates[4])
                .order('booking_date', { ascending: true }),
            supabase
                .from('shift_available_slots')
                .select('*')
                .gte('booking_date', weekDates[0])
                .lte('booking_date', weekDates[4]),
        ])
        setBookings(bk || [])
        setAvailableSlots(avail || [])

        // Pre-fill selectedSlots from existing available slots
        const set = new Set()
            ; (avail || []).forEach(s => set.add(`${normalizeDate(s.booking_date)}|${s.shift}`))
        setSelectedSlots(set)
        setLoading(false)
    }

    function normalizeDate(d) {
        return typeof d === 'string' ? d.split('T')[0] : d
    }

    function getBookingForSlot(date, shift) {
        return bookings.find(b => normalizeDate(b.booking_date) === date && b.shift === shift && (b.status === 'pendiente' || b.status === 'aprobado'))
    }

    function isSlotAvailable(date, shift) {
        return availableSlots.some(s => normalizeDate(s.booking_date) === date && s.shift === shift)
    }

    function isSlotFree(date, shift) {
        return !getBookingForSlot(date, shift) && isSlotAvailable(date, shift)
    }

    function toggleSlot(date, shift) {
        const key = `${date}|${shift}`
        const next = new Set(selectedSlots)
        if (next.has(key)) { next.delete(key) } else { next.add(key) }
        setSelectedSlots(next)
    }

    function formatDayLabel(date) {
        return new Date(date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })
    }

    // ─── Publish ──────────────────────
    async function handlePublish() {
        if (selectedSlots.size === 0) {
            toast.error('Selecciona al menos un turno para publicar.')
            return
        }
        setShowPublishDialog(true)
    }

    async function confirmPublish() {
        setShowPublishDialog(false)
        setPublishing(true)

        await supabase
            .from('shift_available_slots')
            .delete()
            .gte('booking_date', weekDates[0])
            .lte('booking_date', weekDates[4])

        const slotsToInsert = Array.from(selectedSlots).map(key => {
            const [date, shift] = key.split('|')
            return { booking_date: date, shift: parseInt(shift), published_by: profile.id }
        })
        const { error } = await supabase.from('shift_available_slots').insert(slotsToInsert)
        if (error) {
            toast.error('Error al publicar: ' + error.message)
            setPublishing(false)
            return
        }

        const [{ data: captacionesCounts }, { data: cierresCounts }] = await Promise.all([
            supabase.rpc('get_agents_with_captaciones'),
            supabase.rpc('get_agents_with_cierres'),
        ]).catch(() => [{ data: null }, { data: null }])

        const { data: allAgents } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone')
            .eq('role', 'agent')
            .eq('shift_eligible', true)

        const slotsSummary = Array.from(selectedSlots).sort().map(key => {
            const [date, shift] = key.split('|')
            const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })
            return `${dayLabel} — ${SHIFT_CONFIG[parseInt(shift)]?.label} (${SHIFT_CONFIG[parseInt(shift)]?.time})`
        })

        sendShiftNotification(SHIFT_EVENTS.SHIFTS_PUBLISHED, {
            id: null,
            booking_date: weekDates[0],
            shift: 0,
            status: 'published',
        }, profile, '', {
            slots_summary: slotsSummary,
            week_range: weekRangeLabel,
            eligible_agents: (allAgents || []).map(a => ({
                name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
                email: a.email,
                phone: a.phone || '',
            })),
        })

        toast.success(`¡${selectedSlots.size} turnos publicados! Se notificará a los agentes elegibles.`)
        setEditingAvailability(false)
        setPublishing(false)
        await fetchAll()
    }

    // ─── Approve ──────────────────────
    async function handleApprove(booking) {
        const { error } = await supabase.from('shift_bookings').update({
            status: 'aprobado', approved_by: profile.id, updated_at: new Date().toISOString(),
        }).eq('id', booking.id)
        if (error) { toast.error('Error: ' + error.message); return }
        sendShiftNotification(SHIFT_EVENTS.SHIFT_APPROVED, { ...booking, status: 'aprobado' }, booking.agent || {})

        const agentName = booking.agent ? `${booking.agent.first_name || ''} ${booking.agent.last_name || ''}`.trim() : ''
        createShiftCalendarEvent(booking, booking.agent_id, comercialId, agentName)

        toast.success('Turno aprobado.')
        fetchAll()
    }

    // ─── Reject (pending) ──────────────────────
    async function handleReject(booking) {
        setRejectBooking(booking)
        setRejectNotes('')
        setShowRejectDialog(true)
    }

    async function confirmReject() {
        const booking = rejectBooking
        const notes = rejectNotes
        setShowRejectDialog(false)
        setRejectBooking(null)
        const { error } = await supabase.from('shift_bookings').update({
            status: 'rechazado', admin_notes: notes || null, approved_by: profile.id, updated_at: new Date().toISOString(),
        }).eq('id', booking.id)
        if (error) { toast.error('Error: ' + error.message); return }
        sendShiftNotification(SHIFT_EVENTS.SHIFT_REJECTED, { ...booking, status: 'rechazado' }, booking.agent || {}, notes || '')

        deleteShiftCalendarEvent(booking, booking.agent_id, comercialId)

        toast.success('Turno rechazado.')
        fetchAll()
    }

    // ─── Admin Cancel (approved turno) ──────────────────────
    function handleAdminCancel(booking) {
        setAdminCancelBooking(booking)
        setAdminCancelNotes('')
        setShowAdminCancelDialog(true)
    }

    async function confirmAdminCancel() {
        const booking = adminCancelBooking
        const notes = adminCancelNotes
        setShowAdminCancelDialog(false)
        setAdminCancelBooking(null)

        const { error } = await supabase.from('shift_bookings').update({
            status: 'cancelado', admin_notes: notes || null, approved_by: profile.id, updated_at: new Date().toISOString(),
        }).eq('id', booking.id)
        if (error) { toast.error('Error: ' + error.message); return }

        deleteShiftCalendarEvent(booking, booking.agent_id, comercialId)

        sendShiftNotification(SHIFT_EVENTS.SHIFT_CANCELLED_BY_ADMIN,
            { ...booking, status: 'cancelado' },
            booking.agent || {},
            notes || ''
        )

        toast.success('Turno cancelado por administración.')
        fetchAll()
    }

    // ─── Move Turno ──────────────────────
    function handleMove(booking) {
        setMoveBooking(booking)
        setMoveTarget(null)
        setShowMoveDialog(true)
    }

    // Get slots for move modal (published slots — free or occupied by another agent)
    const moveAvailableSlots = useMemo(() => {
        if (!moveBooking) return []
        const slots = []
        weekDates.forEach((date, di) => {
            ;[1, 2].forEach(shift => {
                const currentKey = `${normalizeDate(moveBooking.booking_date)}|${moveBooking.shift}`
                const slotKey = `${date}|${shift}`
                if (slotKey === currentKey) return // skip current slot
                const existingBooking = getBookingForSlot(date, shift)
                // Skip if same agent already has this slot
                if (existingBooking && existingBooking.agent_id === moveBooking.agent_id) return
                if (isSlotAvailable(date, shift) || existingBooking) {
                    const occupantName = existingBooking?.agent
                        ? `${existingBooking.agent.first_name || ''} ${existingBooking.agent.last_name || ''}`.trim()
                        : null
                    slots.push({
                        date, shift,
                        dayLabel: `${DAY_FULL[di]} ${new Date(date + 'T12:00:00').getDate()}`,
                        occupant: occupantName,
                        occupantBooking: existingBooking || null,
                        isSwap: !!existingBooking,
                    })
                }
            })
        })
        return slots
    }, [moveBooking, bookings, availableSlots, weekDates])

    async function confirmMove() {
        if (!moveBooking || !moveTarget) return
        setShowMoveDialog(false)

        const oldBooking = moveBooking
        const agentAName = oldBooking.agent ? `${oldBooking.agent.first_name || ''} ${oldBooking.agent.last_name || ''}`.trim() : ''
        const isSwap = moveTarget.isSwap && moveTarget.occupantBooking

        if (isSwap) {
            // ─── SWAP: Exchange shifts between two agents ───
            const otherBooking = moveTarget.occupantBooking
            const agentBName = otherBooking.agent ? `${otherBooking.agent.first_name || ''} ${otherBooking.agent.last_name || ''}`.trim() : ''

            // 1. Cancel both old bookings
            await Promise.all([
                supabase.from('shift_bookings').update({
                    status: 'cancelado',
                    admin_notes: `Intercambiado con ${agentBName}`,
                    approved_by: profile.id,
                    updated_at: new Date().toISOString(),
                }).eq('id', oldBooking.id),
                supabase.from('shift_bookings').update({
                    status: 'cancelado',
                    admin_notes: `Intercambiado con ${agentAName}`,
                    approved_by: profile.id,
                    updated_at: new Date().toISOString(),
                }).eq('id', otherBooking.id),
            ])

            // Delete old calendar events
            deleteShiftCalendarEvent(oldBooking, oldBooking.agent_id, comercialId)
            deleteShiftCalendarEvent(otherBooking, otherBooking.agent_id, comercialId)

            // 2. Create new bookings (swapped positions)
            const [{ data: newBookingA }, { data: newBookingB }] = await Promise.all([
                supabase.from('shift_bookings').insert({
                    agent_id: oldBooking.agent_id,
                    booking_date: moveTarget.date,
                    shift: moveTarget.shift,
                    status: 'aprobado',
                    approved_by: profile.id,
                    admin_notes: `Intercambio: antes ${formatDayLabel(normalizeDate(oldBooking.booking_date))} ${SHIFT_CONFIG[oldBooking.shift]?.label}`,
                }).select('*, agent:profiles!shift_bookings_agent_id_fkey(id, first_name, last_name, email, phone)').single(),
                supabase.from('shift_bookings').insert({
                    agent_id: otherBooking.agent_id,
                    booking_date: normalizeDate(oldBooking.booking_date),
                    shift: oldBooking.shift,
                    status: 'aprobado',
                    approved_by: profile.id,
                    admin_notes: `Intercambio: antes ${formatDayLabel(normalizeDate(otherBooking.booking_date))} ${SHIFT_CONFIG[otherBooking.shift]?.label}`,
                }).select('*, agent:profiles!shift_bookings_agent_id_fkey(id, first_name, last_name, email, phone)').single(),
            ])

            // 3. Create new calendar events
            if (newBookingA) createShiftCalendarEvent(newBookingA, newBookingA.agent_id, comercialId, agentAName)
            if (newBookingB) createShiftCalendarEvent(newBookingB, newBookingB.agent_id, comercialId, agentBName)

            // 4. Notify both agents
            if (newBookingA) {
                sendShiftNotification(SHIFT_EVENTS.SHIFT_REASSIGNED, { ...newBookingA, status: 'aprobado' }, oldBooking.agent || {}, '', {
                    old_shift: { booking_date: normalizeDate(oldBooking.booking_date), shift_number: oldBooking.shift, shift_label: SHIFT_CONFIG[oldBooking.shift]?.label + ' (' + SHIFT_CONFIG[oldBooking.shift]?.time + ')' },
                })
            }
            if (newBookingB) {
                sendShiftNotification(SHIFT_EVENTS.SHIFT_REASSIGNED, { ...newBookingB, status: 'aprobado' }, otherBooking.agent || {}, '', {
                    old_shift: { booking_date: normalizeDate(otherBooking.booking_date), shift_number: otherBooking.shift, shift_label: SHIFT_CONFIG[otherBooking.shift]?.label + ' (' + SHIFT_CONFIG[otherBooking.shift]?.time + ')' },
                })
            }

            toast.success(`Turnos intercambiados: ${agentAName} ↔ ${agentBName}`)
        } else {
            // ─── MOVE to empty slot ───
            // 1. Cancel old booking
            await supabase.from('shift_bookings').update({
                status: 'cancelado',
                admin_notes: `Reasignado a ${formatDayLabel(moveTarget.date)} – ${SHIFT_CONFIG[moveTarget.shift]?.label}`,
                approved_by: profile.id,
                updated_at: new Date().toISOString(),
            }).eq('id', oldBooking.id)

            deleteShiftCalendarEvent(oldBooking, oldBooking.agent_id, comercialId)

            // 2. Create new booking as approved
            const { data: newBooking, error } = await supabase.from('shift_bookings').insert({
                agent_id: oldBooking.agent_id,
                booking_date: moveTarget.date,
                shift: moveTarget.shift,
                status: 'aprobado',
                approved_by: profile.id,
                admin_notes: `Reasignado desde ${formatDayLabel(normalizeDate(oldBooking.booking_date))} – ${SHIFT_CONFIG[oldBooking.shift]?.label}`,
            }).select('*, agent:profiles!shift_bookings_agent_id_fkey(id, first_name, last_name, email, phone)').single()

            if (error) {
                toast.error('Error al mover turno: ' + error.message)
                fetchAll()
                return
            }

            createShiftCalendarEvent(newBooking, newBooking.agent_id, comercialId, agentAName)

            sendShiftNotification(SHIFT_EVENTS.SHIFT_REASSIGNED, {
                ...newBooking, status: 'aprobado',
            }, oldBooking.agent || {}, '', {
                old_shift: { booking_date: normalizeDate(oldBooking.booking_date), shift_number: oldBooking.shift, shift_label: SHIFT_CONFIG[oldBooking.shift]?.label + ' (' + SHIFT_CONFIG[oldBooking.shift]?.time + ')' },
            })

            toast.success(`Turno de ${agentAName} movido a ${formatDayLabel(moveTarget.date)} – ${SHIFT_CONFIG[moveTarget.shift]?.label}`)
        }

        setMoveBooking(null)
        setMoveTarget(null)
        fetchAll()
    }

    // ─── Assign Agent ──────────────────────
    async function handleAssign(date, shift) {
        setAssignSlot({ date, shift })
        setSelectedAgentId(null)
        setAgentSearch('')
        setShowAssignDialog(true)

        // Fetch eligible agents
        const { data } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone')
            .eq('role', 'agent')
            .eq('shift_eligible', true)
            .order('first_name', { ascending: true })
        setEligibleAgents(data || [])
    }

    const filteredAgents = useMemo(() => {
        if (!agentSearch.trim()) return eligibleAgents
        const q = agentSearch.toLowerCase()
        return eligibleAgents.filter(a =>
            `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase().includes(q) ||
            (a.email || '').toLowerCase().includes(q)
        )
    }, [eligibleAgents, agentSearch])

    async function confirmAssign() {
        if (!assignSlot || !selectedAgentId) return
        setShowAssignDialog(false)

        const agent = eligibleAgents.find(a => a.id === selectedAgentId)
        const agentName = agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() : ''

        const { data: newBooking, error } = await supabase.from('shift_bookings').insert({
            agent_id: selectedAgentId,
            booking_date: assignSlot.date,
            shift: assignSlot.shift,
            status: 'aprobado',
            approved_by: profile.id,
            admin_notes: 'Asignado directamente por administración',
        }).select('*, agent:profiles!shift_bookings_agent_id_fkey(id, first_name, last_name, email, phone)').single()

        if (error) {
            if (error.code === '23505') {
                toast.error('Este turno ya fue reservado.')
            } else {
                toast.error('Error al asignar: ' + error.message)
            }
            return
        }

        createShiftCalendarEvent(newBooking, selectedAgentId, comercialId, agentName)

        sendShiftNotification(SHIFT_EVENTS.SHIFT_ASSIGNED, {
            ...newBooking,
            status: 'aprobado',
        }, agent || {})

        toast.success(`Turno asignado a ${agentName}`)
        setAssignSlot(null)
        setSelectedAgentId(null)
        fetchAll()
    }

    // ─── Stats ──────────────────────
    const pendingCount = bookings.filter(b => b.status === 'pendiente').length
    const approvedCount = bookings.filter(b => b.status === 'aprobado').length
    const publishedCount = availableSlots.length

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-6 h-6 text-orange-500" />
                        Agenda de Turnos / Guardias
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">Gestión, publicación y aprobación de turnos</p>
                </div>
                <div className="flex gap-3">
                    <div className="px-4 py-2 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-center">
                        <div className="text-2xl font-bold text-violet-600">{publishedCount}</div>
                        <div className="text-[10px] text-violet-600 font-semibold uppercase tracking-wider">Publicados</div>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
                        <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
                        <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Pendientes</div>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                        <div className="text-2xl font-bold text-emerald-600">{approvedCount}</div>
                        <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Aprobados</div>
                    </div>
                </div>
            </div>

            {/* Publish Bar */}
            <div className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-xl border border-violet-200 dark:border-violet-800 px-5 py-3">
                <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                        {editingAvailability
                            ? `Selecciona turnos disponibles (${selectedSlots.size} seleccionados)`
                            : `${publishedCount} turnos publicados esta semana`
                        }
                    </span>
                </div>
                <div className="flex gap-2">
                    {editingAvailability ? (
                        <>
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => { setEditingAvailability(false); fetchAll() }}>
                                Cancelar
                            </Button>
                            <Button size="sm" className="text-xs bg-violet-600 hover:bg-violet-700 text-white" onClick={handlePublish} disabled={publishing}>
                                {publishing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                                Publicar y Notificar
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" className="text-xs bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setEditingAvailability(true)}>
                            <Calendar className="w-3 h-3 mr-1" /> Configurar Disponibilidad
                        </Button>
                    )}
                </div>
            </div>

            {/* Tab Toggle */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 w-fit">
                {[{ id: 'calendario', label: 'Calendario', icon: Calendar }, { id: 'lista', label: 'Lista', icon: Users }].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={cn(
                        "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5",
                        tab === t.id ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}>
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>

            {/* Week Navigation */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o - 1)}>
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-center">
                    <span className="font-semibold text-slate-900 dark:text-white">{weekRangeLabel}</span>
                    {weekOffset !== 0 && <Button variant="link" size="sm" className="ml-2 text-xs" onClick={() => setWeekOffset(0)}>Hoy</Button>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o + 1)}>
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                </div>
            ) : tab === 'calendario' ? (
                <div className="grid grid-cols-5 gap-3">
                    {weekDates.map((date, di) => {
                        const isToday = date === new Date().toISOString().split('T')[0]
                        return (
                            <div key={date} className={cn(
                                "rounded-xl border transition-all",
                                isToday ? "border-primary shadow-lg shadow-primary/10" : "border-slate-200 dark:border-slate-800"
                            )}>
                                <div className={cn(
                                    "px-3 py-2 text-center border-b rounded-t-xl",
                                    isToday ? "bg-primary/10 border-primary/20" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                )}>
                                    <div className="text-xs font-bold text-slate-400 uppercase">{DAY_NAMES[di]}</div>
                                    <div className={cn("text-lg font-bold", isToday ? "text-primary" : "text-slate-900 dark:text-white")}>
                                        {new Date(date + 'T12:00:00').getDate()}
                                    </div>
                                </div>

                                <div className="p-2 space-y-2 bg-white dark:bg-slate-950 rounded-b-xl min-h-[140px]">
                                    {[1, 2].map(shift => {
                                        const booking = getBookingForSlot(date, shift)
                                        const available = isSlotAvailable(date, shift)
                                        const cfg = SHIFT_CONFIG[shift]
                                        const slotKey = `${date}|${shift}`
                                        const isSelected = selectedSlots.has(slotKey)

                                        // Editing availability mode
                                        if (editingAvailability) {
                                            return (
                                                <button
                                                    key={shift}
                                                    onClick={() => toggleSlot(date, shift)}
                                                    className={cn(
                                                        "w-full rounded-lg p-2.5 border-2 text-xs transition-all",
                                                        isSelected
                                                            ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30 text-violet-700"
                                                            : "border-dashed border-slate-300 dark:border-slate-700 text-slate-400"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold">{cfg.label}</span>
                                                        {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" /> : <Plus className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div className="text-[10px] opacity-75">{cfg.time}</div>
                                                    <div className={cn("mt-1 font-semibold", isSelected ? "text-violet-600" : "text-slate-400")}>
                                                        {isSelected ? '✓ Disponible' : 'No disponible'}
                                                    </div>
                                                </button>
                                            )
                                        }

                                        // Booking view
                                        if (booking) {
                                            const st = STATUS_CONFIG[booking.status]
                                            const agentName = booking.agent
                                                ? `${booking.agent.first_name || ''} ${booking.agent.last_name || ''}`.trim()
                                                : 'Agente'
                                            return (
                                                <div key={shift} className={cn("rounded-lg p-2.5 border text-xs", st.color)}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold">{cfg.label}</span>
                                                        <st.icon className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="text-[10px] opacity-75">{cfg.time}</div>
                                                    <div className="mt-1 font-semibold truncate">{agentName}</div>

                                                    {/* Pending: Approve / Reject */}
                                                    {booking.status === 'pendiente' && (
                                                        <div className="flex gap-1 mt-2">
                                                            <Button size="sm" className="flex-1 h-6 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleApprove(booking)}>
                                                                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Aprobar
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="flex-1 h-6 text-[10px] border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleReject(booking)}>
                                                                <Ban className="w-3 h-3 mr-0.5" /> Rechazar
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {/* Approved: Move / Cancel */}
                                                    {booking.status === 'aprobado' && (
                                                        <div className="flex gap-1 mt-2">
                                                            <Button size="sm" variant="outline" className="flex-1 h-6 text-[10px] border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => handleMove(booking)}>
                                                                <ArrowRightLeft className="w-3 h-3 mr-0.5" /> Mover
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="flex-1 h-6 text-[10px] border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleAdminCancel(booking)}>
                                                                <XCircle className="w-3 h-3 mr-0.5" /> Cancelar
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        }

                                        // Available but no booking — show Assign button
                                        return (
                                            <div key={shift} className={cn(
                                                "rounded-lg p-2.5 border-2 border-dashed text-xs text-center",
                                                available
                                                    ? "border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/10 text-violet-600"
                                                    : "border-slate-200 dark:border-slate-800 text-slate-400"
                                            )}>
                                                <div className="font-bold">{cfg.label}</div>
                                                <div className="text-[10px] opacity-75">{cfg.time}</div>
                                                <div className={cn("mt-1 font-semibold", available ? "text-violet-500" : "")}>
                                                    {available ? '✓ Publicado' : 'No publicado'}
                                                </div>
                                                {available && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-full mt-1.5 h-6 text-[10px] border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                                                        onClick={() => handleAssign(date, shift)}
                                                    >
                                                        <UserPlus className="w-3 h-3 mr-0.5" /> Asignar
                                                    </Button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* List View */
                <Card>
                    <CardContent className="p-0">
                        {bookings.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                <p>No hay turnos agendados esta semana.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {bookings.map(b => {
                                    const cfg = SHIFT_CONFIG[b.shift]
                                    const st = STATUS_CONFIG[b.status]
                                    const agentName = b.agent ? `${b.agent.first_name || ''} ${b.agent.last_name || ''}`.trim() : 'Agente'
                                    const dateLabel = new Date(b.booking_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
                                    return (
                                        <div key={b.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold", cfg.color)}>T{b.shift}</div>
                                                <div>
                                                    <div className="font-semibold text-sm text-slate-900 dark:text-white">{agentName}</div>
                                                    <div className="text-xs text-slate-500 capitalize">{dateLabel} · {cfg.time}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", st.color)}>{st.label}</span>
                                                {b.status === 'pendiente' && (
                                                    <>
                                                        <Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleApprove(b)}>Aprobar</Button>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleReject(b)}>Rechazar</Button>
                                                    </>
                                                )}
                                                {b.status === 'aprobado' && (
                                                    <>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => handleMove(b)}>
                                                            <ArrowRightLeft className="w-3 h-3 mr-1" /> Mover
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleAdminCancel(b)}>
                                                            <XCircle className="w-3 h-3 mr-1" /> Cancelar
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── Publish Confirmation Dialog ─── */}
            <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Send className="w-5 h-5 text-violet-500" />
                            Publicar Turnos Disponibles
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            ¿Publicar <strong>{selectedSlots.size}</strong> turnos disponibles para la semana <strong>{weekRangeLabel}</strong>?
                            <br /><br />
                            Se notificará a los agentes habilitados para guardia por correo electrónico y se enviará un mensaje de auditoría al grupo comercial de WhatsApp.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-violet-600 hover:bg-violet-700" onClick={confirmPublish}>
                            <Send className="w-4 h-4 mr-1" /> Publicar y Notificar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Reject Reason Dialog ─── */}
            <AlertDialog open={showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(false); setRejectBooking(null) } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Ban className="w-5 h-5 text-red-500" />
                            Rechazar Turno
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            {rejectBooking && (
                                <>
                                    Rechazar el turno de <strong>{rejectBooking.agent ? `${rejectBooking.agent.first_name || ''} ${rejectBooking.agent.last_name || ''}`.trim() : 'Agente'}</strong> para el <strong>{rejectBooking.booking_date}</strong>.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-6 pb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Motivo de rechazo (opcional)</label>
                        <textarea
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Escribe el motivo aquí..."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmReject}>
                            <Ban className="w-4 h-4 mr-1" /> Rechazar Turno
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Admin Cancel Dialog ─── */}
            <AlertDialog open={showAdminCancelDialog} onOpenChange={(open) => { if (!open) { setShowAdminCancelDialog(false); setAdminCancelBooking(null) } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-500" />
                            Cancelar Turno Aprobado
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            {adminCancelBooking && (
                                <>
                                    Cancelar el turno aprobado de <strong>{adminCancelBooking.agent ? `${adminCancelBooking.agent.first_name || ''} ${adminCancelBooking.agent.last_name || ''}`.trim() : 'Agente'}</strong> para el <strong>{formatDayLabel(normalizeDate(adminCancelBooking.booking_date))}</strong> ({SHIFT_CONFIG[adminCancelBooking.shift]?.time}).
                                    <br /><br />
                                    Se notificará al agente automáticamente. Esta acción no se puede deshacer.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-6 pb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Motivo de cancelación <span className="text-red-500">*</span></label>
                        <textarea
                            value={adminCancelNotes}
                            onChange={(e) => setAdminCancelNotes(e.target.value)}
                            placeholder="Ej: El agente avisó que no puede asistir..."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Volver</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={confirmAdminCancel}
                            disabled={!adminCancelNotes.trim()}
                        >
                            <XCircle className="w-4 h-4 mr-1" /> Cancelar Turno
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Move Turno Dialog ─── */}
            <AlertDialog open={showMoveDialog} onOpenChange={(open) => { if (!open) { setShowMoveDialog(false); setMoveBooking(null); setMoveTarget(null) } }}>
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                            Mover Turno
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            {moveBooking && (
                                <>
                                    Mover a <strong>{moveBooking.agent ? `${moveBooking.agent.first_name || ''} ${moveBooking.agent.last_name || ''}`.trim() : 'Agente'}</strong> desde <strong>{formatDayLabel(normalizeDate(moveBooking.booking_date))} – {SHIFT_CONFIG[moveBooking.shift]?.label}</strong> a un nuevo slot.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-6 pb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Selecciona el nuevo turno:</label>
                        {moveAvailableSlots.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                No hay turnos disponibles esta semana para mover.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                                {moveAvailableSlots.map(slot => {
                                    const cfg = SHIFT_CONFIG[slot.shift]
                                    const isSelected = moveTarget?.date === slot.date && moveTarget?.shift === slot.shift
                                    return (
                                        <button
                                            key={`${slot.date}|${slot.shift}`}
                                            onClick={() => setMoveTarget(slot)}
                                            className={cn(
                                                "rounded-lg p-3 border-2 text-xs text-left transition-all",
                                                isSelected
                                                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400/30"
                                                    : slot.isSwap
                                                        ? "border-orange-200 dark:border-orange-800 hover:border-orange-400 hover:bg-orange-50/50 bg-orange-50/30"
                                                        : "border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                                            )}
                                        >
                                            <div className="font-bold text-slate-900 dark:text-white">{slot.dayLabel}</div>
                                            <div className={cn("font-semibold mt-1", cfg.text)}>{cfg.label}</div>
                                            <div className="text-[10px] text-slate-500">{cfg.time}</div>
                                            {slot.isSwap ? (
                                                <div className="mt-1.5 flex items-center gap-1">
                                                    <ArrowRightLeft className="w-3 h-3 text-orange-500" />
                                                    <span className="font-semibold text-orange-600 truncate">↔ {slot.occupant}</span>
                                                </div>
                                            ) : (
                                                <div className="mt-1 text-emerald-500 font-semibold">✓ Libre</div>
                                            )}
                                            {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-500 mt-1" />}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className={moveTarget?.isSwap ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}
                            onClick={confirmMove}
                            disabled={!moveTarget}
                        >
                            <ArrowRightLeft className="w-4 h-4 mr-1" /> {moveTarget?.isSwap ? 'Intercambiar Turnos' : 'Confirmar Movimiento'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Assign Agent Dialog ─── */}
            <AlertDialog open={showAssignDialog} onOpenChange={(open) => { if (!open) { setShowAssignDialog(false); setAssignSlot(null); setSelectedAgentId(null) } }}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-emerald-500" />
                            Asignar Agente a Turno
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            {assignSlot && (
                                <>
                                    Asignar agente al <strong>{formatDayLabel(assignSlot.date)}</strong> — <strong>{SHIFT_CONFIG[assignSlot.shift]?.label} ({SHIFT_CONFIG[assignSlot.shift]?.time})</strong>.
                                    <br />
                                    El turno se aprobará directamente.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-6 pb-2">
                        <input
                            type="text"
                            value={agentSearch}
                            onChange={(e) => setAgentSearch(e.target.value)}
                            placeholder="Buscar agente por nombre o email..."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        />
                        {eligibleAgents.length === 0 ? (
                            <div className="text-center py-4 text-slate-400 text-sm">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                Cargando agentes...
                            </div>
                        ) : filteredAgents.length === 0 ? (
                            <div className="text-center py-4 text-slate-400 text-sm">
                                No se encontraron agentes.
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                                {filteredAgents.map(a => {
                                    const name = `${a.first_name || ''} ${a.last_name || ''}`.trim()
                                    const isSelected = selectedAgentId === a.id
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => setSelectedAgentId(a.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-all",
                                                isSelected
                                                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-400/30"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                                isSelected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
                                            )}>
                                                {(a.first_name || '?')[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-slate-900 dark:text-white truncate">{name}</div>
                                                <div className="text-xs text-slate-500 truncate">{a.email}</div>
                                            </div>
                                            {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={confirmAssign}
                            disabled={!selectedAgentId}
                        >
                            <UserPlus className="w-4 h-4 mr-1" /> Asignar Turno
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
