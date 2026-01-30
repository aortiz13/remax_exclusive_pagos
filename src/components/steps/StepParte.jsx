import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { User } from 'lucide-react'

export default function StepParte({ type, data, onUpdate, onNext, onBack }) {
    // Determine the prefix based on type (Vendedor or Comprador)
    const prefix = type.toLowerCase()

    // Check if fields are filled
    const isComplete = data[`${prefix}Nombre`] && data[`${prefix}Rut`] && data[`${prefix}Email`]

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <div className="mb-6 space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <User className="w-6 h-6" />
                        Parte {type}
                    </h2>
                    <p className="text-muted-foreground text-sm">Ingrese los datos de la parte {type.toLowerCase()}.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label>Nombre y Apellido Completo</Label>
                        <Input
                            value={data[`${prefix}Nombre`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Nombre`, e.target.value)}
                            placeholder="Ej: Juan Pérez"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>RUT</Label>
                        <Input
                            value={data[`${prefix}Rut`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Rut`, e.target.value)}
                            placeholder="Ej: 12.345.678-9"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                            type="email"
                            value={data[`${prefix}Email`] || ''}
                            onChange={(e) => onUpdate(`${prefix}Email`, e.target.value)}
                            placeholder="Ej: juan@example.com"
                            required
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
