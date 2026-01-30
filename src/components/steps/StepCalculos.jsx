import React, { useEffect, useState } from 'react'
import { Card, CardContent, Button, Input, Label, Separator } from '@/components/ui'
import { Calculator, DollarSign, TrendingUp, ShieldCheck, Briefcase } from 'lucide-react'

// Valor UF estimado, idealmente traer de API o Contexto
const VALOR_UF_ESTIMADO = 38000;

export default function StepCalculos({ data, onUpdate, onNext, onBack }) {
    const [results, setResults] = useState({
        totalArriendoInicial: 0,
        honorariosNeto: 0,
        ivaHonorarios: 0,
        totalComision: 0, // Now "Honorarios"
        totalCancelar: 0,
        totalRecibir: 0,
        montoAdmin: 0,
        ivaAdmin: 0,
        totalAdmin: 0
    })

    // Calculations Effect
    useEffect(() => {
        // Base values
        const canon = Number(data.canonArriendo) || 0
        const garantia = Number(data.garantia) || 0
        const gastosNotariales = Number(data.gastosNotariales) || 0
        const certDominio = Number(data.costoDominioVigente) || 0

        // Seguro de Restitución (Pass-through)
        const seguro = data.chkSeguro ? (Number(data.montoSeguro) || 0) : 0

        // --- 1. Arriendo Inicial ---
        const dias = Number(data.diasProporcionales) || 0
        const montoProporcional = data.chkProporcional ? Math.round((canon / 30) * dias) : 0
        const montoMesAdelantado = data.chkMesAdelantado ? canon : 0
        const totalArriendoInicial = montoProporcional + montoMesAdelantado

        // --- 2. Honorarios (Comisión) ---
        let honorariosNeto = 0;
        const mesesContrato = Number(data.duracionContrato) || 12; // Default 1 year if not set
        const tipoPropiedad = data.tipoPropiedad || 'Casa'; // Default Residential

        // Determine Category
        const isCommercial = ['Oficina', 'Local Comercial', 'Bodega', 'Industrial'].includes(tipoPropiedad);

        if (!isCommercial) {
            // -- RESIDENCIAL --
            if (mesesContrato <= 24) {
                // 50% Canon + IVA (Min 6 UF)
                let baseHonorarios = Math.round(canon * 0.5);
                const minHonorarios = 6 * VALOR_UF_ESTIMADO;

                if (baseHonorarios < minHonorarios) {
                    baseHonorarios = minHonorarios;
                }
                honorariosNeto = baseHonorarios;
            } else {
                // > 24 meses: 2% del total del contrato
                const totalContrato = canon * mesesContrato;
                honorariosNeto = Math.round(totalContrato * 0.02);
            }
        } else {
            // -- COMERCIAL --
            if (mesesContrato <= 60) { // Hasta 5 años
                // 100% Canon (1 mes) + IVA
                honorariosNeto = canon;
            } else {
                // > 5 años: 2% del total del contrato
                const totalContrato = canon * mesesContrato;
                honorariosNeto = Math.round(totalContrato * 0.02);
            }
        }

        const ivaHonorarios = Math.round(honorariosNeto * 0.19);
        const totalComision = honorariosNeto + ivaHonorarios;

        // --- 3. Administración ---
        let montoAdmin = 0;
        let ivaAdmin = 0;
        let totalAdmin = 0;

        if (data.conAdministracion) {
            const porcentaje = Number(data.porcentajeAdministracion) || 0;
            // Fee is a percentage of the Canon
            montoAdmin = Math.round(canon * (porcentaje / 100));
            ivaAdmin = Math.round(montoAdmin * 0.19);
            totalAdmin = montoAdmin + ivaAdmin;

            // Note: Administration fee is usually recurrent (monthly), but here we calculate the *first payment* impact?
            // "que el agente tenga la opción para agregar el % y que el sistema haga el calculo sumándole el IVA"
            // Usually valid for first payment if they collect first month admin. 
            // Assuming this is just calculation for the REQUEST, to show value.
            // Usually Admin Fee is deducted from monthly rent.
            // If this is "Payment Link", maybe they are paying the first month rent + comission?
            // Admin fee is usually deducted from what owner receives.
        }

        // --- 4. Total a Cancelar (Arrendatario) ---
        // Arrendatario pays: Initial Rent + Warranty + Notary + Commission + Insurance
        // (Admin fee is usually cost to owner, not extra to tenant, unless specific agreement. 
        //  The prompt says "el sistema haga el calculo sumándole el IVA". 
        //  I will display it but usually it's deducted from owner. I will deduct from owner in 'Recibir')
        const totalCancelar = totalArriendoInicial + garantia + gastosNotariales + totalComision + seguro

        // --- 5. Total a Recibir (Dueño) ---
        // Ingresos: Arriendo Inicial + Garantía
        // Egresos: Comisión + Gastos Notariales + Cert Dominio + (Admin Fee?) + (Seguro?)
        // If owner pays Admin Fee for the first month:
        const totalEgresosOwner = totalComision + gastosNotariales + certDominio + totalAdmin

        const totalRecibir = (totalArriendoInicial + garantia) - totalEgresosOwner

        setResults({
            totalArriendoInicial,
            montoProporcional,
            montoMesAdelantado,
            montoSeguro: seguro,
            honorariosNeto,
            ivaHonorarios,
            totalComision,
            totalCancelar,
            totalRecibir,
            montoAdmin,
            ivaAdmin,
            totalAdmin
        })

    }, [data])

    const handleNext = () => {
        onUpdate('calculations', results)
        onNext()
    }

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val)
    }

    // Determine category label for UI
    const isCommercial = ['Oficina', 'Local Comercial', 'Bodega', 'Industrial'].includes(data.tipoPropiedad);
    const categoryLabel = isCommercial ? 'Comercial' : 'Residencial';

    return (
        <Card className="max-w-4xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-6">
                    <Calculator className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold">Cálculos & Honorarios ({categoryLabel})</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* INPUTS COLUMN */}
                    <div className="space-y-6">

                        {/* SECCIÓN: DURACIÓN CONTRATO */}
                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-3">
                            <Label className="text-blue-900 font-semibold">Duración del Contrato</Label>
                            <div className="flex gap-4 items-center">
                                <div className="relative flex-1">
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={data.duracionContrato || ''}
                                        onChange={(e) => onUpdate('duracionContrato', e.target.value)}
                                    >
                                        <option value="">Seleccionar duración...</option>
                                        {isCommercial ? (
                                            <>
                                                <option value="12">Contrato de hasta 5 años</option>
                                                <option value="61">Contrato mayor a 5 años</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="12">Contrato de hasta 2 años</option>
                                                <option value="25">Contrato de más de 2 años</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>

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
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Costos & Garantía</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Garantía</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input className="pl-8" type="number" value={data.garantia} onChange={(e) => onUpdate('garantia', e.target.value)} placeholder="$ 850000" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Gastos Notariales</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input className="pl-8" type="number" value={data.gastosNotariales} onChange={(e) => onUpdate('gastosNotariales', e.target.value)} placeholder="$ 7500" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                {/* Seguro Restitución */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <input type="checkbox" id="chkSeguro" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" checked={data.chkSeguro || false} onChange={(e) => onUpdate('chkSeguro', e.target.checked)} />
                                        <Label htmlFor="chkSeguro" className="font-medium cursor-pointer flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-slate-500" /> Seguro de Restitución
                                        </Label>
                                    </div>
                                    {data.chkSeguro && (
                                        <div className="pl-6 animate-in slide-in-from-top-2">
                                            <div className="relative">
                                                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input className="pl-8 bg-white dark:bg-slate-950" type="number" value={data.montoSeguro} onChange={(e) => onUpdate('montoSeguro', e.target.value)} placeholder="$ Monto Seguro" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Administración */}
                                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <input type="checkbox" id="conAdministracion" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" checked={data.conAdministracion || false} onChange={(e) => onUpdate('conAdministracion', e.target.checked)} />
                                        <Label htmlFor="conAdministracion" className="font-medium cursor-pointer flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                                            <Briefcase className="w-4 h-4" /> Con Administración
                                        </Label>
                                    </div>
                                    {data.conAdministracion && (
                                        <div className="pl-6 animate-in slide-in-from-top-2 grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">% Comisión</Label>
                                                <div className="relative">
                                                    <Input type="number" value={data.porcentajeAdministracion} onChange={(e) => onUpdate('porcentajeAdministracion', e.target.value)} placeholder="Ej: 7" className="pr-8 h-9 bg-white" />
                                                    <span className="absolute right-3 top-2 text-xs font-bold text-muted-foreground">%</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Monto (+IVA)</Label>
                                                <div className="h-9 px-3 py-2 bg-white/50 text-indigo-700 text-sm rounded-md border border-indigo-100 flex items-center font-mono">
                                                    {formatCurrency(results.totalAdmin)}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Costos Propietario Extra */}
                        <div className="space-y-2">
                            <Label>Certificado de Dominio Vigente (Costo)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-8" type="number" value={data.costoDominioVigente} onChange={(e) => onUpdate('costoDominioVigente', e.target.value)} placeholder="$ 4600" />
                            </div>
                        </div>

                    </div>

                    {/* PREVIEW COLUMN */}
                    <div className="flex flex-col h-full">
                        <div className="bg-slate-900 text-slate-50 rounded-xl p-6 shadow-xl flex-1 flex flex-col justify-between relative overflow-hidden">
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
                                        <span className="flex flex-col">
                                            <span>+ Honorarios Remax</span>
                                            <span className="text-[10px] opacity-60">
                                                {isCommercial
                                                    ? (data.duracionContrato > 60 ? 'Comercial (>5a): 2% Total' : 'Comercial (<=5a): 1 Canon')
                                                    : (data.duracionContrato > 24 ? 'Residencial (>2a): 2% Total' : 'Residencial (<=2a): 50% Canon')} + IVA
                                            </span>
                                        </span>
                                        <span className="font-mono">{formatCurrency(results.totalComision)}</span>
                                    </div>

                                    {data.conAdministracion && (
                                        <div className="flex justify-between text-indigo-300/90">
                                            <span>+ Administración ({data.porcentajeAdministracion}% + IVA)</span>
                                            <span className="font-mono">{formatCurrency(results.totalAdmin)}</span>
                                        </div>
                                    )}

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
                                        *Descuentos aplicados: Honorarios, Notaria, Cert. Dominio {data.conAdministracion && ', Admin'}.
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
