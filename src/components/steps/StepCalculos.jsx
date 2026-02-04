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

    // UF Fetching
    const [ufData, setUfData] = useState({ valor: 0, fecha: '' })

    useEffect(() => {
        const fetchUF = async () => {
            try {
                const res = await fetch('https://mindicador.cl/api/uf')
                const data = await res.json()
                // mindicador returns array in series, or object for current?
                // The snippet in prompt implies: { ... "serie": [ { "fecha": "...", "valor": ... } ] } usually, 
                // BUT user provided example: {"codigo": "uf", ... "valor": 39695.81 } for specific date or root?
                // 'https://mindicador.cl/api/uf' usually returns the series for the last month.
                // 'https://mindicador.cl/api/uf/YYYY-MM-DD' returns specific.
                // However, usually the root 'https://mindicador.cl/api' returns ALL indicators with current value.
                // User prompt: "Endpoint actual: https://mindicador.cl". Let's try root first or UF specific.
                // Let's assume standard response from https://mindicador.cl/api (which returns { uf: { valor: X, ... }, ... })
                // OR specific endpoint. Let's use the one that is most reliable or try root.
                // Actually, user provided example looks like the object inside the main response.
                // Safe bet: Fetch https://mindicador.cl/api and get .uf

                const resRoot = await fetch('https://mindicador.cl/api')
                if (!resRoot.ok) throw new Error('Failed to fetch UF')
                const rootData = await resRoot.json()

                if (rootData.uf) {
                    setUfData({
                        valor: rootData.uf.valor,
                        fecha: rootData.uf.fecha?.split('T')[0]
                    })
                    onUpdate('ufValue', rootData.uf.valor) // Save to form data
                }
            } catch (err) {
                console.error('Error fetching UF:', err)
                // Fallback or leave as 0 (will handle gracefully)
            }
        }
        fetchUF()
    }, [])

    // Calculations Effect
    useEffect(() => {
        // Base values
        const canon = Number(data.canonArriendo) || 0
        const garantia = Number(data.garantia) || 0
        const gastosNotariales = Number(data.gastosNotariales) || 0
        const certDominio = Number(data.costoDominioVigente) || 0
        const ufVal = ufData.valor || 0

        // Seguro de Restitución (Pass-through)
        const seguro = data.chkSeguro ? (Number(data.montoSeguro) || 0) : 0

        // --- 1. Arriendo Inicial ---
        const dias = Number(data.diasProporcionales) || 0
        const montoProporcional = data.chkProporcional ? Math.round((canon / 30) * dias) : 0
        const montoMesAdelantado = data.chkMesAdelantado ? canon : 0
        const totalArriendoInicial = montoProporcional + montoMesAdelantado

        // --- 2. Honorarios (Comisión) ---
        let honorariosNeto = 0;
        let feeAlert = false; // "fee_alert_triggered"

        const mesesContrato = Number(data.duracionContrato) || 12; // Default 1 year if not set
        const tipoPropiedad = data.tipoPropiedad || 'Casa'; // Default Residential

        // Determine Category
        const isCommercial = data.contractType
            ? data.contractType === 'commercial'
            : ['Oficina', 'Local Comercial', 'Bodega', 'Industrial'].includes(tipoPropiedad);

        // --- CALCULATION LOGIC ---

        if (data.ingresoManual) {
            // MANUAL OVERRIDE
            // Logic: User enters a NET amount manually.
            // But how do we get the manual input? We need a field in `data`.
            // Let's assume we reuse 'montoComision' or add 'montoHonorariosManual'.
            // Actually, we should probably stick to `data.honorariosAdmin` or similar, 
            // OR checks generic field. Let's look at `data`.
            // `data.montoComision` is used in Compraventa.
            // Let's use `data.honorariosNetosManual` if it exists, otherwise define it.
            // Since we didn't add it in RequestForm, let's use `data.montoComision` as the shared "Fee Amount" field,
            // OR create a local logic if the user edits the field directly.
            // Wait, previous code calculated `honorariosNeto` inside effect.
            // If manual, we should read from input.
            // Let's assume the Input will write to `data.montoHonorariosManual`.

            honorariosNeto = Number(data.montoHonorariosManual) || 0;

            // CHECK MINIMUM RULE ALERT
            if (!isCommercial && mesesContrato <= 24 && ufVal > 0) {
                const minLegalNeto = Math.round(6 * ufVal);
                if (honorariosNeto < minLegalNeto) {
                    feeAlert = true;
                }
            }

        } else {
            // AUTOMATIC CALCULATION
            if (!isCommercial) {
                // -- RESIDENCIAL --
                if (mesesContrato <= 24) {
                    // Rule 1: 50% Canon
                    const halfRent = Math.round(canon * 0.5);

                    // Rule 2: Minimum 6 UF + IVA (Logic is on Net or Gross?)
                    // "Si ese resultado es menor a 6 UF + IVA, el sistema debe cambiar automáticamente el monto a cobrar a las 6 UF + IVA"
                    // Usually "6 UF + IVA" means the Gross Total is 6UF+IVA.
                    // So Net Minimum = 6 UF.

                    let finalNet = halfRent;
                    if (ufVal > 0) {
                        const minNet = Math.round(6 * ufVal);
                        if (halfRent < minNet) {
                            finalNet = minNet;
                        }
                    }
                    honorariosNeto = finalNet;

                } else {
                    // > 24 meses: 2% del total del contrato
                    const totalContrato = canon * mesesContrato;
                    honorariosNeto = Math.round(totalContrato * 0.02);
                }
            } else {
                // -- COMERCIAL --
                if (mesesContrato <= 60) { // Hasta 5 años
                    honorariosNeto = Math.round(canon * 0.5);
                } else {
                    // > 5 años: 2% del total del contrato
                    const totalContrato = canon * mesesContrato;
                    honorariosNeto = Math.round(totalContrato * 0.02);
                }
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
            montoAdmin = Math.round(canon * (porcentaje / 100));
            ivaAdmin = Math.round(montoAdmin * 0.19);
            totalAdmin = montoAdmin + ivaAdmin;
        }

        // --- 4. Total a Cancelar (Arrendatario) ---
        const totalCancelar = totalArriendoInicial + garantia + gastosNotariales + totalComision + seguro

        // --- 5. Total a Recibir (Dueño) ---
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
            totalAdmin,
            ufUsed: ufVal,
            feeAlert
        })

        // Update parent with alert status
        if (data.feeAlertTriggered !== feeAlert) {
            onUpdate('feeAlertTriggered', feeAlert);
        }

    }, [data, ufData])

    const handleNext = () => {
        onUpdate('calculations', results)
        onNext()
    }

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val)
    }

    // Determine category label for UI
    // Determine category label for UI
    const isCommercial = data.contractType
        ? data.contractType === 'commercial'
        : ['Oficina', 'Local Comercial', 'Bodega', 'Industrial'].includes(data.tipoPropiedad);

    const categoryLabel = isCommercial ? 'Comercial' : 'Residencial';

    // Initialize Contract Type if not set
    useEffect(() => {
        if (!data.contractType && data.tipoPropiedad) {
            const AutoIsCommercial = ['Oficina', 'Local Comercial', 'Bodega', 'Industrial'].includes(data.tipoPropiedad);
            onUpdate('contractType', AutoIsCommercial ? 'commercial' : 'residential');
        }
    }, []) // Run once on mount to set default if missing

    // Local state to track "mode" (short vs long) explicitly.
    // This prevents the UI from flipping back to "short" when the user clears the input (value becomes empty or 0).
    const [contractTimeMode, setContractTimeMode] = useState('short'); // 'short' | 'long'

    // Initialize/Sync mode based on incoming data (only if not already set or first load)
    useEffect(() => {
        if (!data.duracionContrato) return;
        const val = Number(data.duracionContrato);
        if (isCommercial) {
            if (val > 60) setContractTimeMode('long');
            else setContractTimeMode('short');
        } else {
            if (val > 24) setContractTimeMode('long');
            else setContractTimeMode('short');
        }
    }, [isCommercial]); // Dependency on isCommercial ensures we reset if property type changes (unlikely here but safe)
    // We intentionally DO NOT depend on data.duracionContrato here to avoid checking it on every keystroke
    // which would cause the issue we are trying to fix.

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

                        {/* SECCIÓN: TIPO DE CONTRATO (RESIDENCIAL VS COMERCIAL) */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
                            <Label className="text-slate-900 font-semibold flex items-center gap-2">
                                <Briefcase className="w-4 h-4" /> Tipo de Contrato
                            </Label>
                            <div className="flex gap-4">
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${!isCommercial ? 'bg-primary/10 border-primary text-primary font-medium' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    <input
                                        type="radio"
                                        name="contractType"
                                        className="hidden"
                                        checked={!isCommercial}
                                        onChange={() => {
                                            onUpdate('contractType', 'residential')
                                            // Reset duration to default when switching
                                            onUpdate('duracionContrato', 12)
                                            setContractTimeMode('short')
                                        }}
                                    />
                                    <span>Residencial</span>
                                </label>
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${isCommercial ? 'bg-primary/10 border-primary text-primary font-medium' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    <input
                                        type="radio"
                                        name="contractType"
                                        className="hidden"
                                        checked={isCommercial}
                                        onChange={() => {
                                            onUpdate('contractType', 'commercial')
                                            // Reset duration to default when switching
                                            onUpdate('duracionContrato', 12)
                                            setContractTimeMode('short')
                                        }}
                                    />
                                    <span>Comercial</span>
                                </label>
                            </div>
                        </div>

                        {/* SECCIÓN: DURACIÓN CONTRATO */}
                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-3">
                            <Label className="text-blue-900 font-semibold">Duración del Contrato</Label>
                            <div className="flex flex-col gap-3">
                                <div className="relative flex-1">
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={contractTimeMode}
                                        onChange={(e) => {
                                            const newMode = e.target.value;
                                            setContractTimeMode(newMode);

                                            // Set default values when switching modes
                                            if (isCommercial) {
                                                onUpdate('duracionContrato', newMode === 'short' ? 12 : 61)
                                            } else {
                                                onUpdate('duracionContrato', newMode === 'short' ? 12 : 25)
                                            }
                                        }}
                                    >
                                        <option value="short">
                                            {isCommercial ? 'Contrato de hasta 5 años (Comisión 50% canon)' : 'Contrato de hasta 2 años (Comisión 50% canon)'}
                                        </option>
                                        <option value="long">
                                            {isCommercial ? 'Contrato mayor a 5 años (2% Total Contrato)' : 'Contrato mayor a 2 años (2% Total Contrato)'}
                                        </option>
                                    </select>
                                </div>

                                {/* Conditional Input for Months */}
                                {contractTimeMode === 'long' && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <Label className="text-xs text-blue-800 mb-1.5 block">Cantidad de Meses</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min={isCommercial ? 61 : 25}
                                                value={data.duracionContrato}
                                                onChange={(e) => onUpdate('duracionContrato', e.target.value)}
                                                className="bg-white border-blue-200 focus:border-blue-400"
                                                placeholder={isCommercial ? "Ej: 72" : "Ej: 36"}
                                            />
                                            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">meses</span>
                                        </div>
                                    </div>
                                )}
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

                        {/* SECCIÓN 4: HONORARIOS (UF LOGIC & MANUAL) */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800 space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-500 flex justify-between items-center">
                                <span>Honorarios</span>
                                {data.ingresoManual && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">Manual</span>}
                            </h3>

                            {/* UF Info Bar */}
                            <div className="text-xs bg-blue-50 text-blue-800 p-2 rounded-md border border-blue-100 flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                <span>UF Hoy ({ufData.fecha || 'N/A'}): <strong>{formatCurrency(ufData.valor)}</strong></span>
                                <span className="opacity-60">| Mínimo 6 UF: ~{formatCurrency(Math.round(6 * ufData.valor))} + IVA</span>
                            </div>

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="ingresoManual"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={data.ingresoManual || false}
                                    onChange={(e) => onUpdate('ingresoManual', e.target.checked)}
                                />
                                <Label htmlFor="ingresoManual" className="font-medium cursor-pointer text-sm">
                                    Ingreso Manual de Honorarios
                                </Label>
                            </div>

                            {/* MANUAL INPUT */}
                            {data.ingresoManual && (
                                <div className="animate-in slide-in-from-top-2 space-y-2">
                                    <Label className="text-xs text-muted-foreground">Monto Honorarios Neto (Sin IVA)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-8 bg-white"
                                            type="number"
                                            value={data.montoHonorariosManual}
                                            onChange={(e) => onUpdate('montoHonorariosManual', e.target.value)}
                                            placeholder="Ingrese monto neto"
                                        />
                                    </div>
                                    {results.feeAlert && (
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-start gap-1">
                                            <span className="font-bold">⚠ Alerta:</span>
                                            <span>El monto ingresado es inferior al mínimo de 6 UF ({formatCurrency(Math.round(6 * ufData.valor))}). Se notificará a administración.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* READ ONLY DISPLAY (If Automatic) */}
                            {!data.ingresoManual && (
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Cálculo Automático (Neto)</Label>
                                    <div className="h-9 px-3 py-2 bg-muted text-muted-foreground text-sm rounded-md border border-input opacity-70">
                                        {formatCurrency(results.honorariosNeto)}
                                    </div>
                                    {!isCommercial && results.honorariosNeto > 0 && results.honorariosNeto === Math.round(6 * ufData.valor) && (
                                        <p className="text-[10px] text-green-600 font-medium">
                                            * Se aplicó mínimo legal de 6 UF por ser menor el 50%.
                                        </p>
                                    )}
                                </div>
                            )}


                        </div>

                        {/* SECCIÓN 5: CONDICIONES ESPECIALES */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-100 dark:border-yellow-900/30 space-y-3">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="chkCondicionesEspeciales"
                                    className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-600"
                                    checked={data.chkCondicionesEspeciales || false}
                                    onChange={(e) => onUpdate('chkCondicionesEspeciales', e.target.checked)}
                                />
                                <Label htmlFor="chkCondicionesEspeciales" className="font-medium cursor-pointer flex items-center gap-2 text-yellow-900 dark:text-yellow-300">
                                    <ShieldCheck className="w-4 h-4" /> Condiciones Especiales
                                </Label>
                            </div>

                            {data.chkCondicionesEspeciales && (
                                <div className="animate-in slide-in-from-top-2">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                                        Detalle de condiciones (ej. primeros meses diferidos, gastos extra)
                                    </Label>
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Ingrese aquí las condiciones especiales..."
                                        value={data.condicionesEspeciales || ''}
                                        onChange={(e) => onUpdate('condicionesEspeciales', e.target.value)}
                                    />
                                </div>
                            )}
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
