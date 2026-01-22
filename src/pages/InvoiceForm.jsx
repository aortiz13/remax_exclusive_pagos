import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { toast } from 'sonner'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardDescription, Separator, Textarea } from '@/components/ui'
import { ArrowLeft, Save, Send, Receipt } from 'lucide-react'

export default function InvoiceForm() {
    const { id } = useParams()
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(!!id)
    const [submitting, setSubmitting] = useState(false)

    const [formData, setFormData] = useState({
        compradorNombre: '',
        compradorRut: '',
        compradorDireccion: '',
        compradorEmail: '',
        vendedorNombre: '',
        vendedorRut: '',
        vendedorDireccion: '',
        vendedorEmail: '',
        propiedadDireccion: '',
        montoComision: '',
        notas: ''
    })

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
                }
                setLoading(false)
            }
            fetchRequest()
        }
    }, [id, navigate])


    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const saveRequest = async (status = 'draft') => {
        if (!user) return

        setSubmitting(true)
        const payload = {
            user_id: user.id,
            type: 'invoice',
            step: 1, // Single step
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
                toast.success('Borrador guardado')
                if (!id && requestData) {
                    navigate(`/request/invoice/${requestData.id}`, { replace: true })
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
        const webhookPayload = {
            solicitud: 'factura',
            agente: {
                nombre: profile?.first_name || '',
                apellido: profile?.last_name || '',
                email: user?.email || '',
                telefono: profile?.phone || ''
            },
            ...formData,
            requestId: requestData.id,
            createdAt: new Date().toISOString()
        }

        try {
            // Using no-cors mode since we can't read response from opaque connection anyway usually
            // but for tracking success we might try standard fetch.
            // If the user provided URL supports CORS, great. If not, we might need a proxy or Edge Function.
            // Assuming standard fetch for now as requested.
            await fetch('https://workflow.remax-exclusive.cl/webhook-test/boleto_de_pago', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(webhookPayload)
            })
        } catch (error) {
            console.error('Webhook error:', error)
            // We don't block the UI flow on webhook error generally unless critical, 
            // but we might want to alert. For now just logging.
            toast.warning('Solicitud guardada, pero hubo un problema notificando al sistema externo.')
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 py-4 mb-6 shadow-sm">
                <div className="container max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/new-request')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-blue-600" />
                                Solicitud de Factura
                            </h1>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => saveRequest('draft')} disabled={submitting}>
                            <Save className="mr-2 h-4 w-4" />
                            Guardar
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container max-w-3xl mx-auto px-4 space-y-6">

                {/* Comprador Data */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Datos del Comprador</CardTitle>
                        <CardDescription>Información de quien adquiere la propiedad.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </CardContent>
                </Card>

                {/* Vendedor Data */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Datos del Vendedor</CardTitle>
                        <CardDescription>Información del propietario actual.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </CardContent>
                </Card>

                {/* Propiedad y Transacción */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Detalles de la Operación</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="propiedadDireccion">Dirección de la Propiedad Vendida</Label>
                            <Input id="propiedadDireccion" name="propiedadDireccion" value={formData.propiedadDireccion} onChange={handleChange} placeholder="Dirección del inmueble objeto de la venta" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="montoComision">Monto Comisión</Label>
                                <Input id="montoComision" name="montoComision" value={formData.montoComision} onChange={handleChange} placeholder="Ej: 2% + IVA o valor fijo" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notas">Notas Adicionales (Opcional)</Label>
                            <Textarea id="notas" name="notas" value={formData.notas} onChange={handleChange} placeholder="Cualquier detalle relevante para la facturación..." className="resize-none h-24" />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-4 pb-8">
                    <Button size="lg" onClick={() => saveRequest('submitted')} disabled={submitting} className="w-full md:w-auto">
                        <Send className="mr-2 h-4 w-4" />
                        Enviar Solicitud
                    </Button>
                </div>

            </div>
        </div>
    )
}
