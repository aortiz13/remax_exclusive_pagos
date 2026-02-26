import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import {
    Zap,
    UploadCloud,
    Trash2,
    MapPin,
    UserPlus,
    ChevronsUpDown,
    FileText,
    CameraIcon,
    Camera as Camera360Icon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"
import AddressAutocomplete from "@/components/ui/AddressAutocomplete"
import ContactPickerInline from '../../components/ui/ContactPickerInline'
import PropertyPickerInline from '../../components/ui/PropertyPickerInline'
import { logActivity } from '../../services/activityService'
import Camera360BookingModal from '../../components/crm/Camera360BookingModal'

const NewMandate = () => {
    const { profile, user } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [showCameraModal, setShowCameraModal] = useState(false)
    const [fetchingUF, setFetchingUF] = useState(false)
    const [ufValue, setUfValue] = useState(0)

    // Form State
    const [files, setFiles] = useState([])

    const [formData, setFormData] = useState({
        contact_id: '',
        property_id: '',
        address: '',
        commune: '',
        region: '',
        price: '',
        currency: 'UF',
        capture_type: 'Exclusiva',
        operation_type: 'Venta',
        start_date: new Date().toISOString().split('T')[0],
        capture_duration: '90',
        latitude: null,
        longitude: null,
    })

    // Fetch Initial Data
    useEffect(() => {
        fetchUF()
    }, [])

    const fetchUF = async () => {
        setFetchingUF(true)
        try {
            const res = await fetch('https://mindicador.cl/api/uf')
            if (res.ok) {
                const data = await res.json()
                if (data.serie && data.serie.length > 0) {
                    setUfValue(data.serie[0].valor)
                }
            }
        } catch (err) {
            console.error('Error fetching UF:', err)
        } finally {
            setFetchingUF(false)
        }
    }

    // Dynamic Logic Variables
    const isExclusive = formData.capture_type === 'Exclusiva'
    const isRM = formData.region?.toLowerCase().includes('metropolitana') || formData.region?.toLowerCase().includes('santiago')

    const getValueInUF = () => {
        if (!formData.price) return 0
        const price = parseFloat(formData.price)
        if (formData.currency === 'UF') return price
        if (formData.currency === 'CLP' && ufValue > 0) return price / ufValue
        return 0
    }

    const valueInUF = getValueInUF()
    const isVenta = formData.operation_type === 'Venta'
    const isArriendo = formData.operation_type === 'Arriendo'
    const priceRaw = parseFloat(formData.price || 0)

    const showPhotographer = isExclusive && isRM && (
        (isVenta && valueInUF >= 4000) ||
        (isArriendo && priceRaw >= 1000000)
    )
    const show360Camera = isExclusive && isRM

    // Handlers
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files || [])
        setFiles(prev => [...prev, ...selectedFiles])
    }

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.contact_id || !formData.property_id || !formData.address || !formData.start_date || !formData.capture_duration) {
            toast.error('Por favor completa los campos obligatorios')
            return
        }

        setLoading(true)
        try {
            // 1. Upload Files in PARALLEL
            const filePaths = files.map((file) => {
                const fileExt = file.name.split('.').pop()
                const fileName = `${Math.random()}.${fileExt}`
                return `${user.id}/${formData.contact_id}/${Date.now()}_${fileName}`
            })

            const uploadResults = await Promise.all(
                files.map((file, i) =>
                    supabase.storage.from('mandates').upload(filePaths[i], file)
                )
            )

            const uploadedUrls = []
            uploadResults.forEach((result, i) => {
                if (result.error) {
                    console.error(`Error uploading ${files[i].name}:`, result.error)
                } else {
                    uploadedUrls.push({ path: filePaths[i], index: i })
                }
            })

            // 1.5 Generate signed URLs in BATCH (single API call)
            let archivosConUrl = [];
            if (uploadedUrls.length > 0) {
                const { data: signedData, error: signError } = await supabase.storage
                    .from('mandates')
                    .createSignedUrls(
                        uploadedUrls.map(u => u.path),
                        60 * 60 * 24 * 7 // 7 days
                    );

                if (!signError && signedData) {
                    archivosConUrl = signedData.map((item, idx) => ({
                        nombre: files[uploadedUrls[idx].index]?.name || `archivo_${idx + 1}`,
                        tipo: files[uploadedUrls[idx].index]?.type || 'application/octet-stream',
                        url: item.signedUrl
                    }));
                }
            }

            // Clean Agent Profile data
            const agentLimpio = {
                nombre: profile?.first_name,
                apellido: profile?.last_name,
                email: profile?.email,
                telefono: profile?.phone,
                id_agente_remax: profile?.remax_agent_id
            };

            // Clean Mandate data
            const datosMandato = {
                direccion: formData.address,
                comuna: formData.commune,
                region: formData.region,
                precio: formData.price,
                moneda: formData.currency,
                tipo_captacion: formData.capture_type,
                tipo_operacion: formData.operation_type,
                fecha_inicio: formData.start_date,
                fecha_vencimiento: (() => {
                    if (!formData.start_date || !formData.capture_duration) return null
                    const d = new Date(formData.start_date)
                    d.setDate(d.getDate() + parseInt(formData.capture_duration))
                    return d.toISOString().split('T')[0]
                })()
            };

            const webhookPayload = {
                agente: agentLimpio,
                datos_mandato: datosMandato,
                archivos: archivosConUrl,
                fecha_registro: new Date().toISOString()
            };

            // 1.6 Send to Webhook (fire-and-forget, don't block submit)
            fetch('https://workflow.remax-exclusive.cl/webhook/mandatos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            }).catch(err => console.error('Webhook error:', err));

            // 2. Save Mandate
            const { data: mandate, error } = await supabase
                .from('mandates')
                .insert([{
                    agent_id: user.id,
                    contact_id: formData.contact_id,
                    property_id: formData.property_id || null,
                    address: formData.address,
                    commune: formData.commune,
                    region: formData.region,
                    price: formData.price ? parseFloat(formData.price) : null,
                    currency: formData.currency,
                    capture_type: formData.capture_type,
                    operation_type: formData.operation_type,
                    start_date: formData.start_date || null,
                    capture_end_date: (() => {
                        if (!formData.start_date || !formData.capture_duration) return null
                        const d = new Date(formData.start_date)
                        d.setDate(d.getDate() + parseInt(formData.capture_duration))
                        return d.toISOString().split('T')[0]
                    })(),
                    file_urls: uploadedUrls,
                    status: 'pendiente'
                }])
                .select()
                .single()

            if (error) throw error

            // 4. Auto-create CRM Action "Captación Nueva"
            const today = new Date()
            const noteText = [
                `Captación registrada: ${formData.address}`,
                formData.commune ? `Comuna: ${formData.commune}` : null,
                formData.region ? `Región: ${formData.region}` : null,
                `Tipo: ${formData.capture_type} — ${formData.operation_type}`,
                formData.price ? `Precio: ${parseFloat(formData.price).toLocaleString('es-CL')} ${formData.currency}` : null,
            ].filter(Boolean).join('\n')

            const { data: actionRow, error: actionError } = await supabase
                .from('crm_actions')
                .insert({
                    agent_id: user.id,
                    action_type: 'Captación Nueva',
                    action_date: today.toISOString(),
                    property_id: formData.property_id || null,
                    note: noteText,
                    mandate_id: mandate.id,
                    is_conversation_starter: false,
                })
                .select()
                .single()

            if (actionError) {
                console.error('Error creating crm_action:', actionError)
            } else if (formData.contact_id) {
                // Link contact to action
                await supabase.from('crm_action_contacts').insert({
                    action_id: actionRow.id,
                    contact_id: formData.contact_id,
                })
            }

            // 5. Upsert kpi_records — increment new_listings for today (daily)
            const todayStr = today.toISOString().split('T')[0]
            const { data: existingKpi } = await supabase
                .from('kpi_records')
                .select('id, new_listings')
                .eq('agent_id', user.id)
                .eq('period_type', 'daily')
                .eq('date', todayStr)
                .single()

            if (existingKpi) {
                await supabase
                    .from('kpi_records')
                    .update({ new_listings: (existingKpi.new_listings || 0) + 1 })
                    .eq('id', existingKpi.id)
            } else {
                await supabase
                    .from('kpi_records')
                    .insert({
                        agent_id: user.id,
                        period_type: 'daily',
                        date: todayStr,
                        new_listings: 1,
                        conversations_started: 0,
                        relational_coffees: 0,
                        sales_interviews: 0,
                        buying_interviews: 0,
                        commercial_evaluations: 0,
                        active_portfolio: 0,
                        price_reductions: 0,
                        portfolio_visits: 0,
                        buyer_visits: 0,
                        offers_in_negotiation: 0,
                        signed_promises: 0,
                        billing_primary: 0,
                        referrals_count: 0,
                        billing_secondary: 0,
                    })
            }

            // 3. Log Activity
            await logActivity({
                action: 'Captación',
                entity_type: 'Mandato',
                entity_id: mandate.id,
                description: `Nueva captación registrada en ${formData.address}`,
                contact_id: formData.contact_id,
                property_id: formData.property_id || null
            })

            toast.success('Captación registrada con éxito')
            navigate('/crm')
        } catch (err) {
            console.error('Error saving mandate:', err)
            toast.error('Error al guardar la captación')
        } finally {
            setLoading(false)
        }
    }

    const handlePhotographerBooking = () => {
        const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
        const text = `Hola Franco, soy ${agentName} de RE/MAX Exclusive. Tengo una captación exclusiva en ${formData.address} con valor de ${formData.price} ${formData.currency} para agendar sesión de fotos.`
        const whatsappUrl = `https://wa.me/56986559730?text=${encodeURIComponent(text)}`
        window.open(whatsappUrl, '_blank')
    }

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary/10 rounded-2xl">
                    <Zap className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Nueva Captación</h1>
                    <p className="text-slate-500 text-sm">Registra un nuevo mandato y gestiona servicios adicionales</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Contact & Property Selection */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-primary" />
                            Vinculación de Contacto y Propiedad
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-2">
                        <ContactPickerInline
                            label="Contacto *"
                            value={formData.contact_id}
                            onSelectContact={(contact) => {
                                setFormData(prev => ({
                                    ...prev,
                                    contact_id: contact?.id || ''
                                }))
                            }}
                        />
                        <PropertyPickerInline
                            label="Propiedad *"
                            value={formData.property_id}
                            onSelectProperty={(property) => {
                                setFormData(prev => ({
                                    ...prev,
                                    property_id: property?.id || '',
                                    address: property?.address || prev.address,
                                    commune: property?.commune || prev.commune,
                                }))
                            }}
                        />
                    </CardContent>
                </Card>

                {/* 2. File Upload */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UploadCloud className="w-5 h-5 text-primary" />
                            Documentación (PDF / Fotos)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div
                            className="border-dashed border-2 border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center bg-slate-50/30 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors cursor-pointer"
                            onClick={() => document.getElementById('file-upload').click()}
                        >
                            <input
                                type="file"
                                id="file-upload"
                                multiple
                                hidden
                                onChange={handleFileChange}
                                accept="*"
                            />
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-full shadow-sm w-fit mx-auto mb-4 border dark:border-slate-800">
                                <UploadCloud className="w-6 h-6 text-primary" />
                            </div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">Haz clic o arrastra archivos aquí</p>
                            <p className="text-xs text-slate-500 mt-1">Sube el mandato firmado y otros documentos (PDF, Doc, Imágenes, etc.)</p>
                        </div>

                        <AnimatePresence>
                            {files.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-4 space-y-2"
                                >
                                    {files.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-800">
                                            <div className="flex items-center gap-3 truncate">
                                                <FileText className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm truncate">{file.name}</span>
                                                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                onClick={() => removeFile(idx)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>

                {/* 3. Property Details */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-primary" />
                            Datos de la Propiedad
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Dirección <span className="text-red-500">*</span></Label>
                            <AddressAutocomplete
                                value={formData.address}
                                onChange={(val) => setFormData(prev => ({ ...prev, address: val }))}
                                onSelectAddress={(data) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        address: data.address,
                                        commune: data.commune,
                                        region: data.region,
                                        latitude: data.lat,
                                        longitude: data.lng
                                    }))
                                }}
                                placeholder="Escribe la dirección..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Comuna</Label>
                            <Input
                                value={formData.commune}
                                onChange={(e) => setFormData(prev => ({ ...prev, commune: e.target.value }))}
                                placeholder="Auto-completado"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Región</Label>
                            <Input
                                value={formData.region}
                                onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                                placeholder="Auto-completado"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>{formData.operation_type === 'Arriendo' ? 'Valor Arriendo' : 'Valor Propiedad'}</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                                    placeholder="Monto"
                                    className="flex-1"
                                />
                                {formData.operation_type === 'Arriendo' ? (
                                    <div className="w-24 h-10 flex items-center justify-center rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm font-bold text-slate-500">
                                        CLP
                                    </div>
                                ) : (
                                    <select
                                        className="w-24 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        value={formData.currency}
                                        onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                    >
                                        <option value="UF">UF</option>
                                        <option value="CLP">CLP</option>
                                    </select>
                                )}
                            </div>
                            {formData.price && formData.currency === 'CLP' && ufValue > 0 && formData.operation_type !== 'Arriendo' && (
                                <p className="text-[10px] text-slate-500 italic mt-1">
                                    Equivalente a ≈ {valueInUF.toLocaleString('es-CL', { maximumFractionDigits: 1 })} UF (valor UF: ${ufValue.toLocaleString('es-CL')})
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Tipo de Captación</Label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={formData.capture_type}
                                onChange={(e) => setFormData(prev => ({ ...prev, capture_type: e.target.value }))}
                            >
                                <option value="Exclusiva">Captación Exclusiva (Premium)</option>
                                <option value="Abierta">Captación Abierta</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Fecha de Inicio <span className="text-red-500">*</span></Label>
                            <Input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Tiempo de Captación <span className="text-red-500">*</span></Label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={formData.capture_duration}
                                onChange={(e) => setFormData(prev => ({ ...prev, capture_duration: e.target.value }))}
                            >
                                <option value="30">30 días</option>
                                <option value="60">60 días</option>
                                <option value="90">90 días</option>
                                <option value="120">120 días</option>
                                <option value="365">1 año</option>
                            </select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label>Tipo de Operación <span className="text-red-500">*</span></Label>
                            <div className="flex gap-4">
                                <label className={cn(
                                    "flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                    formData.operation_type === 'Venta'
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                )}>
                                    <input
                                        type="radio"
                                        className="hidden"
                                        name="operation_type"
                                        value="Venta"
                                        checked={formData.operation_type === 'Venta'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, operation_type: e.target.value }))}
                                    />
                                    <span className="font-bold">Venta</span>
                                </label>
                                <label className={cn(
                                    "flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                    formData.operation_type === 'Arriendo'
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                )}>
                                    <input
                                        type="radio"
                                        className="hidden"
                                        name="operation_type"
                                        value="Arriendo"
                                        checked={formData.operation_type === 'Arriendo'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, operation_type: e.target.value, currency: e.target.value === 'Arriendo' ? 'CLP' : prev.currency }))}
                                    />
                                    <span className="font-bold">Arriendo</span>
                                </label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Dynamic Rule Engine (Booking) */}
                {(show360Camera || showPhotographer) && (
                    <Card className="border-primary/20 bg-primary/5 shadow-lg shadow-primary/5 mt-8 overflow-hidden">
                        <CardHeader className="bg-primary/10 border-b border-primary/20">
                            <CardTitle className="text-lg flex items-center gap-2 text-primary">
                                <Zap className="w-5 h-5" />
                                Beneficios Disponibles
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {show360Camera && (
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-primary/20 flex flex-col gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                <Camera360Icon className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">Cámara 360°</h4>
                                        </div>
                                        <p className="text-xs text-slate-500">Tour virtual profesional para destacar la propiedad en portales.</p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="mt-auto border-blue-200 text-blue-600 hover:bg-blue-50"
                                            onClick={() => setShowCameraModal(true)}
                                        >
                                            Reservar cámara
                                        </Button>
                                    </div>
                                )}

                                {showPhotographer && (
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-primary/20 flex flex-col gap-3 relative overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-transparent shadow-xl bounce-in">
                                        <div className="absolute top-0 right-0 p-1 bg-primary text-white text-[8px] font-bold uppercase tracking-wider px-2 rounded-bl-lg">
                                            Recomendado
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <CameraIcon className="w-5 h-5 text-primary" />
                                            </div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">Sesión Fotográfica</h4>
                                        </div>
                                        <p className="text-xs text-slate-500">Fotografía profesional (Franco Abelli) incluida para esta captación.</p>
                                        <Button
                                            type="button"
                                            className="mt-auto bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 gap-2"
                                            onClick={handlePhotographerBooking}
                                        >
                                            <Zap className="w-4 h-4" />
                                            Agendar con Franco Abelli
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Informative Note */}
                            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-2">
                                    NOTA IMPORTANTE: BENEFICIOS DE MARKETING CÁMARA 360° Y FOTOGRAFÍA PROFESIONAL
                                </h5>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    El uso de Cámara 360° y la sesión de fotografía profesional, a través del fotógrafo contratado por la oficina, son beneficios exclusivos otorgados por RE/MAX Exclusive para potenciar las captaciones.
                                    Para acceder a estos beneficios se deben cumplir las siguientes condiciones:
                                    <br /><br />
                                    <strong>1. Cámara 360°</strong><br />
                                    Disponible para propiedades captadas en exclusividad.
                                    <br /><br />
                                    <strong>2. Fotografía Profesional</strong><br />
                                    Disponible para propiedades que se encuentren ubicadas en la Región Metropolitana de Santiago, que hayan sido captadas en exclusividad y cuyo valor, en el caso de propiedades en venta, sea de 4.000 UF o más, o su equivalente en pesos chilenos; y en el caso de arriendos, que el canon mensual sea de $1.000.000 o más.
                                    <br /><br />
                                    Adicionalmente, el agente deberá coordinar el acceso a la propiedad y asumir, a su costo, los gastos de traslado del fotógrafo.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t mt-8">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigate('/crm')}
                        className="text-slate-500"
                    >
                        Descartar
                    </Button>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="px-8 min-w-[200px] h-12 rounded-xl text-base font-bold shadow-xl shadow-primary/20"
                    >
                        {loading ? (
                            <>
                                <ChevronsUpDown className="w-4 h-4 animate-spin mr-2" />
                                Registrando...
                            </>
                        ) : (
                            'Registrar Captación'
                        )}
                    </Button>
                </div>
            </form>

            <Camera360BookingModal
                open={showCameraModal}
                onClose={() => setShowCameraModal(false)}
                propertyAddress={formData.address}
            />


        </div>
    )
}

export default NewMandate
