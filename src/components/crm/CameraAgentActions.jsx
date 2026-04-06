import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { Button, Card, CardContent, Label } from '@/components/ui'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Camera, CheckCircle2, RotateCcw, X, Loader2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { sendCameraNotification, CAMERA_EVENTS } from '../../services/cameraNotifications'
import { logActivity } from '../../services/activityService'


export default function CameraAgentActions() {
    const { user, profile } = useAuth()
    const [activeBookings, setActiveBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionModal, setActionModal] = useState(null) // { booking, type: 'pickup'|'return' }
    const [conditionNotes, setConditionNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [minimized, setMinimized] = useState(false)
    const [dismissedIds, setDismissedIds] = useState(new Set())

    useEffect(() => {
        if (!user || !profile) return
        fetchActiveBookings()
        // Poll every 2 minutes for updates
        const interval = setInterval(fetchActiveBookings, 120000)
        return () => clearInterval(interval)
    }, [user, profile])

    const fetchActiveBookings = async () => {
        if (!user || !profile) return
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
            // Silently handle — this is a non-critical floating widget
        } finally { setLoading(false) }
    }

    const needsPickup = (b) => !b.pickup_confirmed_at
    const needsReturn = (b) => b.pickup_confirmed_at && !b.return_confirmed_at

    const dismissCard = (id) => {
        setDismissedIds(prev => new Set([...prev, id]))
    }

    const handlePickupConfirm = async () => {
        if (!actionModal) return
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase.from('camera_bookings')
                .update({
                    pickup_confirmed_at: now,
                    pickup_condition: { notes: conditionNotes, confirmed_at: now },
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

            // Log pickup to timeline
            logActivity({
                action: 'Cámara 360°',
                entity_type: 'Propiedad',
                entity_id: null,
                description: `Retiro de cámara ${actionModal.booking.camera_unit} confirmado`,
                details: { camera_unit: actionModal.booking.camera_unit, address: actionModal.booking.property_address }
            }).catch(() => { })

            toast.success('✅ Retiro confirmado. Recuerda devolver la cámara a tiempo.')
            setActionModal(null)
            setConditionNotes('')
            fetchActiveBookings()
        } catch (err) {
            console.error('Error confirming pickup:', err)
            toast.error('Error al confirmar retiro')
        } finally { setSubmitting(false) }
    }

    const handleReturnConfirm = async (isEarly = false) => {
        if (!actionModal) return
        setSubmitting(true)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase.from('camera_bookings')
                .update({
                    return_confirmed_at: now,
                    return_condition: { notes: conditionNotes, confirmed_at: now, is_early: isEarly },
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

            // Log return to timeline
            logActivity({
                action: 'Cámara 360°',
                entity_type: 'Propiedad',
                entity_id: null,
                description: `Devolución de cámara ${actionModal.booking.camera_unit} confirmada${isEarly ? ' (anticipada)' : ''}`,
                details: { camera_unit: actionModal.booking.camera_unit, address: actionModal.booking.property_address, early: isEarly }
            }).catch(() => { })

            toast.success(isEarly
                ? '✅ Devolución anticipada registrada. El horario ha sido liberado.'
                : '✅ Devolución confirmada. ¡Gracias!'
            )
            setActionModal(null)
            setConditionNotes('')
            fetchActiveBookings()
        } catch (err) {
            console.error('Error confirming return:', err)
            toast.error('Error al confirmar devolución')
        } finally { setSubmitting(false) }
    }

    if (loading || activeBookings.length === 0) return null

    const todayStr = new Date().toISOString().split('T')[0]
    const activeRelevantBookings = activeBookings.filter(b => {
        if (needsPickup(b)) {
            // Solo mostrar retiros de hoy o futuro. Los del pasado sin confirmar son "stale"
            return b.booking_date >= todayStr
        }
        // Las devoluciones se muestran siempre hasta que se confirmen (porque el agente tiene la cámara)
        return needsReturn(b)
    })
    
    const visibleBookings = activeRelevantBookings.filter(b => !dismissedIds.has(b.id))

    return (
        <>
            {/* Minimized floating toggle button */}
            {minimized && visibleBookings.length > 0 && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setMinimized(false)}
                    className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl transition-colors"
                    title="Mostrar notificaciones de cámara"
                >
                    <Camera className="w-5 h-5" />
                    {visibleBookings.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {visibleBookings.length}
                        </span>
                    )}
                </motion.button>
            )}

            {/* Floating widget at bottom-right */}
            {!minimized && visibleBookings.length > 0 && (
                <div className="fixed bottom-6 right-6 z-40 space-y-3" style={{ maxWidth: '380px' }}>
                    {/* Minimize all button */}
                    <div className="flex justify-end gap-1">
                        <button onClick={() => setMinimized(true)}
                            className="text-xs text-slate-500 hover:text-slate-700 bg-white/90 rounded-full px-2 py-0.5 shadow border border-slate-200"
                            title="Minimizar todo">
                            Minimizar
                        </button>
                    </div>

                    {visibleBookings.map(b => {
                        const isOverdue = needsReturn(b) && new Date() > new Date(`${b.booking_date}T${b.end_time}`)
                        return (
                            <motion.div
                                key={b.id}
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                                className={cn(
                                    "p-4 rounded-2xl shadow-2xl border-2 backdrop-blur-sm relative",
                                    isOverdue
                                        ? "bg-red-50/95 border-red-300 dark:bg-red-950/95"
                                        : "bg-white/95 border-blue-200 dark:bg-slate-900/95 dark:border-blue-800"
                                )}
                            >
                                {/* Dismiss button */}
                                <button
                                    onClick={() => dismissCard(b.id)}
                                    className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Cerrar notificación"
                                >
                                    <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                                </button>

                                <div className="flex items-center gap-3 mb-3 pr-6">
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
                                    <Button onClick={() => { setActionModal({ booking: b, type: 'pickup' }) }}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 text-sm font-bold">
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Retiro
                                    </Button>
                                )}
                                {needsReturn(b) && (
                                    <div className="flex gap-2">
                                        <Button onClick={() => { setActionModal({ booking: b, type: 'return' }) }}
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
            )}

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
