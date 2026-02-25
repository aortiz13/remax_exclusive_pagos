import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { Button, Card, CardContent, Label } from '@/components/ui'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Camera, CheckCircle2, UploadCloud, Battery, ShieldCheck,
    AlertTriangle, Package, RotateCcw, X, Loader2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { sendCameraNotification, CAMERA_EVENTS } from '../../services/cameraNotifications'

const CONDITION_ITEMS = [
    { key: 'battery', label: 'Batería cargada (>50%)', icon: Battery },
    { key: 'physical', label: 'Sin daño físico visible', icon: ShieldCheck },
    { key: 'accessories', label: 'Trípode y funda incluidos', icon: Package },
    { key: 'memory', label: 'Tarjeta SD presente', icon: UploadCloud },
]

export default function CameraAgentActions() {
    const { user, profile } = useAuth()
    const [activeBookings, setActiveBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionModal, setActionModal] = useState(null) // { booking, type: 'pickup'|'return' }
    const [condition, setCondition] = useState({})
    const [conditionNotes, setConditionNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!user) return
        fetchActiveBookings()
        // Poll every 2 minutes for updates
        const interval = setInterval(fetchActiveBookings, 120000)
        return () => clearInterval(interval)
    }, [user])

    const fetchActiveBookings = async () => {
        if (!user) return
        try {
            const { data, error } = await supabase
                .from('camera_bookings')
                .select('*')
                .eq('agent_id', user.id)
                .eq('status', 'aprobada')
                .order('booking_date')
            if (error) throw error
            setActiveBookings(data || [])
        } catch (err) {
            console.error('Error fetching active bookings:', err)
        } finally { setLoading(false) }
    }

    const needsPickup = (b) => !b.pickup_confirmed_at
    const needsReturn = (b) => b.pickup_confirmed_at && !b.return_confirmed_at

    const handlePickupConfirm = async () => {
        if (!actionModal) return
        const checkedItems = CONDITION_ITEMS.filter(i => condition[i.key])
        if (checkedItems.length < CONDITION_ITEMS.length) {
            toast.error('Verifica todos los ítems del checklist antes de confirmar')
            return
        }
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase.from('camera_bookings')
                .update({
                    pickup_confirmed_at: now,
                    pickup_condition: { ...condition, notes: conditionNotes, confirmed_at: now },
                    updated_at: now,
                })
                .eq('id', actionModal.booking.id)

            if (error) throw error

            // Update camera unit status
            await supabase.from('camera_units')
                .update({
                    status: 'en_uso',
                    current_booking_id: actionModal.booking.id,
                    updated_at: now,
                })
                .eq('id', actionModal.booking.camera_unit)

            sendCameraNotification(CAMERA_EVENTS.PICKUP_CONFIRMED, actionModal.booking, profile)
            toast.success('✅ Retiro confirmado. Recuerda devolver la cámara a tiempo.')
            setActionModal(null)
            setCondition({})
            setConditionNotes('')
            fetchActiveBookings()
        } catch (err) {
            console.error('Error confirming pickup:', err)
            toast.error('Error al confirmar retiro')
        } finally { setSubmitting(false) }
    }

    const handleReturnConfirm = async (isEarly = false) => {
        if (!actionModal) return
        const checkedItems = CONDITION_ITEMS.filter(i => condition[i.key])
        if (checkedItems.length < CONDITION_ITEMS.length) {
            toast.error('Verifica todos los ítems del checklist antes de confirmar')
            return
        }
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase.from('camera_bookings')
                .update({
                    return_confirmed_at: now,
                    return_condition: { ...condition, notes: conditionNotes, confirmed_at: now, is_early: isEarly },
                    status: 'completada',
                    updated_at: now,
                })
                .eq('id', actionModal.booking.id)

            if (error) throw error

            // Free up camera unit
            await supabase.from('camera_units')
                .update({
                    status: 'disponible',
                    current_booking_id: null,
                    updated_at: now,
                })
                .eq('id', actionModal.booking.camera_unit)

            sendCameraNotification(
                isEarly ? CAMERA_EVENTS.EARLY_RETURN : CAMERA_EVENTS.RETURN_CONFIRMED,
                actionModal.booking,
                profile
            )
            toast.success(isEarly
                ? '✅ Devolución anticipada registrada. El horario ha sido liberado.'
                : '✅ Devolución confirmada. ¡Gracias!'
            )
            setActionModal(null)
            setCondition({})
            setConditionNotes('')
            fetchActiveBookings()
        } catch (err) {
            console.error('Error confirming return:', err)
            toast.error('Error al confirmar devolución')
        } finally { setSubmitting(false) }
    }

    if (loading || activeBookings.length === 0) return null

    return (
        <>
            {/* Floating widget at bottom-right */}
            <div className="fixed bottom-6 right-6 z-40 space-y-3" style={{ maxWidth: '380px' }}>
                {activeBookings.map(b => {
                    const isOverdue = needsReturn(b) && new Date() > new Date(`${b.booking_date}T${b.end_time}`)
                    return (
                        <motion.div
                            key={b.id}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={cn(
                                "p-4 rounded-2xl shadow-2xl border-2 backdrop-blur-sm",
                                isOverdue
                                    ? "bg-red-50/95 border-red-300 dark:bg-red-950/95"
                                    : "bg-white/95 border-blue-200 dark:bg-slate-900/95 dark:border-blue-800"
                            )}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className={cn("p-2 rounded-xl", isOverdue ? "bg-red-100" : "bg-blue-100")}>
                                    <Camera className={cn("w-5 h-5", isOverdue ? "text-red-600" : "text-blue-600")} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        Cámara {b.camera_unit}
                                        {isOverdue && <span className="ml-2 text-red-600 text-xs">⚠️ VENCIDA</span>}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {format(parseISO(b.booking_date), "d MMM", { locale: es })} · {b.start_time?.slice(0, 5)} — {b.end_time?.slice(0, 5)}
                                    </p>
                                </div>
                            </div>

                            {needsPickup(b) && (
                                <Button onClick={() => { setActionModal({ booking: b, type: 'pickup' }); setCondition({}) }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 text-sm font-bold">
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Retiro
                                </Button>
                            )}
                            {needsReturn(b) && (
                                <div className="flex gap-2">
                                    <Button onClick={() => { setActionModal({ booking: b, type: 'return' }); setCondition({}) }}
                                        className={cn("flex-1 text-white rounded-xl h-10 text-sm font-bold",
                                            isOverdue ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700")}>
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        {isOverdue ? 'Devolver (Urgente)' : 'Confirmar Devolución'}
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    )
                })}
            </div>

            {/* Condition Checklist Modal */}
            <AnimatePresence>
                {actionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActionModal(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {actionModal.type === 'pickup' ? (
                                        <><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Confirmar Retiro</>
                                    ) : (
                                        <><RotateCcw className="w-5 h-5 text-blue-600" /> Confirmar Devolución</>
                                    )}
                                </h3>
                                <button onClick={() => setActionModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                                    <X className="w-4 h-4 text-slate-500" />
                                </button>
                            </div>

                            <p className="text-sm text-slate-600 mb-4">
                                Cámara {actionModal.booking.camera_unit} — {format(parseISO(actionModal.booking.booking_date), "d MMM yyyy", { locale: es })}
                            </p>

                            <p className="text-xs font-bold text-slate-700 mb-3">Checklist de estado:</p>
                            <div className="space-y-2 mb-4">
                                {CONDITION_ITEMS.map(item => {
                                    const Icon = item.icon
                                    return (
                                        <button key={item.key} onClick={() => setCondition(p => ({ ...p, [item.key]: !p[item.key] }))}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                                                condition[item.key]
                                                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                            )}>
                                            <div className={cn("p-1.5 rounded-lg", condition[item.key] ? "bg-emerald-100" : "bg-slate-100")}>
                                                <Icon className={cn("w-4 h-4", condition[item.key] ? "text-emerald-600" : "text-slate-400")} />
                                            </div>
                                            <span className={cn("text-sm font-medium", condition[item.key] ? "text-emerald-700" : "text-slate-600")}>{item.label}</span>
                                            {condition[item.key] && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="space-y-2 mb-4">
                                <Label className="text-xs font-bold text-slate-600">Observaciones (opcional)</Label>
                                <textarea className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
                                    rows={2} placeholder="Algún detalle sobre el estado de la cámara..."
                                    value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} />
                            </div>

                            {actionModal.type === 'pickup' ? (
                                <Button onClick={handlePickupConfirm} disabled={submitting}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold">
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                    Confirmar Retiro
                                </Button>
                            ) : (
                                <div className="space-y-2">
                                    <Button onClick={() => handleReturnConfirm(false)} disabled={submitting}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 font-bold">
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                                        Confirmar Devolución
                                    </Button>
                                    {new Date() < new Date(`${actionModal.booking.booking_date}T${actionModal.booking.end_time}`) && (
                                        <Button onClick={() => handleReturnConfirm(true)} disabled={submitting}
                                            variant="outline"
                                            className="w-full rounded-xl h-10 text-sm border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                                            ⚡ Devolución Anticipada (libera horario)
                                        </Button>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}
