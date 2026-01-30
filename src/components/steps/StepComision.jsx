import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { DollarSign } from 'lucide-react'

export default function StepComision({ data, onUpdate, onNext, onBack }) {
    const isComplete = data.montoComision

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    const formatCurrency = (val) => {
        // Simple formatter for display if needed, but we keep input raw or handle it
        // Here we just let user input text/number
        return val
    }

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <div className="mb-6 space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <DollarSign className="w-6 h-6" />
                        Comisión
                    </h2>
                    <p className="text-muted-foreground text-sm">Ingrese el monto de la comisión acordada.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label>Monto Comisión</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-8"
                                value={data.montoComision || ''}
                                onChange={(e) => onUpdate('montoComision', e.target.value)}
                                placeholder="Ej: $ 2.000.000"
                                required
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Aca colocar valor en pesos chilenos unicamente.</p>
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
