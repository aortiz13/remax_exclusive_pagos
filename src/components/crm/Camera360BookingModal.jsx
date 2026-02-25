import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { Button, Card, CardContent, Label } from '@/components/ui'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    X, Camera, ChevronLeft, ChevronRight, Clock, CalendarDays,
    CheckCircle2, XCircle, AlertCircle, Loader2, Info, Zap, AlertTriangle, Wrench
} from 'lucide-react'
import { format, addDays, startOfWeek, isToday, isBefore, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { sendCameraNotification, CAMERA_EVENTS } from '../../services/cameraNotifications'
import { deleteCameraCalendarEvents } from '../../services/cameraCalendarSync'

const TIME_SLOTS = []
for (let h = 8; h <= 20; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 20) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

const STATUS_CONFIG = {
    pendiente: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle, label: 'Pendiente' },
    aprobada: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Aprobada' },
    rechazada: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Rechazada' },
    completada: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2, label: 'Completada' },
    cancelada: { color: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle, label: 'Cancelada' },
    lista_espera: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Clock, label: 'Lista de Espera' },
}

const MAX_BOOKING_HOURS = 24

export default function Camera360BookingModal({ open, onClose, propertyAddress, mandateId }) {
    const { user, profile } = useAuth()
    const [bookings, setBookings] = useState([])
    const [agents, setAgents] = useState({})
    const [cameraUnits, setCameraUnits] = useState([])
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [weekOffset, setWeekOffset] = useState(0)
    const [selectedCamera, setSelectedCamera] = useState(1)
    const [myBookings, setMyBookings] = useState([])
    const [showCancelConfirm, setShowCancelConfirm] = useState(null)
    const [showWaitlistConfirm, setShowWaitlistConfirm] = useState(null)
    const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)

    const [form, setForm] = useState({
        booking_date: '',
        return_date: '', // defaults to booking_date if empty (same-day)
        start_time: '09:00',
        end_time: '11:00',
        notes: '',
        is_urgent: false,
    })

    const weekStart = useMemo(() => {
        const today = new Date()
        return addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7)
    }, [weekOffset])
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

    useEffect(() => {
        if (!open) return
        fetchBookings()
        fetchMyBookings()
        fetchCameraUnits()
    }, [open, weekOffset])

    const fetchCameraUnits = async () => {
        const { data } = await supabase.from('camera_units').select('*')
        setCameraUnits(data || [])
    }

    const fetchBookings = async () => {
        setLoading(true)
        try {
            const from = format(weekDays[0], 'yyyy-MM-dd')
            const to = format(weekDays[6], 'yyyy-MM-dd')
            const { data, error } = await supabase
                .from('camera_bookings').select('*')
                .gte('booking_date', from).lte('booking_date', to)
                .not('status', 'in', '("cancelada","rechazada")')
            if (error) throw error
            setBookings(data || [])
            const agentIds = [...new Set((data || []).map(b => b.agent_id))]
            if (agentIds.length > 0) {
                const { data: profiles } = await supabase.from('profiles')
                    .select('id, first_name, last_name').in('id', agentIds)
                const map = {}
                    ; (profiles || []).forEach(p => { map[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() })
                setAgents(map)
            }
        } catch (err) { console.error('Error fetching bookings:', err) }
        finally { setLoading(false) }
    }

    const fetchMyBookings = async () => {
        if (!user) return
        const { data } = await supabase.from('camera_bookings').select('*')
            .eq('agent_id', user.id).not('status', 'in', '("cancelada","rechazada")')
            .order('booking_date', { ascending: false }).limit(10)
        setMyBookings(data || [])
    }

    const getBookingsForDayCamera = (date, camera) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        // A booking occupies a day if: booking_date <= day <= return_date
        return bookings.filter(b => {
            const bReturnDate = b.return_date || b.booking_date
            return b.camera_unit === camera && b.booking_date <= dateStr && bReturnDate >= dateStr
        })
    }

    // Check if a new booking conflicts with existing ones (multi-day aware)
    const hasConflict = (startDate, returnDate, startTime, endTime, camera) => {
        const sDate = typeof startDate === 'string' ? startDate : format(startDate, 'yyyy-MM-dd')
        const rDate = returnDate || sDate
        return bookings.some(b => {
            if (b.camera_unit !== camera) return false
            const bReturn = b.return_date || b.booking_date
            // Date ranges overlap?
            if (sDate > bReturn || rDate < b.booking_date) return false
            // If same single day, check time overlap
            if (sDate === rDate && b.booking_date === bReturn && sDate === b.booking_date) {
                return startTime < b.end_time && endTime > b.start_time
            }
            // Multi-day ranges overlap — always conflict
            return true
        })
    }

    const getConflictingBookings = (startDate, returnDate, startTime, endTime, camera) => {
        const sDate = typeof startDate === 'string' ? startDate : format(startDate, 'yyyy-MM-dd')
        const rDate = returnDate || sDate
        return bookings.filter(b => {
            if (b.camera_unit !== camera) return false
            const bReturn = b.return_date || b.booking_date
            if (sDate > bReturn || rDate < b.booking_date) return false
            if (sDate === rDate && b.booking_date === bReturn && sDate === b.booking_date) {
                return startTime < b.end_time && endTime > b.start_time
            }
            return true
        })
    }

    // Count waitlist entries for a specific time range on a camera
    const getWaitlistCount = (startDate, returnDate, startTime, endTime, camera) => {
        const sDate = typeof startDate === 'string' ? startDate : format(startDate, 'yyyy-MM-dd')
        const rDate = returnDate || sDate
        return bookings.filter(b => {
            if (b.camera_unit !== camera || b.status !== 'lista_espera') return false
            const bReturn = b.return_date || b.booking_date
            if (sDate > bReturn || rDate < b.booking_date) return false
            if (sDate === rDate && b.booking_date === bReturn && sDate === b.booking_date) {
                return startTime < b.end_time && endTime > b.start_time
            }
            return true
        }).length
    }

    // Validate duration — allow multi-day but still enforce max total hours
    const effectiveReturnDate = form.return_date || form.booking_date

    const validateDuration = () => {
        if (!form.booking_date) return false
        const startDT = new Date(`${form.booking_date}T${form.start_time}`)
        const endDT = new Date(`${effectiveReturnDate}T${form.end_time}`)
        const diffMs = endDT - startDT
        if (diffMs <= 0) return false
        // No max hour limit for multi-day — the camera is needed across days
        return true
    }

    const selectDay = (date) => {
        if (isBefore(date, new Date()) && !isToday(date)) return
        const dateStr = format(date, 'yyyy-MM-dd')
        setForm(prev => ({ ...prev, booking_date: dateStr, return_date: dateStr }))
    }

    // Check if agent has unreturned camera
    const hasUnreturnedCamera = myBookings.some(b =>
        b.status === 'aprobada' && b.pickup_confirmed_at && !b.return_confirmed_at
    )

    // Camera unit status
    const getCameraUnitStatus = (unitId) => cameraUnits.find(u => u.id === unitId)

    const handleSubmit = async () => {
        if (!form.booking_date || !form.start_time || !form.end_time) {
            toast.error('Selecciona fecha y horario'); return
        }
        if (!validateDuration()) {
            toast.error('La hora de devolución debe ser posterior a la hora de retiro'); return
        }
        // Same-day validation: start must be before end
        if (form.booking_date === effectiveReturnDate && form.start_time >= form.end_time) {
            toast.error('La hora de retiro debe ser anterior a la hora de devolución'); return
        }
        const unitStatus = getCameraUnitStatus(selectedCamera)
        if (unitStatus?.status === 'mantenimiento') {
            toast.error(`Cámara ${selectedCamera} está en mantenimiento`); return
        }
        if (hasUnreturnedCamera && !form.is_urgent) {
            toast.error('Tienes una cámara sin devolver. Devuélvela antes de solicitar otra.'); return
        }
        const selectedDate = parseISO(form.booking_date)
        if (hasConflict(form.booking_date, effectiveReturnDate, form.start_time, form.end_time, selectedCamera)) {
            // Check if waitlist is still available (max 1 per slot)
            const waitlistCount = getWaitlistCount(form.booking_date, effectiveReturnDate, form.start_time, form.end_time, selectedCamera)
            if (waitlistCount >= 1) {
                toast.error('Ya hay un agente en lista de espera para este horario. No se pueden agregar más.'); return
            }
            // Show waitlist confirmation instead of blocking
            const conflicting = getConflictingBookings(form.booking_date, effectiveReturnDate, form.start_time, form.end_time, selectedCamera)
            setShowWaitlistConfirm({ conflicting, date: selectedDate })
            return
        }

        setSubmitting(true)
        try {
            const { data, error } = await supabase.from('camera_bookings').insert({
                camera_unit: selectedCamera,
                agent_id: user.id,
                property_address: propertyAddress || 'Sin dirección',
                booking_date: form.booking_date,
                return_date: effectiveReturnDate,
                start_time: form.start_time,
                end_time: form.end_time,
                notes: form.notes,
                mandate_id: mandateId || null,
                status: 'pendiente',
                is_urgent: form.is_urgent,
            }).select().single()

            if (error) throw error

            // Send notification to n8n
            sendCameraNotification(
                form.is_urgent ? CAMERA_EVENTS.URGENT_REQUEST : CAMERA_EVENTS.BOOKING_REQUESTED,
                data, profile
            )

            toast.success(form.is_urgent
                ? '🚨 Solicitud URGENTE enviada. Se notificará inmediatamente al comercial.'
                : 'Solicitud de cámara enviada. Recibirás confirmación pronto.'
            )
            setForm({ booking_date: '', return_date: '', start_time: '09:00', end_time: '11:00', notes: '', is_urgent: false })
            fetchBookings()
            fetchMyBookings()
        } catch (err) {
            console.error('Error creating booking:', err)
            toast.error('Error al enviar la solicitud')
        } finally { setSubmitting(false) }
    }

    const handleCancel = async (booking) => {
        const now = new Date()
        const bookingReturnDate = booking.return_date || booking.booking_date
        const bookingStart = new Date(`${bookingReturnDate}T${booking.end_time}`) // late cancel based on return time
        const hoursUntilStart = (bookingStart - now) / (1000 * 60 * 60)
        const isLate = hoursUntilStart < 12

        try {
            const { error } = await supabase.from('camera_bookings')
                .update({
                    status: 'cancelada',
                    cancelled_at: now.toISOString(),
                    is_late_cancellation: isLate,
                    updated_at: now.toISOString()
                })
                .eq('id', booking.id).eq('agent_id', user.id)
            if (error) throw error

            // Remove calendar events if they existed
            if (booking.crm_task_id_agent || booking.crm_task_id_comercial) {
                deleteCameraCalendarEvents(booking, booking.agent_id, user.id)
            }

            sendCameraNotification(CAMERA_EVENTS.BOOKING_CANCELLED, booking, profile)

            toast.success(isLate
                ? '⚠️ Reserva cancelada. Nota: cancelación tardía (<12h) registrada.'
                : 'Reserva cancelada')
            setShowCancelConfirm(null)
            fetchBookings()
            fetchMyBookings()
        } catch (err) { toast.error('Error al cancelar') }
    }

    const handleWaitlistSubmit = async () => {
        setWaitlistSubmitting(true)
        try {
            const conflicting = showWaitlistConfirm.conflicting[0]
            const { data, error } = await supabase.from('camera_bookings').insert({
                camera_unit: selectedCamera,
                agent_id: user.id,
                property_address: propertyAddress || 'Sin dirección',
                booking_date: form.booking_date,
                return_date: effectiveReturnDate,
                start_time: form.start_time,
                end_time: form.end_time,
                notes: form.notes,
                mandate_id: mandateId || null,
                status: 'lista_espera',
                is_urgent: form.is_urgent,
                waitlist_for: conflicting.id,
            }).select().single()

            if (error) throw error

            // Notify group + agent about the waitlist pre-reserve
            sendCameraNotification(
                CAMERA_EVENTS.WAITLIST_REQUESTED,
                data,
                profile,
                `Pre-reserva en lista de espera. Horario actual ocupado por ${agents[conflicting.agent_id] || 'otro agente'} (${conflicting.start_time?.slice(0, 5)}—${conflicting.end_time?.slice(0, 5)})`,
                { original_booking: { agent_name: agents[conflicting.agent_id], start_time: conflicting.start_time?.slice(0, 5), end_time: conflicting.end_time?.slice(0, 5) } }
            )

            toast.success('📋 Pre-reserva registrada. Serás notificado si el horario se libera.')
            setShowWaitlistConfirm(null)
            setForm({ booking_date: '', return_date: '', start_time: '09:00', end_time: '11:00', notes: '', is_urgent: false })
            fetchBookings()
            fetchMyBookings()
        } catch (err) {
            console.error('Error creating waitlist booking:', err)
            toast.error('Error al registrar la pre-reserva')
        } finally { setWaitlistSubmitting(false) }
    }

    if (!open) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100]">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
                <div className="absolute inset-0 flex items-center justify-center p-4" style={{ left: 'var(--sidebar-width, 0px)' }}>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <Camera className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Reservar Cámara 360°</h2>
                                    <p className="text-sm text-slate-500">{propertyAddress || 'Selecciona un horario disponible'}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Unreturned camera warning */}
                            {hasUnreturnedCamera && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-red-700">Tienes una cámara sin devolver</p>
                                        <p className="text-xs text-red-600">Confirma la devolución antes de solicitar otra reserva.</p>
                                    </div>
                                </div>
                            )}

                            {/* Camera Unit Selector */}
                            <div className="flex gap-3">
                                {[1, 2].map(unit => {
                                    const unitStatus = getCameraUnitStatus(unit)
                                    const isMaintenance = unitStatus?.status === 'mantenimiento'
                                    return (
                                        <button
                                            key={unit}
                                            onClick={() => !isMaintenance && setSelectedCamera(unit)}
                                            disabled={isMaintenance}
                                            className={cn(
                                                "flex-1 p-4 rounded-xl border-2 transition-all duration-200 text-center relative",
                                                isMaintenance && "opacity-50 cursor-not-allowed",
                                                selectedCamera === unit && !isMaintenance
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/10"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                            )}
                                        >
                                            {isMaintenance && (
                                                <div className="absolute top-2 right-2">
                                                    <Wrench className="w-4 h-4 text-amber-500" />
                                                </div>
                                            )}
                                            <Camera className={cn("w-6 h-6 mx-auto mb-2", selectedCamera === unit ? "text-blue-600" : "text-slate-400")} />
                                            <p className={cn("font-bold text-sm", selectedCamera === unit ? "text-blue-700 dark:text-blue-400" : "text-slate-600 dark:text-slate-400")}>
                                                Cámara {unit}
                                            </p>
                                            {isMaintenance && (
                                                <span className="text-[10px] text-amber-600 font-bold">En mantenimiento</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Week Navigation */}
                            <div className="flex items-center justify-between">
                                <button onClick={() => setWeekOffset(p => p - 1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {format(weekDays[0], "d MMM", { locale: es })} — {format(weekDays[6], "d MMM yyyy", { locale: es })}
                                    </p>
                                    {weekOffset !== 0 && (
                                        <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-600 hover:underline mt-1">Volver a hoy</button>
                                    )}
                                </div>
                                <button onClick={() => setWeekOffset(p => p + 1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="w-5 h-5" /></button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-2">
                                {weekDays.map((day) => {
                                    const dateStr = format(day, 'yyyy-MM-dd')
                                    const dayBookings = getBookingsForDayCamera(day, selectedCamera)
                                    const isPast = isBefore(day, new Date()) && !isToday(day)
                                    const isSelected = form.booking_date === dateStr
                                    return (
                                        <button key={dateStr} onClick={() => !isPast && selectDay(day)} disabled={isPast}
                                            className={cn(
                                                "p-3 rounded-xl border-2 transition-all duration-200 text-center min-h-[100px] flex flex-col",
                                                isPast && "opacity-40 cursor-not-allowed border-slate-100",
                                                isSelected && "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md",
                                                !isSelected && !isPast && "border-slate-100 dark:border-slate-800 hover:border-blue-300 cursor-pointer",
                                                isToday(day) && !isSelected && "border-amber-300 bg-amber-50/30"
                                            )}>
                                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{format(day, 'EEE', { locale: es })}</span>
                                            <span className={cn("text-lg font-bold mt-1", isToday(day) ? "text-amber-600" : isSelected ? "text-blue-600" : "text-slate-700 dark:text-slate-300")}>{format(day, 'd')}</span>
                                            {dayBookings.length > 0 && (
                                                <div className="mt-auto pt-2 space-y-1">
                                                    {dayBookings.map(b => (
                                                        <div key={b.id} className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-md border", STATUS_CONFIG[b.status]?.color || 'bg-slate-100')}>
                                                            {b.start_time?.slice(0, 5)}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Booking Form */}
                            <AnimatePresence>
                                {form.booking_date && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10">
                                            <CardContent className="pt-6 space-y-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CalendarDays className="w-5 h-5 text-blue-600" />
                                                    <h3 className="font-bold text-slate-900 dark:text-white">
                                                        Reservar para {format(parseISO(form.booking_date), "EEEE d 'de' MMMM", { locale: es })}
                                                    </h3>
                                                    <span className="ml-auto text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Cámara {selectedCamera}</span>
                                                </div>

                                                {/* Existing bookings warning */}
                                                {getBookingsForDayCamera(parseISO(form.booking_date), selectedCamera).length > 0 && (
                                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                                        <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Horarios ya reservados:</p>
                                                        {getBookingsForDayCamera(parseISO(form.booking_date), selectedCamera).map(b => (
                                                            <div key={b.id} className="text-xs text-amber-600 flex items-center gap-2">
                                                                <Clock className="w-3 h-3" />
                                                                <span>{b.start_time?.slice(0, 5)} — {b.end_time?.slice(0, 5)}</span>
                                                                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border", STATUS_CONFIG[b.status]?.color)}>{STATUS_CONFIG[b.status]?.label}</span>
                                                                <span className="text-slate-400">({agents[b.agent_id] || 'Agente'})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-slate-600">Hora Retiro <span className="text-red-500">*</span></Label>
                                                        <select className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:ring-2 focus:ring-blue-500"
                                                            value={form.start_time} onChange={(e) => setForm(p => ({ ...p, start_time: e.target.value }))}>
                                                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-slate-600">Fecha Devolución</Label>
                                                        <input type="date" className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:ring-2 focus:ring-blue-500"
                                                            value={form.return_date || form.booking_date}
                                                            min={form.booking_date}
                                                            onChange={(e) => setForm(p => ({ ...p, return_date: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div />
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-slate-600">Hora Devolución <span className="text-red-500">*</span></Label>
                                                        <select className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:ring-2 focus:ring-blue-500"
                                                            value={form.end_time} onChange={(e) => setForm(p => ({ ...p, end_time: e.target.value }))}>
                                                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Multi-day indicator */}
                                                {effectiveReturnDate !== form.booking_date && (
                                                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                                                        <CalendarDays className="w-4 h-4 text-blue-600" />
                                                        <p className="text-xs text-blue-700 font-medium">
                                                            📅 Reserva de múltiples días: {format(parseISO(form.booking_date), "EEE d MMM", { locale: es })} {form.start_time} → {format(parseISO(effectiveReturnDate), "EEE d MMM", { locale: es })} {form.end_time}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Max 24h note */}
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Tiempo máximo: {MAX_BOOKING_HOURS} horas hábiles. Uso habitual: 12 a 24 horas.
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold text-slate-600">Notas (opcional)</Label>
                                                    <textarea className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500"
                                                        rows={2} placeholder="Ej: Necesito la cámara viernes para devolver el lunes..."
                                                        value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
                                                </div>

                                                {/* Urgent toggle */}
                                                <button
                                                    type="button"
                                                    onClick={() => setForm(p => ({ ...p, is_urgent: !p.is_urgent }))}
                                                    className={cn(
                                                        "w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all",
                                                        form.is_urgent
                                                            ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                                                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                                    )}
                                                >
                                                    <Zap className={cn("w-5 h-5", form.is_urgent ? "text-red-600" : "text-slate-400")} />
                                                    <div className="text-left">
                                                        <p className={cn("text-sm font-bold", form.is_urgent ? "text-red-700" : "text-slate-600")}>
                                                            🚨 Solicitud Urgente
                                                        </p>
                                                        <p className="text-xs text-slate-500">Notificación inmediata al comercial vía WhatsApp</p>
                                                    </div>
                                                    <div className={cn("ml-auto w-10 h-6 rounded-full transition-colors relative", form.is_urgent ? "bg-red-500" : "bg-slate-300")}>
                                                        <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", form.is_urgent ? "translate-x-4" : "translate-x-0.5")} />
                                                    </div>
                                                </button>

                                                <Button onClick={handleSubmit} disabled={submitting}
                                                    className={cn("w-full h-11 text-white font-bold rounded-xl shadow-lg",
                                                        form.is_urgent ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20")}>
                                                    {submitting ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</>) : (
                                                        <>{form.is_urgent ? <Zap className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                                                            {form.is_urgent ? 'Solicitar URGENTE' : `Solicitar Cámara ${selectedCamera}`}</>
                                                    )}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* My Bookings */}
                            {myBookings.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4" /> Mis Reservas
                                    </h3>
                                    <div className="space-y-2">
                                        {myBookings.map(b => {
                                            const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pendiente
                                            const StatusIcon = cfg.icon
                                            return (
                                                <div key={b.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                    <div className={cn("p-1.5 rounded-lg border", cfg.color)}>
                                                        <StatusIcon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                                            Cámara {b.camera_unit} — {format(parseISO(b.booking_date), "d MMM yyyy", { locale: es })}{b.return_date && b.return_date !== b.booking_date ? ` → ${format(parseISO(b.return_date), "d MMM", { locale: es })}` : ''}
                                                            {b.is_urgent && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">URGENTE</span>}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {b.start_time?.slice(0, 5)} — {b.end_time?.slice(0, 5)} · {b.property_address}
                                                        </p>
                                                        {b.admin_notes && <p className="text-xs text-slate-400 mt-1 italic">📝 {b.admin_notes}</p>}
                                                        {b.pickup_confirmed_at && !b.return_confirmed_at && (
                                                            <p className="text-xs text-emerald-600 mt-1 font-semibold">✅ Retiro confirmado — pendiente devolución</p>
                                                        )}
                                                        {b.return_confirmed_at && (
                                                            <p className="text-xs text-blue-600 mt-1 font-semibold">✅ Devuelta</p>
                                                        )}
                                                    </div>
                                                    <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border", cfg.color)}>{cfg.label}</span>
                                                    {b.status === 'pendiente' && (
                                                        <button onClick={() => setShowCancelConfirm(b)}
                                                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Cancelar reserva">
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Cancel Confirmation */}
                    {showCancelConfirm && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/30" onClick={() => setShowCancelConfirm(null)} />
                            <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                                {(() => {
                                    const now = new Date()
                                    const bookingStart = new Date(`${showCancelConfirm.booking_date}T${showCancelConfirm.start_time}`)
                                    const hoursUntil = (bookingStart - now) / (1000 * 60 * 60)
                                    const isLate = hoursUntil < 12
                                    return (
                                        <>
                                            <h3 className="text-lg font-bold mb-3">¿Cancelar reserva?</h3>
                                            {isLate && (
                                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                                                    <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> Cancelación tardía
                                                    </p>
                                                    <p className="text-xs text-amber-600 mt-1">
                                                        Faltan menos de 12 horas. Esta cancelación quedará registrada.
                                                    </p>
                                                </div>
                                            )}
                                            <div className="flex gap-3 mt-4">
                                                <Button variant="outline" className="flex-1" onClick={() => setShowCancelConfirm(null)}>No</Button>
                                                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleCancel(showCancelConfirm)}>
                                                    Sí, cancelar
                                                </Button>
                                            </div>
                                        </>
                                    )
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Waitlist Confirmation Modal */}
                    {showWaitlistConfirm && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/30" onClick={() => setShowWaitlistConfirm(null)} />
                            <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                        <Clock className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Horario Ocupado</h3>
                                </div>

                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
                                    <p className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1">
                                        <AlertTriangle className="w-4 h-4" /> Este horario ya está reservado:
                                    </p>
                                    {showWaitlistConfirm.conflicting.map(b => (
                                        <div key={b.id} className="text-sm text-amber-600 flex items-center gap-2 mt-1">
                                            <Camera className="w-3.5 h-3.5" />
                                            <span className="font-semibold">{b.start_time?.slice(0, 5)} — {b.end_time?.slice(0, 5)}</span>
                                            <span>·</span>
                                            <span>{agents[b.agent_id] || 'Otro agente'}</span>
                                            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border", STATUS_CONFIG[b.status]?.color)}>
                                                {STATUS_CONFIG[b.status]?.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl mb-4">
                                    <p className="text-sm text-purple-700 dark:text-purple-300">
                                        <strong>¿Pre-reservar?</strong> Tu solicitud quedará en <strong>lista de espera</strong>.
                                        Se notificará al equipo comercial y al agente actual. Si el horario se libera, serás notificado automáticamente.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => setShowWaitlistConfirm(null)}>Cancelar</Button>
                                    <Button
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                        onClick={handleWaitlistSubmit}
                                        disabled={waitlistSubmitting}
                                    >
                                        {waitlistSubmitting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</>
                                        ) : (
                                            <><Clock className="w-4 h-4 mr-2" /> Pre-Reservar</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AnimatePresence>
    )
}
