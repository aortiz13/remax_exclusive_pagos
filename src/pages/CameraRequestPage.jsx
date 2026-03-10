import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { Camera, ArrowLeft, Building2, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import PropertyPickerInline from '../components/ui/PropertyPickerInline'
import Camera360BookingModal from '../components/crm/Camera360BookingModal'

export default function CameraRequestPage() {
    const navigate = useNavigate()

    const [selectedProperty, setSelectedProperty] = useState(null)
    const [showCameraModal, setShowCameraModal] = useState(false)

    const handleSelectProperty = (property) => {
        if (!property?.id) {
            setSelectedProperty(null)
            return
        }
        setSelectedProperty(property)
    }

    const propertyAddress = selectedProperty?.address
        ? `${selectedProperty.address}${selectedProperty.commune ? `, ${selectedProperty.commune}` : ''}`
        : ''

    return (
        <div className="max-w-3xl mx-auto pb-12">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                    <Camera className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Solicitar Cámara 360°</h1>
                    <p className="text-slate-500 text-sm">Reserva la cámara 360° para una propiedad captada en exclusiva</p>
                </div>
            </div>

            {/* Step 1: Select Property */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        Selecciona la Propiedad
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <PropertyPickerInline
                        label="Propiedad *"
                        value={selectedProperty?.id || ''}
                        onSelectProperty={handleSelectProperty}
                    />

                    {/* Address display (read-only) */}
                    <AnimatePresence>
                        {selectedProperty && propertyAddress && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                            >
                                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{propertyAddress}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>


                </CardContent>
            </Card>

            {/* Info note */}
            <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-sm">
                <CardContent className="py-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-2">
                            Condiciones para solicitar la Cámara 360°
                        </h5>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            La Cámara 360° es un beneficio exclusivo otorgado por RE/MAX Exclusive para potenciar las captaciones.
                            Para acceder a este beneficio, la propiedad debe estar captada en <strong>exclusividad</strong>.
                        </p>
                        <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-400 dark:border-amber-600 rounded-lg">
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                ⚠️ Requisito obligatorio: Estar al día con el pago de la cuota mensual de la oficina.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-3 pt-8">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/new-request')}
                    className="text-slate-500"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a Solicitudes
                </Button>

                <Button
                    disabled={!selectedProperty}
                    className="px-8 h-12 rounded-xl text-base font-bold shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                    onClick={() => {
                        if (!selectedProperty) {
                            toast.error('Selecciona una propiedad primero')
                            return
                        }
                        setShowCameraModal(true)
                    }}
                >
                    <Camera className="w-5 h-5" />
                    Reservar Cámara 360°
                </Button>
            </div>

            {/* Camera Booking Modal */}
            <Camera360BookingModal
                open={showCameraModal}
                onClose={() => setShowCameraModal(false)}
                propertyAddress={propertyAddress}
            />
        </div>
    )
}
