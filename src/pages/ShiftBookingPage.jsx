import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Card, CardContent, Label, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui'
import { toast } from 'sonner'
import {
    Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2,
    X, Shield, Info, Ban, Loader2, ArrowLeft
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { sendShiftNotification, SHIFT_EVENTS } from '../services/shiftNotifications'

const SHIFT_CONFIG = {
    1: { label: 'Turno 1', time: '09:00 – 13:00', color: 'from-amber-400 to-orange-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    2: { label: 'Turno 2', time: '13:00 – 18:00', color: 'from-blue-400 to-indigo-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
}

const STATUS_CONFIG = {
    pendiente: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle, label: 'Pendiente' },
    aprobado: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Aprobado' },
    rechazado: { color: 'bg-red-100 text-red-700 border-red-200', icon: Ban, label: 'Rechazado' },
    cancelado: { color: 'bg-slate-100 text-slate-500 border-slate-200', icon: X, label: 'Cancelado' },
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const DAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const CONDITIONS = [
    'Haber captado al menos 2 propiedades en exclusiva.',
    'Haber hecho al menos un cierre de negocio de compraventa o de arriendo.',
    'Participar activamente en las actividades presenciales (reuniones de ventas, talleres, seguimiento de indicadores).',
    'Mantener informado al staff comercial del estatus de gestión de cada lead asignado.',
    'Ingresar captaciones nuevas como producto de su gestión de turno.',
]

export default function ShiftBookingPage() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [weekOffset, setWeekOffset] = useState(0)
    const [bookings, setBookings] = useState([])
    const [availableSlots, setAvailableSlots] = useState([])
    const [myBookings, setMyBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [agents, setAgents] = useState({})
    const [showConditions, setShowConditions] = useState(false)

    // Cancel dialog state
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [cancelBooking, setCancelBooking] = useState(null)

    // Eligibility state
    const [eligibility, setEligibility] = useState({ captaciones: 0, cierres: 0, checked: false })

    // Compute week dates (Mon–Fri)
    const weekDates = useMemo(() => {
        const today = new Date()
        const dayOfWeek = today.getDay() // 0=Sun … 6=Sat
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
        const fmt = (d) => {
            const dt = new Date(d + 'T12:00:00')
            return dt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
        }
        return `${fmt(weekDates[0])} – ${fmt(weekDates[4])}`
    }, [weekDates])

    // Check eligibility
    useEffect(() => {
        if (!profile?.id) return
        async function check() {
            const [{ count: captaciones }, { count: cierres }] = await Promise.all([
                supabase.from('mandates').select('id', { count: 'exact', head: true }).eq('agent_id', profile.id),
                supabase.from('crm_actions').select('id', { count: 'exact', head: true }).eq('agent_id', profile.id).eq('action_type', 'Cierre de negocio'),
            ])
            setEligibility({ captaciones: captaciones || 0, cierres: cierres || 0, checked: true })
        }
        check()
    }, [profile?.id])

    const isEligible = eligibility.captaciones >= 2 && eligibility.cierres >= 1

    // Fetch bookings for current week + agents
    useEffect(() => {
        fetchBookings()
        fetchAgents()
    }, [weekDates])

    // Fetch my upcoming bookings
    useEffect(() => {
        if (profile?.id) fetchMyBookings()
    }, [profile?.id, bookings])

    async function fetchBookings() {
        setLoading(true)
        const [{ data: bk }, { data: avail }] = await Promise.all([
            supabase
                .from('shift_bookings')
                .select('*, agent:profiles!shift_bookings_agent_id_fkey(id, first_name, last_name, email, phone)')
                .gte('booking_date', weekDates[0])
                .lte('booking_date', weekDates[4])
                .not('status', 'eq', 'cancelado'),
            supabase
                .from('shift_available_slots')
                .select('*')
                .gte('booking_date', weekDates[0])
                .lte('booking_date', weekDates[4]),
        ])
        setBookings(bk || [])
        setAvailableSlots(avail || [])
        setLoading(false)
    }

    async function fetchMyBookings() {
        const today = new Date().toISOString().split('T')[0]
        const { data } = await supabase
            .from('shift_bookings')
            .select('*')
            .eq('agent_id', profile.id)
            .gte('booking_date', today)
            .order('booking_date', { ascending: true })
        setMyBookings(data || [])
    }

    async function fetchAgents() {
        const { data } = await supabase.from('profiles').select('id, first_name, last_name')
        const map = {}
            ; (data || []).forEach(a => { map[a.id] = `${a.first_name || ''} ${a.last_name || ''}`.trim() })
        setAgents(map)
    }

    function getBookingForSlot(date, shift) {
        return bookings.find(b => b.booking_date === date && b.shift === shift)
    }

    function isSlotPublished(date, shift) {
        return availableSlots.some(s => s.booking_date === date && s.shift === shift)
    }

    async function handleBook(date, shift) {
        if (!isEligible) {
            toast.error('No cumples los requisitos mínimos para agendar turnos.')
            return
        }
        const existing = getBookingForSlot(date, shift)
        if (existing) {
            toast.error('Este turno ya está reservado.')
            return
        }

        // Don't allow past dates
        const today = new Date().toISOString().split('T')[0]
        if (date < today) {
            toast.error('No puedes agendar turnos en fechas pasadas.')
            return
        }

        setSubmitting(true)
        const { data, error } = await supabase.from('shift_bookings').insert({
            agent_id: profile.id,
            booking_date: date,
            shift,
            status: 'pendiente',
        }).select().single()

        if (error) {
            if (error.code === '23505') {
                toast.error('Este turno ya fue reservado por otro agente.')
            } else {
                toast.error('Error al agendar turno: ' + error.message)
            }
            setSubmitting(false)
            return
        }

        // Notification
        sendShiftNotification(SHIFT_EVENTS.SHIFT_REQUESTED, data, profile)

        toast.success('¡Turno solicitado! Pendiente de aprobación.')
        await fetchBookings()
        setSubmitting(false)
    }

    async function handleCancel(booking) {
        setCancelBooking(booking)
        setShowCancelDialog(true)
    }

    async function confirmCancel() {
        const booking = cancelBooking
        setShowCancelDialog(false)
        setCancelBooking(null)
        const { error } = await supabase.from('shift_bookings').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', booking.id)
        if (error) {
            toast.error('Error al cancelar: ' + error.message)
            return
        }
        sendShiftNotification(SHIFT_EVENTS.SHIFT_CANCELLED, booking, profile)
        toast.success('Turno cancelado.')
        await fetchBookings()
    }

    const isPast = (date) => date < new Date().toISOString().split('T')[0]

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/new-request')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Shield className="w-6 h-6 text-orange-500" />
                            Turnos / Guardias
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">Agenda tu turno en la oficina para recibir leads</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowConditions(!showConditions)} className="gap-1.5">
                    <Info className="w-4 h-4" />
                    {showConditions ? 'Ocultar' : 'Ver'} Requisitos
                </Button>
            </div>

            {/* Eligibility Status */}
            {eligibility.checked && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    {isEligible ? (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Cumples los requisitos — {eligibility.captaciones} captaciones y {eligibility.cierres} cierre(s) de negocio registrados.
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium">
                            <Ban className="w-4 h-4" />
                            No cumples los requisitos mínimos — Necesitas al menos 2 captaciones (tienes {eligibility.captaciones}) y 1 cierre de negocio (tienes {eligibility.cierres}).
                        </div>
                    )}
                </motion.div>
            )}

            {/* Conditions Panel */}
            <AnimatePresence>
                {showConditions && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                            <CardContent className="p-5">
                                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-orange-500" />
                                    Condiciones para postular a turnos
                                </h3>
                                <ul className="space-y-2">
                                    {CONDITIONS.map((c, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                            <span className="mt-0.5 w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                                            {c}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Week Navigation */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o - 1)}>
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-center">
                    <span className="font-semibold text-slate-900 dark:text-white">{weekRangeLabel}</span>
                    {weekOffset !== 0 && (
                        <Button variant="link" size="sm" className="ml-2 text-xs" onClick={() => setWeekOffset(0)}>
                            Hoy
                        </Button>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o + 1)}>
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </div>

            {/* Calendar Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                </div>
            ) : (
                <div className="grid grid-cols-5 gap-3">
                    {weekDates.map((date, di) => {
                        const past = isPast(date)
                        const isToday = date === new Date().toISOString().split('T')[0]
                        return (
                            <div key={date} className={cn(
                                "rounded-xl border transition-all",
                                isToday ? "border-primary shadow-lg shadow-primary/10" : "border-slate-200 dark:border-slate-800",
                                past && "opacity-60"
                            )}>
                                {/* Day Header */}
                                <div className={cn(
                                    "px-3 py-2 text-center border-b rounded-t-xl",
                                    isToday ? "bg-primary/10 border-primary/20" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                )}>
                                    <div className="text-xs font-bold text-slate-400 uppercase">{DAY_NAMES[di]}</div>
                                    <div className={cn(
                                        "text-lg font-bold",
                                        isToday ? "text-primary" : "text-slate-900 dark:text-white"
                                    )}>
                                        {new Date(date + 'T12:00:00').getDate()}
                                    </div>
                                </div>

                                {/* Slots */}
                                <div className="p-2 space-y-2 bg-white dark:bg-slate-950 rounded-b-xl">
                                    {[1, 2].map(shift => {
                                        const booking = getBookingForSlot(date, shift)
                                        const cfg = SHIFT_CONFIG[shift]
                                        const isMine = booking?.agent_id === profile?.id

                                        if (booking) {
                                            const st = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pendiente
                                            const agentName = booking.agent
                                                ? `${booking.agent.first_name || ''} ${booking.agent.last_name || ''}`.trim()
                                                : agents[booking.agent_id] || 'Agente'

                                            return (
                                                <div key={shift} className={cn(
                                                    "rounded-lg p-2.5 border text-xs transition-all",
                                                    st.color
                                                )}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold">{cfg.label}</span>
                                                        <st.icon className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="text-[10px] opacity-75">{cfg.time}</div>
                                                    <div className="mt-1.5 font-semibold truncate">{agentName}</div>
                                                    {isMine && booking.status !== 'cancelado' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full mt-1.5 h-6 text-[10px] hover:bg-red-100 hover:text-red-600"
                                                            onClick={() => handleCancel(booking)}
                                                        >
                                                            <X className="w-3 h-3 mr-1" /> Cancelar
                                                        </Button>
                                                    )}
                                                </div>
                                            )
                                        }

                                        // Check if slot is published
                                        const published = isSlotPublished(date, shift)
                                        const canBook = published && !past && isEligible && !submitting

                                        return (
                                            <button
                                                key={shift}
                                                disabled={!canBook}
                                                onClick={() => canBook && handleBook(date, shift)}
                                                className={cn(
                                                    "w-full rounded-lg p-2.5 border-2 border-dashed text-xs transition-all",
                                                    !published
                                                        ? "border-slate-200 dark:border-slate-800 text-slate-300 cursor-not-allowed opacity-50"
                                                        : canBook
                                                            ? "border-emerald-300 dark:border-emerald-700 text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 cursor-pointer"
                                                            : "border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed"
                                                )}
                                            >
                                                <div className="font-bold">{cfg.label}</div>
                                                <div className="text-[10px] opacity-75">{cfg.time}</div>
                                                <div className={cn(
                                                    "mt-1.5 font-semibold",
                                                    !published ? "text-slate-300" : canBook ? "text-emerald-600" : ""
                                                )}>
                                                    {!published ? 'No disponible' : past ? '—' : 'Disponible'}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* My Upcoming Bookings */}
            {myBookings.length > 0 && (
                <Card>
                    <CardContent className="p-5">
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            Mis Próximos Turnos
                        </h3>
                        <div className="space-y-2">
                            {myBookings.map(b => {
                                const cfg = SHIFT_CONFIG[b.shift]
                                const st = STATUS_CONFIG[b.status] || STATUS_CONFIG.pendiente
                                const dateLabel = new Date(b.booking_date + 'T12:00:00').toLocaleDateString('es-CL', {
                                    weekday: 'long', day: 'numeric', month: 'long'
                                })
                                return (
                                    <div key={b.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold", cfg.color)}>
                                                T{b.shift}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm text-slate-900 dark:text-white capitalize">{dateLabel}</div>
                                                <div className="text-xs text-slate-500">{cfg.time}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", st.color)}>
                                                {st.label}
                                            </span>
                                            {b.status !== 'cancelado' && b.status !== 'rechazado' && (
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:bg-red-50" onClick={() => handleCancel(b)}>
                                                    <X className="w-3 h-3 mr-1" /> Cancelar
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Cancel Confirmation Dialog */}
            <AlertDialog open={showCancelDialog} onOpenChange={(open) => { if (!open) { setShowCancelDialog(false); setCancelBooking(null) } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <X className="w-5 h-5 text-red-500" />
                            Cancelar Turno
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            {cancelBooking && (
                                <>
                                    ¿Estás seguro de cancelar tu turno del <strong>{new Date(cancelBooking.booking_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> ({SHIFT_CONFIG[cancelBooking.shift]?.time})?
                                    <br /><br />
                                    Esta acción no se puede deshacer.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Volver</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmCancel}>
                            <X className="w-4 h-4 mr-1" /> Sí, Cancelar Turno
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
