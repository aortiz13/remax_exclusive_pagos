import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import {
    Calculator, DollarSign, TrendingUp, ShieldCheck,
    Briefcase, ChevronRight, ChevronLeft, Calendar, FileCheck,
    AlertTriangle, CheckCircle, Building, Home
} from 'lucide-react'

export default function StepCalculos({ data, onUpdate, onNext, onBack }) {
    const [results, setResults] = useState({
        totalArriendoInicial: 0,
        honorariosNetoA: 0,
        ivaHonorariosA: 0,
        totalComisionA: 0,
        honorariosNetoB: 0,
        ivaHonorariosB: 0,
        totalComisionB: 0,
        totalCancelar: 0,
        totalRecibir: 0,
        montoAdmin: 0,
        ivaAdmin: 0,
        totalAdmin: 0
    })

    const [ufData, setUfData] = useState({ valor: 0, fecha: '' })

    useEffect(() => {
        const fetchUF = async () => {
            try {
                const resRoot = await fetch('https://mindicador.cl/api')
                if (!resRoot.ok) throw new Error('Failed to fetch UF')
                const rootData = await resRoot.json()
                if (rootData.uf) {
                    setUfData({
                        valor: rootData.uf.valor,
                        fecha: rootData.uf.fecha?.split('T')[0]
                    })
                    onUpdate('ufValue', rootData.uf.valor)
                }
            } catch (err) {
                console.error('Error fetching UF:', err)
            }
        }
        fetchUF()
    }, [])

    useEffect(() => {
        const canon = Number(data.canonArriendo) || 0
        const garantia = Number(data.garantia) || 0
        const gastosNotarialesA = data.incluyeGastosNotarialesArrendador ? (Number(data.montoGastosNotarialesArrendador) || 0) : 0
        const gastosNotarialesB = data.incluyeGastosNotarialesArrendatario ? (Number(data.montoGastosNotarialesArrendatario) || 0) : 0
        const certDominio = Number(data.costoDominioVigente) || 0
        const ufVal = ufData.valor || 0
        const seguro = data.chkSeguro ? (Number(data.montoSeguro) || 0) : 0

        const dias = Number(data.diasProporcionales) || 0
        const montoProporcional = data.chkProporcional ? Math.round((canon / 30) * dias) : 0
        const montoMesAdelantado = data.chkMesAdelantado ? canon : 0
        const totalArriendoInicial = montoProporcional + montoMesAdelantado

        let honorariosNetoA = 0
        let honorariosNetoB = 0
        let feeAlertA = false
        let feeAlertB = false

        const mesesContrato = Number(data.duracionContrato) || 12
        const tipoPropiedad = data.tipoPropiedad || 'Casa'

        const isCommercial = data.contractType
            ? data.contractType === 'commercial'
            : ['Oficina', 'Local Comercial', 'Bodega', 'Industrial'].includes(tipoPropiedad)

        const calculateSideFee = (manualFlag, manualAmount) => {
            let netFee = 0
            let isMinApplied = false
            let alert = false

            if (manualFlag) {
                netFee = Number(manualAmount) || 0
                if (!isCommercial && mesesContrato <= 24 && ufVal > 0) {
                    const minLegalNeto = Math.round(6 * ufVal)
                    if (netFee < minLegalNeto) alert = true
                }
            } else {
                if (!isCommercial) {
                    if (mesesContrato <= 24) {
                        const halfRent = Math.round(canon * 0.5)
                        let finalNet = halfRent
                        if (ufVal > 0) {
                            const minNet = Math.round(6 * ufVal)
                            if (halfRent < minNet) { finalNet = minNet; isMinApplied = true }
                        }
                        netFee = finalNet
                    } else {
                        netFee = Math.round(canon * mesesContrato * 0.02)
                    }
                } else {
                    if (mesesContrato <= 60) {
                        netFee = Math.round(canon * 0.5)
                    } else {
                        netFee = Math.round(canon * mesesContrato * 0.02)
                    }
                }
            }
            return { netFee, isMinApplied, alert }
        }

        const calcA = calculateSideFee(data.ingresoManualA, data.montoManualA)
        honorariosNetoA = calcA.netFee
        feeAlertA = calcA.alert

        const calcB = calculateSideFee(data.ingresoManualB, data.montoManualB)
        honorariosNetoB = calcB.netFee
        feeAlertB = calcB.alert

        const ivaHonorariosA = Math.round(honorariosNetoA * 0.19)
        const totalComisionA = honorariosNetoA + ivaHonorariosA

        const ivaHonorariosB = Math.round(honorariosNetoB * 0.19)
        const totalComisionB = honorariosNetoB + ivaHonorariosB

        let montoAdmin = 0, ivaAdmin = 0, totalAdmin = 0
        if (data.conAdministracion) {
            const porcentaje = Number(data.porcentajeAdministracion) || 0
            montoAdmin = Math.round(canon * (porcentaje / 100))
            ivaAdmin = Math.round(montoAdmin * 0.19)
            totalAdmin = montoAdmin + ivaAdmin
        }

        const totalCancelar = totalArriendoInicial + garantia + gastosNotarialesB + totalComisionB + seguro
        const totalEgresosOwner = totalComisionA + gastosNotarialesA + certDominio + totalAdmin
        const totalRecibir = (totalArriendoInicial + garantia) - totalEgresosOwner

        setResults({
            totalArriendoInicial,
            montoProporcional,
            montoMesAdelantado,
            montoSeguro: seguro,
            honorariosNetoA, ivaHonorariosA, totalComisionA,
            minAppliedA: calcA.isMinApplied, feeAlertA,
            honorariosNetoB, ivaHonorariosB, totalComisionB,
            minAppliedB: calcB.isMinApplied, feeAlertB,
            totalCancelar, totalRecibir,
            montoAdmin, ivaAdmin, totalAdmin,
            ufUsed: ufVal,
            feeAlert: feeAlertA || feeAlertB
        })

        if (data.feeAlertTriggered !== (feeAlertA || feeAlertB)) {
            onUpdate('feeAlertTriggered', feeAlertA || feeAlertB)
        }
    }, [data, ufData])

    const handleNext = () => {
        onUpdate('calculations', results)
        onNext()
    }

    const formatCurrency = (val) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(val) || 0)

    const isCommercial = data.contractType
        ? data.contractType === 'commercial'
        : ['Oficina', 'Local Comercial', 'Bodega', 'Industrial'].includes(data.tipoPropiedad)

    useEffect(() => {
        if (!data.contractType && data.tipoPropiedad) {
            const AutoIsCommercial = ['Oficina', 'Local Comercial', 'Bodega', 'Industrial'].includes(data.tipoPropiedad)
            onUpdate('contractType', AutoIsCommercial ? 'commercial' : 'residential')
        }
    }, [])

    const [contractTimeMode, setContractTimeMode] = useState('short')

    useEffect(() => {
        if (!data.duracionContrato) return
        const val = Number(data.duracionContrato)
        if (isCommercial) {
            setContractTimeMode(val > 60 ? 'long' : 'short')
        } else {
            setContractTimeMode(val > 24 ? 'long' : 'short')
        }
    }, [isCommercial])

    // ── Toggle Switch Component ──────────────────────────────────────────────
    const ToggleSwitch = ({ checked, onChange, id }) => (
        <label htmlFor={id} className="relative inline-flex items-center cursor-pointer">
            <input
                id={id}
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={onChange}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary transition-colors" />
        </label>
    )

    // ── Currency Input ───────────────────────────────────────────────────────
    const CurrencyInput = ({ value, onChange, placeholder = '$ 0', className = '', large = false }) => (
        <div className="relative">
            <span className={`absolute inset-y-0 left-3 flex items-center text-slate-400 font-bold pointer-events-none ${large ? 'text-xl' : 'text-sm'}`}>$</span>
            <input
                type="number"
                value={value}
                onChange={onChange}
                placeholder={placeholder.replace('$ ', '')}
                className={`block w-full pl-8 pr-4 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all ${large ? 'py-3 text-2xl font-bold text-slate-900' : 'py-2 text-base font-semibold text-slate-800'} ${className}`}
            />
        </div>
    )

    // ── Section Label ────────────────────────────────────────────────────────
    const SectionLabel = ({ icon: Icon, children }) => (
        <div className="flex items-center gap-2 mb-4">
            {Icon && <Icon className="w-4 h-4 text-slate-400" />}
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{children}</h3>
        </div>
    )

    // ── Summary Row ──────────────────────────────────────────────────────────
    const SummaryRow = ({ label, value, className = '' }) => (
        <div className={`flex justify-between items-center text-sm ${className}`}>
            <span className="text-white/70">{label}</span>
            <span className="font-medium font-mono">{value}</span>
        </div>
    )

    return (
        <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Calculator className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Cálculos & Honorarios</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {isCommercial ? 'Contrato Comercial' : 'Contrato Residencial'}
                        </p>
                    </div>
                </div>

                {/* Contract Type Pill Toggle */}
                <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm inline-flex gap-1">
                    <button
                        onClick={() => { onUpdate('contractType', 'residential'); onUpdate('duracionContrato', 12); setContractTimeMode('short') }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!isCommercial ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        <Home className="w-3.5 h-3.5" />
                        Residencial
                    </button>
                    <button
                        onClick={() => { onUpdate('contractType', 'commercial'); onUpdate('duracionContrato', 12); setContractTimeMode('short') }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isCommercial ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        <Building className="w-3.5 h-3.5" />
                        Comercial
                    </button>
                </div>
            </div>

            {/* Main Two-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* ─── LEFT COLUMN ─────────────────────────────────────────── */}
                <div className="lg:col-span-7 flex flex-col gap-6">

                    {/* Row 1: Canon + Duration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Canon de Arriendo */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                Canon de Arriendo (Mensual)
                            </label>
                            <CurrencyInput
                                large
                                value={data.canonArriendo}
                                onChange={(e) => onUpdate('canonArriendo', e.target.value)}
                                placeholder="$ 750000"
                            />
                            {ufData.valor > 0 && data.canonArriendo > 0 && (
                                <p className="mt-2 text-xs text-slate-400">
                                    ≈ {(Number(data.canonArriendo) / ufData.valor).toFixed(2)} UF
                                </p>
                            )}
                        </div>

                        {/* Duración del Contrato */}
                        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                                    Duración del Contrato
                                </label>
                            </div>
                            <p className="text-xs text-slate-500 mb-3">Define el plazo para el cálculo de honorarios.</p>
                            <select
                                value={contractTimeMode}
                                onChange={(e) => {
                                    const newMode = e.target.value
                                    setContractTimeMode(newMode)
                                    if (isCommercial) {
                                        onUpdate('duracionContrato', newMode === 'short' ? 12 : 61)
                                    } else {
                                        onUpdate('duracionContrato', newMode === 'short' ? 12 : 25)
                                    }
                                }}
                                className="w-full px-3 py-2 text-sm border border-primary/20 bg-white rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-700 mb-3"
                            >
                                <option value="short">
                                    {isCommercial ? 'Hasta 5 años (50% canon)' : 'Hasta 2 años (50% canon)'}
                                </option>
                                <option value="long">
                                    {isCommercial ? 'Mayor a 5 años (2% total)' : 'Mayor a 2 años (2% total)'}
                                </option>
                            </select>
                            {contractTimeMode === 'long' && (
                                <div className="animate-in slide-in-from-top-2 duration-200 relative">
                                    <input
                                        type="number"
                                        min={isCommercial ? 61 : 25}
                                        value={data.duracionContrato}
                                        onChange={(e) => onUpdate('duracionContrato', e.target.value)}
                                        placeholder={isCommercial ? '72' : '36'}
                                        className="w-full px-3 pr-14 py-2 text-sm border border-primary/20 bg-white rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-semibold"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">meses</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Pagos Iniciales */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <SectionLabel icon={DollarSign}>Pagos Iniciales</SectionLabel>
                        <div className="space-y-3">

                            {/* Días Proporcionales */}
                            <div className={`flex items-center justify-between bg-white p-4 rounded-xl border transition-all ${data.chkProporcional ? 'border-primary/20 shadow-sm shadow-primary/5' : 'border-slate-100'}`}>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-800">Días Proporcionales</span>
                                    <span className="text-xs text-slate-400">Cobrar días restantes del mes en curso</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    {data.chkProporcional && (
                                        <span className="text-sm font-bold text-primary font-mono">
                                            {formatCurrency(results.montoProporcional)}
                                        </span>
                                    )}
                                    <ToggleSwitch
                                        id="chkProporcional"
                                        checked={data.chkProporcional || false}
                                        onChange={(e) => onUpdate('chkProporcional', e.target.checked)}
                                    />
                                </div>
                            </div>

                            {data.chkProporcional && (
                                <div className="animate-in slide-in-from-top-2 duration-200 pl-4 grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1 font-medium">Cantidad de Días</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={data.diasProporcionales}
                                                onChange={(e) => onUpdate('diasProporcionales', e.target.value)}
                                                placeholder="Ej: 5"
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1 font-medium">Monto Calculado</label>
                                        <div className="px-3 py-2 bg-primary/5 text-primary text-sm rounded-lg border border-primary/10 font-bold font-mono">
                                            {formatCurrency(Math.round(((data.canonArriendo || 0) / 30) * (data.diasProporcionales || 0)))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Mes Adelantado */}
                            <div className={`flex items-center justify-between bg-white p-4 rounded-xl border transition-all ${data.chkMesAdelantado ? 'border-primary/20 shadow-sm shadow-primary/5' : 'border-slate-100'}`}>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-800">Mes de Arriendo Adelantado</span>
                                    <span className="text-xs text-slate-400">Cobro completo del primer mes</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    {data.chkMesAdelantado && (
                                        <span className="text-sm font-bold text-primary font-mono">
                                            {formatCurrency(data.canonArriendo || 0)}
                                        </span>
                                    )}
                                    <ToggleSwitch
                                        id="chkMesAdelantado"
                                        checked={data.chkMesAdelantado || false}
                                        onChange={(e) => onUpdate('chkMesAdelantado', e.target.checked)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Garantía + Notaría */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Garantía */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                Monto de Garantía
                            </label>
                            <CurrencyInput
                                value={data.garantia}
                                onChange={(e) => onUpdate('garantia', e.target.value)}
                                placeholder="$ 850000"
                            />
                        </div>

                        {/* Gastos Notariales */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Gastos Notariales
                            </label>

                            {/* Notaría Propietario */}
                            <div className={`p-3 rounded-xl border transition-all ${data.incluyeGastosNotarialesArrendador ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-slate-700">Propietario</span>
                                    <ToggleSwitch
                                        id="chkNotariaArrendador"
                                        checked={data.incluyeGastosNotarialesArrendador || false}
                                        onChange={(e) => onUpdate('incluyeGastosNotarialesArrendador', e.target.checked)}
                                    />
                                </div>
                                {data.incluyeGastosNotarialesArrendador && (
                                    <div className="animate-in slide-in-from-top-1 duration-200 relative">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">$</span>
                                        <input
                                            type="number"
                                            value={data.montoGastosNotarialesArrendador}
                                            onChange={(e) => onUpdate('montoGastosNotarialesArrendador', e.target.value)}
                                            className="w-full pl-6 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Notaría Arrendatario */}
                            <div className={`p-3 rounded-xl border transition-all ${data.incluyeGastosNotarialesArrendatario ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-slate-700">Arrendatario</span>
                                    <ToggleSwitch
                                        id="chkNotariaArrendatario"
                                        checked={data.incluyeGastosNotarialesArrendatario || false}
                                        onChange={(e) => onUpdate('incluyeGastosNotarialesArrendatario', e.target.checked)}
                                    />
                                </div>
                                {data.incluyeGastosNotarialesArrendatario && (
                                    <div className="animate-in slide-in-from-top-1 duration-200 relative">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">$</span>
                                        <input
                                            type="number"
                                            value={data.montoGastosNotarialesArrendatario}
                                            onChange={(e) => onUpdate('montoGastosNotarialesArrendatario', e.target.value)}
                                            className="w-full pl-6 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Row 4: Otros Costos (Seguro + Admin + Cert) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <SectionLabel icon={FileCheck}>Costos Adicionales</SectionLabel>
                        <div className="space-y-3">

                            {/* Seguro de Restitución */}
                            <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${data.chkSeguro ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <span className="text-sm font-semibold text-slate-800">Seguro de Restitución</span>
                                    </div>
                                </div>
                                <ToggleSwitch
                                    id="chkSeguro"
                                    checked={data.chkSeguro || false}
                                    onChange={(e) => onUpdate('chkSeguro', e.target.checked)}
                                />
                            </div>
                            {data.chkSeguro && (
                                <div className="animate-in slide-in-from-top-2 duration-200 pl-4">
                                    <CurrencyInput
                                        value={data.montoSeguro}
                                        onChange={(e) => onUpdate('montoSeguro', e.target.value)}
                                        placeholder="$ Monto Seguro"
                                    />
                                </div>
                            )}

                            {/* Certificado de Dominio */}
                            <div className="p-4 rounded-xl border border-slate-100 bg-white">
                                <label className="block text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                                    <FileCheck className="w-3 h-3" />
                                    Certificado de Dominio Vigente
                                </label>
                                <CurrencyInput
                                    value={data.costoDominioVigente}
                                    onChange={(e) => onUpdate('costoDominioVigente', e.target.value)}
                                    placeholder="$ 4600"
                                />
                            </div>

                            {/* Con Administración */}
                            <div className={`p-4 rounded-xl border transition-all ${data.conAdministracion ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-indigo-400" />
                                        <span className="text-sm font-semibold text-slate-800">Con Administración</span>
                                    </div>
                                    <ToggleSwitch
                                        id="conAdministracion"
                                        checked={data.conAdministracion || false}
                                        onChange={(e) => onUpdate('conAdministracion', e.target.checked)}
                                    />
                                </div>
                                {data.conAdministracion && (
                                    <div className="animate-in slide-in-from-top-2 duration-200 grid grid-cols-2 gap-3 mt-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1 font-medium">% Comisión</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={data.porcentajeAdministracion}
                                                    onChange={(e) => onUpdate('porcentajeAdministracion', e.target.value)}
                                                    placeholder="7"
                                                    className="w-full px-3 pr-8 py-2 text-sm border border-indigo-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none font-semibold"
                                                />
                                                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1 font-medium">Monto + IVA</label>
                                            <div className="px-3 py-2 bg-white text-indigo-700 text-sm rounded-lg border border-indigo-100 font-bold font-mono">
                                                {formatCurrency(results.totalAdmin)}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Row 5: Honorarios Independientes */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <SectionLabel icon={null}>Honorarios</SectionLabel>
                            {/* UF Badge */}
                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 text-xs font-semibold">
                                <TrendingUp className="w-3 h-3" />
                                <span>UF {ufData.fecha || 'hoy'}: <strong>{formatCurrency(ufData.valor)}</strong></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* PARTE A – PROPIETARIO */}
                            <div className={`bg-white p-5 rounded-2xl border relative overflow-hidden transition-all ${results.feeAlertA ? 'border-red-200 shadow-sm shadow-red-50' : 'border-slate-200 shadow-sm'}`}>
                                {data.ingresoManualA && (
                                    <span className="absolute top-3 right-3 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                        MANUAL
                                    </span>
                                )}
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parte A</p>
                                        <p className="text-base font-bold text-slate-900 mt-0.5">Propietario</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400">Sobrescribir</p>
                                        <div className="mt-1 flex justify-end">
                                            <ToggleSwitch
                                                id="ingresoManualA"
                                                checked={data.ingresoManualA || false}
                                                onChange={(e) => onUpdate('ingresoManualA', e.target.checked)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {data.ingresoManualA ? (
                                    <div className="space-y-2 animate-in fade-in duration-200">
                                        <label className="text-xs text-slate-500 font-medium">Neto sin IVA</label>
                                        <CurrencyInput
                                            value={data.montoManualA}
                                            onChange={(e) => onUpdate('montoManualA', e.target.value)}
                                            placeholder="$ Neto"
                                        />
                                        {results.feeAlertA && (
                                            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                <span><strong>Bajo Mínimo:</strong> Mínimo 6 UF (~{formatCurrency(Math.round(6 * ufData.valor))}). Se notificará.</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <div className="px-3 py-2 bg-slate-50 text-slate-700 text-sm rounded-lg border border-slate-100 flex items-center justify-between">
                                            <span className="text-xs text-slate-400">Neto Calc.</span>
                                            <span className="font-bold font-mono">{formatCurrency(results.honorariosNetoA)}</span>
                                        </div>
                                        {results.minAppliedA && (
                                            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                <CheckCircle className="w-3 h-3" />
                                                <span>Mínimo legal aplicado</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs text-slate-400">Total + IVA</span>
                                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(results.totalComisionA)}</span>
                                </div>
                            </div>

                            {/* PARTE B – ARRENDATARIO */}
                            <div className={`bg-white p-5 rounded-2xl border relative overflow-hidden transition-all ${results.feeAlertB ? 'border-red-200 shadow-sm shadow-red-50' : 'border-slate-200 shadow-sm'}`}>
                                {data.ingresoManualB && (
                                    <span className="absolute top-3 right-3 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                        MANUAL
                                    </span>
                                )}
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parte B</p>
                                        <p className="text-base font-bold text-slate-900 mt-0.5">Arrendatario</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400">Sobrescribir</p>
                                        <div className="mt-1 flex justify-end">
                                            <ToggleSwitch
                                                id="ingresoManualB"
                                                checked={data.ingresoManualB || false}
                                                onChange={(e) => onUpdate('ingresoManualB', e.target.checked)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {data.ingresoManualB ? (
                                    <div className="space-y-2 animate-in fade-in duration-200">
                                        <label className="text-xs text-slate-500 font-medium">Neto sin IVA</label>
                                        <CurrencyInput
                                            value={data.montoManualB}
                                            onChange={(e) => onUpdate('montoManualB', e.target.value)}
                                            placeholder="$ Neto"
                                        />
                                        {results.feeAlertB && (
                                            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                <span><strong>Bajo Mínimo:</strong> Mínimo 6 UF (~{formatCurrency(Math.round(6 * ufData.valor))}). Se notificará.</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <div className="px-3 py-2 bg-slate-50 text-slate-700 text-sm rounded-lg border border-slate-100 flex items-center justify-between">
                                            <span className="text-xs text-slate-400">Neto Calc.</span>
                                            <span className="font-bold font-mono">{formatCurrency(results.honorariosNetoB)}</span>
                                        </div>
                                        {results.minAppliedB && (
                                            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                <CheckCircle className="w-3 h-3" />
                                                <span>Mínimo legal aplicado</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs text-slate-400">Total + IVA</span>
                                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(results.totalComisionB)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 6: Condiciones Especiales */}
                    <div className={`p-5 rounded-2xl border transition-all ${data.chkCondicionesEspeciales ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className={`w-4 h-4 ${data.chkCondicionesEspeciales ? 'text-amber-500' : 'text-slate-400'}`} />
                                <span className={`text-sm font-semibold ${data.chkCondicionesEspeciales ? 'text-amber-900' : 'text-slate-800'}`}>
                                    Condiciones Especiales
                                </span>
                            </div>
                            <ToggleSwitch
                                id="chkCondicionesEspeciales"
                                checked={data.chkCondicionesEspeciales || false}
                                onChange={(e) => onUpdate('chkCondicionesEspeciales', e.target.checked)}
                            />
                        </div>

                        {data.chkCondicionesEspeciales && (
                            <div className="animate-in slide-in-from-top-2 duration-200 mt-4">
                                <label className="block text-xs text-amber-700 font-medium mb-2">
                                    Detalle (ej. primeros meses diferidos, gastos extra)
                                </label>
                                <textarea
                                    className="w-full min-h-[80px] px-3 py-2 text-sm border border-amber-200 bg-white rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none placeholder-slate-300 transition-all resize-none"
                                    placeholder="Ingrese aquí las condiciones especiales..."
                                    value={data.condicionesEspeciales || ''}
                                    onChange={(e) => onUpdate('condicionesEspeciales', e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                </div>

                {/* ─── RIGHT COLUMN: Sticky Financial Summary ───────────────── */}
                <div className="lg:col-span-5 self-stretch">
                    <div className="sticky top-28">

                        {/* Main Summary Card */}
                        <div
                            className="rounded-2xl overflow-hidden text-white p-6 relative"
                            style={{
                                background: 'linear-gradient(135deg, #0D1B4B 0%, #1A2E6E 100%)',
                                boxShadow: '0 8px 32px 0 rgba(0, 31, 97, 0.37)'
                            }}
                        >
                            {/* Glassmorphism orb */}
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl pointer-events-none" />

                            <div className="relative z-10">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                        <h3 className="font-bold text-base">Resumen Financiero</h3>
                                    </div>
                                    <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg text-xs font-medium border border-white/10">
                                        <span className="text-emerald-400">UF</span>
                                        <span className="text-white/80">{formatCurrency(ufData.valor)}</span>
                                    </div>
                                </div>

                                {/* Line Items */}
                                <div className="space-y-2.5 mb-6">
                                    <SummaryRow label="Canon Mensual Base" value={formatCurrency(data.canonArriendo || 0)} className="text-white font-semibold" />
                                    <div className="h-px bg-white/10" />

                                    {data.chkProporcional && (
                                        <SummaryRow
                                            label={`Proporcional (${data.diasProporcionales || 0} días)`}
                                            value={formatCurrency(results.montoProporcional)}
                                        />
                                    )}
                                    {data.chkMesAdelantado && (
                                        <SummaryRow label="Mes Adelantado" value={formatCurrency(results.montoMesAdelantado)} />
                                    )}

                                    <SummaryRow label="+ Garantía" value={formatCurrency(data.garantia || 0)} />

                                    {data.incluyeGastosNotarialesArrendador && (
                                        <SummaryRow
                                            label="Notaría (Propietario)"
                                            value={formatCurrency(data.montoGastosNotarialesArrendador || 0)}
                                        />
                                    )}
                                    {data.incluyeGastosNotarialesArrendatario && (
                                        <SummaryRow
                                            label="+ Notaría (Arrendatario)"
                                            value={formatCurrency(data.montoGastosNotarialesArrendatario || 0)}
                                        />
                                    )}
                                    {results.montoSeguro > 0 && (
                                        <SummaryRow label="+ Seguro Restitución" value={formatCurrency(results.montoSeguro)} />
                                    )}

                                    <div className="h-px bg-white/10" />

                                    <SummaryRow label="Hon. Propietario (c/IVA)" value={formatCurrency(results.totalComisionA)} />
                                    <SummaryRow label="Hon. Arrendatario (c/IVA)" value={formatCurrency(results.totalComisionB)} />

                                    {data.conAdministracion && (
                                        <SummaryRow
                                            label={`+ Administración (${data.porcentajeAdministracion}% + IVA)`}
                                            value={formatCurrency(results.totalAdmin)}
                                            className="text-indigo-300"
                                        />
                                    )}
                                </div>

                                {/* Total Arrendatario */}
                                <div className="bg-white text-slate-900 rounded-xl p-4 mb-3 shadow-lg">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                        Total a Pagar — Arrendatario
                                    </span>
                                    <span className="text-2xl font-extrabold font-mono">{formatCurrency(results.totalCancelar)}</span>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                                        Incluye arriendo, garantía, notaría y honorarios.
                                    </p>
                                </div>

                                {/* Total Propietario */}
                                <div
                                    className="rounded-xl p-4 shadow-lg"
                                    style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
                                >
                                    <span className="block text-[10px] font-bold text-emerald-100 uppercase tracking-widest mb-1">
                                        Total a Recibir — Propietario
                                    </span>
                                    <span className="text-2xl font-extrabold font-mono text-white">{formatCurrency(results.totalRecibir)}</span>
                                    <p className="text-[10px] text-emerald-100/70 mt-1 leading-tight">
                                        Neto tras deducir honorarios{data.conAdministracion ? ', admin' : ''} y costos.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-200">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Atrás
                </Button>
                <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!data.canonArriendo}
                    size="lg"
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 shadow-lg shadow-primary/20 transition-all"
                >
                    Continuar
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}
