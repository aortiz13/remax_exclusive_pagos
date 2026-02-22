import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { Building2, MapPin } from 'lucide-react'
import PropertyPickerInline from '@/components/ui/PropertyPickerInline'

export default function StepPropiedad({ data, onUpdate, onNext, onBack }) {
    const isComplete = data.tipoPropiedad && data.direccion && data.comuna

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    const handlePropertySelect = (property) => {
        onUpdate('tipoPropiedad', property.property_type || '')
        onUpdate('direccion', property.address || '')
        onUpdate('comuna', property.commune || '')
        // Store the CRM property ID for auto-linking later
        onUpdate('_crmPropertyId', property.id)
    }

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
                        <select
                            value={data.tipoPropiedad}
                            onChange={e => onUpdate('tipoPropiedad', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Seleccionar...</option>
                            <option value="Departamento">Departamento</option>
                            <option value="Casa">Casa</option>
                            <option value="Oficina">Oficina</option>
                            <option value="Local Comercial">Local Comercial</option>
                            <option value="Estacionamiento">Estacionamiento</option>
                            <option value="Bodega">Bodega</option>
                        </select>
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

                    <div className="flex justify-between pt-4">
                        {onBack && <Button type="button" variant="outline" onClick={onBack}>← Atrás</Button>}
                        <Button type="submit" disabled={!isComplete} className="ml-auto">Siguiente →</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
