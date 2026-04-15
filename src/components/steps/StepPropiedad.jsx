import React, { useState } from 'react'
import { Card, CardContent, Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'
import { Building2, MapPin, Hash, Save, CheckCircle2, Loader2 } from 'lucide-react'
import PropertyPickerInline from '@/components/ui/PropertyPickerInline'
import { supabase } from '../../services/supabase'
import { toast } from 'sonner'

export default function StepPropiedad({ data, onUpdate, onNext, onBack }) {
    const requiresRol = data.tipoSolicitud === 'arriendo'
    const isComplete = data.tipoPropiedad && data.direccion && data.comuna && (!requiresRol || data.rolPropiedad)

    const [savingRol, setSavingRol] = useState(false)
    const [rolSaved, setRolSaved] = useState(false)

    // Track whether the CRM property already had a ROL
    const [crmPropertyHadRol, setCrmPropertyHadRol] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    const handlePropertySelect = (property) => {
        onUpdate('tipoPropiedad', property.property_type || '')
        onUpdate('direccion', property.address || '')
        onUpdate('comuna', property.commune || '')
        onUpdate('rolPropiedad', property.rol_number || '')
        // Store the CRM property ID for auto-linking later
        onUpdate('_crmPropertyId', property.id)

        // Track whether this CRM property already had a ROL
        setCrmPropertyHadRol(!!property.rol_number)
        setRolSaved(false)
    }

    // Save the typed ROL back to the CRM property
    const handleSaveRolToProperty = async () => {
        const propertyId = data._crmPropertyId
        const rol = data.rolPropiedad?.trim()
        if (!propertyId || !rol) return

        setSavingRol(true)
        try {
            const { error } = await supabase
                .from('properties')
                .update({ rol_number: rol })
                .eq('id', propertyId)

            if (error) throw error
            toast.success('ROL guardado en la propiedad del CRM')
            setRolSaved(true)
            setCrmPropertyHadRol(true) // Now the property has it
        } catch (err) {
            console.error('Error saving ROL to property:', err)
            toast.error('Error al guardar el ROL en la propiedad')
        } finally {
            setSavingRol(false)
        }
    }

    // Show "save to property" button when:
    // 1. A CRM property is selected
    // 2. The CRM property did NOT originally have a ROL
    // 3. The user has typed a ROL value
    // 4. The ROL hasn't been saved yet
    const showSaveRolButton = requiresRol && data._crmPropertyId && !crmPropertyHadRol && data.rolPropiedad?.trim() && !rolSaved

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Propiedad</h2>
                        <p className="text-sm text-muted-foreground">Información de la propiedad en operación</p>
                    </div>
                </div>

                <PropertyPickerInline onSelectProperty={handlePropertySelect} />

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label>Tipo de Propiedad <span className="text-red-500">*</span></Label>
                        <Select value={data.tipoPropiedad || undefined} onValueChange={v => onUpdate('tipoPropiedad', v)}>
                            <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent className="z-[300]">
                                <SelectItem value="Departamento">Departamento</SelectItem>
                                <SelectItem value="Casa">Casa</SelectItem>
                                <SelectItem value="Oficina">Oficina</SelectItem>
                                <SelectItem value="Local Comercial">Local Comercial</SelectItem>
                                <SelectItem value="Estacionamiento">Estacionamiento</SelectItem>
                                <SelectItem value="Bodega">Bodega</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            Dirección <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={data.direccion}
                            onChange={e => onUpdate('direccion', e.target.value)}
                            placeholder="Ej: Av. Providencia 1234, Depto 501"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Comuna <span className="text-red-500">*</span></Label>
                        <Input
                            value={data.comuna}
                            onChange={e => onUpdate('comuna', e.target.value)}
                            placeholder="Ej: Providencia"
                        />
                    </div>

                    {requiresRol && (
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5" />
                            ROL de la Propiedad <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                value={data.rolPropiedad || ''}
                                onChange={e => {
                                    onUpdate('rolPropiedad', e.target.value)
                                    // If user changes the ROL after saving, allow re-save
                                    if (rolSaved) setRolSaved(false)
                                }}
                                placeholder="Ej: 1234-56"
                                className="flex-1"
                            />
                            {showSaveRolButton && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSaveRolToProperty}
                                    disabled={savingRol}
                                    className="whitespace-nowrap text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all"
                                >
                                    {savingRol ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3.5 h-3.5" />
                                    )}
                                    Guardar en propiedad
                                </Button>
                            )}
                            {rolSaved && (
                                <div className="flex items-center gap-1 text-xs text-green-600 font-medium whitespace-nowrap">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Guardado
                                </div>
                            )}
                        </div>

                    </div>
                    )}

                    <div className="flex justify-between pt-4">
                        {onBack && <Button type="button" variant="outline" onClick={onBack}>← Atrás</Button>}
                        <Button type="submit" disabled={!isComplete} className="ml-auto">Siguiente →</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
