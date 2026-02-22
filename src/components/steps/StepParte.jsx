import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { User } from 'lucide-react'
import ContactPickerInline from '@/components/ui/ContactPickerInline'

export default function StepParte({ type, data, onUpdate, onNext, onBack }) {
    // Determine the prefix based on type (Vendedor or Comprador)
    const prefix = type.toLowerCase()

    // Conditional Logic for "Puntas" (Venta flow)
    const isParteRequired = data.ventaRole === 'Ambas' || data.ventaRole === type

    // Check if fields are filled
    const isComplete = !isParteRequired || (
        data[`${prefix}Nombre`] &&
        data[`${prefix}Rut`] &&
        data[`${prefix}Email`]
    )

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    const handleContactSelect = (contact) => {
        onUpdate(`${prefix}Nombre`, `${contact.first_name || ''} ${contact.last_name || ''}`.trim())
        onUpdate(`${prefix}Rut`, contact.rut || '')
        onUpdate(`${prefix}Email`, contact.email || '')
        onUpdate(`${prefix}Telefono`, contact.phone || '')
        onUpdate(`${prefix}Direccion`, contact.address || '')
        onUpdate(`${prefix}Comuna`, contact.barrio_comuna || '')
        // Store the CRM contact ID for auto-linking
        onUpdate(`_crm${type}ContactId`, contact.id)
    }

    // Map form type to property_contacts role
    const getRoleLabel = () => {
        switch (type) {
            case 'Vendedor': return 'vendedor'
            case 'Comprador': return 'comprador'
            case 'Dueño': return 'propietario'
            case 'Arrendatario': return 'arrendatario'
            default: return type.toLowerCase()
        }
    }

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Datos del {type}</h2>
                        <p className="text-sm text-muted-foreground">
                            {isParteRequired
                                ? `Información de contacto del ${type.toLowerCase()}`
                                : `Opcional — usted no representa al ${type.toLowerCase()}`}
                        </p>
                    </div>
                </div>

                {isParteRequired && (
                    <ContactPickerInline
                        onSelectContact={handleContactSelect}
                        label={`Pre-llenar datos del ${type.toLowerCase()}`}
                    />
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {isParteRequired && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo <span className="text-red-500">*</span></Label>
                                <Input
                                    value={data[`${prefix}Nombre`] || ''}
                                    onChange={e => onUpdate(`${prefix}Nombre`, e.target.value)}
                                    placeholder="Nombre y Apellido"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>RUT <span className="text-red-500">*</span></Label>
                                <Input
                                    value={data[`${prefix}Rut`] || ''}
                                    onChange={e => onUpdate(`${prefix}Rut`, e.target.value)}
                                    placeholder="12.345.678-9"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Email <span className="text-red-500">*</span></Label>
                                <Input
                                    type="email"
                                    value={data[`${prefix}Email`] || ''}
                                    onChange={e => onUpdate(`${prefix}Email`, e.target.value)}
                                    placeholder="email@ejemplo.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Teléfono</Label>
                                <Input
                                    value={data[`${prefix}Telefono`] || ''}
                                    onChange={e => onUpdate(`${prefix}Telefono`, e.target.value)}
                                    placeholder="+56 9 1234 5678"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Dirección</Label>
                                <Input
                                    value={data[`${prefix}Direccion`] || ''}
                                    onChange={e => onUpdate(`${prefix}Direccion`, e.target.value)}
                                    placeholder="Dirección particular"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Comuna</Label>
                                <Input
                                    value={data[`${prefix}Comuna`] || ''}
                                    onChange={e => onUpdate(`${prefix}Comuna`, e.target.value)}
                                    placeholder="Comuna"
                                />
                            </div>
                        </div>
                    )}

                    {!isParteRequired && (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No se requiere información del {type.toLowerCase()} en este flujo.</p>
                            <p className="text-sm mt-1">Puede continuar al siguiente paso.</p>
                        </div>
                    )}

                    <div className="flex justify-between pt-4">
                        <Button type="button" variant="outline" onClick={onBack}>← Atrás</Button>
                        <Button type="submit" disabled={!isComplete}>Siguiente →</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
