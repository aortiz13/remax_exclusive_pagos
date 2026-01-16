import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { UserCircle, Mail, Phone, User } from 'lucide-react'

export default function StepAgente({ data, onUpdate, onNext }) {
    const isValid = data.agenteNombre && data.agenteApellido && data.agenteEmail && data.agenteTelefono

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm animate-in slide-in-from-right-4 duration-500">
            <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-6">
                    <UserCircle className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold">Datos del Agente</h2>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nombre">Nombre</Label>
                            <div className="relative">
                                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="nombre"
                                    className="pl-8"
                                    value={data.agenteNombre || ''}
                                    onChange={(e) => onUpdate('agenteNombre', e.target.value)}
                                    placeholder="Ej: Juan"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="apellido">Apellido</Label>
                            <Input
                                id="apellido"
                                value={data.agenteApellido || ''}
                                onChange={(e) => onUpdate('agenteApellido', e.target.value)}
                                placeholder="Ej: Pérez"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email Corporativo</Label>
                        <div className="relative">
                            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="email"
                                type="email"
                                className="pl-8"
                                value={data.agenteEmail || ''}
                                onChange={(e) => onUpdate('agenteEmail', e.target.value)}
                                placeholder="juan.perez@remax-exclusive.cl"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="telefono">Teléfono</Label>
                        <div className="relative">
                            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="telefono"
                                type="tel"
                                className="pl-8"
                                value={data.agenteTelefono || ''}
                                onChange={(e) => onUpdate('agenteTelefono', e.target.value)}
                                placeholder="+56 9 1234 5678"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={onNext}
                        disabled={!isValid}
                        className="w-full mt-4"
                        size="lg"
                    >
                        Continuar
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
