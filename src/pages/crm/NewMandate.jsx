import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { Button, Input, Label, Textarea, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import {
    Zap,
    UploadCloud,
    X,
    Trash2,
    MapPin,
    Camera,
    UserPlus,
    Search,
    Check,
    ChevronsUpDown,
    Plus,
    FileText,
    CameraIcon,
    Camera as Camera360Icon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import AddressAutocomplete from "@/components/ui/AddressAutocomplete"
import ContactForm from '../../components/crm/ContactForm'
import { logActivity } from '../../services/activityService'

const NewMandate = () => {
    const { profile, user } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [fetchingUF, setFetchingUF] = useState(false)
    const [ufValue, setUfValue] = useState(0)

    // Form State
    const [contacts, setContacts] = useState([])
    const [properties, setProperties] = useState([])
    const [openContactSelect, setOpenContactSelect] = useState(false)
    const [openPropertySelect, setOpenPropertySelect] = useState(false)
    const [isContactFormOpen, setIsContactFormOpen] = useState(false)
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
        operation_type: 'Venta', // New field
        latitude: null,
        longitude: null,
    })

    // Fetch Initial Data
    useEffect(() => {
        fetchContacts()
        fetchProperties()
        fetchUF()
    }, [])

    const fetchContacts = async () => {
        const { data } = await supabase.from('contacts').select('id, first_name, last_name').order('first_name')
        setContacts(data || [])
    }

    const fetchProperties = async () => {
        const { data } = await supabase.from('properties').select('id, address').order('address')
        setProperties(data || [])
    }

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
        if (!formData.contact_id || !formData.address) {
            toast.error('Por favor completa los campos obligatorios')
            return
        }

        setLoading(true)
        try {
            // 1. Upload Files
            const uploadedUrls = []
            for (const file of files) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${Math.random()}.${fileExt}`
                const filePath = `${user.id}/${formData.contact_id}/${Date.now()}_${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('mandates')
                    .upload(filePath, file)

                if (uploadError) throw uploadError
                uploadedUrls.push(filePath)
            }

            // 1.5 Prepare data for Webhook
            const fileToBase64 = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            const base64Files = await Promise.all(files.map(async (file) => ({
                nombre: file.name,
                tipo: file.type,
                contenido: await fileToBase64(file)
            })));

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
                tipo_operacion: formData.operation_type
            };

            const webhookPayload = {
                agente: agentLimpio,
                datos_mandato: datosMandato,
                archivos: base64Files,
                fecha_registro: new Date().toISOString()
            };

            // 1.6 Send to Webhook
            try {
                await fetch('https://workflow.remax-exclusive.cl/webhook/mandatos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                });
            } catch (webhookErr) {
                console.error('Webhook error:', webhookErr);
            }

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
                    file_urls: uploadedUrls,
                    status: 'pendiente'
                }])
                .select()
                .single()

            if (error) throw error

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
                {/* 1. Contact Selection */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-primary" />
                            Vinculación de Contacto
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <Label>Buscar Contacto <span className="text-red-500">*</span></Label>
                                <Popover open={openContactSelect} onOpenChange={setOpenContactSelect}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between font-normal mt-1 overflow-hidden"
                                        >
                                            <span className="truncate flex-1 text-left">
                                                {formData.contact_id
                                                    ? contacts.find((c) => c.id === formData.contact_id)?.first_name + " " + contacts.find((c) => c.id === formData.contact_id)?.last_name
                                                    : "Seleccionar contacto..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0 z-[100]">
                                        <Command>
                                            <CommandInput placeholder="Nombre o apellido..." />
                                            <CommandList>
                                                <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => {
                                                            setOpenContactSelect(false)
                                                            setIsContactFormOpen(true)
                                                        }}
                                                        className="font-medium text-primary cursor-pointer border-b mb-1 pb-1"
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Crear nuevo contacto
                                                    </CommandItem>
                                                    {contacts.map((contact) => (
                                                        <CommandItem
                                                            key={contact.id}
                                                            value={contact.first_name + " " + contact.last_name}
                                                            onSelect={() => {
                                                                setFormData(prev => ({ ...prev, contact_id: contact.id }))
                                                                setOpenContactSelect(false)
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", formData.contact_id === contact.id ? "opacity-100" : "opacity-0")} />
                                                            {contact.first_name} {contact.last_name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="w-1/3">
                                <Label>Asociar Propiedad (Opcional)</Label>
                                <Popover open={openPropertySelect} onOpenChange={setOpenPropertySelect}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between font-normal mt-1 overflow-hidden"
                                        >
                                            <span className="truncate flex-1 text-left">
                                                {formData.property_id
                                                    ? properties.find((p) => p.id === formData.property_id)?.address
                                                    : "Propiedad existente..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 z-[100]">
                                        <Command>
                                            <CommandInput placeholder="Buscar por dirección..." />
                                            <CommandList>
                                                <CommandEmpty>No encontrada.</CommandEmpty>
                                                <CommandGroup>
                                                    {properties.map((prop) => (
                                                        <CommandItem
                                                            key={prop.id}
                                                            value={prop.address}
                                                            onSelect={() => {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    property_id: prop.id,
                                                                    address: prop.address // Prefill address if linked
                                                                }))
                                                                setOpenPropertySelect(false)
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", formData.property_id === prop.id ? "opacity-100" : "opacity-0")} />
                                                            {prop.address}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
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
                                            onClick={() => toast.info('Reservar cámara - En desarrollo')}
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
                                    Nota Importante - Fotógrafo Profesional
                                </h5>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                    "Las sesiones de fotos profesionales son cortesía de la oficina para captaciones que cumplen los requisitos (Exclusiva, Metropolitana, $4000+ UF). Es responsabilidad del agente coordinar el acceso a la propiedad y cubrir cualquier costo de traslado si el fotógrafo lo requiere fuera de áreas urbanas primarias."
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

            {/* Simplified Contact Form Modal */}
            <AnimatePresence>
                {isContactFormOpen && (
                    <ContactForm
                        isOpen={isContactFormOpen}
                        onClose={(newContact) => {
                            setIsContactFormOpen(false)
                            if (newContact) {
                                setContacts(prev => [newContact, ...prev])
                                setFormData(prev => ({ ...prev, contact_id: newContact.id }))
                                toast.success('Contacto creado y vinculado')
                            }
                        }}
                        isSimplified={true}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

export default NewMandate
