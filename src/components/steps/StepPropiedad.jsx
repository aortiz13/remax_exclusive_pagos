import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { Building2, MapPin } from 'lucide-react'

export default function StepPropiedad({ data, onUpdate, onNext, onBack }) {
    const isComplete = data.tipoPropiedad && data.direccion && data.comuna

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <div className="mb-6 space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Building2 className="w-6 h-6" />
                        Datos de la Propiedad
                    </h2>
                    <p className="text-muted-foreground text-sm">Ingrese la información básica del inmueble de la operación.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo de Propiedad</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={data.tipoPropiedad}
                                onChange={(e) => onUpdate('tipoPropiedad', e.target.value)}
                                required
                                autoFocus
                            >
                                <option value="">Seleccionar...</option>
                                <option value="Departamento">Departamento</option>
                                <option value="Casa">Casa</option>
                                <option value="Oficina">Oficina</option>
                                <option value="Local Comercial">Local Comercial</option>
                                <option value="Bodega">Bodega</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Comuna</Label>
                            <Input
                                value={data.comuna}
                                onChange={(e) => onUpdate('comuna', e.target.value)}
                                placeholder="Ej: Providencia"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Dirección Completa</Label>
                        <div className="relative">
                            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-8"
                                value={data.direccion}
                                onChange={(e) => onUpdate('direccion', e.target.value)}
                                placeholder="Calle, Número, Depto..."
                                required
                            />
                        </div>
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
