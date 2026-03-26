import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import {
    Upload, FileSpreadsheet, Check, X, AlertTriangle, Receipt,
    ArrowRight, ArrowLeft, CheckCircle, ChevronDown, ChevronUp,
    Send, User, Mail, DollarSign, Info, Loader2, RotateCcw,
    Eye, MessageSquare, Phone
} from 'lucide-react'
import {
    parsePendingFeesExcel, lookupAgentPhones, formatCLP,
    buildPendingFeeEmailHTML, buildWhatsAppMessage, sendPendingFeeNotifications
} from '../services/pendingFeesService'

const ALLOWED = ['superadministrador', 'tecnico', 'legal', 'comercial', 'administracion']

export default function AdminPendingFees() {
    const { profile } = useAuth()
    const [step, setStep] = useState(1)

    // Step 1
    const [parsedData, setParsedData] = useState(null) // { months, agents }
    const [fileName, setFileName] = useState('')
    const [parsing, setParsing] = useState(false)

    // Step 2
    const [selectedAgents, setSelectedAgents] = useState(new Set())
    const [expandedAgent, setExpandedAgent] = useState(null)
    const [previewAgent, setPreviewAgent] = useState(null)
    const [previewWhatsApp, setPreviewWhatsApp] = useState(null)
    const [phoneMap, setPhoneMap] = useState({})
    const [loading, setLoading] = useState(false)
    const [sendWhatsApp, setSendWhatsApp] = useState(true)

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

    const agents = parsedData?.agents || []
    const months = parsedData?.months || []
    const pendingAgents = agents.filter(a => a.hasPendingFees)

    // ─── Step 1: Upload File ────────────────────────────────────
    const handleFile = async (file) => {
        if (!file) return
        setParsing(true)
        setFileName(file.name)
        try {
            const data = await parsePendingFeesExcel(file)
            setParsedData(data)
            const pending = data.agents.filter(a => a.hasPendingFees).length
            if (data.agents.length === 0) {
                toast.error('El archivo no contiene agentes válidos')
            } else {
                toast.success(`${data.agents.length} agentes leídos — ${pending} con cuotas pendientes`)
            }
        } catch (err) {
            console.error('Parse error:', err)
            toast.error(err.message || 'Error al leer el archivo')
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
        setLoading(true)
        try {
            const phones = await lookupAgentPhones(pendingAgents)
            setPhoneMap(phones)
            setSelectedAgents(new Set(pendingAgents.map((_, i) => i)))
            setStep(2)
            toast.success(`${pendingAgents.length} agentes con deuda — listos para revisión`)
        } catch (err) {
            console.error('Lookup error:', err)
            toast.error('Error al buscar datos de agentes')
        } finally {
            setLoading(false)
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
        if (selectedAgents.size === pendingAgents.length) {
            setSelectedAgents(new Set())
        } else {
            setSelectedAgents(new Set(pendingAgents.map((_, i) => i)))
        }
    }

    const totalSelected = pendingAgents
        .filter((_, i) => selectedAgents.has(i))
        .reduce((sum, a) => sum + a.total, 0)

    const handleSend = async () => {
        const selected = pendingAgents.filter((_, i) => selectedAgents.has(i))
        if (selected.length === 0) {
            toast.error('Selecciona al menos un agente')
            return
        }
        setSending(true)
        try {
            // Build HTML + WhatsApp for each agent
            const agentsPayload = selected.map(agent => {
                const normEmail = agent.email?.toLowerCase().trim()
                const phone = phoneMap[normEmail]?.phone || ''
                return {
                    ...agent,
                    phone,
                    html: buildPendingFeeEmailHTML(agent, months),
                    whatsapp_message: buildWhatsAppMessage(agent, months),
                }
            })

            const result = await sendPendingFeeNotifications(agentsPayload, sendWhatsApp)
            setSendResults({ sent: selected.length, agents: selected, result })
            setStep(3)
            toast.success(`${selected.length} notificaciones enviadas exitosamente`)
        } catch (err) {
            console.error('Send error:', err)
            toast.error(err.message || 'Error al enviar notificaciones')
        } finally {
            setSending(false)
        }
    }

    // ─── Step 3: Reset ──────────────────────────────────────────
    const handleReset = () => {
        setStep(1)
        setParsedData(null)
        setFileName('')
        setSelectedAgents(new Set())
        setExpandedAgent(null)
        setPreviewAgent(null)
        setPreviewWhatsApp(null)
        setSendResults(null)
        setPhoneMap({})
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Receipt className="w-7 h-7 text-red-600" />
                    Cobranza de Cuotas Pendientes
                </h1>
                <p className="text-gray-500 mt-1">
                    Sube el Excel de cuotas pendientes para notificar a los agentes por correo y WhatsApp
                </p>
            </div>

            {/* Progress steps */}
            <div className="flex items-center gap-4 mb-8">
                {[
                    { n: 1, label: 'Subir Excel' },
                    { n: 2, label: 'Revisar Deudas' },
                    { n: 3, label: 'Resultados' },
                ].map(({ n, label }) => (
                    <div key={n} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                            step === n ? 'bg-red-600 text-white shadow-lg shadow-red-200' :
                            step > n ? 'bg-green-500 text-white' :
                            'bg-gray-200 text-gray-500'
                        }`}>
                            {step > n ? <Check className="w-4 h-4" /> : n}
                        </div>
                        <span className={`text-sm font-medium ${step === n ? 'text-red-600' : step > n ? 'text-green-600' : 'text-gray-400'}`}>
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
                        onClick={() => document.getElementById('pending-fees-file-input').click()}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-red-400 hover:bg-red-50/50 transition-all group"
                    >
                        <input
                            id="pending-fees-file-input"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                        {parsing ? (
                            <Loader2 className="w-12 h-12 text-red-500 mx-auto animate-spin" />
                        ) : (
                            <Upload className="w-12 h-12 text-gray-400 mx-auto group-hover:text-red-500 transition-colors" />
                        )}
                        <p className="text-gray-600 mt-4 font-medium">
                            {parsing ? 'Leyendo archivo...' : 'Arrastra el Excel de cuotas pendientes o haz clic para seleccionar'}
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                            Formato: Cobranzas - Mensualidades Oficina (agentes).xlsx
                        </p>
                        {fileName && (
                            <div className="mt-4 inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg">
                                <FileSpreadsheet className="w-4 h-4" />
                                <span className="font-medium">{fileName}</span>
                                <span className="text-red-400">— {agents.length} agentes</span>
                            </div>
                        )}
                    </div>

                    {/* Preview table */}
                    {agents.length > 0 && (
                        <>
                            {/* Stats bar */}
                            <div className="flex items-center gap-4 bg-white rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center gap-2 text-sm">
                                    <Info className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-500">
                                        <strong className="text-red-600">{pendingAgents.length}</strong> agentes con cuotas pendientes de <strong>{agents.length}</strong> total
                                    </span>
                                </div>
                                <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
                                    <DollarSign className="w-4 h-4 text-red-500" />
                                    <span>Total pendiente: <strong className="text-red-600">
                                        {formatCLP(pendingAgents.reduce((s, a) => s + a.total, 0))}
                                    </strong></span>
                                </div>
                            </div>

                            {/* Data table */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto max-h-[450px]">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Correo</th>
                                                {months.map(m => (
                                                    <th key={m} className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{m}</th>
                                                ))}
                                                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase bg-red-50">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {agents.map((agent, i) => (
                                                <tr key={i} className={`hover:bg-gray-50 ${!agent.hasPendingFees ? 'opacity-30' : ''}`}>
                                                    <td className="px-3 py-2 text-gray-400">{agent._row}</td>
                                                    <td className="px-3 py-2 text-gray-800 font-medium">{agent.name}</td>
                                                    <td className="px-3 py-2 text-gray-500 text-xs">{agent.email}</td>
                                                    {months.map(m => {
                                                        const val = agent.months[m] || 0
                                                        return (
                                                            <td key={m} className={`px-3 py-2 text-right ${val > 0 ? 'text-gray-700 font-medium' : 'text-gray-300'}`}>
                                                                {val > 0 ? formatCLP(val) : '0'}
                                                            </td>
                                                        )
                                                    })}
                                                    <td className={`px-3 py-2 text-right font-bold ${
                                                        agent.total > 0 ? 'bg-red-100 text-red-700' : 'text-green-600'
                                                    }`}>
                                                        {agent.total > 0 ? formatCLP(agent.total) : '$0'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Proceed button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={proceedToReview}
                                    disabled={pendingAgents.length === 0 || loading}
                                    className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-200"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Buscando teléfonos...
                                        </>
                                    ) : (
                                        <>
                                            Revisar Notificaciones
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <SummaryCard
                            icon={<User className="w-5 h-5" />}
                            label="Agentes con Deuda"
                            value={pendingAgents.length}
                            color="red"
                        />
                        <SummaryCard
                            icon={<DollarSign className="w-5 h-5" />}
                            label="Total Deuda"
                            value={formatCLP(pendingAgents.reduce((s, a) => s + a.total, 0))}
                            color="red"
                            isLarge
                        />
                        <SummaryCard
                            icon={<Send className="w-5 h-5" />}
                            label="Seleccionados"
                            value={`${selectedAgents.size} / ${pendingAgents.length}`}
                            color="blue"
                        />
                        <SummaryCard
                            icon={<DollarSign className="w-5 h-5" />}
                            label="Monto Seleccionado"
                            value={formatCLP(totalSelected)}
                            color="orange"
                            isLarge
                        />
                    </div>

                    {/* WhatsApp toggle + Select all */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleAll}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                            >
                                {selectedAgents.size === pendingAgents.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                            </button>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sendWhatsApp}
                                onChange={(e) => setSendWhatsApp(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <MessageSquare className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-gray-700 font-medium">Enviar WhatsApp</span>
                        </label>
                    </div>

                    {/* Agent cards */}
                    <div className="space-y-4">
                        {pendingAgents.map((agent, idx) => {
                            const normEmail = agent.email?.toLowerCase().trim()
                            const agentPhone = phoneMap[normEmail]?.phone || ''
                            const activeMonths = months.filter(m => (agent.months[m] || 0) > 0)

                            return (
                                <div
                                    key={idx}
                                    className={`bg-white rounded-xl border-2 transition-all overflow-hidden ${
                                        selectedAgents.has(idx) ? 'border-red-200 shadow-md' : 'border-gray-200 opacity-60'
                                    }`}
                                >
                                    {/* Agent header */}
                                    <div className="flex items-center gap-4 p-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedAgents.has(idx)}
                                            onChange={() => toggleAgent(idx)}
                                            className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="font-semibold text-gray-800">{agent.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="text-sm text-gray-500">{agent.email || 'Sin email'}</span>
                                                </div>
                                                {agentPhone && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Phone className="w-3.5 h-3.5 text-green-500" />
                                                        <span className="text-sm text-gray-500">{agentPhone}</span>
                                                    </div>
                                                )}
                                                {!agentPhone && sendWhatsApp && (
                                                    <div className="flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                        <span className="text-xs text-amber-500">Sin teléfono</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-red-600">{formatCLP(agent.total)}</div>
                                            <div className="text-xs text-gray-400">
                                                {activeMonths.length} mes{activeMonths.length !== 1 ? 'es' : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setPreviewAgent(agent)}
                                                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                                title="Previsualizar correo"
                                            >
                                                <Eye className="w-5 h-5 text-blue-500" />
                                            </button>
                                            {sendWhatsApp && (
                                                <button
                                                    onClick={() => setPreviewWhatsApp(agent)}
                                                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                                                    title="Previsualizar WhatsApp"
                                                >
                                                    <MessageSquare className="w-5 h-5 text-green-500" />
                                                </button>
                                            )}
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
                                    </div>

                                    {/* Expanded detail */}
                                    {expandedAgent === idx && (
                                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                                            <div className="overflow-x-auto">
                                                <table className="text-sm border-collapse">
                                                    <thead>
                                                        <tr>
                                                            {activeMonths.map(m => (
                                                                <th key={m} className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase border-b-2 border-gray-200">{m}</th>
                                                            ))}
                                                            <th className="px-4 py-2 text-center text-xs font-bold text-red-600 uppercase border-b-2 border-red-200 bg-red-50">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            {activeMonths.map(m => (
                                                                <td key={m} className="px-4 py-3 text-center text-gray-700 font-medium">{formatCLP(agent.months[m])}</td>
                                                            ))}
                                                            <td className="px-4 py-3 text-center font-bold text-red-600 bg-red-50">{formatCLP(agent.total)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
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
                            className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-200"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Enviar Notificaciones ({selectedAgents.size} agente{selectedAgents.size !== 1 ? 's' : ''})
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
                            ¡Notificaciones enviadas exitosamente!
                        </h2>
                        <p className="text-green-600">
                            Se enviaron recordatorios de cuotas pendientes a <strong>{sendResults.sent}</strong> agentes
                            {sendWhatsApp && ' (correo + WhatsApp)'}
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
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Deuda Total</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Correo</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">WhatsApp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sendResults.agents.map((agent, i) => {
                                        const normEmail = agent.email?.toLowerCase().trim()
                                        const hasPhone = !!(phoneMap[normEmail]?.phone)
                                        return (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-800">{agent.name}</td>
                                                <td className="px-4 py-3 text-gray-500">{agent.email}</td>
                                                <td className="px-4 py-3 text-right font-bold text-red-600">{formatCLP(agent.total)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                        Enviado
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {sendWhatsApp && hasPhone ? (
                                                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                            Enviado
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                                            {sendWhatsApp ? 'Sin teléfono' : 'Desactivado'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="bg-gray-100">
                                    <tr>
                                        <td className="px-4 py-3 font-bold text-gray-700" colSpan={2}>Total Deuda Notificada</td>
                                        <td className="px-4 py-3 text-right text-lg font-bold text-red-600">
                                            {formatCLP(sendResults.agents.reduce((s, a) => s + a.total, 0))}
                                        </td>
                                        <td colSpan={2} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Reset button */}
                    <div className="flex justify-center pt-4">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Nueva Cobranza
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
                                    Para: <strong>{previewAgent.name}</strong> — {previewAgent.email || 'Sin email'}
                                </p>
                            </div>
                            <button onClick={() => setPreviewAgent(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <iframe
                                srcDoc={buildPendingFeeEmailHTML(previewAgent, months)}
                                className="w-full h-full min-h-[500px] border-0"
                                title="Email preview"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ WhatsApp Preview Modal ═══════ */}
            {previewWhatsApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewWhatsApp(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <div>
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-green-500" />
                                    Previsualización WhatsApp
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Para: <strong>{previewWhatsApp.name}</strong>
                                </p>
                            </div>
                            <button onClick={() => setPreviewWhatsApp(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm p-4 shadow-sm max-w-sm ml-auto">
                                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                                    {buildWhatsAppMessage(previewWhatsApp, months)}
                                </pre>
                                <div className="text-right mt-2">
                                    <span className="text-[10px] text-gray-500">
                                        {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
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
        red: 'bg-red-50 text-red-600 border-red-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        green: 'bg-green-50 text-green-600 border-green-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200',
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
