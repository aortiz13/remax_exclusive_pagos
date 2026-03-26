import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import {
    Upload, FileSpreadsheet, Check, X, AlertTriangle, CreditCard,
    ArrowRight, ArrowLeft, CheckCircle, XCircle, ChevronDown, ChevronUp,
    Send, User, Mail, DollarSign, Building, Info, Loader2, RotateCcw,
    Link2, ExternalLink, Eye
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
    parseCommissionExcel, processCommissions, detectMonth,
    getSkippedSummary, sendCommissionEmails, formatCLP,
    matchCommissionProperties, matchAgentEmails, buildCommissionEmailHTML
} from '../services/commissionService'

const ALLOWED = ['superadministrador', 'tecnico', 'legal', 'comercial', 'administracion']

export default function AdminCommissionPayment() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [step, setStep] = useState(1)

    // Step 1
    const [rows, setRows] = useState([])
    const [fileName, setFileName] = useState('')
    const [parsing, setParsing] = useState(false)
    const [month, setMonth] = useState('')

    // Step 2
    const [agentSummaries, setAgentSummaries] = useState([])
    const [skipped, setSkipped] = useState({})
    const [selectedAgents, setSelectedAgents] = useState(new Set())
    const [expandedAgent, setExpandedAgent] = useState(null)
    const [matching, setMatching] = useState(false)
    const [matchStats, setMatchStats] = useState({ matched: 0, unmatched: 0 })

    // Preview
    const [previewAgent, setPreviewAgent] = useState(null)

    // Step 3
    const [sending, setSending] = useState(false)
    const [sendResults, setSendResults] = useState(null)

    if (!ALLOWED.includes(profile?.role)) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">No tienes permisos para acceder a esta página.</p>
            </div>
        )
    }

    // ─── Step 1: Upload File ────────────────────────────────────
    const handleFile = async (file) => {
        if (!file) return
        setParsing(true)
        setFileName(file.name)
        try {
            const parsed = await parseCommissionExcel(file)
            setRows(parsed)
            const autoMonth = detectMonth(parsed)
            setMonth(autoMonth)
            if (parsed.length === 0) {
                toast.error('El archivo no contiene filas válidas')
            } else {
                toast.success(`${parsed.length} filas leídas`)
            }
        } catch (err) {
            console.error('Parse error:', err)
            toast.error('Error al leer el archivo')
        } finally {
            setParsing(false)
        }
    }

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        const file = e.dataTransfer?.files?.[0]
        if (file) handleFile(file)
    }, [])

    const proceedToReview = async () => {
        setMatching(true)
        try {
            // Match Excel addresses against DB properties + resolve agent emails
            const [propertyMatches, agentEmails] = await Promise.all([
                matchCommissionProperties(rows),
                matchAgentEmails(rows),
            ])
            const summaries = processCommissions(rows, propertyMatches, agentEmails)
            const skipSummary = getSkippedSummary(rows)

            // Count match stats
            let matched = 0, unmatched = 0
            for (const agent of summaries) {
                for (const prop of agent.properties) {
                    if (prop.matched) matched++
                    else unmatched++
                }
            }
            setMatchStats({ matched, unmatched })
            setAgentSummaries(summaries)
            setSkipped(skipSummary)
            setSelectedAgents(new Set(summaries.map((_, i) => i)))
            setStep(2)
            toast.success(`${summaries.length} agentes — ${matched} propiedades encontradas en el sistema`)
        } catch (err) {
            console.error('Match error:', err)
            toast.error('Error al procesar comisiones')
        } finally {
            setMatching(false)
        }
    }

    // ─── Step 2: Review ─────────────────────────────────────────
    const toggleAgent = (idx) => {
        setSelectedAgents(prev => {
            const next = new Set(prev)
            next.has(idx) ? next.delete(idx) : next.add(idx)
            return next
        })
    }

    const toggleAll = () => {
        if (selectedAgents.size === agentSummaries.length) {
            setSelectedAgents(new Set())
        } else {
            setSelectedAgents(new Set(agentSummaries.map((_, i) => i)))
        }
    }

    const totalSelected = agentSummaries
        .filter((_, i) => selectedAgents.has(i))
        .reduce((sum, a) => sum + a.total, 0)

    const handleSend = async () => {
        const selected = agentSummaries.filter((_, i) => selectedAgents.has(i))
        if (selected.length === 0) {
            toast.error('Selecciona al menos un agente')
            return
        }
        setSending(true)
        try {
            const result = await sendCommissionEmails(selected, month)
            setSendResults({ sent: selected.length, agents: selected, result })
            setStep(3)
            toast.success(`${selected.length} correos enviados exitosamente`)
        } catch (err) {
            console.error('Send error:', err)
            toast.error(err.message || 'Error al enviar correos')
        } finally {
            setSending(false)
        }
    }

    // ─── Step 3: Reset ──────────────────────────────────────────
    const handleReset = () => {
        setStep(1)
        setRows([])
        setFileName('')
        setMonth('')
        setAgentSummaries([])
        setSkipped({})
        setSelectedAgents(new Set())
        setExpandedAgent(null)
        setSendResults(null)
    }

    // Valid states helper (mirrors service)
    const isValid = (e) => ['LIQUIDADO', 'LIQUIDADO MANUAL'].includes(e)
    const isProcessable = (row) => isValid(row.estado) && row.comision_admin > 0
    const liquidadoCount = rows.filter(r => isProcessable(r)).length

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <CreditCard className="w-7 h-7 text-blue-600" />
                    Liquidación de Comisiones
                </h1>
                <p className="text-gray-500 mt-1">
                    Sube el Excel de administración para calcular y enviar comisiones por agente
                </p>
            </div>

            {/* Progress steps */}
            <div className="flex items-center gap-4 mb-8">
                {[
                    { n: 1, label: 'Subir Excel' },
                    { n: 2, label: 'Revisar Comisiones' },
                    { n: 3, label: 'Resultados' },
                ].map(({ n, label }) => (
                    <div key={n} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                            step === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                            step > n ? 'bg-green-500 text-white' :
                            'bg-gray-200 text-gray-500'
                        }`}>
                            {step > n ? <Check className="w-4 h-4" /> : n}
                        </div>
                        <span className={`text-sm font-medium ${step === n ? 'text-blue-600' : step > n ? 'text-green-600' : 'text-gray-400'}`}>
                            {label}
                        </span>
                        {n < 3 && <ArrowRight className="w-4 h-4 text-gray-300 ml-2" />}
                    </div>
                ))}
            </div>

            {/* ═══════ STEP 1: Upload ═══════ */}
            {step === 1 && (
                <div className="space-y-6">
                    {/* Drag & Drop */}
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => document.getElementById('commission-file-input').click()}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                    >
                        <input
                            id="commission-file-input"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                        {parsing ? (
                            <Loader2 className="w-12 h-12 text-blue-500 mx-auto animate-spin" />
                        ) : (
                            <Upload className="w-12 h-12 text-gray-400 mx-auto group-hover:text-blue-500 transition-colors" />
                        )}
                        <p className="text-gray-600 mt-4 font-medium">
                            {parsing ? 'Leyendo archivo...' : 'Arrastra el Excel de administración o haz clic para seleccionar'}
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                            Formatos: .xlsx, .xls, .csv
                        </p>
                        {fileName && (
                            <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">
                                <FileSpreadsheet className="w-4 h-4" />
                                <span className="font-medium">{fileName}</span>
                                <span className="text-blue-400">— {rows.length} filas</span>
                            </div>
                        )}
                    </div>

                    {/* Preview table */}
                    {rows.length > 0 && (
                        <>
                            {/* Month selector */}
                            <div className="flex items-center gap-4 bg-white rounded-xl p-4 border border-gray-200">
                                <label className="text-sm font-medium text-gray-600">Mes de liquidación:</label>
                                <input
                                    type="text"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    placeholder="Marzo 2026"
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                                />
                                <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto">
                                    <Info className="w-4 h-4" />
                                    <span>{liquidadoCount} filas válidas de {rows.length} total</span>
                                </div>
                            </div>

                            {/* Data table */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto max-h-96">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fila</th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dirección</th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Comisión Admin</th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Agente</th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">%</th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {rows.slice(0, 100).map((row, i) => (
                                                <tr key={i} className={`hover:bg-gray-50 ${!isProcessable(row) ? 'opacity-40' : ''}`}>
                                                    <td className="px-3 py-2 text-gray-400">{row._row}</td>
                                                    <td className="px-3 py-2 text-gray-800 font-medium max-w-xs truncate">{row.direccion}</td>
                                                    <td className={`px-3 py-2 ${row.comision_admin < 0 ? 'text-red-500 font-semibold' : 'text-gray-700'}`}>{formatCLP(row.comision_admin)}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                            isValid(row.estado) ? 'bg-green-100 text-green-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {row.estado || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-700">{row.agent_name || '—'}</td>
                                                    <td className="px-3 py-2 text-gray-600">{row.percentage > 0 ? `${row.percentage}%` : '—'}</td>
                                                    <td className="px-3 py-2 text-gray-500 text-xs">{row.correo_agente || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {rows.length > 100 && (
                                    <div className="p-3 bg-gray-50 text-center text-xs text-gray-500">
                                        Mostrando 100 de {rows.length} filas
                                    </div>
                                )}
                            </div>

                            {/* Proceed button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={proceedToReview}
                                    disabled={liquidadoCount === 0 || !month || matching}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
                                >
                                    {matching ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Buscando propiedades...
                                        </>
                                    ) : (
                                        <>
                                            Procesar Comisiones
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ═══════ STEP 2: Review ═══════ */}
            {step === 2 && (
                <div className="space-y-6">
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <SummaryCard
                            icon={<User className="w-5 h-5" />}
                            label="Agentes"
                            value={agentSummaries.length}
                            color="blue"
                        />
                        <SummaryCard
                            icon={<Building className="w-5 h-5" />}
                            label="Propiedades"
                            value={agentSummaries.reduce((s, a) => s + a.properties.length, 0)}
                            color="purple"
                        />
                        <SummaryCard
                            icon={<Link2 className="w-5 h-5" />}
                            label="Encontradas en CRM"
                            value={`${matchStats.matched} / ${matchStats.matched + matchStats.unmatched}`}
                            color="teal"
                        />
                        <SummaryCard
                            icon={<DollarSign className="w-5 h-5" />}
                            label="Total a Pagar"
                            value={formatCLP(agentSummaries.reduce((s, a) => s + a.total, 0))}
                            color="green"
                            isLarge
                        />
                        <SummaryCard
                            icon={<Send className="w-5 h-5" />}
                            label="Seleccionados"
                            value={`${selectedAgents.size} / ${agentSummaries.length}`}
                            color="orange"
                        />
                    </div>

                    {/* Skipped rows info */}
                    {(skipped.noAgent?.length > 0 || skipped.otherStatus?.length > 0) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                Filas no procesadas
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-amber-600">
                                {skipped.noAgent?.length > 0 && (
                                    <span>{skipped.noAgent.length} sin agente/porcentaje</span>
                                )}
                                {skipped.otherStatus?.length > 0 && (
                                    <span>{skipped.otherStatus.length} otros estados (no liquidados)</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Select all */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={toggleAll}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            {selectedAgents.size === agentSummaries.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        </button>
                        <span className="text-sm text-gray-500">
                            Total seleccionado: <strong className="text-green-600">{formatCLP(totalSelected)}</strong>
                        </span>
                    </div>

                    {/* Agent cards */}
                    <div className="space-y-4">
                        {agentSummaries.map((agent, idx) => (
                            <div
                                key={idx}
                                className={`bg-white rounded-xl border-2 transition-all overflow-hidden ${
                                    selectedAgents.has(idx) ? 'border-blue-200 shadow-md' : 'border-gray-200 opacity-60'
                                }`}
                            >
                                {/* Agent header */}
                                <div className="flex items-center gap-4 p-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedAgents.has(idx)}
                                        onChange={() => toggleAgent(idx)}
                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span className="font-semibold text-gray-800">{agent.agentName}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="text-sm text-gray-500">{agent.email}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-green-600">{formatCLP(agent.total)}</div>
                                        <div className="text-xs text-gray-400">{agent.properties.length} propiedad{agent.properties.length !== 1 ? 'es' : ''}</div>
                                    </div>
                                    <button
                                        onClick={() => setPreviewAgent(agent)}
                                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                        title="Previsualizar correo"
                                    >
                                        <Eye className="w-5 h-5 text-blue-500" />
                                    </button>
                                    <button
                                        onClick={() => setExpandedAgent(expandedAgent === idx ? null : idx)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        {expandedAgent === idx ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>
                                </div>

                                {/* Expanded detail table */}
                                {expandedAgent === idx && (
                                    <div className="border-t border-gray-100 bg-gray-50">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Propiedad</th>
                                                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Match CRM</th>
                                                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Monto Arriendo</th>
                                                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Comisión Admin</th>
                                                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Suscripción Leasity</th>
                                                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Base</th>
                                                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">% Agente</th>
                                                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Comisión</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {agent.properties.map((prop, pi) => (
                                                        <tr key={pi} className="hover:bg-white">
                                                            <td className="px-4 py-2.5 text-gray-700 max-w-xs">
                                                                <div className="truncate">{prop.direccion}</div>
                                                                {prop.matched && prop.propertyAddress && prop.propertyAddress !== prop.direccion && (
                                                                    <div className="text-xs text-gray-400 truncate mt-0.5">
                                                                        DB: {prop.propertyAddress}{prop.propertyUnit ? `, ${prop.propertyUnit}` : ''}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                {prop.matched ? (
                                                                    <button
                                                                        onClick={() => window.open(`/crm/property/${prop.propertyId}`, '_blank')}
                                                                        className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold hover:bg-green-200 transition-colors"
                                                                        title={`Confianza: ${prop.matchConfidence}%`}
                                                                    >
                                                                        <CheckCircle className="w-3 h-3" />
                                                                        Sí
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </button>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">
                                                                        <XCircle className="w-3 h-3" />
                                                                        No
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-gray-600">{formatCLP(prop.monto_arriendo)}</td>
                                                            <td className="px-4 py-2.5 text-right text-gray-600">{formatCLP(prop.comision_admin)}</td>
                                                            <td className="px-4 py-2.5 text-right text-orange-500">{formatCLP(prop.suscripcion_leasity)}</td>
                                                            <td className="px-4 py-2.5 text-right text-gray-700 font-medium">{formatCLP(prop.base)}</td>
                                                            <td className="px-4 py-2.5 text-right text-blue-600 font-medium">{prop.porcentaje}%</td>
                                                            <td className="px-4 py-2.5 text-right text-green-600 font-bold">{formatCLP(prop.comision)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-100">
                                                    <tr>
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-700" colSpan={7}>
                                                            Total a pagar
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-lg font-bold text-green-600">
                                                            {formatCLP(agent.total)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-between items-center pt-4">
                        <button
                            onClick={() => setStep(1)}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Volver
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={sending || selectedAgents.size === 0}
                            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-200"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Enviar Correos ({selectedAgents.size} agente{selectedAgents.size !== 1 ? 's' : ''})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══════ STEP 3: Results ═══════ */}
            {step === 3 && sendResults && (
                <div className="space-y-6">
                    {/* Success banner */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-green-800 mb-2">
                            ¡Correos enviados exitosamente!
                        </h2>
                        <p className="text-green-600">
                            Se enviaron {sendResults.sent} correos de liquidación de comisiones para el mes de <strong>{month}</strong>
                        </p>
                    </div>

                    {/* Summary table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-700">Detalle de envíos</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Agente</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Propiedades</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sendResults.agents.map((agent, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-800">{agent.agentName}</td>
                                            <td className="px-4 py-3 text-gray-500">{agent.email}</td>
                                            <td className="px-4 py-3 text-right text-gray-600">{agent.properties.length}</td>
                                            <td className="px-4 py-3 text-right font-bold text-green-600">{formatCLP(agent.total)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Enviado
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100">
                                    <tr>
                                        <td className="px-4 py-3 font-bold text-gray-700" colSpan={3}>Total General</td>
                                        <td className="px-4 py-3 text-right text-lg font-bold text-green-600">
                                            {formatCLP(sendResults.agents.reduce((s, a) => s + a.total, 0))}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Reset button */}
                    <div className="flex justify-center pt-4">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Nueva Liquidación
                        </button>
                    </div>
                </div>
            )}
            {/* ═══════ Email Preview Modal ═══════ */}
            {previewAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewAgent(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <div>
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-blue-500" />
                                    Previsualización del correo
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Para: <strong>{previewAgent.agentName}</strong> — {previewAgent.email || 'Sin email'}
                                </p>
                            </div>
                            <button onClick={() => setPreviewAgent(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <iframe
                                srcDoc={buildCommissionEmailHTML(previewAgent, month)}
                                className="w-full h-full min-h-[500px] border-0"
                                title="Email preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Helper: Summary Card ──────────────────────────────────────
function SummaryCard({ icon, label, value, color, isLarge }) {
    const colorMap = {
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        green: 'bg-green-50 text-green-600 border-green-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200',
        teal: 'bg-teal-50 text-teal-600 border-teal-200',
    }
    return (
        <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
            <div className="flex items-center gap-2 text-sm font-medium opacity-80">
                {icon}
                {label}
            </div>
            <div className={`mt-1 font-bold ${isLarge ? 'text-xl' : 'text-2xl'}`}>
                {value}
            </div>
        </div>
    )
}
