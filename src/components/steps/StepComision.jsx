import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { DollarSign } from 'lucide-react'

export default function StepComision({ data, onUpdate, onNext, onBack }) {
    const isComplete = data.dividirComision
        ? (data.comisionVendedor && data.comisionComprador)
        : data.montoComision

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
                    <p className="text-muted-foreground text-sm">Defina la estructura de comisión para la operación.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* TOGGLE SPLIT */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <Label htmlFor="split-commission" className="flex flex-col cursor-pointer">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">¿Dividir Comisión?</span>
                            <span className="text-xs text-muted-foreground">Cobrar por separado a Vendedor y Comprador</span>
                        </Label>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="split-commission"
                                id="split-commission"
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer duration-200 ease-in-out verified-toggle"
                                style={{
                                    right: data.dividirComision ? '0' : '50%',
                                    borderColor: data.dividirComision ? '#22c55e' : '#ccc'
                                }}
                                checked={data.dividirComision || false}
                                onChange={(e) => onUpdate('dividirComision', e.target.checked)}
                            />
                            <label
                                htmlFor="split-commission"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${data.dividirComision ? 'bg-green-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>

                    {!data.dividirComision ? (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <Label>Monto Comisión Total</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8"
                                    value={data.montoComision || ''}
                                    onChange={(e) => onUpdate('montoComision', e.target.value)}
                                    placeholder="Ej: 2000000"
                                    required={!data.dividirComision}
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Valor en pesos chilenos (Neto o Bruto según acuerdo).</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label className="text-blue-700">Comisión Vendedor</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-8"
                                        value={data.comisionVendedor || ''}
                                        onChange={(e) => onUpdate('comisionVendedor', e.target.value)}
                                        placeholder="Monto Vendedor"
                                        required={data.dividirComision}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-green-700">Comisión Comprador</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-8"
                                        value={data.comisionComprador || ''}
                                        onChange={(e) => onUpdate('comisionComprador', e.target.value)}
                                        placeholder="Monto Comprador"
                                        required={data.dividirComision}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

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
