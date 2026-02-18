import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { User } from 'lucide-react'

export default function StepParte({ type, data, onUpdate, onNext, onBack }) {
    // Determine the prefix based on type (Vendedor or Comprador)
    const prefix = type.toLowerCase()

    // Conditional Logic for "Puntas" (Venta flow)
    const isParteRequired = data.ventaRole === 'Ambas' || data.ventaRole === type

    // Check if fields are filled
    const isComplete = !isParteRequired || (
        data[`${prefix}Nombre`] &&
        data[`${prefix}Rut`] &&
        data[`${prefix}Email`] &&
        data[`${prefix}Telefono`] &&
        data[`${prefix}Direccion`] &&
        data[`${prefix}Comuna`]
    )

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                {!isParteRequired && (
                    <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm border border-yellow-200">
                        <strong>Información Opcional:</strong> Has seleccionado "Punta {data.ventaRole === 'Vendedor' ? 'Compradora' : 'Vendedora'}", por lo que estos datos no son obligatorios.
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label>Nombre y Apellido Completo {isParteRequired && '*'}</Label>
                        <Input
                            value={data[`${prefix}Nombre`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Nombre`, e.target.value)}
                            placeholder="Ej: Juan Pérez"
                            required={isParteRequired}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>RUT {isParteRequired && '*'}</Label>
                        <Input
                            value={data[`${prefix}Rut`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Rut`, e.target.value)}
                            placeholder="Ej: 12.345.678-9"
                            required={isParteRequired}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Email {isParteRequired && '*'}</Label>
                        <Input
                            type="email"
                            value={data[`${prefix}Email`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Email`, e.target.value)}
                            placeholder="Ej: juan@example.com"
                            required={isParteRequired}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Teléfono {isParteRequired && '*'}</Label>
                        <Input
                            type="tel"
                            value={data[`${prefix}Telefono`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Telefono`, e.target.value)}
                            placeholder="Ej: +56 9 1234 5678"
                            required={isParteRequired}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Dirección Particular {isParteRequired && '*'}</Label>
                        <Input
                            value={data[`${prefix}Direccion`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Direccion`, e.target.value)}
                            placeholder="Calle, Número, Depto"
                            required={isParteRequired}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Comuna Particular {isParteRequired && '*'}</Label>
                        <Input
                            value={data[`${prefix}Comuna`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Comuna`, e.target.value)}
                            placeholder="Ej: Providencia"
                            required={isParteRequired}
                        />
                    </div>

                    <div className="flex justify-between pt-4 gap-4">
                        <Button type="button" variant="outline" onClick={onBack} className="w-full md:w-auto">
                            Atrás
                        </Button>
                        <Button type="submit" disabled={!isComplete} className="w-full md:w-auto">
                            Siguiente
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
