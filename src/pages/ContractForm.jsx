import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar as CalendarIcon, Upload, Plus, Trash2, MapPin, Search, ChevronRight, FileText, FileSignature, Handshake, CheckCircle2, ChevronDown, UserPlus, Users } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import ContactPickerInline from '../components/ui/ContactPickerInline'
import PropertyPickerInline from '../components/ui/PropertyPickerInline'
import { autoLinkContactProperty } from '../services/autoLink'
import { logActivity } from '../services/activityService'
import { triggerLegalWebhook } from '../services/api'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Textarea, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'
import SyncFieldIndicator from '../components/ui/SyncFieldIndicator'
import { ArrowLeft, Building2, Key, Save, UploadCloud, FilePlus } from 'lucide-react'

// --- HELPER COMPONENTS ---

function SelectUncontrolled({ name, defaultValue, placeholder, className, options }) {
    const [value, setValue] = useState(defaultValue || '')
    return (
        <>
            <input type="hidden" name={name} value={value} />
            <Select value={value || undefined} onValueChange={v => setValue(v)}>
                <SelectTrigger className={className}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                    {options.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </>
    )
}

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

const FileUploadField = forwardRef(function FileUploadField({ label, name, accept, multiple = false, category = '', initialFiles = [] }, ref) {
    // files: array of { name, url, storagePath } OR { name, uploading: true } during upload
    const [files, setFiles] = useState(() => {
        // Restore previously uploaded files from draft data
        if (initialFiles && initialFiles.length > 0) {
            return initialFiles.map(f => ({ name: f.name, url: f.url, storagePath: f.storagePath }))
        }
        return []
    })
    const inputRef = useRef(null)
    const [uploading, setUploading] = useState(false)

    // Expose getFiles() to parent via ref — returns uploaded file metadata (not raw File objects)
    useImperativeHandle(ref, () => ({
        getFiles: () => files.filter(f => f.url && !f.uploading),
        getUploadedUrls: () => files.filter(f => f.url).map(f => ({ name: f.name, url: f.url, storagePath: f.storagePath })),
    }), [files])

    const handleFileChange = async (e) => {
        const selectedFiles = Array.from(e.target.files || [])
        if (selectedFiles.length === 0) return

        // Reset the input so the same file can be re-selected
        if (inputRef.current) inputRef.current.value = ''

        setUploading(true)

        for (const file of (multiple ? selectedFiles : [selectedFiles[0]])) {
            // Add placeholder entry while uploading
            const tempId = `${Date.now()}-${Math.random()}`
            setFiles(prev => multiple ? [...prev, { name: file.name, uploading: true, _tempId: tempId }] : [{ name: file.name, uploading: true, _tempId: tempId }])

            try {
                const ext = file.name.split('.').pop()
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                const storagePath = `drafts/${category}/${Date.now()}-${safeName}`

                const { error: uploadError } = await supabase.storage
                    .from('contracts')
                    .upload(storagePath, file, { cacheControl: '3600', upsert: false })

                if (uploadError) throw uploadError

                const url = `https://remax-crm-remax-storage.jzuuqr.easypanel.host/contracts/${storagePath}`

                // Replace placeholder with real data
                setFiles(prev => prev.map(f => f._tempId === tempId ? { name: file.name, url, storagePath } : f))
            } catch (err) {
                console.error('File upload error:', err)
                toast.error(`Error subiendo ${file.name}: ${err.message}`)
                // Remove failed placeholder
                setFiles(prev => prev.filter(f => f._tempId !== tempId))
            }
        }

        setUploading(false)
    }

    const handleRemove = async (index) => {
        const file = files[index]
        // Optionally delete from storage
        if (file?.storagePath) {
            try {
                await supabase.storage.from('contracts').remove([file.storagePath])
            } catch (err) {
                console.error('Error deleting file from storage:', err)
            }
        }
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-4">
            <Label className="text-sm font-semibold text-slate-700">{label}</Label>
            <Card className={"border-dashed border-2 cursor-pointer transition-colors " + (files.length > 0 ? 'bg-blue-50/50 border-primary/30' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100')} onClick={() => !uploading && inputRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <input
                        ref={inputRef}
                        type="file"
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
                                        <div className={`p-2 rounded ${file.uploading ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {file.uploading ? (
                                                <div className="h-4 w-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <UploadCloud className="h-4 w-4" />
                                            )}
                                        </div>
                                        <span className="text-sm font-medium truncate max-w-[180px]">{file.name}</span>
                                        {file.uploading && <span className="text-xs text-yellow-600">Subiendo...</span>}
                                        {file.url && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                                    </div>
                                    {!file.uploading && (
                                        <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {multiple && !uploading && (
                                <p className="text-xs text-center text-slate-400 mt-2">Click para agregar más</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
})

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

    const [formData, setFormData] = useState(() => {
        const data = {}
        const fields = [
            'nombres', 'apellidos', 'rut', 'email', 'telefono', 'direccion',
            'nacionalidad', 'ocupacion', 'civil', 'nacimiento',
            'juridica_razon', 'juridica_rut', 'juridica_direccion', 'juridica_telefono',
            'juridica_rep_nombres', 'juridica_rep_apellidos', 'juridica_rep_rut',
            'juridica_rep_nacionalidad', 'juridica_rep_civil', 'juridica_rep_email',
            'juridica_rep_nacimiento', 'juridica_rep_direccion',
            'empleador', 'empleador_rut', 'telefono_lab', 'direccion_lab',
            'banco', 'tipo_cuenta', 'nro_cuenta'
        ]
        fields.forEach(f => {
            data[f] = initialData[`${prefix}${f}`] || ''
        })
        return data
    })

    const handleInputChange = (e) => {
        const { name, value } = e.target
        const fieldName = name.replace(prefix, '')
        setFormData(prev => ({ ...prev, [fieldName]: value }))
    }

    const handleSelectChange = (fieldName, value) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }))
    }

    const handleContactSelect = (contact) => {
        const updates = {
            contact_id: contact.id
        }

        if (personType === 'natural') {
            updates.nombres = contact.first_name || ''
            updates.apellidos = contact.last_name || ''
            updates.rut = contact.rut || ''
            updates.email = contact.email || ''
            updates.telefono = contact.phone || ''
            updates.direccion = contact.address || ''
            updates.nacionalidad = contact.nacionalidad || ''
            updates.ocupacion = contact.occupation || ''
            updates.civil = contact.civil_status || ''

            if (prefix.startsWith('arrendador')) {
                updates.banco = contact.bank_name || ''
                updates.tipo_cuenta = contact.bank_account_type || ''
                updates.nro_cuenta = contact.bank_account_number || ''
            }
        }

        setFormData(prev => ({ ...prev, ...updates }))

        setPrefilledData({
            contact_id: contact.id,
            empty_fields: [
                !contact.first_name && 'nombres',
                !contact.last_name && 'apellidos',
                !contact.rut && 'rut',
                !contact.email && 'email',
                !contact.phone && 'telefono',
                !contact.address && 'direccion',
                !contact.bank_name && 'banco',
                !contact.bank_account_type && 'tipo_cuenta',
                !contact.bank_account_number && 'nro_cuenta'
            ].filter(Boolean),
            exclude_sync: []
        })
    }

    const handleExclude = (field) => {
        setPrefilledData(prev => ({
            ...prev,
            exclude_sync: [...prev.exclude_sync, field]
        }))
    }

    const SyncLabel = ({ field, children }) => (
        <SyncFieldIndicator
            contactId={prefilledData.contact_id}
            fieldName={field}
            emptyFields={prefilledData.empty_fields}
            excludedFields={prefilledData.exclude_sync}
            onExclude={handleExclude}
            currentValue={formData[field]}
        >
            {children}
        </SyncFieldIndicator>
    )

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
                            className={`text-xs px-2 py-1 rounded transition-colors ${personType === 'natural' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            Natural
                        </button>
                        <button
                            type="button"
                            onClick={() => setPersonType('juridica')}
                            className={`text-xs px-2 py-1 rounded transition-colors ${personType === 'juridica' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
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

            <input type="hidden" name={`${prefix}tipo_persona`} value={personType} />
            <input type="hidden" name={`${prefix}contact_id`} value={prefilledData.contact_id || formData.contact_id || ''} />

            {personType === 'natural' && (
                <ContactPickerInline
                    onSelectContact={handleContactSelect}
                    label={`Pre-llenar datos del ${typeLabel.toLowerCase()}`}
                />
            )}

            {personType === 'natural' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <SyncLabel field="nombres">
                            <Label htmlFor={`${prefix}nombres`} className="text-xs font-semibold uppercase text-slate-500">Nombres <span className="text-red-500">*</span></Label>
                        </SyncLabel>
                        <Input id={`${prefix}nombres`} name={`${prefix}nombres`} value={formData.nombres} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                        <SyncLabel field="apellidos">
                            <Label htmlFor={`${prefix}apellidos`} className="text-xs font-semibold uppercase text-slate-500">Apellidos <span className="text-red-500">*</span></Label>
                        </SyncLabel>
                        <Input id={`${prefix}apellidos`} name={`${prefix}apellidos`} value={formData.apellidos} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                        <SyncLabel field="rut">
                            <Label htmlFor={`${prefix}rut`} className="text-xs font-semibold uppercase text-slate-500">RUT / Pasaporte <span className="text-red-500">*</span></Label>
                        </SyncLabel>
                        <Input id={`${prefix}rut`} name={`${prefix}rut`} value={formData.rut} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Nacionalidad</Label>
                        <Input name={`${prefix}nacionalidad`} value={formData.nacionalidad} onChange={handleInputChange} />
                    </div>

                    {['Vendedor', 'Comprador', 'Arrendador', 'Arrendatario'].includes(typeLabel) && (
                        <div className="space-y-2">
                            <Label htmlFor={`${prefix}civil`} className="text-xs font-semibold uppercase text-slate-500">Estado Civil <span className="text-red-500">*</span></Label>
                            <Select value={formData.civil || undefined} onValueChange={(v) => handleSelectChange('civil', v)}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent className="z-[300]">
                                    <SelectItem value="Soltero">Soltero</SelectItem>
                                    <SelectItem value="Casado Bajo comunidad Conyugal">Casado Bajo comunidad Conyugal</SelectItem>
                                    <SelectItem value="Casado con Separación de Bienes">Casado con Separación de Bienes</SelectItem>
                                    <SelectItem value="Viudo">Viudo</SelectItem>
                                    <SelectItem value="Divorciado">Divorciado</SelectItem>
                                    <SelectItem value="Conviviente civil con Separación de Bienes">Conviviente Civil con Separación de Bienes</SelectItem>
                                    <SelectItem value="Conviviente Civil con Comunidad de Bienes">Conviviente Civil con Comunidad de Bienes</SelectItem>
                                </SelectContent>
                            </Select>
                            <input type="hidden" name={`${prefix}civil`} value={formData.civil} />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Fecha Nacimiento</Label>
                        {/* Assuming DateField can take value and onChange, or using a simple date input */}
                        <Input type="date" name={`${prefix}nacimiento`} value={formData.nacimiento} onChange={handleInputChange} />
                    </div>

                    <div className="space-y-2">
                        <SyncLabel field="email">
                            <Label htmlFor={`${prefix}email`} className="text-xs font-semibold uppercase text-slate-500">Correo <span className="text-red-500">*</span></Label>
                        </SyncLabel>
                        <Input id={`${prefix}email`} name={`${prefix}email`} type="email" value={formData.email} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                        <SyncLabel field="telefono">
                            <Label htmlFor={`${prefix}telefono`} className="text-xs font-semibold uppercase text-slate-500">Teléfono <span className="text-red-500">*</span></Label>
                        </SyncLabel>
                        <Input id={`${prefix}telefono`} name={`${prefix}telefono`} value={formData.telefono} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Profesión</Label>
                        <Input name={`${prefix}ocupacion`} value={formData.ocupacion} onChange={handleInputChange} />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                        <SyncLabel field="direccion">
                            <Label htmlFor={`${prefix}direccion`} className="text-xs font-semibold uppercase text-slate-500">Domicilio Particular</Label>
                        </SyncLabel>
                        <Input id={`${prefix}direccion`} name={`${prefix}direccion`} value={formData.direccion} onChange={handleInputChange} />
                    </div>

                    {prefix.startsWith('arrendador') && (
                        <div className="md:col-span-3 bg-amber-50/50 p-4 rounded border border-amber-100 mt-2">
                            <Label className="uppercase text-xs font-bold text-amber-600 mb-4 block">Datos Bancarios para Transferencia (Obligatorio)</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <SyncLabel field="banco">
                                        <Label className="text-xs font-semibold uppercase text-slate-500">Banco <span className="text-red-500">*</span></Label>
                                    </SyncLabel>
                                    <Select value={formData.banco || undefined} onValueChange={(v) => handleSelectChange('banco', v)}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent className="z-[300]">
                                            {['Banco de Chile', 'Banco Santander', 'Banco Estado', 'BCI', 'Scotiabank', 'Itaú', 'Banco Bice', 'Banco Security', 'Banco Falabella', 'Banco Ripley', 'Banco Consorcio', 'Banco Internacional', 'Coopeuch'].map(b => (
                                                <SelectItem key={b} value={b}>{b}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <input type="hidden" name={`${prefix}banco`} value={formData.banco} />
                                </div>
                                <div className="space-y-2">
                                    <SyncLabel field="tipo_cuenta">
                                        <Label className="text-xs font-semibold uppercase text-slate-500">Tipo de Cuenta <span className="text-red-500">*</span></Label>
                                    </SyncLabel>
                                    <Select value={formData.tipo_cuenta || undefined} onValueChange={(v) => handleSelectChange('tipo_cuenta', v)}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent className="z-[300]">
                                            {['Cuenta Corriente', 'Cuenta Vista', 'Cuenta RUT', 'Cuenta de Ahorro'].map(t => (
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <input type="hidden" name={`${prefix}tipo_cuenta`} value={formData.tipo_cuenta} />
                                </div>
                                <div className="space-y-2">
                                    <SyncLabel field="nro_cuenta">
                                        <Label htmlFor={`${prefix}nro_cuenta`} className="text-xs font-semibold uppercase text-slate-500">N° de Cuenta <span className="text-red-500">*</span></Label>
                                    </SyncLabel>
                                    <Input id={`${prefix}nro_cuenta`} name={`${prefix}nro_cuenta`} value={formData.nro_cuenta} onChange={handleInputChange} required />
                                </div>
                            </div>
                        </div>
                    )}

                    {!hideLaborData && (
                        <div className="md:col-span-3 bg-white p-4 rounded border mt-2">
                            <Label className="uppercase text-xs font-bold text-slate-400 mb-4 block">Datos Laborales</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase text-slate-500">Empleador</Label>
                                    <Input name={`${prefix}empleador`} value={formData.empleador} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase text-slate-500">RUT Empleador</Label>
                                    <Input name={`${prefix}empleador_rut`} value={formData.empleador_rut} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase text-slate-500">Teléfono Laboral</Label>
                                    <Input name={`${prefix}telefono_lab`} value={formData.telefono_lab} onChange={handleInputChange} />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label className="text-xs font-semibold uppercase text-slate-500">Dirección Laboral</Label>
                                    <Input name={`${prefix}direccion_lab`} value={formData.direccion_lab} onChange={handleInputChange} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-2">
                            <Label className="text-xs font-semibold uppercase text-slate-500">Razón Social <span className="text-red-500">*</span></Label>
                            <Input name={`${prefix}juridica_razon`} value={formData.juridica_razon} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase text-slate-500">RUT Empresa <span className="text-red-500">*</span></Label>
                            <Input name={`${prefix}juridica_rut`} value={formData.juridica_rut} onChange={handleInputChange} required />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <Label className="text-xs font-semibold uppercase text-slate-500">Domicilio Comercial</Label>
                            <Input name={`${prefix}juridica_direccion`} value={formData.juridica_direccion} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase text-slate-500">Teléfono</Label>
                            <Input name={`${prefix}juridica_telefono`} value={formData.juridica_telefono} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500">Representante Legal (Obligatorio)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500">Nombres <span className="text-red-500">*</span></Label>
                                <Input name={`${prefix}juridica_rep_nombres`} value={formData.juridica_rep_nombres} onChange={handleInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500">Apellidos <span className="text-red-500">*</span></Label>
                                <Input name={`${prefix}juridica_rep_apellidos`} value={formData.juridica_rep_apellidos} onChange={handleInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500">RUT Rep. Legal <span className="text-red-500">*</span></Label>
                                <Input name={`${prefix}juridica_rep_rut`} value={formData.juridica_rep_rut} onChange={handleInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500">Nacionalidad</Label>
                                <Input name={`${prefix}juridica_rep_nacionalidad`} value={formData.juridica_rep_nacionalidad} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500">Estado Civil</Label>
                                <Input name={`${prefix}juridica_rep_civil`} value={formData.juridica_rep_civil} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500">Correo <span className="text-red-500">*</span></Label>
                                <Input name={`${prefix}juridica_rep_email`} type="email" value={formData.juridica_rep_email} onChange={handleInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500">Fecha Nacimiento</Label>
                                <Input type="date" name={`${prefix}juridica_rep_nacimiento`} value={formData.juridica_rep_nacimiento} onChange={handleInputChange} />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-xs font-semibold uppercase text-slate-500">Domicilio Particular</Label>
                                <Input name={`${prefix}juridica_rep_direccion`} value={formData.juridica_rep_direccion} onChange={handleInputChange} />
                            </div>
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
            if (initialData[`${prefixRoot}_${i}_nombres`] || initialData[`${prefixRoot}_${i}_juridica_razon`]) {
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
                        key={index}
                        typeLabel={typeLabel}
                        index={index} // Display index 0..N -> 1..N+1
                        prefix={`${prefixRoot}_${index + 1}_`} // Store as prefix_1_, prefix_2_...
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

    // File upload refs
    const dominioRef = useRef(null)
    const gpRef = useRef(null)
    const otrosRef = useRef(null)

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

            // Include uploaded file URLs in draft data
            const dominioFiles = dominioRef.current?.getUploadedUrls() || []
            const gpFiles = gpRef.current?.getUploadedUrls() || []
            const otrosFiles = otrosRef.current?.getUploadedUrls() || []
            jsonData.uploaded_files = {
                dominio_vigente: dominioFiles,
                gp_certificado: gpFiles,
                otros_documentos: otrosFiles,
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

        // Validation - Files (from refs) — files are now { name, url, storagePath } objects
        const dominioFiles = dominioRef.current?.getFiles() || []
        const gpFiles = gpRef.current?.getFiles() || []
        const otrosFiles = otrosRef.current?.getFiles() || []

        if (dominioFiles.length === 0) {
            toast.error('Debes adjuntar al menos un archivo de Dominio Vigente.')
            return
        }

        if (gpFiles.length === 0) {
            toast.error('Debes adjuntar al menos un archivo de GP (Hipotecas y Gravámenes).')
            return
        }

        // Validate estado civil for all parties
        for (let i = 1; i <= 4; i++) {
            const vNombres = formData.get(`vendedor_${i}_nombres`)
            const vTipo = formData.get(`vendedor_${i}_tipo_persona`)
            if (vNombres && vTipo === 'natural' && !formData.get(`vendedor_${i}_civil`)) {
                toast.error(`Estado Civil del Vendedor ${i} es obligatorio.`)
                return
            }
            const cNombres = formData.get(`comprador_${i}_nombres`)
            const cTipo = formData.get(`comprador_${i}_tipo_persona`)
            if (cNombres && cTipo === 'natural' && !formData.get(`comprador_${i}_civil`)) {
                toast.error(`Estado Civil del Comprador ${i} es obligatorio.`)
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


            // Prepare Webhook Payload — fetch files from storage URLs and attach as blobs
            const webhookData = new FormData()
            // Append all string fields
            formData.forEach((value, key) => {
                if (typeof value === 'string') {
                    webhookData.append(key, value)
                }
            })
            // Fetch and append files from storage URLs
            const fetchAndAppendFiles = async (fileList, fieldName) => {
                for (const f of fileList) {
                    try {
                        const resp = await fetch(f.url)
                        const blob = await resp.blob()
                        webhookData.append(fieldName, new File([blob], f.name, { type: blob.type }))
                    } catch (err) {
                        console.warn(`Could not fetch file ${f.name} for webhook:`, err)
                    }
                }
            }
            await fetchAndAppendFiles(dominioFiles, 'dominio_vigente[]')
            await fetchAndAppendFiles(gpFiles, 'gp_certificado[]')
            await fetchAndAppendFiles(otrosFiles, 'otros_documentos[]')

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
                        if (formData.get(`${prefix}_${i}_contact_id`)) count++;
                    }
                    return count || 1; // At least one if they filled it manually but no CRM ID, but loop below will safely ignore empty ones anyway.
                }

                // Vendedores
                for (let i = 1; i <= 4; i++) {
                    const contactId = formData.get(`vendedor_${i}_contact_id`);
                    if (contactId) {
                        await autoLinkContactProperty(contactId, propId, 'vendedor', agentId);
                    }
                }

                // Compradores
                for (let i = 1; i <= 4; i++) {
                    const contactId = formData.get(`comprador_${i}_contact_id`);
                    if (contactId) {
                        await autoLinkContactProperty(contactId, propId, 'comprador', agentId);
                    }
                }
            }

            toast.success(requestId ? 'Solicitud actualizada exitosamente.' : 'Solicitud de contrato enviada exitosamente.')

            // Log contract submission to timeline
            logActivity({
                action: 'Solicitud',
                entity_type: 'Propiedad',
                entity_id: formData.get('crm_property_id') || null,
                description: `Contrato de compraventa ${requestId ? 'actualizado' : 'enviado'}`,
                property_id: formData.get('crm_property_id') || null,
                details: { request_type: 'contract', contract_type: 'buy-sell' }
            }).catch(() => { })

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
                                <button type="button" onClick={() => setCurrency('clp')} className={`flex-1 text-sm font-medium h-full rounded transition-colors ${currency === 'clp' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>CLP ($)</button>
                                <button type="button" onClick={() => setCurrency('uf')} className={`flex-1 text-sm font-medium h-full rounded transition-colors ${currency === 'uf' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>UF</button>
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
                        <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v)}>
                            <SelectTrigger className="flex h-10 w-full md:w-1/3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[300]">
                                <SelectItem value="contado">Al Contado</SelectItem>
                                <SelectItem value="credito">Con Crédito Hipotecario</SelectItem>
                            </SelectContent>
                        </Select>
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
                                        <button type="button" onClick={() => setReservationCurrency('clp')} className={`flex-1 text-xs font-medium h-full rounded transition-colors ${reservationCurrency === 'clp' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>CLP</button>
                                        <button type="button" onClick={() => setReservationCurrency('uf')} className={`flex-1 text-xs font-medium h-full rounded transition-colors ${reservationCurrency === 'uf' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>UF</button>
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
                            ref={dominioRef}
                            label="Dominio Vigente (Archivos PDF/Imágenes)"
                            name="dominio_vigente"
                            accept=".pdf,image/*,.doc,.docx"
                            multiple
                            category="dominio_vigente"
                            initialFiles={initialData?.uploaded_files?.dominio_vigente || []}
                        />
                        <FileUploadField
                            ref={gpRef}
                            label="Certificado GP (Hipotecas y Grav.)"
                            name="gp_certificado"
                            accept=".pdf,image/*,.doc,.docx"
                            multiple
                            category="gp_certificado"
                            initialFiles={initialData?.uploaded_files?.gp_certificado || []}
                        />
                        <div className="pt-4 border-t mt-4">
                            <FileUploadField
                                ref={otrosRef}
                                label="Otros Documentos (Opcional - Poderes, Escrituras, etc.)"
                                name="otros_documentos"
                                accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                                multiple
                                category="otros_documentos"
                                initialFiles={initialData?.uploaded_files?.otros_documentos || []}
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

    // File upload refs
    const dominioRef = useRef(null)
    const otrosRef = useRef(null)

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

            // Include uploaded file URLs in draft data
            const dominioFiles = dominioRef.current?.getUploadedUrls() || []
            const otrosFiles = otrosRef.current?.getUploadedUrls() || []
            jsonData.uploaded_files = {
                dominio_vigente: dominioFiles,
                otros_documentos: otrosFiles,
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

        // Validation - Files (from refs)
        const dominioFiles = dominioRef.current?.getFiles() || []
        const otrosFiles = otrosRef.current?.getFiles() || []

        if (!requestId && dominioFiles.length === 0) {
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

        // Arrendador 1 bank details validation
        const arrendador_1_nombres = formData.get('arrendador_1_nombres');
        const arrendador_1_apellidos = formData.get('arrendador_1_apellidos');
        const arrendador_1_rut = formData.get('arrendador_1_rut');

        // New bank fields
        const arrendador_1_banco = formData.get('arrendador_1_banco');
        const arrendador_1_tipo_cuenta = formData.get('arrendador_1_tipo_cuenta');
        const arrendador_1_nro_cuenta = formData.get('arrendador_1_nro_cuenta');

        if (!arrendador_1_nombres || !arrendador_1_apellidos || !arrendador_1_rut || !arrendador_1_banco || !arrendador_1_tipo_cuenta || !arrendador_1_nro_cuenta) {
            toast.error('Nombre, RUT y Datos Bancarios del Arrendador 1 son obligatorios');
            setIsSubmitting(false);
            return;
        }

        // Validate estado civil for all parties
        for (let i = 1; i <= 4; i++) {
            const aNombres = formData.get(`arrendador_${i}_nombres`)
            const aTipo = formData.get(`arrendador_${i}_tipo_persona`)
            if (aNombres && aTipo === 'natural' && !formData.get(`arrendador_${i}_civil`)) {
                toast.error(`Estado Civil del Arrendador ${i} es obligatorio.`)
                return
            }
            const tNombres = formData.get(`arrendatario_${i}_nombres`)
            const tTipo = formData.get(`arrendatario_${i}_tipo_persona`)
            if (tNombres && tTipo === 'natural' && !formData.get(`arrendatario_${i}_civil`)) {
                toast.error(`Estado Civil del Arrendatario ${i} es obligatorio.`)
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
            formData.append('tipo_solicitud', 'arriendo')

            // Explicitly set checkboxes/booleans
            formData.set('tiene_fiador', hasGuarantor ? 'si' : 'no')
            formData.set('con_administracion', conAdministracion ? 'SI' : 'NO')
            formData.set('con_restitucion', conRestitucion ? 'SI' : 'NO')
            formData.set('moneda_arriendo', currency)

            // Remove empty/zero size files from potential arrays
            // Note: FormData with same name appends. We need to filter.
            // Actually, we will construct the webhook payload carefully.


            // Prepare Webhook Payload
            const webhookData = new FormData()

            // Copy all non-file data
            for (const [key, value] of formData.entries()) {
                if (!(value instanceof File)) {
                    webhookData.append(key, value)
                }
            }

            // Fetch and append files from storage URLs
            const fetchAndAppendFiles = async (fileList, fieldName) => {
                for (const f of fileList) {
                    try {
                        const resp = await fetch(f.url)
                        const blob = await resp.blob()
                        webhookData.append(fieldName, new File([blob], f.name, { type: blob.type }))
                    } catch (err) {
                        console.warn(`Could not fetch file ${f.name} for webhook:`, err)
                    }
                }
            }
            await fetchAndAppendFiles(dominioFiles, 'dominio_vigente[]')
            await fetchAndAppendFiles(otrosFiles, 'otros_documentos[]')

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

            // Log lease contract submission to timeline
            logActivity({
                action: 'Solicitud',
                entity_type: 'Propiedad',
                entity_id: null,
                description: `Contrato de arriendo ${requestId ? 'actualizado' : 'enviado'}`,
                details: { request_type: 'contract', contract_type: 'lease' }
            }).catch(() => { })

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
                                <button type="button" onClick={() => setCurrency('clp')} className={`flex-1 text-sm font-medium h-full rounded transition-colors ${currency === 'clp' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>CLP ($)</button>
                                <button type="button" onClick={() => setCurrency('uf')} className={`flex-1 text-sm font-medium h-full rounded transition-colors ${currency === 'uf' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>UF</button>
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
                            <SelectUncontrolled
                                name="reajuste"
                                defaultValue={initialData.reajuste || 'semestral'}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                options={[
                                    { value: 'semestral', label: 'Semestral' },
                                    { value: 'anual', label: 'Anual' },
                                    { value: 'trimestral', label: 'Trimestral' },
                                    { value: 'mensual', label: 'Mensual' },
                                    { value: 'sin_reajuste', label: 'Sin Reajuste' },
                                ]}
                            />
                        </div>


                        <Field label="Documenta con Cheque (SI/NO)" name="documenta_cheque" placeholder="SI/NO" defaultValue={initialData.documenta_cheque} />
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
                    <FileUploadField ref={dominioRef} label="Dominio Vigente" name="dominio_vigente" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv" multiple={true} category="dominio_vigente" initialFiles={initialData?.uploaded_files?.dominio_vigente || []} />
                    <div className="pt-4"></div>
                    <FileUploadField ref={otrosRef} label="Otros Documentos (Opcional)" name="otros_documentos" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv" multiple={true} category="otros_documentos" initialFiles={initialData?.uploaded_files?.otros_documentos || []} />
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

    // File upload refs
    const contratoRef = useRef(null)
    const docAdicionalesRef = useRef(null)

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

            // Include uploaded file URLs in draft data
            const contratoFiles = contratoRef.current?.getUploadedUrls() || []
            const docAdicionalesFiles = docAdicionalesRef.current?.getUploadedUrls() || []
            jsonData.uploaded_files = {
                contrato_original: contratoFiles,
                documentos_adicionales: docAdicionalesFiles,
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

        // Validation - Files (from refs)
        const contratoFiles = contratoRef.current?.getFiles() || []
        const docAdicionalesFiles = docAdicionalesRef.current?.getFiles() || []

        if (!requestId && contratoFiles.length === 0) {
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

            // Append all string data
            for (const [key, value] of formData.entries()) {
                if (typeof value === 'string') {
                    webhookData.append(key, value)
                }
            }

            // Fetch and append files from storage URLs
            const fetchAndAppendFiles = async (fileList, fieldName) => {
                for (const f of fileList) {
                    try {
                        const resp = await fetch(f.url)
                        const blob = await resp.blob()
                        webhookData.append(fieldName, new File([blob], f.name, { type: blob.type }))
                    } catch (err) {
                        console.warn(`Could not fetch file ${f.name} for webhook:`, err)
                    }
                }
            }
            await fetchAndAppendFiles(contratoFiles, 'contrato_original[]')
            await fetchAndAppendFiles(docAdicionalesFiles, 'documentos_adicionales[]')

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

            // Log annex submission to timeline  
            logActivity({
                action: 'Solicitud',
                entity_type: 'Propiedad',
                entity_id: null,
                description: 'Anexo de contrato enviado',
                details: { request_type: 'contract', contract_type: 'annex' }
            }).catch(() => { })

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
                                <Select value={selectedPropertyId || undefined} onValueChange={v => handlePropertySelect({ target: { value: v } })} disabled={loadingProperties}>
                                    <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-white pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                        <SelectValue placeholder="Seleccionar propiedad..." />
                                    </SelectTrigger>
                                    <SelectContent className="z-[300]">
                                        {properties.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.address} {p.commune ? `- ${p.commune} ` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                            ref={contratoRef}
                            label="Contrato Original (Obligatorio)"
                            name="contrato_original"
                            accept=".pdf,image/*,.doc,.docx"
                            category="contrato_original"
                            initialFiles={initialData?.uploaded_files?.contrato_original || []}
                        />
                        <FileUploadField
                            ref={docAdicionalesRef}
                            label="Documentos Adicionales (Opcional)"
                            name="documentos_adicionales"
                            accept=".pdf,image/*,.doc,.docx"
                            multiple
                            category="documentos_adicionales"
                            initialFiles={initialData?.uploaded_files?.documentos_adicionales || []}
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
