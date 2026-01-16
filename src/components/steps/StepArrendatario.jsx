import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { UserPlus } from 'lucide-react'

export default function StepArrendatario({ data, onUpdate, onNext, onBack }) {
    const isTenantComplete = data.arrendatarioNombre && data.arrendatarioApellido && data.arrendatarioEmail && data.arrendatarioTelefono && data.arrendatarioRut

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isTenantComplete) onNext()
    }

    const handleRutChange = (field, val) => {
        onUpdate(field, val)
    }

    return (
        <Card className="max-w-2xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Tenant Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <UserPlus className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold text-foreground">Datos del Arrendatario <span className="text-sm font-normal text-muted-foreground">(Receptor del Voucher)</span></h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input
                                    value={data.arrendatarioNombre}
                                    onChange={(e) => onUpdate('arrendatarioNombre', e.target.value)}
                                    required
                                    autoFocus
                                    placeholder="Nombre"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Apellido</Label>
                                <Input
                                    value={data.arrendatarioApellido}
                                    onChange={(e) => onUpdate('arrendatarioApellido', e.target.value)}
                                    required
                                    placeholder="Apellido"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>RUT</Label>
                                <Input
                                    value={data.arrendatarioRut}
                                    onChange={(e) => handleRutChange('arrendatarioRut', e.target.value)}
                                    placeholder="12.345.678-9"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Teléfono</Label>
                                <Input
                                    type="tel"
                                    value={data.arrendatarioTelefono}
                                    onChange={(e) => onUpdate('arrendatarioTelefono', e.target.value)}
                                    required
                                    placeholder="+56 9 ..."
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={data.arrendatarioEmail}
                                    onChange={(e) => onUpdate('arrendatarioEmail', e.target.value)}
                                    required
                                    placeholder="nombre@ejemplo.com"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between pt-6">
                        <Button type="button" variant="outline" onClick={onBack}>
                            Atrás
                        </Button>
                        <Button type="submit" disabled={!isTenantComplete}>
                            Siguiente
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
