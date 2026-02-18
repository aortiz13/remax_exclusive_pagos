import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { DollarSign } from 'lucide-react'

export default function StepHonorarios({ data, onUpdate, onNext, onBack }) {
    const isVenta = data.tipoSolicitud === 'venta'
    const role = isVenta ? data.ventaRole : data.arriendoRole
    const isSplit = role === 'Ambas'

    const labelA = isVenta ? 'Vendedor' : 'Arrendador'
    const labelB = isVenta ? 'Comprador' : 'Arrendatario'

    // Determine completion
    const isComplete = isSplit
        ? (data.montoHonorariosA && data.montoHonorariosB)
        : (role === labelA || role === (isVenta ? 'Vendedor' : 'Arrendador')) ? data.montoHonorariosA : data.montoHonorariosB

    // Helper for calculations
    const getCalculations = (amount) => {
        const net = Number(amount) || 0
        const iva = Math.round(net * 0.19)
        const total = net + iva
        return { net, iva, total }
    }

    const calcA = getCalculations(data.montoHonorariosA)
    const calcB = getCalculations(data.montoHonorariosB)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    return (
        <Card className="max-w-2xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <div className="mb-8 space-y-2 text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex justify-center items-center gap-2">
                        <DollarSign className="w-7 h-7" />
                        Honorarios de la Operación
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Ingrese los montos netos fijados para los honorarios.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* SIDE A */}
                        {(isSplit || role === labelA || role === (isVenta ? 'Vendedor' : 'Arrendador')) && (
                            <div className={`space-y-4 p-4 rounded-xl border-2 transition-all ${isSplit ? 'border-blue-50 bg-blue-50/10' : 'col-span-2 border-slate-100'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold text-slate-800">Honorarios {labelA}</h3>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Monto Neto</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="number"
                                            value={data.montoHonorariosA || ''}
                                            onChange={(e) => onUpdate('montoHonorariosA', e.target.value)}
                                            className="pl-9 h-12 text-lg font-semibold"
                                            placeholder="Ingresa el neto"
                                            required
                                            autoFocus={!isSplit || role === labelA}
                                        />
                                    </div>
                                </div>

                                {calcA.net > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-blue-100/50">
                                        <div className="flex justify-between text-sm text-slate-600">
                                            <span>IVA (19%)</span>
                                            <span>${calcA.iva.toLocaleString('es-CL')}</span>
                                        </div>
                                        <div className="flex justify-between text-lg font-bold text-blue-700">
                                            <span>Total</span>
                                            <span>${calcA.total.toLocaleString('es-CL')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SIDE B */}
                        {(isSplit || role === labelB || role === (isVenta ? 'Comprador' : 'Arrendatario')) && (
                            <div className={`space-y-4 p-4 rounded-xl border-2 transition-all ${isSplit ? 'border-green-50 bg-green-50/10' : 'col-span-2 border-slate-100'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-2 rounded-lg bg-green-50 text-green-600">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold text-slate-800">Honorarios {labelB}</h3>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Monto Neto</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="number"
                                            value={data.montoHonorariosB || ''}
                                            onChange={(e) => onUpdate('montoHonorariosB', e.target.value)}
                                            className="pl-9 h-12 text-lg font-semibold"
                                            placeholder="Ingresa el neto"
                                            required
                                        />
                                    </div>
                                </div>

                                {calcB.net > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-green-100/50">
                                        <div className="flex justify-between text-sm text-slate-600">
                                            <span>IVA (19%)</span>
                                            <span>${calcB.iva.toLocaleString('es-CL')}</span>
                                        </div>
                                        <div className="flex justify-between text-lg font-bold text-green-700">
                                            <span>Total</span>
                                            <span>${calcB.total.toLocaleString('es-CL')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
