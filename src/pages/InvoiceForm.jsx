import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { toast } from 'sonner'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardDescription, Textarea } from '@/components/ui'
import { ArrowLeft, Save, Send, Receipt, User, Building2, FileText, ChevronRight, ChevronLeft } from 'lucide-react'
import Stepper from '../components/layout/Stepper'
import { motion, AnimatePresence } from 'framer-motion'

export default function InvoiceForm() {
    const { id } = useParams()
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(!!id)
    const [submitting, setSubmitting] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)

    const [formData, setFormData] = useState({
        // Vendedor
        vendedorNombre: '',
        vendedorRut: '',
        vendedorDireccion: '',
        vendedorEmail: '',
        // Comprador
        compradorNombre: '',
        compradorRut: '',
        compradorDireccion: '',
        compradorEmail: '',
        // Propiedad & Transacción
        propiedadDireccion: '',
        montoComision: '',
        notas: ''
    })

    const steps = [
        { id: 1, label: 'Vendedor' },
        { id: 2, label: 'Comprador' },
        { id: 3, label: 'Propiedad' },
        { id: 4, label: 'Resumen' },
    ]

    useEffect(() => {
        if (id) {
            const fetchRequest = async () => {
                const { data, error } = await supabase
                    .from('requests')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (error) {
                    toast.error('Error al cargar la solicitud')
                    navigate('/dashboard')
                    return
                }

                if (data && data.data) {
                    setFormData(data.data)
                    setCurrentStep(data.step || 1)
                }
                setLoading(false)
            }
            fetchRequest()
        }
    }, [id, navigate])

    const formatCurrency = (value) => {
        // Remove non-numeric characters
        const number = value.replace(/\D/g, '')
        if (!number) return ''
        return '$ ' + new Intl.NumberFormat('es-CL').format(number)
    }

    const handleChange = (e) => {
        const { name, value } = e.target

        if (name === 'montoComision') {
            // Apply currency formatting
            const formatted = formatCurrency(value)
            setFormData(prev => ({ ...prev, [name]: formatted }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const saveRequest = async (status = 'draft', nextStepVal = null) => {
        if (!user) return

        const stepToSave = nextStepVal !== null ? nextStepVal : currentStep
        if (status === 'submitted') setSubmitting(true)

        const payload = {
            user_id: user.id,
            type: 'invoice',
            step: stepToSave,
            data: formData,
            status: status,
            updated_at: new Date()
        }

        try {
            let requestData
            if (id) {
                const { data, error } = await supabase
                    .from('requests')
                    .update(payload)
                    .eq('id', id)
                    .select()
                    .single()
                if (error) throw error
                requestData = data
            } else {
                const { data, error } = await supabase
                    .from('requests')
                    .insert(payload)
                    .select()
                    .single()
                if (error) throw error
                requestData = data
            }

            if (status === 'submitted') {
                await sendWebhook(requestData)
                toast.success('Solicitud enviada exitosamente')
                navigate('/dashboard')
            } else {
                // Handle navigation for new records immediately
                if (!id && requestData) {
                    // Update URL to include the new ID
                    // This will trigger the useEffect to fetch data and set step/form data again
                    navigate(`/request/invoice/${requestData.id}`, { replace: true })
                }

                if (!nextStepVal) {
                    // Only show toast if explicitly saving draft, not intermediate step auto-save
                    toast.success('Borrador guardado')
                }
            }

        } catch (error) {
            console.error('Error saving request:', error)
            toast.error('Error al guardar la solicitud')
        } finally {
            setSubmitting(false)
        }
    }

    const sendWebhook = async (requestData) => {
        // We'll use exceljs to create a buffer/blob
        // Since we can't import exceljs in browser without issues sometimes depending on build, 
        // we'll assume it's working or use a dynamic import if needed. 
        // package.json has "exceljs": "^4.4.0".

        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Solicitud Factura');

            // Define columns
            worksheet.columns = [
                { header: 'Solicitud', key: 'solicitud', width: 15 },
                { header: 'Agente', key: 'agente', width: 25 },
                { header: 'Vendedor', key: 'vendedor', width: 25 },
                { header: 'RUT Vendedor', key: 'vendedorRut', width: 15 },
                { header: 'Email Vendedor', key: 'vendedorEmail', width: 25 },
                { header: 'Dirección Vendedor', key: 'vendedorDireccion', width: 30 },
                { header: 'Comprador', key: 'comprador', width: 25 },
                { header: 'RUT Comprador', key: 'compradorRut', width: 15 },
                { header: 'Email Comprador', key: 'compradorEmail', width: 25 },
                { header: 'Dirección Comprador', key: 'compradorDireccion', width: 30 },
                { header: 'Dirección Propiedad', key: 'propiedad', width: 30 },
                { header: 'Monto Comisión', key: 'comision', width: 15 },
                { header: 'Notas', key: 'notas', width: 30 },
                { header: 'ID Interno', key: 'id', width: 36 },
                { header: 'Fecha', key: 'fecha', width: 20 },
            ];

            // Add row
            worksheet.addRow({
                solicitud: 'factura',
                agente: `${profile?.first_name || ''} ${profile?.last_name || ''}`,
                vendedor: formData.vendedorNombre,
                vendedorRut: formData.vendedorRut,
                vendedorEmail: formData.vendedorEmail,
                vendedorDireccion: formData.vendedorDireccion,
                comprador: formData.compradorNombre,
                compradorRut: formData.compradorRut,
                compradorEmail: formData.compradorEmail,
                compradorDireccion: formData.compradorDireccion,
                propiedad: formData.propiedadDireccion,
                comision: formData.montoComision,
                notas: formData.notas,
                id: requestData.id,
                fecha: new Date().toLocaleDateString('es-CL')
            });

            // Generate buffer
            const buffer = await workbook.xlsx.writeBuffer();

            // Convert buffer to Base64 for JSON payload
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64File = window.btoa(binary);

            // Construct JSON Payload (matching structure of RequestForm)
            const payload = {
                solicitud: 'factura',
                agente: {
                    nombre: profile?.first_name || '',
                    apellido: profile?.last_name || '',
                    email: user?.email || '',
                    telefono: profile?.phone || ''
                },
                excel_base64: base64File,
                filename: `solicitud_factura_${requestData.id}.xlsx`
            };

            await fetch('https://workflow.remax-exclusive.cl/webhook/boleto_de_pago', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
        } catch (error) {
            console.error('Webhook error:', error)
            toast.warning('Solicitud guardada, pero hubo un problema generando el archivo Excel.')
        }
    }

    const nextStep = () => {
        const next = Math.min(currentStep + 1, steps.length)
        setCurrentStep(next)
        saveRequest('draft', next)
    }

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1))
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    )

    const stepVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    }

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20">
            {/* Top Stepper Area - Matching RequestForm layout */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20 px-4 py-6 mb-8 shadow-sm">
                <div className="max-w-4xl mx-auto">
                    <Stepper currentStep={currentStep} steps={steps} />
                </div>
            </div>

            <div className="container max-w-4xl mx-auto px-4">
                <div className="max-w-3xl mx-auto space-y-6">

                    {/* Header Title & Actions */}
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <Button variant="ghost" className="pl-0 hover:pl-2 transition-all -ml-2 mb-2 text-slate-500" onClick={() => navigate('/dashboard')}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver al Panel
                            </Button>
                            <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                {id ? 'Editar Solicitud Factura' : 'Nueva Solicitud Factura'}
                            </h1>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => saveRequest('draft')} className="text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Save className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Guardar Borrador</span>
                        </Button>
                    </div>

                    <div className="relative min-h-[500px]">
                        <AnimatePresence mode="wait">
                            {/* Step 1: Vendedor */}
                            {currentStep === 1 && (
                                <motion.div
                                    key="step1"
                                    variants={stepVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card className="glass-card overflow-hidden border-0 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
                                        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <User className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl">Datos del Vendedor</CardTitle>
                                                    <CardDescription>Información del propietario actual.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-8 p-6 md:p-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label htmlFor="vendedorNombre" className="text-slate-900 dark:text-slate-200">Nombre Completo</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorNombre" name="vendedorNombre" value={formData.vendedorNombre} onChange={handleChange} placeholder="Ej: María González" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="vendedorRut" className="text-slate-900 dark:text-slate-200">RUT</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorRut" name="vendedorRut" value={formData.vendedorRut} onChange={handleChange} placeholder="Ej: 9.876.543-2" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="vendedorEmail" className="text-slate-900 dark:text-slate-200">Correo Electrónico</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorEmail" name="vendedorEmail" type="email" value={formData.vendedorEmail} onChange={handleChange} placeholder="Ej: maria@ejemplo.com" />
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label htmlFor="vendedorDireccion" className="text-slate-900 dark:text-slate-200">Dirección Domicilio</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorDireccion" name="vendedorDireccion" value={formData.vendedorDireccion} onChange={handleChange} placeholder="Ej: Calle Falsa 456, Providencia" />
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                                <Button onClick={nextStep} className="pl-6 pr-4 h-11 text-base">
                                                    Siguiente
                                                    <ChevronRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}

                            {/* Step 2: Comprador */}
                            {currentStep === 2 && (
                                <motion.div
                                    key="step2"
                                    variants={stepVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card className="glass-card overflow-hidden border-0 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
                                        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <User className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl">Datos del Comprador</CardTitle>
                                                    <CardDescription>Información de quien adquiere la propiedad.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-8 p-6 md:p-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label htmlFor="compradorNombre">Nombre Completo</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="compradorNombre" name="compradorNombre" value={formData.compradorNombre} onChange={handleChange} placeholder="Ej: Juan Pérez" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="compradorRut">RUT</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="compradorRut" name="compradorRut" value={formData.compradorRut} onChange={handleChange} placeholder="Ej: 12.345.678-9" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="compradorEmail">Correo Electrónico</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="compradorEmail" name="compradorEmail" type="email" value={formData.compradorEmail} onChange={handleChange} placeholder="Ej: juan@ejemplo.com" />
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label htmlFor="compradorDireccion">Dirección Domicilio</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="compradorDireccion" name="compradorDireccion" value={formData.compradorDireccion} onChange={handleChange} placeholder="Ej: Av. Siempre Viva 123, Santiago" />
                                                </div>
                                            </div>

                                            <div className="flex justify-between pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                                <Button variant="outline" onClick={prevStep} className="h-11 px-6">
                                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                                    Atrás
                                                </Button>
                                                <Button onClick={nextStep} className="pl-6 pr-4 h-11 text-base">
                                                    Siguiente
                                                    <ChevronRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}

                            {/* Step 3: Propiedad */}
                            {currentStep === 3 && (
                                <motion.div
                                    key="step3"
                                    variants={stepVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card className="glass-card overflow-hidden border-0 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
                                        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl">Datos de la Operación</CardTitle>
                                                    <CardDescription>Detalles del inmueble y comisión.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-8 p-6 md:p-8">
                                            <div className="space-y-2">
                                                <Label htmlFor="propiedadDireccion">Dirección de la Propiedad Vendida</Label>
                                                <Input className="h-11 bg-white dark:bg-slate-950" id="propiedadDireccion" name="propiedadDireccion" value={formData.propiedadDireccion} onChange={handleChange} placeholder="Dirección del inmueble objeto de la venta" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="montoComision">Monto Comisión</Label>
                                                    <Input
                                                        className="h-11 bg-white dark:bg-slate-950 font-medium text-lg"
                                                        id="montoComision"
                                                        name="montoComision"
                                                        value={formData.montoComision}
                                                        onChange={handleChange}
                                                        placeholder="Ej: $ 500.000"
                                                        maxLength={15}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="notas">Notas Adicionales (Opcional)</Label>
                                                <Textarea className="bg-white dark:bg-slate-950 resize-none h-32" id="notas" name="notas" value={formData.notas} onChange={handleChange} placeholder="Cualquier detalle relevante para la facturación..." />
                                            </div>

                                            <div className="flex justify-between pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                                <Button variant="outline" onClick={prevStep} className="h-11 px-6">
                                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                                    Atrás
                                                </Button>
                                                <Button onClick={nextStep} className="pl-6 pr-4 h-11 text-base">
                                                    Siguiente
                                                    <ChevronRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}

                            {/* Step 4: Resumen */}
                            {currentStep === 4 && (
                                <motion.div
                                    key="step4"
                                    variants={stepVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card className="glass-card overflow-hidden border-0 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
                                        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <FileText className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl">Resumen de Solicitud</CardTitle>
                                                    <CardDescription>Revisa los datos antes de enviar.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-8 pt-8 p-6 md:p-8">
                                            <div className="space-y-6">
                                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-4">
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                                                        <User className="w-4 h-4 text-primary" />
                                                        Datos del Vendedor
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Nombre</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.vendedorNombre}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">RUT</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.vendedorRut}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-4">
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                                                        <User className="w-4 h-4 text-blue-500" />
                                                        Datos del Comprador
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Nombre</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.compradorNombre}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">RUT</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.compradorRut}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-4">
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                                                        <Building2 className="w-4 h-4 text-emerald-500" />
                                                        Datos de la Operación
                                                    </h3>
                                                    <div className="grid grid-cols-1 gap-4 text-sm">
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Dirección Propiedad</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.propiedadDireccion}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Monto Comisión</span>
                                                            <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formData.montoComision}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-between pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                                <Button variant="outline" onClick={prevStep} className="h-11 px-6">
                                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                                    Atrás
                                                </Button>
                                                <Button
                                                    onClick={() => saveRequest('submitted')}
                                                    disabled={submitting}
                                                    className="pl-6 pr-6 h-11 text-base bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
                                                >
                                                    {submitting ? (
                                                        <>Enviando...</>
                                                    ) : (
                                                        <>
                                                            Enviar Solicitud
                                                            <Send className="ml-2 h-4 w-4" />
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    )
}
