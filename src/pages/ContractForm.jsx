import { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, Upload, Plus, Trash2, MapPin, Search, ChevronRight, FileText, FileSignature, Handshake, CheckCircle2, ChevronDown, UserPlus, Users } from 'lucide-react'
import { supabase } from '../services/supabase'

import { useAuth } from '../context/AuthContext'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import ContactPickerInline from '../components/ui/ContactPickerInline'
import PropertyPickerInline from '../components/ui/PropertyPickerInline'
import { autoLinkContactProperty } from '../services/autoLink'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Textarea } from '@/components/ui'
import { ArrowLeft, Building2, Key, Save, UploadCloud, FilePlus } from 'lucide-react'

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
        <div className={"space-y-2 " + (className || "")}>
            <Label htmlFor={name} className="text-xs font-semibold uppercase text-slate-500">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <Input id={name} name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required={required} />
        </div>
    )
}

function DateField({ label, name, defaultValue, ...rest }) {
    const [noDate, setNoDate] = useState(false)

    useEffect(() => {
        // If defaultValue is empty or null, we might consider "Sin Fecha", 
        // but typically standard date input just shows empty.
        // If we want to support "Sin Fecha" persistence, we'd need a separate field.
        // For now, simple initialization.
    }, [defaultValue])

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor={name} className="text-xs font-semibold uppercase text-slate-500">{label}</Label>

            </div>
            <Input
                id={name}
                name={name}
                type="date"
                defaultValue={defaultValue}
                disabled={noDate}
                required={rest.required}
                className=""
            />
        </div>
    )
}

function FileUploadField({ label, name, accept, multiple = false }) {
    const [files, setFiles] = useState([])
    const inputRef = useRef(null)

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files || [])
        if (selectedFiles.length > 0) {
            setFiles(prev => multiple ? [...prev, ...selectedFiles] : [selectedFiles[0]])
        }
    }

    const handleRemove = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
        if (inputRef.current) {
            inputRef.current.value = ''
        }
    }

    return (
        <div className="space-y-4">
            <Label className="text-sm font-semibold text-slate-700">{label}</Label>
            <Card className={"border-dashed border-2 cursor-pointer transition-colors " + (files.length > 0 ? 'bg-blue-50/50 border-primary/30' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100')} onClick={() => inputRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <Input
                        ref={inputRef}
                        type="file"
                        name={multiple ? name + '[]' : name}
                        accept={accept}
                        multiple={multiple}
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {files.length === 0 ? (
                        <>
                            <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                                <UploadCloud className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-700">Haz clic para subir {multiple ? 'archivos' : 'archivo'}</p>
                                <p className="text-xs text-slate-500">PDF o Imágenes (max 10MB)</p>
                            </div>
                        </>
                    ) : (
                        <div className="w-full space-y-2">
                            {files.map((file, idx) => (
                                <div key={idx} className="w-full flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                        <div className="p-2 bg-blue-100 rounded text-blue-600">
                                            <UploadCloud className="h-4 w-4" />
                                        </div>
                                        <span className="text-sm font-medium truncate max-w-[180px]">{file.name}</span>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {multiple && (
                                <p className="text-xs text-center text-slate-400 mt-2">Click para agregar más</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function PartyForm({ typeLabel, index, prefix, initialData = {}, onRemove, isRemovable, hideLaborData = false }) {
    const [personType, setPersonType] = useState('natural') // natural | juridica

    // Helper to get value
    const getValue = (suffix) => initialData[`${prefix}_${suffix} `] || ''

    // State for CRM pre-fill
    const [prefilledData, setPrefilledData] = useState({})

    // Helper to get effective value (prefer prefilled over initial)
    const getEffectiveValue = (suffix) => prefilledData[`${prefix}_${suffix} `] !== undefined ? prefilledData[`${prefix}_${suffix} `] : getValue(suffix)

    // Check if we have initial data effectively switching the type
    useEffect(() => {
        if (getValue('juridica_razon')) {
            setPersonType('juridica')
        }
    }, [])

    const handleContactSelect = (contact) => {
        setPrefilledData(prev => ({
            ...prev,
            [`${prefix} _nombres`]: contact.first_name || '',
            [`${prefix} _apellidos`]: contact.last_name || '',
            [`${prefix} _rut`]: contact.rut || '',
            [`${prefix} _email`]: contact.email || '',
            [`${prefix} _telefono`]: contact.phone || '',
            [`${prefix} _direccion`]: contact.address || '',
            [`${prefix} _contact_id`]: contact.id
        }))
    }

    return (
        <div className="bg-slate-50/50 p-6 rounded-lg border space-y-4 relative animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-4">
                <h5 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                    <span className="bg-slate-200 text-slate-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">{index + 1}</span>
                    {typeLabel}
                </h5>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white rounded-md border p-1 h-8 items-center">
                        <button
                            type="button"
                            onClick={() => setPersonType('natural')}
                            className={`text - xs px - 2 py - 1 rounded transition - colors ${personType === 'natural' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'} `}
                        >
                            Natural
                        </button>
                        <button
                            type="button"
                            onClick={() => setPersonType('juridica')}
                            className={`text - xs px - 2 py - 1 rounded transition - colors ${personType === 'juridica' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'} `}
                        >
                            Jurídica
                        </button>
                    </div>
                    {isRemovable && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={onRemove} type="button">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <input type="hidden" name={`${prefix} _tipo_persona`} value={personType} />
            <input type="hidden" name={`${prefix} _contact_id`} value={prefilledData[`${prefix} _contact_id`] || ''} />

            {personType === 'natural' && (
                <ContactPickerInline
                    onSelectContact={handleContactSelect}
                    label={`Pre - llenar datos del ${typeLabel.toLowerCase()} `}
                />
            )}

            {personType === 'natural' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field label="Nombres" name={`${prefix} _nombres`} defaultValue={getEffectiveValue('nombres')} required />
                    <Field label="Apellidos" name={`${prefix} _apellidos`} defaultValue={getEffectiveValue('apellidos')} required />
                    <Field label="RUT / Pasaporte" name={`${prefix} _rut`} defaultValue={getEffectiveValue('rut')} required />
                    <Field label="Nacionalidad" name={`${prefix} _nacionalidad`} defaultValue={getEffectiveValue('nacionalidad')} />

                    {['Vendedor', 'Comprador'].includes(typeLabel) ? (
                        <div className="space-y-2">
                            <Label htmlFor={`${prefix} _civil`} className="text-xs font-semibold uppercase text-slate-500">Estado Civil</Label>
                            <select
                                id={`${prefix} _civil`}
                                name={`${prefix} _civil`}
                                defaultValue={getValue('civil')}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <option value="">Seleccione...</option>
                                <option value="Soltero">Soltero</option>
                                <option value="Casado Bajo comunidad Conyugal">Casado Bajo comunidad Conyugal</option>
                                <option value="Casado con Separación de Bienes">Casado con Separación de Bienes</option>
                                <option value="Viudo">Viudo</option>
                                <option value="Divorciado">Divorciado</option>
                                <option value="Conviviente civil con Separación de Bienes">Conviviente Civil con Separación de Bienes</option>
                                <option value="Conviviente Civil con Comunidad de Bienes">Conviviente Civil con Comunidad de Bienes</option>
                            </select>
                        </div>
                    ) : (
                        <Field label="Estado Civil" name={`${prefix} _civil`} defaultValue={getEffectiveValue('civil')} />
                    )}

                    <DateField label="Fecha Nacimiento" name={`${prefix} _nacimiento`} defaultValue={getEffectiveValue('nacimiento')} />
                    <Field label="Correo" name={`${prefix} _email`} type="email" defaultValue={getEffectiveValue('email')} required />
                    <Field label="Teléfono" name={`${prefix} _telefono`} defaultValue={getEffectiveValue('telefono')} required />
                    <Field label="Profesión" name={`${prefix} _ocupacion`} defaultValue={getEffectiveValue('ocupacion')} />
                    <Field label="Domicilio Particular" name={`${prefix} _direccion`} className="md:col-span-3" defaultValue={getEffectiveValue('direccion')} />

                    {!hideLaborData && (
                        <div className="md:col-span-3 bg-white p-4 rounded border mt-2">
                            <Label className="uppercase text-xs font-bold text-slate-400 mb-4 block">Datos Laborales</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Field label="Empleador" name={`${prefix} _empleador`} defaultValue={getValue('empleador')} />
                                <Field label="RUT Empleador" name={`${prefix} _empleador_rut`} defaultValue={getValue('empleador_rut')} />
                                <Field label="Teléfono Laboral" name={`${prefix} _telefono_lab`} defaultValue={getValue('telefono_lab')} />
                                <Field label="Dirección Laboral" name={`${prefix} _direccion_lab`} className="md:col-span-2" defaultValue={getValue('direccion_lab')} />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Razón Social" name={`${prefix} _juridica_razon`} className="md:col-span-2" defaultValue={getValue('juridica_razon')} required />
                        <Field label="RUT Empresa" name={`${prefix} _juridica_rut`} defaultValue={getValue('juridica_rut')} required />
                        <Field label="Domicilio Comercial" name={`${prefix} _juridica_direccion`} className="md:col-span-2" defaultValue={getValue('juridica_direccion')} />
                        <Field label="Teléfono" name={`${prefix} _juridica_telefono`} defaultValue={getValue('juridica_telefono')} />
                    </div>
                    <div className="bg-white p-4 rounded-lg border space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500">Representante Legal (Obligatorio)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Field label="Nombres" name={`${prefix} _juridica_rep_nombres`} defaultValue={getValue('juridica_rep_nombres')} required />
                            <Field label="Apellidos" name={`${prefix} _juridica_rep_apellidos`} defaultValue={getValue('juridica_rep_apellidos')} required />
                            <Field label="RUT Rep. Legal" name={`${prefix} _juridica_rep_rut`} defaultValue={getValue('juridica_rep_rut')} required />
                            <Field label="Nacionalidad" name={`${prefix} _juridica_rep_nacionalidad`} defaultValue={getValue('juridica_rep_nacionalidad')} />
                            <Field label="Estado Civil" name={`${prefix} _juridica_rep_civil`} defaultValue={getValue('juridica_rep_civil')} />
                            <Field label="Correo" name={`${prefix} _juridica_rep_email`} type="email" defaultValue={getValue('juridica_rep_email')} required />
                            <DateField label="Fecha Nacimiento" name={`${prefix} _juridica_rep_nacimiento`} defaultValue={getValue('juridica_rep_nacimiento')} />
                            <Field label="Domicilio Particular" name={`${prefix} _juridica_rep_direccion`} className="md:col-span-2" defaultValue={getValue('juridica_rep_direccion')} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function PartyArraySection({ title, typeLabel, prefixRoot, initialData = {}, hideLaborData = false }) {
    // Determine initial count based on data or default to 1
    // Simple check: do we have a second entry?
    // We assume sequential indices 1, 2, 3...
    const getInitialCount = () => {
        let count = 1
        // Check up to 4
        for (let i = 2; i <= 4; i++) {
            // Check a discriminatory field, e.g., name or rut
            if (initialData[`${prefixRoot}_${i} _nombres`] || initialData[`${prefixRoot}_${i} _juridica_razon`]) {
                count = i
            }
        }
        return count
    }

    const [ids, setIds] = useState(() => {
        const c = getInitialCount()
        return Array.from({ length: c }, (_, i) => i + 1) // [1, 2...]
    })

    const addParty = () => {
        if (ids.length >= 4) return
        const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1
        setIds([...ids, nextId])
    }

    const removeParty = (idToRemove) => {
        setIds(ids.filter(id => id !== idToRemove))
    }

    return (
        <CardSection title={title}>
            <div className="space-y-6">
                {ids.map((id, index) => (
                    <PartyForm
                        key={id}
                        typeLabel={typeLabel}
                        index={index} // Display index 0..N -> 1..N+1
                        prefix={`${prefixRoot}_${index + 1} `} // Store as prefix_1, prefix_2...
                        initialData={initialData}
                        onRemove={() => removeParty(id)}
                        isRemovable={ids.length > 1}
                        hideLaborData={hideLaborData}
                    />
                ))}

                {ids.length < 4 && (
                    <Button type="button" variant="outline" onClick={addParty} className="w-full border-dashed border-2">
                        <Plus className="mr-2 h-4 w-4" /> Agregar {typeLabel}
                    </Button>
                )}
            </div>
        </CardSection>
    )


}

// --- MAIN PAGE COMPONENT ---

export default function ContractForm() {
    const { id } = useParams()
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [step, setStep] = useState('type') // 'type', 'form'
    const [formType, setFormType] = useState(null) // 'buy-sell', 'lease'
    const [initialData, setInitialData] = useState({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (id) {
            setLoading(true)
            const fetchRequest = async () => {
                const { data, error } = await supabase
                    .from('requests')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (error) {
                    console.error('Error fetching request:', error)
                    toast.error('Error al cargar la solicitud')
                    navigate('/dashboard')
                    return
                }

                if (data && data.data) {
                    setInitialData(data.data)
                    setFormType(data.data.contract_type)
                    setStep('form')
                }
                setLoading(false)
            }
            fetchRequest()
        }
    }, [id, navigate])

    const handleTypeSelect = (type) => {
        setFormType(type)
        setStep('form')
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Cargando...</div>
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

                    <div className="grid gap-6 md:grid-cols-3">
                        <Card
                            className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl border-2 hover:border-primary group"
                            onClick={() => handleTypeSelect('buy-sell')}
                        >
                            <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                                <div className="p-4 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
                                    <Building2 className="h-10 w-10 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold group-hover:text-primary transition-colors">Compraventa</h3>
                                    <p className="text-xs text-slate-500 mt-2">Promesa y Compraventa de propiedades.</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl border-2 hover:border-red-500 group"
                            onClick={() => handleTypeSelect('lease')}
                        >
                            <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                                <div className="p-4 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors">
                                    <Key className="h-10 w-10 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold group-hover:text-red-500 transition-colors">Arriendo</h3>
                                    <p className="text-xs text-slate-500 mt-2">Contrato de Arriendo habitacional o comercial.</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl border-2 hover:border-purple-500 group"
                            onClick={() => handleTypeSelect('annex')}
                        >
                            <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                                <div className="p-4 rounded-full bg-purple-50 group-hover:bg-purple-100 transition-colors">
                                    <FilePlus className="h-10 w-10 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold group-hover:text-purple-600 transition-colors">Anexo</h3>
                                    <p className="text-xs text-slate-500 mt-2">Modificaciones o anexos a contratos vigentes.</p>
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
                <Button variant="ghost" onClick={() => id ? navigate('/dashboard') : setStep('type')} className="mb-6 pl-0 text-slate-500 hover:text-primary">
                    <ArrowLeft className="mr-2 h-4 w-4" /> {id ? 'Volver al Dashboard' : 'Volver a Selección de Contrato'}
                </Button>

                <h1 className="text-2xl font-bold mb-6">
                    {formType === 'buy-sell' && 'Solicitud de Compraventa'}
                    {formType === 'lease' && 'Solicitud de Arriendo'}
                    {formType === 'annex' && 'Solicitud de Anexo de Contrato'}
                    {id && ' (Edición)'}
                </h1>

                {formType === 'buy-sell' && <BuySellFormLogic user={user} profile={profile} navigate={navigate} initialData={initialData} requestId={id} />}
                {formType === 'lease' && <LeaseFormLogic user={user} profile={profile} navigate={navigate} initialData={initialData} requestId={id} />}
                {formType === 'annex' && <AnnexFormLogic user={user} profile={profile} navigate={navigate} initialData={initialData} requestId={id} />}
            </div>
        </div>
    )
}

// --- LOGIC COMPONENTS ---

function BuySellFormLogic({ user, profile, navigate, initialData = {}, requestId = null }) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const formRef = useRef(null)
    const [currency, setCurrency] = useState(initialData?.moneda_venta || 'clp')
    const [paymentMethod, setPaymentMethod] = useState(initialData?.forma_pago || 'contado')
    const [reservationCurrency, setReservationCurrency] = useState(initialData?.moneda_reserva || 'clp')

    const handleSaveDraft = async () => {
        if (!formRef.current) return
        const formData = new FormData(formRef.current)

        setIsSavingDraft(true)
        try {
            const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''} `.trim()

            const jsonData = {
                contract_type: 'buy-sell',
                agente_nombre: agentName,
                agente_email: user.email,
                agente_telefono: profile?.phone || '',
                tipo_solicitud: 'compraventa',
                moneda_venta: currency,
                forma_pago: paymentMethod,
                moneda_reserva: reservationCurrency,
            }

            for (const [key, value] of formData.entries()) {
                if (!(value instanceof File)) {
                    if (jsonData[key]) {
                        if (!Array.isArray(jsonData[key])) jsonData[key] = [jsonData[key]]
                        jsonData[key].push(value)
                    } else {
                        jsonData[key] = value
                    }
                }
            }

            let error;
            if (requestId) {
                const { error: updateError } = await supabase.from('requests').update({
                    status: 'draft',
                    updated_at: new Date(),
                    data: jsonData
                }).eq('id', requestId)
                error = updateError
            } else {
                const { error: insertError } = await supabase.from('requests').insert({
                    user_id: user.id,
                    status: 'draft',
                    step: 5,
                    data: jsonData
                })
                error = insertError
            }

            if (error) throw error

            toast.success('Borrador guardado exitosamente.')
            navigate('/dashboard')
        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al guardar borrador: ' + error.message)
        } finally {
            setIsSavingDraft(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        // Validation - Files
        const dominio = formData.getAll('dominio_vigente[]')
        const gp = formData.getAll('gp_certificado[]')

        // Check helper
        const hasValidFile = (files) => files && files.length > 0 && files.some(f => f.size > 0);

        if (!hasValidFile(dominio)) {
            const singleDom = formData.get('dominio_vigente')
            if (!singleDom || singleDom.size === 0) {
                toast.error('Debes adjuntar al menos un archivo de Dominio Vigente.')
                return
            }
        }

        if (!hasValidFile(gp)) {
            const singleGp = formData.get('gp_certificado')
            if (!singleGp || singleGp.size === 0) {
                toast.error('Debes adjuntar al menos un archivo de GP (Hipotecas y Gravámenes).')
                return
            }
        }

        setIsSubmitting(true)
        try {
            // Append context data
            const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''} `.trim()
            formData.append('agente_nombre', agentName)
            formData.append('agente_email', user.email)
            formData.append('agente_telefono', profile?.phone || '')
            formData.append('tipo_solicitud', 'compraventa')
            formData.append('moneda_venta', currency)
            formData.append('forma_pago', paymentMethod)
            formData.append('moneda_reserva', reservationCurrency)

            // Remove empty files & Re-append valid ones handled by webhookData below
            // ... (structure below handles this)

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
            // Handle multiple files correctly for webhook
            const fileFields = ['dominio_vigente', 'gp_certificado', 'otros_documentos']
            fileFields.forEach(field => {
                // Try both array syntax and plain syntax to catch all
                const filesArray = formData.getAll(`${field} []`).length > 0 ? formData.getAll(`${field} []`) : formData.getAll(field);
                if (filesArray.length > 0) {
                    filesArray.forEach(file => {
                        if (file instanceof File && file.size > 0) {
                            webhookData.append(`${field} []`, file)
                        }
                    })
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

            let error;

            if (requestId) {
                // UPDATE existing request
                const { error: updateError } = await supabase.from('requests').update({
                    status: 'submitted',
                    updated_at: new Date(),
                    data: {
                        ...jsonData,
                        contract_type: 'buy-sell'
                    }
                }).eq('id', requestId)
                error = updateError
            } else {
                // INSERT new request
                const { error: insertError } = await supabase.from('requests').insert({
                    user_id: user.id,
                    status: 'submitted',
                    step: 5,
                    data: {
                        ...jsonData,
                        contract_type: 'buy-sell'
                    }
                })
                error = insertError
            }

            if (error) throw error

            // --- AUTO-LINKING LOGIC ---
            const propId = formData.get('crm_property_id')
            const agentId = user?.id
            if (propId && agentId) {
                // Determine total number of parties using formData directly
                const partyCount = (prefix) => {
                    let count = 0;
                    for (let i = 1; i <= 4; i++) {
                        if (formData.get(`${prefix}_${i} _contact_id`)) count++;
                    }
                    return count || 1; // At least one if they filled it manually but no CRM ID, but loop below will safely ignore empty ones anyway.
                }

                // Vendedores
                for (let i = 1; i <= 4; i++) {
                    const contactId = formData.get(`vendedor_${i} _contact_id`);
                    if (contactId) {
                        await autoLinkContactProperty(contactId, propId, 'vendedor', agentId);
                    }
                }

                // Compradores
                for (let i = 1; i <= 4; i++) {
                    const contactId = formData.get(`comprador_${i} _contact_id`);
                    if (contactId) {
                        await autoLinkContactProperty(contactId, propId, 'comprador', agentId);
                    }
                }
            }

            toast.success(requestId ? 'Solicitud actualizada exitosamente.' : 'Solicitud de contrato enviada exitosamente.')
            navigate('/dashboard')

        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al enviar la solicitud: ' + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-8 pb-12">
            <div className="grid gap-8">
                <CardSection title="1. Información de la Operación">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <DateField label="Fecha de cierre de negocio" name="fecha_cierre" defaultValue={initialData.fecha_cierre} />
                        <Field label="Código RE/MAX" name="codigo_remax" placeholder="Ej. 12345" defaultValue={initialData.codigo_remax} />
                        <DateField label="Fecha firma PROMESA" name="fecha_promesa" defaultValue={initialData.fecha_promesa} />
                        <DateField label="Fecha de entrega propiedad" name="fecha_entrega" defaultValue={initialData.fecha_entrega} />
                        <DateField label="Fecha firma Escritura" name="fecha_escritura" defaultValue={initialData.fecha_escritura} />
                    </div>
                </CardSection>

                <CardSection title="2. Identificación de la Propiedad">
                    <PropertyPickerInline
                        onSelectProperty={(property) => {
                            // Find and update the inputs directly since they are uncontrolled via Field component
                            const form = formRef.current
                            if (!form) return
                            const setInputValue = (name, value) => {
                                const el = form.elements[name]
                                if (el) el.value = value || ''
                            }
                            setInputValue('rol_propiedad', property.tax_id || '')
                            setInputValue('tipo_propiedad', property.property_type || '')
                            setInputValue('comuna', property.commune || '')
                            setInputValue('direccion_propiedad', property.address || '')
                            // Create hidden input to store ID for auto-linking if it doesn't exist
                            let hiddenInput = form.querySelector('input[name="crm_property_id"]')
                            if (!hiddenInput) {
                                hiddenInput = document.createElement('input')
                                hiddenInput.type = 'hidden'
                                hiddenInput.name = 'crm_property_id'
                                form.appendChild(hiddenInput)
                            }
                            hiddenInput.value = property.id
                        }}
                        label="Pre-llenar datos de la propiedad"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                        <Field label="ROL Propiedad" name="rol_propiedad" placeholder="940-146" defaultValue={initialData.rol_propiedad} />
                        <Field label="Tipo de Propiedad" name="tipo_propiedad" placeholder="Departamento, Casa..." defaultValue={initialData.tipo_propiedad} />
                        <Field label="Comuna" name="comuna" placeholder="Las Condes" defaultValue={initialData.comuna} />
                        <Field label="Dirección de la Propiedad" name="direccion_propiedad" className="md:col-span-2" defaultValue={initialData.direccion_propiedad} />

                        <div className="space-y-2">
                            <Label>Moneda de Venta</Label>
                            <div className="flex bg-white rounded-md border p-1 h-10 items-center">
                                <button type="button" onClick={() => setCurrency('clp')} className={`flex - 1 text - sm font - medium h - full rounded transition - colors ${currency === 'clp' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'} `}>CLP ($)</button>
                                <button type="button" onClick={() => setCurrency('uf')} className={`flex - 1 text - sm font - medium h - full rounded transition - colors ${currency === 'uf' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'} `}>UF</button>
                            </div>
                        </div>

                        <Field
                            label={`Valor de Venta(${currency === 'clp' ? '$' : 'UF'})`}
                            name="valor_venta"
                            placeholder={currency === 'clp' ? "$ 198.000.000" : "UF 5.000"}
                            defaultValue={initialData.valor_venta}
                        />
                    </div>
                </CardSection>

                <CardSection title="3. Información de las Partes">
                    <p className="text-sm text-slate-500 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
                        <span className="font-semibold text-blue-700">Importante:</span> Ingrese todos los vendedores y compradores involucrados.
                    </p>
                    <div className="space-y-8">
                        <PartyArraySection
                            title="Vendedores"
                            typeLabel="Vendedor"
                            prefixRoot="vendedor"
                            initialData={initialData}
                            hideLaborData={true}
                        />
                        <div className="border-t pt-6"></div>
                        <PartyArraySection
                            title="Compradores"
                            typeLabel="Comprador"
                            prefixRoot="comprador"
                            initialData={initialData}
                            hideLaborData={true}
                        />
                    </div>
                </CardSection>

                <CardSection title="Acuerdos para Promesa">
                    <div className="mb-6 space-y-2">
                        <Label>Forma de Pago</Label>
                        <select
                            name="forma_pago_selector"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="flex h-10 w-full md:w-1/3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="contado">Al Contado</option>
                            <option value="credito">Con Crédito Hipotecario</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 animate-in fade-in">
                        {paymentMethod === 'credito' ? (
                            <>
                                <Field label="Monto del Pie (UF)" name="monto_pie" placeholder="UF" defaultValue={initialData.monto_pie} required />
                                <Field label="Monto a Financiar (Banco) - UF" name="monto_financiar" placeholder="UF" defaultValue={initialData.monto_financiar} required />
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Label>Monto Reserva / Vale Vista</Label>
                                <div className="flex gap-2">
                                    <div className="flex bg-white rounded-md border p-1 h-10 items-center w-32 shrink-0">
                                        <button type="button" onClick={() => setReservationCurrency('clp')} className={`flex - 1 text - xs font - medium h - full rounded transition - colors ${reservationCurrency === 'clp' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'} `}>CLP</button>
                                        <button type="button" onClick={() => setReservationCurrency('uf')} className={`flex - 1 text - xs font - medium h - full rounded transition - colors ${reservationCurrency === 'uf' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'} `}>UF</button>
                                    </div>
                                    <Input name="monto_reserva" placeholder={reservationCurrency === 'clp' ? "$" : "UF"} defaultValue={initialData.monto_reserva} className="flex-1" />
                                </div>
                            </div>
                        )}
                    </div>

                    <h4 className="text-sm font-medium mb-4 text-slate-700 mt-6 md:mt-8 bg-slate-100/50 p-2 rounded">Datos Bancarios</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 p-4 bg-slate-50 rounded-lg border relative">
                            <span className="absolute top-2 right-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendedor</span>
                            <div className="grid grid-cols-1 gap-4">
                                <Field label="Banco" name="vendedor_banco" defaultValue={initialData.vendedor_banco} />
                                <Field label="Ejecutivo" name="vendedor_ejecutivo" defaultValue={initialData.vendedor_ejecutivo} />
                                <Field label="Correo" name="vendedor_correo_banco" type="email" defaultValue={initialData.vendedor_correo_banco} />
                                <Field label="Teléfono" name="vendedor_telefono_banco" defaultValue={initialData.vendedor_telefono_banco} />
                            </div>
                        </div>
                        <div className="space-y-4 p-4 bg-slate-50 rounded-lg border relative">
                            <span className="absolute top-2 right-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comprador</span>
                            <div className="grid grid-cols-1 gap-4">
                                <Field label="Banco" name="comprador_banco" defaultValue={initialData.comprador_banco} />
                                <Field label="Ejecutivo" name="comprador_ejecutivo" defaultValue={initialData.comprador_ejecutivo} />
                                <Field label="Correo" name="comprador_correo_banco" type="email" defaultValue={initialData.comprador_correo_banco} />
                                <Field label="Teléfono" name="comprador_telefono_banco" defaultValue={initialData.comprador_telefono_banco} />
                            </div>
                        </div>
                    </div>
                </CardSection>

                <CardSection title="5. Documentación Adjunta (Obligatoria)">
                    <div className="grid grid-cols-1 gap-6">
                        <FileUploadField
                            label="Dominio Vigente (Archivos PDF/Imágenes)"
                            name="dominio_vigente"
                            accept=".pdf,image/*,.doc,.docx"
                            multiple
                        />
                        <FileUploadField
                            label="Certificado GP (Hipotecas y Grav.)"
                            name="gp_certificado"
                            accept=".pdf,image/*,.doc,.docx"
                            multiple
                        />
                        <div className="pt-4 border-t mt-4">
                            <FileUploadField
                                label="Otros Documentos (Opcional - Poderes, Escrituras, etc.)"
                                name="otros_documentos"
                                accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                                multiple
                            />
                        </div>
                    </div>
                </CardSection>

                <CardSection title="6. Notas de Avance">
                    <Textarea name="notas" placeholder="Escribe aquí cualquier nota importante..." className="min-h-[120px]" defaultValue={initialData.notas} />
                </CardSection>

                <div className="sticky bottom-4 z-10">
                    <Card className="shadow-lg border-2 border-primary/20 bg-white/95 backdrop-blur">
                        <CardContent className="p-4 flex flex-col md:flex-row justify-end items-center gap-4">
                            <Button type="button" variant="outline" size="lg" disabled={isSubmitting || isSavingDraft} onClick={handleSaveDraft} className="w-full md:w-auto">
                                <Save className="mr-2 h-5 w-5" />
                                {isSavingDraft ? 'Guardando...' : 'Guardar Borrador'}
                            </Button>
                            <Button type="submit" size="lg" disabled={isSubmitting || isSavingDraft} className="w-full md:w-auto bg-primary text-white">
                                <UploadCloud className="mr-2 h-5 w-5" />
                                {isSubmitting ? 'Enviando...' : (requestId ? 'Actualizar Solicitud' : 'Enviar Solicitud')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}

function LeaseFormLogic({ user, profile, navigate, initialData = {}, requestId = null }) {
    const [hasGuarantor, setHasGuarantor] = useState(initialData?.tiene_fiador === 'si')
    const [conAdministracion, setConAdministracion] = useState(initialData?.con_administracion === 'SI')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const formRef = useRef(null)
    const [currency, setCurrency] = useState(initialData?.moneda_arriendo || 'clp')

    const [conRestitucion, setConRestitucion] = useState(initialData?.con_restitucion === 'SI')

    const handleSaveDraft = async () => {
        if (!formRef.current) return
        const formData = new FormData(formRef.current)

        setIsSavingDraft(true)
        try {
            const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''} `.trim()

            const jsonData = {
                contract_type: 'lease',
                agente_nombre: agentName,
                agente_email: user.email,
                agente_telefono: profile?.phone || '',
                tipo_solicitud: 'arriendo',
                tiene_fiador: hasGuarantor ? 'si' : 'no',
                con_administracion: conAdministracion ? 'SI' : 'NO',
                con_restitucion: conRestitucion ? 'SI' : 'NO',
                moneda_arriendo: currency
            }

            for (const [key, value] of formData.entries()) {
                if (!(value instanceof File)) {
                    if (jsonData[key]) {
                        if (!Array.isArray(jsonData[key])) jsonData[key] = [jsonData[key]]
                        jsonData[key].push(value)
                    } else {
                        jsonData[key] = value
                    }
                }
            }

            let error;
            if (requestId) {
                const { error: updateError } = await supabase.from('requests').update({
                    status: 'draft',
                    updated_at: new Date(),
                    data: jsonData
                }).eq('id', requestId)
                error = updateError
            } else {
                // If it's a new request, insert
                const { error: insertError } = await supabase.from('requests').insert({
                    user_id: user.id,
                    status: 'draft',
                    step: 5,
                    data: jsonData
                })
                error = insertError
            }

            if (error) throw error

            toast.success('Borrador guardado exitosamente.')
            navigate('/dashboard')
        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al guardar borrador: ' + error.message)
        } finally {
            setIsSavingDraft(false)
        }
    }

    useEffect(() => {
        if (currency === 'uf') {
            const reajusteSelect = document.querySelector('select[name="reajuste"]')
            if (reajusteSelect) reajusteSelect.value = 'sin_reajuste'
        }
    }, [currency])


    const handleSubmit = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        // Validation
        const dominio = formData.get('dominio_vigente[]')
        const fileInput = document.querySelector('input[name="dominio_vigente[]"]');
        const hasFiles = fileInput && fileInput.files.length > 0;

        // If editing and no new file, it's ok if not replacing. But here we enforce checking size if present.
        // For now, let's assume if it's a new request, it's mandatory.
        if (!requestId && !hasFiles) {
            toast.error('Debes adjuntar el Dominio Vigente.')
            return
        }

        if (!formData.get('fecha_inicio')) {
            toast.error('La Fecha de Inicio de Arriendo es obligatoria.')
            return
        }

        // Administration mandatory checks
        if (conAdministracion) {
            if (!formData.get('cliente_agua')) return toast.error('N° Cliente Agua es obligatorio con Administración')
            if (!formData.get('cliente_luz')) return toast.error('N° Cliente Luz es obligatorio con Administración')
            if (!formData.get('cliente_gas')) return toast.error('N° Cliente Gas es obligatorio con Administración')
            if (!formData.get('admin_contacto_nombre')) return toast.error('Nombre Contacto Administración es obligatorio')
            if (!formData.get('admin_contacto_telefono')) return toast.error('Teléfono Contacto Administración es obligatorio')
            if (!formData.get('admin_contacto_email')) return toast.error('Email Contacto Administración es obligatorio')
        }

        setIsSubmitting(true)

        try {
            // Append context data
            const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''} `.trim()
            formData.append('agente_nombre', agentName)
            formData.append('agente_email', user.email)
            formData.append('agente_telefono', profile?.phone || '')
            formData.append('tipo_solicitud', 'arriendo')

            // Explicitly set checkboxes/booleans
            formData.set('tiene_fiador', hasGuarantor ? 'si' : 'no')
            formData.set('con_administracion', conAdministracion ? 'SI' : 'NO')
            formData.set('con_restitucion', conRestitucion ? 'SI' : 'NO')
            formData.set('moneda_arriendo', currency)

            // Remove empty/zero size files from potential arrays
            // Note: FormData with same name appends. We need to filter.
            // Actually, we will construct the webhook payload carefully.

            // Generate Excel logic (simplified for logic but assumes backend handles lists)
            // For excel generation, we might need to flatten arrays or handle them.
            // Current generator might accept the formData as is.

            const excelBlob = await generateExcel(formData)
            const pdfBlob = await generatePDF(formData)

            // Prepare Webhook Payload
            const webhookData = new FormData()

            // Copy all non-file data
            for (const [key, value] of formData.entries()) {
                if (!(value instanceof File)) {
                    webhookData.append(key, value)
                }
            }

            // Append Files
            const appendFiles = (baseFieldName) => {
                // Check both "name" and "name[]" to be safe
                const files = formData.getAll(baseFieldName).length > 0
                    ? formData.getAll(baseFieldName)
                    : formData.getAll(`${baseFieldName} []`);

                files.forEach((file) => {
                    if (file instanceof File && file.size > 0) {
                        // We append with the base name (common in webhooks) or array syntax if preferred
                        // Let's use array syntax for destination to ensure lists are clear
                        webhookData.append(`${baseFieldName} []`, file);
                    }
                });
            }
            appendFiles('dominio_vigente')
            appendFiles('otros_documentos')

            // Append Generated PDF
            webhookData.append('detalles solicitud.pdf', pdfBlob, 'detalles solicitud.pdf')

            // Trigger Webhook
            await triggerLegalWebhook(webhookData)

            // Save to Supabase (JSON doesn't support files, so we strip them)
            const jsonData = {}
            for (const [key, value] of formData.entries()) {
                if (!(value instanceof File)) {
                    // Handle arrays for keys like vendedor_1_... if needed, but for now simple key-value
                    // If multiple values exist, formData.entries() loops them.
                    // We might overwrite if not careful.
                    // Better to use getAll for known array fields, but for general form dump:
                    if (jsonData[key]) {
                        if (!Array.isArray(jsonData[key])) jsonData[key] = [jsonData[key]]
                        jsonData[key].push(value)
                    } else {
                        jsonData[key] = value
                    }
                }
            }

            let error;
            if (requestId) {
                const { error: updateError } = await supabase.from('requests').update({
                    status: 'submitted',
                    updated_at: new Date(),
                    data: {
                        ...jsonData,
                        contract_type: 'lease'
                    }
                }).eq('id', requestId)
                error = updateError
            } else {
                const { error: insertError } = await supabase.from('requests').insert({
                    user_id: user.id,
                    status: 'submitted',
                    step: 5,
                    data: {
                        ...jsonData,
                        contract_type: 'lease'
                    }
                })
                error = insertError
            }

            if (error) throw error

            // --- AUTO-DRAFT CREATION START ---
            try {
                // Determine Person Types for Owner/Tenant to correctly mapped fields.
                // Assuming "Arrendador 1" and "Arrendatario 1" are the primaries.

                // Fetch UF if needed for conversion
                let finalCanon = formData.get('canon_arriendo') || '0'
                let finalMoneda = currency // 'clp' or 'uf'

                if (currency === 'uf') {
                    try {
                        const ufRes = await fetch('https://mindicador.cl/api/uf')
                        const ufData = await ufRes.json()
                        const valorUF = ufData.serie && ufData.serie[0] ? ufData.serie[0].valor : null

                        if (valorUF) {
                            // Parse canon (handle comma/dot)
                            const canonStr = finalCanon.toString()
                            const canonNum = parseFloat(canonStr.replace(/\./g, '').replace(',', '.'))
                            if (!isNaN(canonNum)) {
                                finalCanon = Math.round(canonNum * valorUF)
                                finalMoneda = 'clp' // Switch to CLP for the Payment Request
                            }
                        }
                    } catch (errUF) {
                        console.error("Error fetching UF for auto-draft conversion:", errUF)
                        // Fallback: keep as UF
                    }
                }

                const draftData = {
                    tipo_solicitud: 'arriendo', // snake_case consistent with DB/Form

                    // Agent
                    agente_nombre: profile?.first_name || '',
                    agente_apellido: profile?.last_name || '',
                    agente_email: user.email,
                    agente_telefono: profile?.phone || '',

                    // Property
                    direccion_propiedad: formData.get('direccion_propiedad') || '',
                    comuna: formData.get('comuna') || '',
                    tipo_propiedad: formData.get('tipo_propiedad') || '',
                    rol_propiedad: formData.get('rol_propiedad') || '',

                    // Tenant (Arrendatario) - Mapping from index 1 - Use snake_case keys for initialData loading in target form
                    arrendatario_nombre: formData.get('arrendatario_1_nombres') || formData.get('arrendatario_1_juridica_razon') || '',
                    arrendatario_apellido: formData.get('arrendatario_1_apellidos') || '', // Empty if Juridica
                    arrendatario_rut: formData.get('arrendatario_1_rut') || formData.get('arrendatario_1_juridica_rut') || '',
                    arrendatario_email: formData.get('arrendatario_1_email') || formData.get('arrendatario_1_juridica_rep_email') || '',
                    arrendatario_telefono: formData.get('arrendatario_1_telefono') || formData.get('arrendatario_1_juridica_telefono') || '',

                    // New Address Fields for Payment Link
                    arrendatario_direccion: formData.get('arrendatario_1_direccion') || formData.get('arrendatario_1_juridica_direccion') || '',

                    // Owner (Dueño/Arrendador)
                    arrendador_nombre: (formData.get('arrendador_1_nombres') ? `${formData.get('arrendador_1_nombres')} ${formData.get('arrendador_1_apellidos')} ` : formData.get('arrendador_1_juridica_razon')) || '',
                    arrendador_rut: formData.get('arrendador_1_rut') || formData.get('arrendador_1_juridica_rut') || '',
                    arrendador_email: formData.get('arrendador_1_email') || formData.get('arrendador_1_juridica_rep_email') || '',
                    arrendador_telefono: formData.get('arrendador_1_telefono') || formData.get('arrendador_1_juridica_telefono') || '',
                    arrendador_direccion: formData.get('arrendador_1_direccion') || formData.get('arrendador_1_juridica_direccion') || '',
                    arrendador_comuna: '',

                    // Financials
                    canon_arriendo: finalCanon,
                    moneda_arriendo: finalMoneda, // 'clp' (converted) or 'uf'

                    // Logic fields
                    con_administracion: conAdministracion ? 'SI' : 'NO',
                    admin_comision_porcentaje: conAdministracion ? (formData.get('admin_comision_porcentaje') || '') : '',

                    con_restitucion: conRestitucion ? 'SI' : 'NO',
                    monto_seguro_restitucion: conRestitucion ? (formData.get('monto_seguro_restitucion') || '') : '',

                    // Special Conditions -> Notes
                    condiciones_especiales: formData.get('notas') || '',
                    chk_condiciones_especiales: !!formData.get('notas'), // Toggle on if notes exist
                }

                // Insert Draft
                const { error: draftError } = await supabase.from('requests').insert({
                    user_id: user.id,
                    status: 'draft',
                    step: 1,
                    data: draftData,
                    created_at: new Date()
                })

                if (draftError) {
                    console.error("Error creating auto-draft:", draftError)
                } else {
                    toast.info("Se ha generado un borrador de Link de Pago automáticamente.")
                }

            } catch (draftErr) {
                console.error("Auto-draft exception:", draftErr)
            }
            // --- AUTO-DRAFT CREATION END ---

            toast.success(requestId ? 'Solicitud actualizada exitosamente.' : 'Solicitud de arriendo enviada exitosamente.')
            navigate('/dashboard')

        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al enviar: ' + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-8 pb-12">
            <div className="grid gap-8">
                <CardSection title="1. Datos del Contrato y Propiedad">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <Field label="Plazo del Contrato" name="plazo_contrato" placeholder="Ej. 1 año renovable" defaultValue={initialData.plazo_contrato} />
                        <DateField label="Fecha Inicio Arriendo" name="fecha_inicio" defaultValue={initialData.fecha_inicio} required />

                        <div className="space-y-2">
                            <Label>Moneda</Label>
                            <div className="flex bg-white rounded-md border p-1 h-10 items-center">
                                <button type="button" onClick={() => setCurrency('clp')} className={`flex - 1 text - sm font - medium h - full rounded transition - colors ${currency === 'clp' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'} `}>CLP ($)</button>
                                <button type="button" onClick={() => setCurrency('uf')} className={`flex - 1 text - sm font - medium h - full rounded transition - colors ${currency === 'uf' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'} `}>UF</button>
                            </div>
                        </div>

                        <Field
                            label={`Canon de Arriendo(${currency === 'clp' ? '$' : 'UF'})`}
                            name="canon_arriendo"
                            placeholder={currency === 'clp' ? "$ 420.000" : "UF 15,5"}
                            defaultValue={initialData.canon_arriendo}
                        />

                        <div className="space-y-2">
                            <Label>Reajuste</Label>
                            <select name="reajuste" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" defaultValue={initialData.reajuste}>
                                <option value="semestral">Semestral</option>
                                <option value="anual">Anual</option>
                                <option value="trimestral">Trimestral</option>
                                <option value="mensual">Mensual</option>
                                <option value="sin_reajuste">Sin Reajuste</option>
                            </select>
                        </div>


                        <Field label="Documenta con Cheque (SI/NO)" name="documenta_cheque" placeholder="SI/NO" defaultValue={initialData.documenta_cheque} />
                        <Field label="Cuenta para Transferencia" name="cuenta_transferencia" className="md:col-span-2" placeholder="Banco, Tipo Cta, Número, RUT" defaultValue={initialData.cuenta_transferencia} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="flex items-center space-x-2 border p-3 rounded-md bg-white">
                            <input
                                type="checkbox"
                                id="con_administracion"
                                name="con_administracion"
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                checked={conAdministracion}
                                onChange={(e) => setConAdministracion(e.target.checked)}
                            />
                            <Label htmlFor="con_administracion" className="font-medium cursor-pointer text-slate-700">Con Administración (Edificio/Condominio)</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md bg-white">
                            <input
                                type="checkbox"
                                id="con_restitucion"
                                name="con_restitucion"
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                checked={conRestitucion}
                                onChange={(e) => setConRestitucion(e.target.checked)}
                            />
                            <Label htmlFor="con_restitucion" className="font-medium cursor-pointer text-slate-700">Con Restitución</Label>
                        </div>
                    </div>

                    {/* NEW FIELDS ROW */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {conAdministracion && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <Field
                                    label="% Comisión Administración (Sin IVA)"
                                    name="admin_comision_porcentaje"
                                    placeholder="Ej. 7"
                                    type="number"
                                    step="0.1"
                                    defaultValue={initialData.admin_comision_porcentaje}
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">Se usará para pre-llenar la solicitud de pago.</p>
                            </div>
                        )}
                        {conRestitucion && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <Field
                                    label={`Monto Seguro Restitución(${currency === 'clp' ? '$' : 'UF'})`}
                                    name="monto_seguro_restitucion"
                                    placeholder={currency === 'clp' ? "$ 150.000" : "UF 5"}
                                    defaultValue={initialData.monto_seguro_restitucion}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Se usará para pre-llenar la solicitud de pago.</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                        <Field label="ROL Propiedad" name="rol_propiedad" placeholder="123-45" defaultValue={initialData.rol_propiedad} />
                        <Field label="Dirección de la Propiedad" name="direccion_propiedad" className="md:col-span-2" defaultValue={initialData.direccion_propiedad} />
                    </div>

                    <h4 className="text-sm font-bold text-slate-500 mt-6 mb-4">Servicios Básicos y Administración {conAdministracion ? '(Obligatorio)' : '(Opcional)'}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Field label="N° Cliente Agua" name="cliente_agua" defaultValue={initialData.cliente_agua} required={conAdministracion} />
                        <Field label="N° Cliente Luz" name="cliente_luz" defaultValue={initialData.cliente_luz} required={conAdministracion} />
                        <Field label="N° Cliente Gas" name="cliente_gas" defaultValue={initialData.cliente_gas} required={conAdministracion} />
                    </div>
                    {
                        conAdministracion && (
                            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mt-4">
                                <h4 className="text-xs font-bold text-blue-600 uppercase mb-3">Contacto Administración</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Field label="Nombre Contacto" name="admin_contacto_nombre" defaultValue={initialData.admin_contacto_nombre} required />
                                    <Field label="Teléfono" name="admin_contacto_telefono" defaultValue={initialData.admin_contacto_telefono} required />
                                    <Field label="Email" name="admin_contacto_email" type="email" defaultValue={initialData.admin_contacto_email} required />
                                </div>
                            </div>
                        )
                    }
                </CardSection >

                <PartyArraySection
                    title="2. Arrendador (Propietario)"
                    typeLabel="Arrendador"
                    prefixRoot="arrendador"
                    initialData={initialData}
                />

                <PartyArraySection
                    title="3. Arrendatario"
                    typeLabel="Arrendatario"
                    prefixRoot="arrendatario"
                    initialData={initialData}
                />

                <CardSection title="4. Aval (Codeudor Solidario)">
                    <div className="mb-6 flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="has_guarantor"
                            checked={hasGuarantor}
                            onChange={(e) => setHasGuarantor(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="has_guarantor" className="font-normal cursor-pointer">
                            Incluir aval / Codeudor Solidario
                        </Label>
                    </div>

                    {hasGuarantor && (
                        <div className="space-y-6 animate-in fade-in">
                            <PartyArraySection
                                title="" // No internal title needed
                                typeLabel="Aval"
                                prefixRoot="fiador"
                                initialData={initialData}
                            />
                        </div>
                    )}
                </CardSection>

                <CardSection title="5. Documentación Adjunta">
                    <FileUploadField label="Dominio Vigente" name="dominio_vigente" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv" multiple={true} />
                    <div className="pt-4"></div>
                    <FileUploadField label="Otros Documentos (Opcional)" name="otros_documentos" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv" multiple={true} />
                </CardSection>

                <CardSection title="6. Notas Adicionales">
                    <Textarea name="notas" placeholder="Información adicional relevante..." className="min-h-[120px]" defaultValue={initialData.notas} />
                </CardSection>

                <div className="sticky bottom-4 z-10">
                    <Card className="shadow-lg border-2 border-primary/20 bg-white/95 backdrop-blur">
                        <CardContent className="p-4 flex flex-col md:flex-row justify-end items-center gap-4">
                            <Button type="button" variant="outline" size="lg" disabled={isSubmitting || isSavingDraft} onClick={handleSaveDraft} className="w-full md:w-auto">
                                <Save className="mr-2 h-5 w-5" />
                                {isSavingDraft ? 'Guardando...' : 'Guardar Borrador'}
                            </Button>
                            <Button type="submit" size="lg" disabled={isSubmitting || isSavingDraft} className="w-full md:w-auto bg-primary text-white">
                                <UploadCloud className="mr-2 h-5 w-5" />
                                {isSubmitting ? 'Enviando...' : (requestId ? 'Actualizar Solicitud' : 'Enviar Solicitud')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div >
        </form >
    )
}

function AnnexFormLogic({ user, profile, navigate, initialData = {}, requestId = null }) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const formRef = useRef(null)
    const [properties, setProperties] = useState([])
    const [loadingProperties, setLoadingProperties] = useState(false)
    const [selectedPropertyId, setSelectedPropertyId] = useState('')

    const handleSaveDraft = async () => {
        if (!formRef.current) return
        const formData = new FormData(formRef.current)

        setIsSavingDraft(true)
        try {
            const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''} `.trim()

            const jsonData = {
                contract_type: 'annex',
                agente_nombre: agentName,
                agente_email: user.email,
                agente_telefono: profile?.phone || '',
                tipo_solicitud: 'anexo',
            }

            for (const [key, value] of formData.entries()) {
                if (!(value instanceof File)) {
                    if (jsonData[key]) {
                        if (!Array.isArray(jsonData[key])) jsonData[key] = [jsonData[key]]
                        jsonData[key].push(value)
                    } else {
                        jsonData[key] = value
                    }
                }
            }

            let error;
            if (requestId) {
                const { error: updateError } = await supabase.from('requests').update({
                    status: 'draft',
                    updated_at: new Date(),
                    data: jsonData
                }).eq('id', requestId)
                error = updateError
            } else {
                const { error: insertError } = await supabase.from('requests').insert({
                    user_id: user.id,
                    status: 'draft',
                    step: 1,
                    data: jsonData
                })
                error = insertError
            }

            if (error) throw error

            toast.success('Borrador guardado exitosamente.')
            navigate('/dashboard')
        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al guardar borrador: ' + error.message)
        } finally {
            setIsSavingDraft(false)
        }
    }

    // Fetch Agent's Properties for Autocomplete
    useEffect(() => {
        const fetchProperties = async () => {
            if (!user?.id) return
            setLoadingProperties(true)
            const { data, error } = await supabase
                .from('properties')
                .select('id, address, commune') // Note: 'role' might not exist, checking schema... Schema says: address, commune. No role.
                .eq('agent_id', user.id)
                .order('created_at', { ascending: false })

            if (!error && data) {
                setProperties(data)
            }
            setLoadingProperties(false)
        }
        fetchProperties()
    }, [user])

    const handlePropertySelect = (e) => {
        const propId = e.target.value
        setSelectedPropertyId(propId)
        if (propId) {
            const prop = properties.find(p => p.id === propId)
            if (prop) {
                // Auto-fill address and commune
                const addressInput = document.querySelector('input[name="direccion_propiedad"]')
                const communeInput = document.querySelector('input[name="comuna"]')
                if (addressInput) addressInput.value = prop.address || ''
                if (communeInput) communeInput.value = prop.commune || ''
            }
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        // Validation
        const contrato = formData.get('contrato_original')
        // Check if file provided. For edits, it might be skipped if not changing. 
        // But for "Anexo" usually we want the contract reference.
        // Let's assume strict for new requests.
        const fileInput = document.querySelector('input[name="contrato_original"]');
        const hasFiles = fileInput && fileInput.files.length > 0;

        if (!requestId && !hasFiles) {
            toast.error('Debes adjuntar el Contrato Original.')
            return
        }

        setIsSubmitting(true)

        try {
            // Append context data
            const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''} `.trim()
            formData.append('agente_nombre', agentName)
            formData.append('agente_email', user.email)
            formData.append('agente_telefono', profile?.phone || '')
            formData.append('tipo_solicitud', 'anexo')

            // Prepare Webhook Payload
            const webhookData = new FormData()

            // Append data
            for (const [key, value] of formData.entries()) {
                if (typeof value === 'string') {
                    webhookData.append(key, value)
                }
            }

            // Files - Helper
            const appendFiles = (baseFieldName) => {
                const files = formData.getAll(baseFieldName).length > 0
                    ? formData.getAll(baseFieldName)
                    : formData.getAll(`${baseFieldName} []`);

                files.forEach((file) => {
                    if (file instanceof File && file.size > 0) {
                        webhookData.append(`${baseFieldName} []`, file);
                    }
                });
            }
            appendFiles('contrato_original')
            appendFiles('documentos_adicionales')

            // Trigger Webhook
            await triggerLegalWebhook(webhookData)

            // Save JSON to Supabase
            const jsonData = {}
            for (const [key, value] of formData.entries()) {
                if (!(value instanceof File)) {
                    if (jsonData[key]) {
                        if (!Array.isArray(jsonData[key])) jsonData[key] = [jsonData[key]]
                        jsonData[key].push(value)
                    } else {
                        jsonData[key] = value
                    }
                }
            }

            const payload = {
                status: 'submitted',
                type: 'annex',
                data: { ...jsonData, contract_type: 'annex' }
            }

            let error
            if (requestId) {
                const { error: updateError } = await supabase.from('requests').update({ ...payload, updated_at: new Date() }).eq('id', requestId)
                error = updateError
            } else {
                const { error: insertError } = await supabase.from('requests').insert({ ...payload, user_id: user.id, step: 1 })
                error = insertError
            }

            if (error) throw error

            toast.success('Solicitud de Anexo enviada exitosamente.')
            navigate('/dashboard')

        } catch (error) {
            console.error('Error:', error)
            toast.error('Error al enviar la solicitud: ' + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-8 pb-12">
            <div className="grid gap-8">
                <CardSection title="1. Propiedad y Datos Básicos">
                    <div className="mb-6 p-4 bg-slate-50 border rounded-lg">
                        <Label className="mb-2 block text-xs font-bold uppercase text-slate-500">Autocompletar desde mis propiedades</Label>
                        <div className="flex gap-2 items-center">
                            <div className="relative w-full max-w-md">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-white pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    onChange={handlePropertySelect}
                                    value={selectedPropertyId}
                                    disabled={loadingProperties}
                                >
                                    <option value="">Seleccionar propiedad...</option>
                                    {properties.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.address} {p.commune ? `- ${p.commune} ` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {loadingProperties && <span className="text-xs text-slate-400">Cargando...</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Field label="Dirección" name="direccion_propiedad" defaultValue={initialData.direccion_propiedad} className="md:col-span-2" required />
                        <Field label="Comuna" name="comuna" defaultValue={initialData.comuna} required />
                        <Field label="ROL (Opcional)" name="rol" defaultValue={initialData.rol} />
                    </div>
                </CardSection>

                <CardSection title="2. Detalle de la Solicitud">
                    <div className="space-y-4">
                        <Label>Cuerpo del Anexo / Instrucciones</Label>
                        <Textarea
                            name="cuerpo_anexo"
                            placeholder="Describa aquí las modificaciones, cláusulas a agregar/eliminar, o el objetivo del anexo..."
                            className="min-h-[200px] font-mono text-sm"
                            defaultValue={initialData.cuerpo_anexo}
                            required
                        />
                        <p className="text-xs text-slate-500">Sea lo más detallado posible para facilitar la redacción legal.</p>
                    </div>
                </CardSection>

                <CardSection title="3. Documentación Requerida">
                    <div className="space-y-6">
                        <FileUploadField
                            label="Contrato Original (Obligatorio)"
                            name="contrato_original"
                            accept=".pdf,image/*,.doc,.docx"
                        />
                        <FileUploadField
                            label="Documentos Adicionales (Opcional)"
                            name="documentos_adicionales"
                            accept=".pdf,image/*,.doc,.docx"
                            multiple
                        />
                    </div>
                </CardSection>

                <div className="sticky bottom-4 z-10">
                    <Card className="shadow-lg border-2 border-primary/20 bg-white/95 backdrop-blur">
                        <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="text-xs text-slate-500 text-center md:text-left">
                                <span className="font-bold block">Aviso Importante:</span>
                                Al enviar, la solicitud será procesada por el equipo legal. Asegúrate de adjuntar el contrato base.
                            </div>
                            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                <Button type="button" variant="outline" size="lg" disabled={isSubmitting || isSavingDraft} onClick={handleSaveDraft} className="w-full md:w-auto">
                                    <Save className="mr-2 h-5 w-5" />
                                    {isSavingDraft ? 'Guardando...' : 'Guardar Borrador'}
                                </Button>
                                <Button type="submit" size="lg" disabled={isSubmitting || isSavingDraft} className="w-full md:w-auto bg-primary text-white">
                                    <UploadCloud className="mr-2 h-5 w-5" />
                                    {isSubmitting ? 'Enviando...' : (requestId ? 'Actualizar Solicitud' : 'Enviar Solicitud')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}
