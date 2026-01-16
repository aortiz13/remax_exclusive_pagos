import React, { useEffect, useState } from 'react'
import { Card, CardContent, Button, Input, Label, Separator } from '@/components/ui'
import { Calculator, DollarSign, TrendingDown, TrendingUp, Calendar, ShieldCheck } from 'lucide-react'

export default function StepCalculos({ data, onUpdate, onNext, onBack }) {
    const [results, setResults] = useState({
        totalArriendoInicial: 0,
        honorariosNeto: 0,
        ivaHonorarios: 0,
        totalComision: 0,
        totalCancelar: 0,
        totalRecibir: 0
    })

    // Calculations Effect
    useEffect(() => {
        // Base values
        const canon = Number(data.canonArriendo) || 0
        const garantia = Number(data.garantia) || 0
        const gastosNotariales = Number(data.gastosNotariales) || 0
        const certDominio = Number(data.costoDominioVigente) || 0
        const honorariosAdmin = Number(data.honorariosAdmin) || 0
        const seguro = data.chkSeguro ? (Number(data.montoSeguro) || 0) : 0

        // 1. Initial Rent Calculation

        // Días Proporcionales
        const dias = Number(data.diasProporcionales) || 0
        const montoProporcional = data.chkProporcional ? Math.round((canon / 30) * dias) : 0

        // Mes Adelantado
        const montoMesAdelantado = data.chkMesAdelantado ? canon : 0

        const totalArriendoInicial = montoProporcional + montoMesAdelantado

        // 2. Honorarios (50% del CANON base + IVA)
        // Commission is based on the Monthly Canon, irrespective of initial days
        const honorariosNeto = Math.round(canon * 0.5)
        const ivaHonorarios = Math.round(honorariosNeto * 0.19)
        const totalComision = honorariosNeto + ivaHonorarios

        // 3. Total a Cancelar (Arrendatario)
        const totalCancelar = totalArriendoInicial + garantia + gastosNotariales + totalComision + seguro

        // 4. Total a Recibir (Dueño)
        // Ingresos: Arriendo Inicial + Garantía
        // Egresos: Comisión + Gastos Notariales + Cert Dominio + Hon Admin
        // (Insurance is assumed external/pass-through)
        const ingresos = totalArriendoInicial + garantia
        const egresos = totalComision + gastosNotariales + certDominio + honorariosAdmin
        const totalRecibir = ingresos - egresos

        setResults({
            totalArriendoInicial,
            montoProporcional,
            montoMesAdelantado,
            montoSeguro: seguro,
            honorariosNeto,
            ivaHonorarios,
            totalComision,
            totalCancelar,
            totalRecibir
        })
    }, [data])

    const handleNext = () => {
        onUpdate('calculations', results)
        onNext()
    }

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val)
    }

    return (
        <Card className="max-w-4xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-6">
                    <Calculator className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold">Cálculos Financieros</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* INPUTS COLUMN */}
                    <div className="space-y-6">

                        {/* SECCIÓN 1: CANON */}
                        <div className="space-y-2">
                            <Label>Canon de Arriendo (Mensual Base)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8 text-lg font-medium"
                                    type="number"
                                    value={data.canonArriendo}
                                    onChange={(e) => onUpdate('canonArriendo', e.target.value)}
                                    placeholder="$ 750000"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* SECCIÓN 2: TIPO DE PAGO INICIAL */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg space-y-4 border border-slate-100 dark:border-slate-800">
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Arriendo Inicial</h3>

                            {/* Días Proporcionales */}
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="chkProporcional"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={data.chkProporcional || false}
                                        onChange={(e) => onUpdate('chkProporcional', e.target.checked)}
                                    />
                                    <Label htmlFor="chkProporcional" className="font-medium cursor-pointer">
                                        Días Proporcionales
                                    </Label>
                                </div>
                                {data.chkProporcional && (
                                    <div className="pl-6 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Cantidad Días</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="30"
                                                className="h-9"
                                                value={data.diasProporcionales}
                                                onChange={(e) => onUpdate('diasProporcionales', e.target.value)}
                                                placeholder="Ej: 5"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Monto Calc.</Label>
                                            <div className="h-9 px-3 py-2 bg-muted text-muted-foreground text-sm rounded-md border border-input">
                                                {formatCurrency(Math.round(((data.canonArriendo || 0) / 30) * (data.diasProporcionales || 0)))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Mes Adelantado */}
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="chkMesAdelantado"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={data.chkMesAdelantado || false}
                                        onChange={(e) => onUpdate('chkMesAdelantado', e.target.checked)}
                                    />
                                    <Label htmlFor="chkMesAdelantado" className="font-medium cursor-pointer">
                                        Mes Adelantado (Completo)
                                    </Label>
                                </div>
                                {data.chkMesAdelantado && (
                                    <div className="pl-6 animate-in slide-in-from-top-2">
                                        <div className="h-9 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm rounded-md border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                                            <span>Monto Automático:</span>
                                            <span className="font-bold">{formatCurrency(data.canonArriendo || 0)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN 3: OTROS COSTOS */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Costos Adicionales</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Garantía</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-8"
                                            type="number"
                                            value={data.garantia}
                                            onChange={(e) => onUpdate('garantia', e.target.value)}
                                            placeholder="$ 850000"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Gastos Notariales</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-8"
                                            type="number"
                                            value={data.gastosNotariales}
                                            onChange={(e) => onUpdate('gastosNotariales', e.target.value)}
                                            placeholder="$ 7500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seguro Restitución */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center space-x-2 mb-2">
                                    <input
                                        type="checkbox"
                                        id="chkSeguro"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={data.chkSeguro || false}
                                        onChange={(e) => onUpdate('chkSeguro', e.target.checked)}
                                    />
                                    <Label htmlFor="chkSeguro" className="font-medium cursor-pointer flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                                        Seguro de Restitución
                                    </Label>
                                </div>
                                {data.chkSeguro && (
                                    <div className="pl-6 animate-in slide-in-from-top-2">
                                        <div className="relative">
                                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                className="pl-8 bg-white dark:bg-slate-950"
                                                type="number"
                                                value={data.montoSeguro}
                                                onChange={(e) => onUpdate('montoSeguro', e.target.value)}
                                                placeholder="$ Monto Seguro"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN 4: CARGOS PROPIETARIO */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Cargos Propietario</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Certificado de Dominio Vigente</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-8"
                                            type="number"
                                            value={data.costoDominioVigente}
                                            onChange={(e) => onUpdate('costoDominioVigente', e.target.value)}
                                            placeholder="$ 4600"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Honorarios Admin</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-8"
                                            type="number"
                                            value={data.honorariosAdmin}
                                            onChange={(e) => onUpdate('honorariosAdmin', e.target.value)}
                                            placeholder="$ 80920"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PREVIEW COLUMN */}
                    <div className="flex flex-col h-full">
                        <div className="bg-slate-900 text-slate-50 rounded-xl p-6 shadow-xl flex-1 flex flex-col justify-between relative overflow-hidden">
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>

                            <div>
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-green-400" /> Resumen Financiero
                                </h3>

                                <div className="space-y-3 text-sm opacity-90">
                                    <div className="flex justify-between font-medium text-white/90">
                                        <span>Canon Mensual Base</span>
                                        <span>{formatCurrency(data.canonArriendo || 0)}</span>
                                    </div>
                                    <Separator className="bg-white/10" />

                                    {/* Breakdown of Payment */}
                                    {data.chkProporcional && (
                                        <div className="flex justify-between">
                                            <span>Prop. ({data.diasProporcionales || 0} dias)</span>
                                            <span className="font-mono">{formatCurrency(results.montoProporcional)}</span>
                                        </div>
                                    )}
                                    {data.chkMesAdelantado && (
                                        <div className="flex justify-between">
                                            <span>Mes Adelantado</span>
                                            <span className="font-mono">{formatCurrency(results.montoMesAdelantado)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between text-white/70">
                                        <span>+ Garantía</span>
                                        <span className="font-mono">{formatCurrency(data.garantia || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-white/70">
                                        <span>+ Gastos Notariales</span>
                                        <span className="font-mono">{formatCurrency(data.gastosNotariales || 0)}</span>
                                    </div>
                                    {results.montoSeguro > 0 && (
                                        <div className="flex justify-between text-white/70">
                                            <span>+ Seguro Restitución</span>
                                            <span className="font-mono">{formatCurrency(results.montoSeguro)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-white/70">
                                        <span>+ Comisión ({formatCurrency(results.honorariosNeto)} + IVA)</span>
                                        <span className="font-mono">{formatCurrency(results.totalComision)}</span>
                                    </div>

                                    <div className="my-2 border-t border-white/20"></div>
                                </div>
                            </div>

                            <div className="space-y-4 mt-2">
                                <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                                    <span className="block text-xs uppercase tracking-wider opacity-70 mb-1">Total a Pagar (Arrendatario)</span>
                                    <div className="text-2xl font-bold font-mono tracking-tight text-white">
                                        {formatCurrency(results.totalCancelar)}
                                    </div>
                                </div>

                                <div className="bg-green-500/20 border border-green-500/30 p-4 rounded-lg backdrop-blur-sm">
                                    <span className="block text-xs uppercase tracking-wider text-green-300 mb-1">Total a Recibir (Dueño)</span>
                                    <div className="text-2xl font-bold font-mono tracking-tight text-green-400">
                                        {formatCurrency(results.totalRecibir)}
                                    </div>
                                    <p className="text-[10px] text-green-200/60 mt-2 leading-tight">
                                        *Descuentos aplicados: Comisión, Gastos Notariales, Cert. Dominio, Hon. Admin.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between mt-8 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={onBack}>
                        Atrás
                    </Button>
                    <Button
                        type="button"
                        onClick={handleNext}
                        // Valid if at least one payment type selected or logic permits (flexible)
                        disabled={!data.canonArriendo}
                        size="lg"
                    >
                        Continuar
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
