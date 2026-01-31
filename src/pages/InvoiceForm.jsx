import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { toast } from 'sonner'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardDescription, Textarea } from '@/components/ui'
import { ArrowLeft, Save, Send, Receipt, User, Building2, FileText } from 'lucide-react'
import Stepper from '../components/layout/Stepper'

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

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20">
            {/* Top Stepper Area - Matching RequestForm layout */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 py-8 mb-8 shadow-sm">
                <div className="max-w-4xl mx-auto">
                    <Stepper currentStep={currentStep} steps={steps} />
                </div>
            </div>

            <div className="container max-w-4xl mx-auto px-4">
                <div className="max-w-3xl mx-auto space-y-6">

                    {/* Header Title & Actions */}
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            {id ? 'Editar Solicitud Factura' : 'Nueva Solicitud Factura'}
                        </h1>
                        <Button variant="ghost" size="sm" onClick={() => saveRequest('draft')} className="text-muted-foreground hover:text-primary">
                            <Save className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Guardar Borrador</span>
                        </Button>
                    </div>

                    <div className="mt-8">
                        {/* Step 1: Vendedor */}
                        {currentStep === 1 && (
                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <User className="h-5 w-5 text-primary" />
                                        <CardTitle>Datos del Vendedor</CardTitle>
                                    </div>
                                    <CardDescription>Información del propietario actual.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="vendedorNombre">Nombre Completo</Label>
                                            <Input id="vendedorNombre" name="vendedorNombre" value={formData.vendedorNombre} onChange={handleChange} placeholder="María González" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="vendedorRut">RUT</Label>
                                            <Input id="vendedorRut" name="vendedorRut" value={formData.vendedorRut} onChange={handleChange} placeholder="9.876.543-2" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="vendedorEmail">Correo Electrónico</Label>
                                            <Input id="vendedorEmail" name="vendedorEmail" type="email" value={formData.vendedorEmail} onChange={handleChange} placeholder="maria@ejemplo.com" />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="vendedorDireccion">Dirección Domicilio</Label>
                                            <Input id="vendedorDireccion" name="vendedorDireccion" value={formData.vendedorDireccion} onChange={handleChange} placeholder="Calle Falsa 456, Providencia" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                        <Button variant="outline" onClick={() => navigate('/dashboard')}>Atrás</Button>
                                        <Button onClick={nextStep}>Siguiente</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Step 2: Comprador */}
                        {currentStep === 2 && (
                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <User className="h-5 w-5 text-primary" />
                                        <CardTitle>Datos del Comprador</CardTitle>
                                    </div>
                                    <CardDescription>Información de quien adquiere la propiedad.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="compradorNombre">Nombre Completo</Label>
                                            <Input id="compradorNombre" name="compradorNombre" value={formData.compradorNombre} onChange={handleChange} placeholder="Juan Pérez" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="compradorRut">RUT</Label>
                                            <Input id="compradorRut" name="compradorRut" value={formData.compradorRut} onChange={handleChange} placeholder="12.345.678-9" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="compradorEmail">Correo Electrónico</Label>
                                            <Input id="compradorEmail" name="compradorEmail" type="email" value={formData.compradorEmail} onChange={handleChange} placeholder="juan@ejemplo.com" />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="compradorDireccion">Dirección Domicilio</Label>
                                            <Input id="compradorDireccion" name="compradorDireccion" value={formData.compradorDireccion} onChange={handleChange} placeholder="Av. Siempre Viva 123, Santiago" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                        <Button variant="outline" onClick={prevStep}>Atrás</Button>
                                        <Button onClick={nextStep}>Siguiente</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Step 3: Propiedad */}
                        {currentStep === 3 && (
                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-primary" />
                                        <CardTitle>Datos de la Operación</CardTitle>
                                    </div>
                                    <CardDescription>Detalles del inmueble y comisión.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="propiedadDireccion">Dirección de la Propiedad Vendida</Label>
                                        <Input id="propiedadDireccion" name="propiedadDireccion" value={formData.propiedadDireccion} onChange={handleChange} placeholder="Dirección del inmueble objeto de la venta" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="montoComision">Monto Comisión</Label>
                                            <Input
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
                                        <Textarea id="notas" name="notas" value={formData.notas} onChange={handleChange} placeholder="Cualquier detalle relevante para la facturación..." className="resize-none h-24" />
                                    </div>

                                    <div className="flex justify-between pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                        <Button variant="outline" onClick={prevStep}>Atrás</Button>
                                        <Button onClick={nextStep}>Siguiente</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Step 4: Resumen */}
                        {currentStep === 4 && (
                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        <CardTitle>Resumen de Solicitud</CardTitle>
                                    </div>
                                    <CardDescription>Revisa los datos antes de enviar.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="space-y-4">
                                        <div className="rounded-lg border p-4 space-y-3">
                                            <h3 className="font-semibold text-sm text-slate-900 border-b pb-2 mb-2">Vendedor</h3>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <span className="text-slate-500">Nombre:</span>
                                                <span className="font-medium text-right">{formData.vendedorNombre}</span>
                                                <span className="text-slate-500">RUT:</span>
                                                <span className="font-medium text-right">{formData.vendedorRut}</span>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border p-4 space-y-3">
                                            <h3 className="font-semibold text-sm text-slate-900 border-b pb-2 mb-2">Comprador</h3>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <span className="text-slate-500">Nombre:</span>
                                                <span className="font-medium text-right">{formData.compradorNombre}</span>
                                                <span className="text-slate-500">RUT:</span>
                                                <span className="font-medium text-right">{formData.compradorRut}</span>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border p-4 space-y-3">
                                            <h3 className="font-semibold text-sm text-slate-900 border-b pb-2 mb-2">Inmueble & Comisión</h3>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <span className="text-slate-500">Dirección:</span>
                                                <span className="font-medium text-right truncate pl-4" title={formData.propiedadDireccion}>{formData.propiedadDireccion}</span>
                                                <span className="text-slate-500">Monto:</span>
                                                <span className="font-medium text-right">{formData.montoComision}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                        <Button variant="outline" onClick={prevStep}>Atrás</Button>
                                        <Button onClick={() => saveRequest('submitted')} disabled={submitting} className="w-32 bg-green-600 hover:bg-green-700">
                                            {submitting ? 'Enviando...' : 'Enviar'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}
