import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { toast } from 'sonner'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardDescription, Textarea } from '@/components/ui'
import { ArrowLeft, Save, Send, Receipt, User, Building2, FileText, ChevronRight, ChevronLeft, Users, UserPlus } from 'lucide-react'
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
        // Identificación
        operationSide: '', // 'both', 'seller', 'buyer'

        // Vendedor
        vendedorNombre: '',
        vendedorRut: '',
        vendedorDireccion: '',
        vendedorEmail: '',
        vendedorTelefono: '',

        // Comprador
        compradorNombre: '',
        compradorRut: '',
        compradorDireccion: '',
        compradorEmail: '',
        compradorTelefono: '',

        // Propiedad & Transacción
        propiedadDireccion: '',
        remaxCode: '',
        montoHonorariosNeto: '', // Fee amount without tax
        montoHonorariosIVA: '', // 19% of net
        montoHonorariosBruto: '', // Total
        notas: ''
    })

    const steps = [
        { id: 1, label: 'Identificación' },
        { id: 2, label: 'Vendedor' },
        { id: 3, label: 'Comprador' },
        { id: 4, label: 'Operación' },
        { id: 5, label: 'Resumen' },
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

    const unformatCurrency = (value) => {
        if (!value) return 0
        return parseInt(value.replace(/\D/g, ''), 10)
    }

    const handleChange = (e) => {
        const { name, value } = e.target

        if (name === 'montoHonorariosNeto') {
            const formatted = formatCurrency(value)
            const numericValue = unformatCurrency(value)

            // Calculate tax and gross
            const iva = Math.round(numericValue * 0.19)
            const bruto = numericValue + iva

            setFormData(prev => ({
                ...prev,
                [name]: formatted,
                montoHonorariosIVA: formatCurrency(iva.toString()),
                montoHonorariosBruto: formatCurrency(bruto.toString())
            }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const handleSelectSide = (side) => {
        setFormData(prev => ({ ...prev, operationSide: side }))
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
                if (!id && requestData) {
                    navigate(`/request/invoice/${requestData.id}`, { replace: true })
                }

                if (!nextStepVal) {
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
        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Solicitud Factura');

            const sideLabel = {
                'both': 'Ambas Puntas',
                'seller': 'Solo Vendedor',
                'buyer': 'Solo Comprador'
            }[formData.operationSide] || formData.operationSide;

            // Define columns
            worksheet.columns = [
                { header: 'Solicitud', key: 'solicitud', width: 15 },
                { header: 'Agente', key: 'agente', width: 25 },
                { header: 'Operación', key: 'operationSide', width: 20 },
                { header: 'Vendedor', key: 'vendedor', width: 25 },
                { header: 'RUT Vendedor', key: 'vendedorRut', width: 15 },
                { header: 'Email Vendedor', key: 'vendedorEmail', width: 25 },
                { header: 'Teléfono Vendedor', key: 'vendedorTelefono', width: 20 },
                { header: 'Dirección Vendedor', key: 'vendedorDireccion', width: 30 },
                { header: 'Comprador', key: 'comprador', width: 25 },
                { header: 'RUT Comprador', key: 'compradorRut', width: 15 },
                { header: 'Email Comprador', key: 'compradorEmail', width: 25 },
                { header: 'Teléfono Comprador', key: 'compradorTelefono', width: 20 },
                { header: 'Dirección Comprador', key: 'compradorDireccion', width: 30 },
                { header: 'Dirección Propiedad', key: 'propiedad', width: 30 },
                { header: 'Código REMAX', key: 'remaxCode', width: 15 },
                { header: 'Honorarios Neto', key: 'neto', width: 15 },
                { header: 'IVA (19%)', key: 'iva', width: 15 },
                { header: 'Honorarios Total', key: 'bruto', width: 15 },
                { header: 'Notas', key: 'notas', width: 30 },
                { header: 'ID Interno', key: 'id', width: 36 },
                { header: 'Fecha', key: 'fecha', width: 20 },
            ];

            // Add row
            worksheet.addRow({
                solicitud: 'factura',
                agente: `${profile?.first_name || ''} ${profile?.last_name || ''}`,
                operationSide: sideLabel,
                vendedor: formData.vendedorNombre,
                vendedorRut: formData.vendedorRut,
                vendedorEmail: formData.vendedorEmail,
                vendedorTelefono: formData.vendedorTelefono,
                vendedorDireccion: formData.vendedorDireccion,
                comprador: formData.compradorNombre,
                compradorRut: formData.compradorRut,
                compradorEmail: formData.compradorEmail,
                compradorTelefono: formData.compradorTelefono,
                compradorDireccion: formData.compradorDireccion,
                propiedad: formData.propiedadDireccion,
                remaxCode: formData.remaxCode,
                neto: formData.montoHonorariosNeto,
                iva: formData.montoHonorariosIVA,
                bruto: formData.montoHonorariosBruto,
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

            // Construct JSON Payload
            const payload = {
                solicitud: 'factura',
                agente: {
                    nombre: profile?.first_name || '',
                    apellido: profile?.last_name || '',
                    email: user?.email || '',
                    telefono: profile?.phone || ''
                },
                excel_base64: base64File,
                filename: `solicitud_factura_${requestData.id}.xlsx`,
                // Extra fields in JSON as requested by user
                data: {
                    ...formData,
                    operationSideLabel: sideLabel
                }
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
        // Validation could be added here
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
            {/* Top Stepper Area */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-6 mb-8">
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

                            {/* Step 1: Identificación de Puntas */}
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
                                                    <Users className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl">Identificación de las Partes</CardTitle>
                                                    <CardDescription>Selecciona a quién se emitirá la factura.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-8 p-6 md:p-8">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div
                                                    className={`cursor-pointer rounded-xl border-2 p-6 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all ${formData.operationSide === 'both' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800'}`}
                                                    onClick={() => handleSelectSide('both')}
                                                >
                                                    <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                                        <Users className="h-6 w-6" />
                                                    </div>
                                                    <div className="text-center">
                                                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Ambas Puntas</h3>
                                                        <p className="text-xs text-slate-500 mt-1">Vendedor y Comprador</p>
                                                    </div>
                                                </div>

                                                <div
                                                    className={`cursor-pointer rounded-xl border-2 p-6 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all ${formData.operationSide === 'seller' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800'}`}
                                                    onClick={() => handleSelectSide('seller')}
                                                >
                                                    <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                        <User className="h-6 w-6" />
                                                    </div>
                                                    <div className="text-center">
                                                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Solo Vendedor</h3>
                                                        <p className="text-xs text-slate-500 mt-1">Propietario/Arrendador</p>
                                                    </div>
                                                </div>

                                                <div
                                                    className={`cursor-pointer rounded-xl border-2 p-6 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all ${formData.operationSide === 'buyer' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800'}`}
                                                    onClick={() => handleSelectSide('buyer')}
                                                >
                                                    <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                                        <UserPlus className="h-6 w-6" />
                                                    </div>
                                                    <div className="text-center">
                                                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Solo Comprador</h3>
                                                        <p className="text-xs text-slate-500 mt-1">Cliente/Arrendatario</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                                <Button onClick={nextStep} disabled={!formData.operationSide} className="pl-6 pr-4 h-11 text-base">
                                                    Siguiente
                                                    <ChevronRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}

                            {/* Step 2: Vendedor */}
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
                                                    <CardTitle className="text-xl">Datos del Vendedor / Arrendador</CardTitle>
                                                    <CardDescription>Información del propietario actual.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-8 p-6 md:p-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label htmlFor="vendedorNombre">Nombre Completo</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorNombre" name="vendedorNombre" value={formData.vendedorNombre} onChange={handleChange} placeholder="Ej: María González" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="vendedorRut">RUT</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorRut" name="vendedorRut" value={formData.vendedorRut} onChange={handleChange} placeholder="Ej: 9.876.543-2" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="vendedorEmail">Correo Electrónico</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorEmail" name="vendedorEmail" type="email" value={formData.vendedorEmail} onChange={handleChange} placeholder="Ej: maria@ejemplo.com" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="vendedorTelefono">Teléfono</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorTelefono" name="vendedorTelefono" value={formData.vendedorTelefono} onChange={handleChange} placeholder="Ej: +569 1234 5678" />
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label htmlFor="vendedorDireccion">Dirección Domicilio</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="vendedorDireccion" name="vendedorDireccion" value={formData.vendedorDireccion} onChange={handleChange} placeholder="Ej: Calle Falsa 456, Providencia" />
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

                            {/* Step 3: Comprador */}
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
                                                    <UserPlus className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl">Datos del Comprador / Arrendatario</CardTitle>
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
                                                <div className="space-y-2">
                                                    <Label htmlFor="compradorTelefono">Teléfono</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="compradorTelefono" name="compradorTelefono" value={formData.compradorTelefono} onChange={handleChange} placeholder="Ej: +569 9876 5432" />
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

                            {/* Step 4: Propiedad (Operación) */}
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
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl">Datos de la Operación</CardTitle>
                                                    <CardDescription>Detalles del inmueble y honorarios.</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-8 p-6 md:p-8">
                                            <div className="space-y-2">
                                                <Label htmlFor="propiedadDireccion">Dirección de la Propiedad</Label>
                                                <Input className="h-11 bg-white dark:bg-slate-950" id="propiedadDireccion" name="propiedadDireccion" value={formData.propiedadDireccion} onChange={handleChange} placeholder="Dirección del inmueble" />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="remaxCode">Código REMAX</Label>
                                                    <Input className="h-11 bg-white dark:bg-slate-950" id="remaxCode" name="remaxCode" value={formData.remaxCode} onChange={handleChange} placeholder="Ej: 123456789" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="montoHonorariosNeto">Honorarios (Neto)</Label>
                                                    <Input
                                                        className="h-11 bg-white dark:bg-slate-950 font-medium text-lg"
                                                        id="montoHonorariosNeto"
                                                        name="montoHonorariosNeto"
                                                        value={formData.montoHonorariosNeto}
                                                        onChange={handleChange}
                                                        placeholder="Ej: $ 500.000 (Sin IVA)"
                                                        maxLength={15}
                                                    />
                                                    <p className="text-xs text-slate-500">Ingresa el monto sin IVA, el cálculo es automático.</p>
                                                </div>
                                            </div>

                                            {/* Desglose Honorarios */}
                                            {formData.montoHonorariosNeto && (
                                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-4">
                                                    <div>
                                                        <span className="text-xs text-slate-500 uppercase font-semibold">Neto</span>
                                                        <div className="text-lg font-medium">{formData.montoHonorariosNeto}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-slate-500 uppercase font-semibold">IVA (19%)</span>
                                                        <div className="text-lg font-medium text-slate-600 dark:text-slate-400">{formData.montoHonorariosIVA}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-slate-500 uppercase font-semibold">Total</span>
                                                        <div className="text-lg font-bold text-emerald-600">{formData.montoHonorariosBruto}</div>
                                                    </div>
                                                </div>
                                            )}

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

                            {/* Step 5: Resumen */}
                            {currentStep === 5 && (
                                <motion.div
                                    key="step5"
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

                                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2 mb-4">
                                                        <Users className="w-4 h-4 text-purple-500" />
                                                        Operación
                                                    </h3>
                                                    <div className="text-sm">
                                                        <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Tipo</span>
                                                        <span className="font-medium text-slate-900 dark:text-slate-200">
                                                            {{
                                                                'both': 'Ambas Puntas',
                                                                'seller': 'Solo Vendedor',
                                                                'buyer': 'Solo Comprador'
                                                            }[formData.operationSide] || formData.operationSide}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-4">
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                                                        <User className="w-4 h-4 text-primary" />
                                                        Datos del Vendedor
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Nombre</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.vendedorNombre}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">RUT</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.vendedorRut}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Teléfono</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.vendedorTelefono}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-4">
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                                                        <UserPlus className="w-4 h-4 text-amber-500" />
                                                        Datos del Comprador
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Nombre</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.compradorNombre}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">RUT</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.compradorRut}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Teléfono</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.compradorTelefono}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-4">
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
                                                        <Building2 className="w-4 h-4 text-emerald-500" />
                                                        Datos de la Operación
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                                        <div className="sm:col-span-2">
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Dirección Propiedad</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.propiedadDireccion}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Código REMAX</span>
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">{formData.remaxCode}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Honorarios Total</span>
                                                            <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formData.montoHonorariosBruto}</span>
                                                            <span className="text-xs text-slate-500 block">({formData.montoHonorariosNeto} + IVA)</span>
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
