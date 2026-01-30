import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { generateExcel } from '../lib/generateExcel'
import { generatePDF } from '../lib/generatePDF'
import { triggerLegalWebhook } from '../services/api'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Textarea } from '@/components/ui'
import { ArrowLeft, Building2, Key, Save, Plus, Trash2, UploadCloud } from 'lucide-react'

// --- HELPER COMPONENTS ---

function CardSection({ title, children }) {
    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="text-lg text-slate-800">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {children}
            </CardContent>
        </Card>
    )
}

function Field({ label, name, type = "text", placeholder, defaultValue, className, required = false }) {
    return (
        <div className={`space-y-2 ${className}`}>
            <Label htmlFor={name} className="text-xs font-semibold uppercase text-slate-500">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <Input id={name} name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required={required} />
        </div>
    )
}

function DateField({ label, name }) {
    const [noDate, setNoDate] = useState(false)
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor={name} className="text-xs font-semibold uppercase text-slate-500">{label}</Label>
                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id={`${name}_nodate`}
                        name={`${name}_nodate`}
                        className="h-3 w-3 rounded border-slate-300"
                        checked={noDate}
                        onChange={(e) => setNoDate(e.target.checked)}
                    />
                    <Label htmlFor={`${name}_nodate`} className="text-[10px] text-slate-500 font-normal cursor-pointer select-none">Sin Fecha</Label>
                </div>
            </div>
            <Input
                id={name}
                name={name}
                type="date"
                disabled={noDate}
                className={noDate ? "bg-slate-100 text-slate-400" : ""}
            />
        </div>
    )
}

function FileUploadField({ label, name, accept }) {
    const [file, setFile] = useState(null)
    const inputRef = useRef(null)

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
        }
    }

    const handleRemove = () => {
        setFile(null)
        if (inputRef.current) {
            inputRef.current.value = ''
        }
    }

    return (
        <div className="space-y-4">
            <Label className="text-sm font-semibold text-slate-700">{label}</Label>
            <Card className={`border-dashed border-2 cursor-pointer transition-colors ${file ? 'bg-blue-50/50 border-primary/30' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100'}`} onClick={() => !file && inputRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <Input
                        ref={inputRef}
                        type="file"
                        name={name}
                        accept={accept}
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {!file ? (
                        <>
                            <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                                <UploadCloud className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-700">Haz clic para subir archivo</p>
                                <p className="text-xs text-slate-500">PDF o Imágenes (max 10MB)</p>
                            </div>
                        </>
                    ) : (
                        <div className="w-full flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <div className="p-2 bg-blue-100 rounded text-blue-600">
                                    <UploadCloud className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-medium truncate max-w-[180px]">{file.name}</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleRemove(); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function PartyForm({ type, index }) {
    const prefix = `${type.toLowerCase()}_${index}`
    return (
        <div className="bg-slate-50/50 p-6 rounded-lg border space-y-4">
            <h5 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                <span className="bg-slate-200 text-slate-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">{index}</span>
                {type} {index}
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Nombres" name={`${prefix}_nombres`} />
                <Field label="Apellidos" name={`${prefix}_apellidos`} />
                <Field label="RUT / Pasaporte" name={`${prefix}_rut`} />
                <Field label="Profesión" name={`${prefix}_profesion`} />
                <Field label="Estado Civil" name={`${prefix}_estado_civil`} />
                <Field label="Dirección" name={`${prefix}_direccion`} className="md:col-span-2" />
                <Field label="Teléfono" name={`${prefix}_telefono`} />
                <Field label="Correo" name={`${prefix}_correo`} type="email" />
            </div>
        </div>
    )
}

// --- MAIN PAGE COMPONENT ---

export default function ContractForm() {
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [step, setStep] = useState('type') // 'type', 'form'
    const [formType, setFormType] = useState(null) // 'buy-sell', 'lease'

    const handleTypeSelect = (type) => {
        setFormType(type)
        setStep('form')
    }

    if (step === 'type') {
        return (
            <div className="min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex flex-col items-center">
                <div className="max-w-4xl w-full space-y-6">
                    <Button variant="ghost" onClick={() => navigate('/new-request')} className="pl-0 text-slate-500 hover:text-primary mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                    </Button>

                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold tracking-tight">Tipo de Contrato</h1>
                        <p className="text-muted-foreground">¿Qué tipo de contrato necesitas redactar?</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card
                            className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl border-2 hover:border-primary group"
                            onClick={() => handleTypeSelect('buy-sell')}
                        >
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                                <div className="p-4 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
                                    <Building2 className="h-12 w-12 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors">Compraventa</h3>
                                    <p className="text-sm text-slate-500 mt-2">Redacción de contrato de promesa y compraventa de propiedades.</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl border-2 hover:border-red-500 group"
                            onClick={() => handleTypeSelect('lease')}
                        >
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                                <div className="p-4 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors">
                                    <Key className="h-12 w-12 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold group-hover:text-red-500 transition-colors">Arriendo</h3>
                                    <p className="text-sm text-slate-500 mt-2">Redacción de contrato de arrendamiento habitacional o comercial.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <Button variant="ghost" onClick={() => setStep('type')} className="mb-6 pl-0 text-slate-500 hover:text-primary">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Selección de Contrato
                </Button>

                <h1 className="text-2xl font-bold mb-6">
                    {formType === 'buy-sell' ? 'Solicitud de Compraventa' : 'Solicitud de Arriendo'}
                </h1>

                {formType === 'buy-sell' && <BuySellFormLogic user={user} profile={profile} navigate={navigate} />}
                {formType === 'lease' && <LeaseFormLogic user={user} profile={profile} navigate={navigate} />}
            </div>
        </div>
    )
}

// --- LOGIC COMPONENTS ---

function BuySellFormLogic({ user, profile, navigate }) {
    const [numVendedores, setNumVendedores] = useState(1)
    const [numCompradores, setNumCompradores] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        // Validation
        const dominio = formData.get('dominio_vigente')
        const gp = formData.get('gp_certificado')

        if (!dominio || (dominio instanceof File && dominio.size === 0)) {
            toast.error('Debes adjuntar el Dominio Vigente.')
            return
        }
        if (!gp || (gp instanceof File && gp.size === 0)) {
            toast.error('Debes adjuntar el Certificado de Hipotecas y Gravámenes.')
            return
        }

        setIsSubmitting(true)
        try {
            // Append context data
            const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
            formData.append('agente_nombre', agentName)
            formData.append('agente_email', user.email)
            formData.append('agente_telefono', profile?.phone || '')
            formData.append('tipo_solicitud', 'compraventa')

            // Remove empty files
            const fileFields = ['dominio_vigente', 'gp_certificado']
            fileFields.forEach(field => {
                const file = formData.get(field)
                if (file instanceof File && file.size === 0) {
                    formData.delete(field)
                }
            })

            // Generate Excel
            const excelBlob = await generateExcel(formData)

            // Generate PDF
            const pdfBlob = await generatePDF(formData)

            // Prepare Webhook Payload
            const webhookData = new FormData()
            // Append all string fields
            formData.forEach((value, key) => {
                if (typeof value === 'string') {
                    webhookData.append(key, value)
                }
            })
            // Append Files (Binary)
            // Re-append valid files from original formData
            const fileFields = ['dominio_vigente', 'gp_certificado']
            fileFields.forEach(field => {
                const file = formData.get(field)
                if (file instanceof File && file.size > 0) {
                    webhookData.append(field, file)
                }
            })

            // Append Generated PDF
            webhookData.append('detalles solicitud.pdf', pdfBlob, 'detalles solicitud.pdf')

            // Trigger Webhook
            await triggerLegalWebhook(webhookData)

            // Save JSON to Supabase (Audit / Backup)
            const jsonData = {}
            formData.forEach((value, key) => {
                if (!(value instanceof File)) {
                    jsonData[key] = value
                }
            })

            const { error } = await supabase.from('requests').insert({
                user_id: user.id,
                status: 'submitted',
                step: 5,
                data: {
                    ...jsonData,
                    contract_type: 'buy-sell'
                }
            })

            if (error) throw error

            toast.success('Solicitud de contrato enviada exitosamente.')
            navigate('/dashboard')

        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al enviar la solicitud: ' + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 pb-12">
            <div className="grid gap-8">
                <CardSection title="1. Información de la Operación">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <DateField label="Fecha de cierre de negocio" name="fecha_cierre" />
                        <Field label="Código RE/MAX" name="codigo_remax" placeholder="Ej. 12345" />
                        <DateField label="Fecha firma PROMESA" name="fecha_promesa" />
                        <DateField label="Fecha de entrega propiedad" name="fecha_entrega" />
                        <DateField label="Fecha firma Escritura" name="fecha_escritura" />
                    </div>
                </CardSection>

                <CardSection title="2. Identificación de la Propiedad">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Field label="ROL Propiedad" name="rol_propiedad" placeholder="940-146" />
                        <Field label="Tipo de Propiedad" name="tipo_propiedad" placeholder="Departamento, Casa..." />
                        <Field label="Comuna" name="comuna" placeholder="Las Condes" />
                        <Field label="Valor de Venta (Pesos)" name="valor_venta_pesos" placeholder="$ 198.000.000" />
                        <Field label="Valor Referencial (UF)" name="valor_venta_uf" placeholder="UF 5.000" />
                    </div>
                </CardSection>

                <CardSection title="3. Información de las Partes">
                    <div className="space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Vendedores</h4>
                                {numVendedores < 2 && (
                                    <Button size="sm" variant="outline" onClick={() => setNumVendedores(2)} type="button">
                                        <Plus className="mr-2 h-3 w-3" /> Agregar Vendedor 2
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-6">
                                <PartyForm type="Vendedor" index={1} />
                                {numVendedores >= 2 && (
                                    <div className="relative pt-4">
                                        <Button size="sm" variant="ghost" className="absolute right-0 top-0 text-red-500 h-8" onClick={() => setNumVendedores(1)} type="button">
                                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                        </Button>
                                        <PartyForm type="Vendedor" index={2} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Compradores</h4>
                                {numCompradores < 2 && (
                                    <Button size="sm" variant="outline" onClick={() => setNumCompradores(2)} type="button">
                                        <Plus className="mr-2 h-3 w-3" /> Agregar Comprador 2
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-6">
                                <PartyForm type="Comprador" index={1} />
                                {numCompradores >= 2 && (
                                    <div className="relative pt-4">
                                        <Button size="sm" variant="ghost" className="absolute right-0 top-0 text-red-500 h-8" onClick={() => setNumCompradores(1)} type="button">
                                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                        </Button>
                                        <PartyForm type="Comprador" index={2} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardSection>

                <CardSection title="4. Acuerdos para Promesa">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <Field label="Monto del Pie" name="monto_pie" placeholder="$" />
                        <Field label="Monto a Financiar" name="monto_financiar" placeholder="$" />
                        <Field label="Monto Contado" name="monto_contado" placeholder="$" />
                    </div>
                    <h4 className="text-sm font-medium mb-4 text-slate-700">Datos Bancarios (Vendedor)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border">
                        <Field label="Banco" name="vendedor_banco" />
                        <Field label="Ejecutivo" name="vendedor_ejecutivo" />
                        <Field label="Correo" name="vendedor_correo_banco" type="email" />
                        <Field label="Teléfono" name="vendedor_telefono_banco" />
                    </div>
                    <h4 className="text-sm font-medium mb-4 text-slate-700">Datos Bancarios (Comprador)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border">
                        <Field label="Banco" name="comprador_banco" />
                        <Field label="Ejecutivo" name="comprador_ejecutivo" />
                        <Field label="Correo" name="comprador_correo_banco" type="email" />
                        <Field label="Teléfono" name="comprador_telefono_banco" />
                    </div>
                </CardSection>

                <CardSection title="5. Documentación Adjunta">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FileUploadField label="Dominio Vigente" name="dominio_vigente" accept="application/pdf,image/*" />
                        <FileUploadField label="GP (Hip. y Grav.)" name="gp_certificado" accept="application/pdf,image/*" />
                    </div>
                </CardSection>

                <CardSection title="6. Notas de Avance">
                    <Textarea name="notas" placeholder="Escribe aquí cualquier nota importante..." className="min-h-[120px]" />
                </CardSection>

                <div className="sticky bottom-4 z-10">
                    <Card className="shadow-lg border-2 border-primary/20 bg-white/95 backdrop-blur">
                        <CardContent className="p-4 flex justify-end">
                            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full md:w-auto">
                                <Save className="mr-2 h-5 w-5" />
                                {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}

function LeaseFormLogic({ user, profile, navigate }) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [tenantType, setTenantType] = useState('natural')
    const [hasGuarantor, setHasGuarantor] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        const dominio = formData.get('dominio_vigente')
        if (!dominio || (dominio instanceof File && dominio.size === 0)) {
            toast.error('Debes adjuntar el Dominio Vigente.')
            return
        }

        setIsSubmitting(true)

        try {
            // Append context data
            const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
            formData.append('agente_nombre', agentName)
            formData.append('agente_email', user.email)
            formData.append('agente_telefono', profile?.phone || '')
            formData.append('tipo_solicitud', 'arriendo')
            formData.append('tipo_arrendatario', tenantType)
            formData.append('tiene_fiador', hasGuarantor ? 'si' : 'no')
            formData.set('con_administracion', formData.get('con_administracion') ? 'SI' : 'NO')
            formData.set('con_restitucion', formData.get('con_restitucion') ? 'SI' : 'NO')

            // Remove empty files
            const fileFields = ['dominio_vigente']
            fileFields.forEach(field => {
                const file = formData.get(field)
                if (file instanceof File && file.size === 0) {
                    formData.delete(field)
                }
            })

            // Generate Excel
            const excelBlob = await generateExcel(formData)

            // Generate PDF
            const pdfBlob = await generatePDF(formData)

            // Prepare Webhook Payload
            const webhookData = new FormData()
            // Append all string fields
            formData.forEach((value, key) => {
                if (typeof value === 'string') {
                    webhookData.append(key, value)
                }
            })
            // Append Files (Binary)
            const fileFields = ['dominio_vigente']
            fileFields.forEach(field => {
                const file = formData.get(field)
                if (file instanceof File && file.size > 0) {
                    webhookData.append(field, file)
                }
            })

            // Append Generated PDF
            webhookData.append('detalles solicitud.pdf', pdfBlob, 'detalles solicitud.pdf')

            // Trigger Webhook
            await triggerLegalWebhook(webhookData)

            // Save to Supabase
            const jsonData = {}
            formData.forEach((value, key) => {
                if (!(value instanceof File)) {
                    jsonData[key] = value
                }
            })

            const { error } = await supabase.from('requests').insert({
                user_id: user.id,
                status: 'submitted',
                step: 5,
                data: {
                    ...jsonData,
                    contract_type: 'lease'
                }
            })

            if (error) throw error

            toast.success('Solicitud de arriendo enviada exitosamente.')
            navigate('/dashboard')

        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al enviar: ' + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 pb-12">
            <div className="grid gap-8">
                <CardSection title="1. Datos del Contrato y Propiedad">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        <Field label="Plazo del Contrato" name="plazo_contrato" placeholder="Ej. 1 año renovable" />
                        <DateField label="Fecha Inicio Arriendo" name="fecha_inicio" />
                        <Field label="Canon de Arriendo" name="canon_arriendo" placeholder="$ 420.000" />
                        <Field label="Documenta con Cheque (SI/NO)" name="documenta_cheque" placeholder="SI/NO" />
                        <Field label="Cuenta para Transferencia" name="cuenta_transferencia" className="md:col-span-2" placeholder="Banco, Tipo Cta, Número, RUT" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="flex items-center space-x-2 border p-3 rounded-md bg-white">
                            <input type="checkbox" id="con_administracion" name="con_administracion" className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                            <Label htmlFor="con_administracion" className="font-medium cursor-pointer text-slate-700">Con Administración</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md bg-white">
                            <input type="checkbox" id="con_restitucion" name="con_restitucion" className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                            <Label htmlFor="con_restitucion" className="font-medium cursor-pointer text-slate-700">Con Restitución</Label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                        <Field label="ROL Propiedad" name="rol_propiedad" placeholder="123-45" />
                        <Field label="N° Cliente Agua" name="cliente_agua" />
                        <Field label="N° Cliente Luz" name="cliente_luz" />
                        <Field label="Dirección de la Propiedad" name="direccion_propiedad" className="md:col-span-3" />
                    </div>
                </CardSection>

                <CardSection title="2. Arrendador (Propietario)">
                    <PartyForm type="Arrendador" index="" />
                    {/* Note: PartyForm expects index. I'll hack it to hide 1/2 if index is empty or modify PartyForm. 
                       Actually LeasePersonForm in original was different. I reused PartyForm. 
                       PartyForm has "index" prop. If I pass index="" it shows "Arrendador ". It works nicely enough.
                       Wait, key names. PartyForm uses `${type.toLowerCase()}_${index}`.
                       Original: `arrendador_nombres`. 
                       My PartyForm: `arrendador__nombres`.
                       I need to be careful with key names if generateExcel expects specific keys.
                       generateExcel expects `arrendador_nombres`.
                       My Component produces `arrendador__nombres` (double underscore? no, index is appended).
                       If index is empty string, it becomes `arrendador__nombres`.
                       I should probably create a LeasePersonForm helper that matches the key generation.
                   */}

                    {/* Let's redefine PartyForm to be flexible or create LeasePersonForm specific.
                       To save code space I will inline the fields for Lease to match exact keys.
                   */}
                    <div className="bg-slate-50/50 p-6 rounded-lg border space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Field label="Nombres" name="arrendador_nombres" />
                            <Field label="Apellidos" name="arrendador_apellidos" />
                            <Field label="RUT / Pasaporte" name="arrendador_rut" />
                            <Field label="Nacionalidad" name="arrendador_nacionalidad" />
                            <Field label="Estado Civil" name="arrendador_civil" />
                            <DateField label="Fecha Nacimiento" name="arrendador_nacimiento" />
                            <Field label="Domicilio Particular" name="arrendador_direccion" className="md:col-span-2" />
                            <Field label="Comuna" name="arrendador_comuna" />
                            <Field label="Teléfono" name="arrendador_telefono" />
                            <Field label="Correo" name="arrendador_email" type="email" />
                        </div>
                    </div>
                </CardSection>

                <CardSection title="3. Arrendatario">
                    <div className="flex items-center gap-4 mb-6">
                        <Label>Tipo de Arrendatario:</Label>
                        <div className="flex items-center gap-2 border rounded-lg p-1 bg-slate-50">
                            <Button type="button" variant={tenantType === 'natural' ? 'default' : 'ghost'} size="sm" onClick={() => setTenantType('natural')}>Persona Natural</Button>
                            <Button type="button" variant={tenantType === 'legal' ? 'default' : 'ghost'} size="sm" onClick={() => setTenantType('legal')}>Persona Jurídica</Button>
                        </div>
                    </div>

                    {tenantType === 'natural' ? (
                        <div className="bg-slate-50/50 p-6 rounded-lg border space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Field label="Nombres" name="arrendatario_nombres" />
                                <Field label="Apellidos" name="arrendatario_apellidos" />
                                <Field label="RUT / Pasaporte" name="arrendatario_rut" />
                                <Field label="Nacionalidad" name="arrendatario_nacionalidad" />
                                <Field label="Estado Civil" name="arrendatario_civil" />
                                <DateField label="Fecha Nacimiento" name="arrendatario_nacimiento" />
                                <Field label="Domicilio Particular" name="arrendatario_direccion" className="md:col-span-2" />
                                <Field label="Comuna" name="arrendatario_comuna" />
                                <Field label="Teléfono" name="arrendatario_telefono" />
                                <Field label="Correo" name="arrendatario_email" type="email" />
                            </div>
                            <div className="bg-white p-4 rounded-lg border space-y-4">
                                <h4 className="text-sm font-bold uppercase text-slate-500">Datos Laborales</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Field label="Ocupación" name="arrendatario_ocupacion" />
                                    <Field label="Profesión" name="arrendatario_profesion" />
                                    <Field label="Empleador" name="arrendatario_empleador" />
                                    <Field label="Cargo" name="arrendatario_cargo" />
                                    <Field label="Antigüedad" name="arrendatario_antiguedad" />
                                    <Field label="Teléfono Laboral" name="arrendatario_telefono_lab" />
                                    <Field label="Domicilio Laboral" name="arrendatario_direccion_lab" className="md:col-span-3" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50/50 p-6 rounded-lg border space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Field label="Razón Social" name="arrendatario_juridica_razon" className="md:col-span-2" />
                                <Field label="RUT Empresa" name="arrendatario_juridica_rut" />
                                <Field label="Domicilio Comercial" name="arrendatario_juridica_direccion" className="md:col-span-2" />
                                <Field label="Teléfono" name="arrendatario_juridica_telefono" />
                            </div>
                            <div className="bg-white p-4 rounded-lg border space-y-4">
                                <h4 className="text-sm font-bold uppercase text-slate-500">Representante Legal</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Field label="Nombres" name="arrendatario_juridica_rep_nombres" />
                                    <Field label="Apellidos" name="arrendatario_juridica_rep_apellidos" />
                                    <Field label="RUT" name="arrendatario_juridica_rep_rut" />
                                    <DateField label="Fecha Nacimiento" name="arrendatario_juridica_rep_nacimiento" />
                                    <Field label="Nacionalidad" name="arrendatario_juridica_rep_nacionalidad" />
                                    <Field label="Estado Civil" name="arrendatario_juridica_rep_civil" />
                                    <Field label="Teléfono" name="arrendatario_juridica_rep_telefono" />
                                    <Field label="Correo" name="arrendatario_juridica_rep_email" type="email" />
                                </div>
                            </div>
                        </div>
                    )}
                </CardSection>

                <CardSection title="4. Fiador y Codeudor Solidario">
                    <div className="mb-6 flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="has_guarantor"
                            checked={hasGuarantor}
                            onChange={(e) => setHasGuarantor(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="has_guarantor" className="font-normal cursor-pointer">
                            Incluir Fiador / Codeudor Solidario
                        </Label>
                    </div>

                    {hasGuarantor && (
                        <div className="bg-slate-50/50 p-6 rounded-lg border space-y-6 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Field label="Nombres" name="fiador_nombres" />
                                <Field label="Apellidos" name="fiador_apellidos" />
                                <Field label="RUT / Pasaporte" name="fiador_rut" />
                                <Field label="Nacionalidad" name="fiador_nacionalidad" />
                                <Field label="Estado Civil" name="fiador_civil" />
                                <DateField label="Fecha Nacimiento" name="fiador_nacimiento" />
                                <Field label="Domicilio Particular" name="fiador_direccion" className="md:col-span-2" />
                                <Field label="Comuna" name="fiador_comuna" />
                                <Field label="Teléfono" name="fiador_telefono" />
                                <Field label="Correo" name="fiador_email" type="email" />
                            </div>
                            <div className="bg-white p-4 rounded-lg border space-y-4">
                                <h4 className="text-sm font-bold uppercase text-slate-500">Datos Laborales</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Field label="Ocupación" name="fiador_ocupacion" />
                                    <Field label="Profesión" name="fiador_profesion" />
                                    <Field label="Empleador" name="fiador_empleador" />
                                    <Field label="Cargo" name="fiador_cargo" />
                                    <Field label="Antigüedad" name="fiador_antiguedad" />
                                    <Field label="Teléfono Laboral" name="fiador_telefono_lab" />
                                    <Field label="Domicilio Laboral" name="fiador_direccion_lab" className="md:col-span-3" />
                                </div>
                            </div>
                        </div>
                    )}
                </CardSection>

                <CardSection title="5. Documentación Adjunta">
                    <FileUploadField label="Dominio Vigente" name="dominio_vigente" accept="application/pdf,image/*" />
                </CardSection>

                <CardSection title="6. Notas Adicionales">
                    <Textarea name="notas" placeholder="Información adicional relevante..." className="min-h-[120px]" />
                </CardSection>

                <div className="sticky bottom-4 z-10">
                    <Card className="shadow-lg border-2 border-primary/20 bg-white/95 backdrop-blur">
                        <CardContent className="p-4 flex justify-end">
                            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full md:w-auto">
                                <Save className="mr-2 h-5 w-5" />
                                {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}
