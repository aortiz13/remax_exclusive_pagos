import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import {
    Upload, FileSpreadsheet, Check, X, AlertTriangle, Building2,
    ArrowRight, ArrowLeft, CheckCircle, XCircle, ChevronDown,
    Search, User, MapPin, Calendar, RefreshCw, Info, ExternalLink, SkipForward,
    ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'
import { parseExcelFile, matchProperties, matchAgents, applyImport } from '../services/adminImportService'
import { generateInspectionSchedule } from '../services/inspectionService'

const ALLOWED = ['superadministrador', 'tecnico', 'legal', 'comercial', 'administracion']

export default function AdminAdministradaImport() {
    const { profile } = useAuth()
    const [step, setStep] = useState(1) // 1=upload, 2=review, 3=results

    // Step 1
    const [rows, setRows] = useState([])
    const [fileName, setFileName] = useState('')
    const [parsing, setParsing] = useState(false)

    // Step 2
    const [matched, setMatched] = useState([])
    const [unmatched, setUnmatched] = useState([])
    const [agentMap, setAgentMap] = useState({})
    const [matching, setMatching] = useState(false)
    const [selectedMatched, setSelectedMatched] = useState(new Set())
    const [selectedUnmatched, setSelectedUnmatched] = useState(new Set())
    const [alreadyImported, setAlreadyImported] = useState([])
    const [sortOrder, setSortOrder] = useState('desc') // 'desc' = highest first

    // Step 3
    const [results, setResults] = useState(null)
    const [applying, setApplying] = useState(false)

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
            const parsed = await parseExcelFile(file)
            setRows(parsed)
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
            const [matchResult, agents] = await Promise.all([
                matchProperties(rows),
                matchAgents(rows),
            ])
            setMatched(matchResult.matched)
            setUnmatched(matchResult.unmatched)
            setAlreadyImported(matchResult.alreadyImported || [])
            setAgentMap(agents)
            setSelectedMatched(new Set(matchResult.matched.map((_, i) => i)))
            setSelectedUnmatched(new Set(matchResult.unmatched.map((_, i) => i)))
            setStep(2)
            const parts = [`${matchResult.matched.length} coincidencias`, `${matchResult.unmatched.length} nuevas`]
            if (matchResult.alreadyImported?.length) parts.push(`${matchResult.alreadyImported.length} ya importadas`)
            toast.success(parts.join(', '))
        } catch (err) {
            console.error('Match error:', err)
            toast.error('Error al buscar coincidencias')
        } finally {
            setMatching(false)
        }
    }

    // ─── Step 2: Review Matches ─────────────────────────────────
    const handleApply = async () => {
        setApplying(true)
        try {
            const selMatched = matched.filter((_, i) => selectedMatched.has(i))
            const selUnmatched = unmatched.filter((_, i) => selectedUnmatched.has(i))
            const res = await applyImport(selMatched, selUnmatched, agentMap)

            // Auto-generate inspection schedules for all updated/created properties
            let schedulesGenerated = 0
            for (const m of selMatched) {
                if (m.excelRow.fecha_inicio) {
                    try {
                        const r = await generateInspectionSchedule(m.property.id)
                        schedulesGenerated += r.created || 0
                    } catch (_) { }
                }
            }
            for (const cp of res.createdProperties) {
                try {
                    const r = await generateInspectionSchedule(cp.id)
                    schedulesGenerated += r.created || 0
                } catch (_) { }
            }
            res.schedulesGenerated = schedulesGenerated

            setResults(res)
            setStep(3)
            if (res.errors.length > 0) {
                toast.error(`Completado con ${res.errors.length} errores`)
            } else {
                toast.success('Importación completada')
            }
        } catch (err) {
            console.error('Apply error:', err)
            toast.error('Error al aplicar importación')
        } finally {
            setApplying(false)
        }
    }

    const toggleMatched = (i) => {
        setSelectedMatched(prev => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
        })
    }
    const toggleUnmatched = (i) => {
        setSelectedUnmatched(prev => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
        })
    }

    // ─── Render ─────────────────────────────────────────────────
    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Importar Propiedades Administradas</h1>
                    <p className="text-sm text-slate-500">Suba el Excel de administración para sincronizar contratos e inspecciones</p>
                </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
                {[
                    { n: 1, label: 'Subir Archivo' },
                    { n: 2, label: 'Revisar Coincidencias' },
                    { n: 3, label: 'Resultados' },
                ].map(({ n, label }) => (
                    <div key={n} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === n ? 'bg-[#003DA5] text-white' :
                            step > n ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                            {step > n ? <Check className="w-4 h-4" /> : n}
                        </div>
                        <span className={`text-sm font-medium ${step === n ? 'text-slate-900' : 'text-gray-400'}`}>{label}</span>
                        {n < 3 && <ArrowRight className="w-4 h-4 text-gray-300 mx-2" />}
                    </div>
                ))}
            </div>

            {/* ═══ Step 1: Upload ═══ */}
            {step === 1 && (
                <div className="space-y-4">
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-[#003DA5] hover:bg-blue-50/30 transition-colors cursor-pointer"
                        onClick={() => document.getElementById('excel-input')?.click()}
                    >
                        <input
                            id="excel-input"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-gray-700">
                            {parsing ? 'Leyendo archivo...' : 'Arrastre o haga clic para subir'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">Formatos: .xlsx, .xls, .csv</p>
                    </div>

                    {fileName && rows.length > 0 && (
                        <>
                            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                        <span className="text-sm font-semibold text-gray-700">{fileName}</span>
                                        <span className="text-xs text-gray-400">({rows.length} filas)</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto max-h-[400px]">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-gray-50 z-10">
                                            <tr>
                                                <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">#</th>
                                                <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Dirección</th>
                                                <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Comuna</th>
                                                <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Inicio</th>
                                                <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Término</th>
                                                <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Agente</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((r, i) => (
                                                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                                                    <td className="py-2 px-3 text-gray-400">{r._row}</td>
                                                    <td className="py-2 px-3 text-gray-800 font-medium max-w-[250px] truncate">{r.direccion}</td>
                                                    <td className="py-2 px-3 text-gray-600">{r.comuna}</td>
                                                    <td className="py-2 px-3 text-gray-600">{r.fecha_inicio || <span className="text-red-400">—</span>}</td>
                                                    <td className="py-2 px-3 text-gray-600">{r.fecha_fin || <span className="text-red-400">—</span>}</td>
                                                    <td className="py-2 px-3">
                                                        {r.agente.toLowerCase() === 'oficina' ? (
                                                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                                                                <Building2 className="w-3 h-3" /> Oficina
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-700">{r.agente}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={proceedToReview}
                                    disabled={matching}
                                    className="px-6 py-2.5 bg-[#003DA5] text-white rounded-xl text-sm font-bold hover:bg-[#002d7a] transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {matching ? (
                                        <><RefreshCw className="w-4 h-4 animate-spin" /> Buscando coincidencias...</>
                                    ) : (
                                        <><Search className="w-4 h-4" /> Buscar Coincidencias</>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ═══ Step 2: Review ═══ */}
            {step === 2 && (
                <div className="space-y-4">
                    {/* Summary chips */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                            <CheckCircle className="w-4 h-4" /> {matched.length} coincidencias
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                            <AlertTriangle className="w-4 h-4" /> {unmatched.length} nuevas
                        </span>
                        {Object.values(agentMap).filter(a => a?.isOffice).length > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                                <Building2 className="w-4 h-4" /> {rows.filter(r => r.agente.toLowerCase() === 'oficina').length} oficina
                            </span>
                        )}
                        {alreadyImported.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full text-sm font-semibold">
                                <SkipForward className="w-4 h-4" /> {alreadyImported.length} ya importadas
                            </span>
                        )}
                    </div>

                    {/* Matched properties */}
                    {matched.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b bg-emerald-50 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <span className="text-sm font-bold text-emerald-800">Coincidencias encontradas — Se actualizarán fechas de contrato</span>
                            </div>
                            <div className="overflow-x-auto max-h-[350px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-50 z-10">
                                        <tr>
                                            <th className="py-2 px-3 w-8">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMatched.size === matched.length}
                                                    onChange={() => {
                                                        if (selectedMatched.size === matched.length) setSelectedMatched(new Set())
                                                        else setSelectedMatched(new Set(matched.map((_, i) => i)))
                                                    }}
                                                    className="rounded"
                                                />
                                            </th>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Excel</th>
                                            <th className="text-center py-2 px-3 text-xs font-bold text-gray-500">
                                                <button
                                                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                                    className="inline-flex items-center gap-1 hover:text-[#003DA5] transition-colors"
                                                    title={sortOrder === 'desc' ? 'Ordenar: menor a mayor' : 'Ordenar: mayor a menor'}
                                                >
                                                    Match
                                                    {sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                                                </button>
                                            </th>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Propiedad en CRM</th>
                                            <th className="text-center py-2 px-3 text-xs font-bold text-gray-500">Fechas</th>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Agente</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...matched]
                                            .map((m, i) => ({ ...m, _origIdx: i }))
                                            .sort((a, b) => sortOrder === 'desc' ? b.confidence - a.confidence : a.confidence - b.confidence)
                                            .map((m) => {
                                                const i = m._origIdx
                                                const agent = agentMap[m.excelRow.agente]
                                                return (
                                                    <tr key={i} className={`border-t border-gray-100 ${selectedMatched.has(i) ? 'bg-emerald-50/30' : 'opacity-50'}`}>
                                                        <td className="py-2 px-3">
                                                            <input type="checkbox" checked={selectedMatched.has(i)} onChange={() => toggleMatched(i)} className="rounded" />
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="text-gray-800 font-medium max-w-[200px] truncate">{m.excelRow.direccion}</div>
                                                            <div className="text-xs text-gray-400">{m.excelRow.comuna}</div>
                                                        </td>
                                                        <td className="py-2 px-3 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${m.confidence >= 70 ? 'bg-emerald-100 text-emerald-700' :
                                                                m.confidence >= 50 ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-red-100 text-red-700'
                                                                }`}>
                                                                {m.confidence}%
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <a
                                                                href={`/crm/property/${m.property.id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="group/link block hover:bg-blue-50 rounded-lg p-1 -m-1 transition-colors"
                                                                title="Abrir propiedad en nueva pestaña"
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-gray-700 max-w-[180px] truncate text-xs group-hover/link:text-[#003DA5] group-hover/link:underline">{m.property.address}</span>
                                                                    <ExternalLink className="w-3 h-3 text-gray-300 group-hover/link:text-[#003DA5] shrink-0" />
                                                                </div>
                                                                <div className="text-xs text-gray-400">{m.property.commune} {m.property.unit_number && `· ${m.property.unit_number}`}</div>
                                                            </a>
                                                        </td>
                                                        <td className="py-2 px-3 text-center">
                                                            <div className="text-xs text-gray-600">{m.excelRow.fecha_inicio || '—'}</div>
                                                            <div className="text-xs text-gray-400">{m.excelRow.fecha_fin || '—'}</div>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            {agent?.isOffice ? (
                                                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">🏢 Oficina</span>
                                                            ) : agent ? (
                                                                <span className="text-xs text-gray-700">{agent.first_name} {agent.last_name}</span>
                                                            ) : (
                                                                <span className="text-xs text-red-500">⚠️ {m.excelRow.agente}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Unmatched — will be created */}
                    {unmatched.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b bg-amber-50 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                                <span className="text-sm font-bold text-amber-800">Sin coincidencia — Se crearán como nuevas propiedades</span>
                            </div>
                            <div className="overflow-x-auto max-h-[300px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-50 z-10">
                                        <tr>
                                            <th className="py-2 px-3 w-8">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUnmatched.size === unmatched.length}
                                                    onChange={() => {
                                                        if (selectedUnmatched.size === unmatched.length) setSelectedUnmatched(new Set())
                                                        else setSelectedUnmatched(new Set(unmatched.map((_, i) => i)))
                                                    }}
                                                    className="rounded"
                                                />
                                            </th>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Dirección</th>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Comuna</th>
                                            <th className="text-center py-2 px-3 text-xs font-bold text-gray-500">Fechas</th>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Agente</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unmatched.map((row, i) => {
                                            const agent = agentMap[row.agente]
                                            return (
                                                <tr key={i} className={`border-t border-gray-100 ${selectedUnmatched.has(i) ? 'bg-amber-50/30' : 'opacity-50'}`}>
                                                    <td className="py-2 px-3">
                                                        <input type="checkbox" checked={selectedUnmatched.has(i)} onChange={() => toggleUnmatched(i)} className="rounded" />
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-800 font-medium max-w-[250px] truncate">{row.direccion}</td>
                                                    <td className="py-2 px-3 text-gray-600">{row.comuna}</td>
                                                    <td className="py-2 px-3 text-center">
                                                        <div className="text-xs text-gray-600">{row.fecha_inicio || '—'}</div>
                                                        <div className="text-xs text-gray-400">{row.fecha_fin || '—'}</div>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        {agent?.isOffice ? (
                                                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">🏢 Oficina</span>
                                                        ) : agent ? (
                                                            <span className="text-xs text-gray-700">{agent.first_name} {agent.last_name}</span>
                                                        ) : (
                                                            <span className="text-xs text-red-500">⚠️ {row.agente}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* No agent match warning */}
                    {Object.entries(agentMap).filter(([_, v]) => v === null).length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                            <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-700">Agentes no encontrados:</p>
                                <p className="text-xs text-red-600 mt-1">
                                    {Object.entries(agentMap).filter(([_, v]) => v === null).map(([name]) => name).join(', ')}
                                </p>
                                <p className="text-xs text-red-500 mt-1">Estas propiedades se importarán sin agente asignado.</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={() => setStep(1)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                                {selectedMatched.size + selectedUnmatched.size} de {matched.length + unmatched.length} seleccionadas
                            </span>
                            <button
                                onClick={handleApply}
                                disabled={applying || (selectedMatched.size + selectedUnmatched.size === 0)}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {applying ? (
                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Aplicando...</>
                                ) : (
                                    <><Check className="w-4 h-4" /> Aplicar Importación</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Info about deselected rows */}
                    {(matched.length + unmatched.length - selectedMatched.size - selectedUnmatched.size) > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-700">
                                Las filas <strong>deseleccionadas</strong> no serán procesadas ahora. Si vuelve a importar el mismo Excel, estas filas aparecerán nuevamente para su revisión.
                            </p>
                        </div>
                    )}

                    {/* Already imported */}
                    {alreadyImported.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden opacity-60">
                            <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
                                <SkipForward className="w-5 h-5 text-gray-400" />
                                <span className="text-sm font-bold text-gray-500">Ya importadas previamente — No se procesarán</span>
                            </div>
                            <div className="overflow-x-auto max-h-[200px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-50 z-10">
                                        <tr>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-400">Dirección</th>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-400">Comuna</th>
                                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-400">Agente</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alreadyImported.map((row, i) => (
                                            <tr key={i} className="border-t border-gray-100">
                                                <td className="py-2 px-3 text-gray-400 text-xs">{row.direccion}</td>
                                                <td className="py-2 px-3 text-gray-400 text-xs">{row.comuna}</td>
                                                <td className="py-2 px-3 text-gray-400 text-xs">{row.agente}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Step 3: Results ═══ */}
            {step === 3 && results && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Importación Completada</h2>

                        <div className="flex items-center justify-center gap-6 mt-6">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-[#003DA5]">{results.updated}</div>
                                <div className="text-sm text-gray-500">Actualizadas</div>
                            </div>
                            <div className="w-px h-12 bg-gray-200" />
                            <div className="text-center">
                                <div className="text-3xl font-bold text-emerald-600">{results.created}</div>
                                <div className="text-sm text-gray-500">Creadas</div>
                            </div>
                            <div className="w-px h-12 bg-gray-200" />
                            <div className="text-center">
                                <div className="text-3xl font-bold text-purple-600">{results.officeCount}</div>
                                <div className="text-sm text-gray-500">Oficina</div>
                            </div>
                            <div className="w-px h-12 bg-gray-200" />
                            <div className="text-center">
                                <div className="text-3xl font-bold text-teal-600">{results.schedulesGenerated || 0}</div>
                                <div className="text-sm text-gray-500">Inspecciones Programadas</div>
                            </div>
                        </div>
                    </div>

                    {results.createdProperties.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b bg-blue-50 flex items-center gap-2">
                                <Info className="w-5 h-5 text-blue-600" />
                                <span className="text-sm font-bold text-blue-800">Propiedades creadas (no estaban en el CRM)</span>
                            </div>
                            <div className="overflow-x-auto max-h-[300px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-50">
                                        <tr>
                                            <th className="text-left py-2 px-4 text-xs font-bold text-gray-500">Dirección</th>
                                            <th className="text-left py-2 px-4 text-xs font-bold text-gray-500">Comuna</th>
                                            <th className="text-left py-2 px-4 text-xs font-bold text-gray-500">Agente</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.createdProperties.map((p, i) => (
                                            <tr key={i} className="border-t border-gray-100">
                                                <td className="py-2 px-4 text-gray-800">{p.address}</td>
                                                <td className="py-2 px-4 text-gray-600">{p.comuna}</td>
                                                <td className="py-2 px-4 text-gray-600">{p.agente}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {results.errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-sm font-bold text-red-700 mb-2">Errores ({results.errors.length}):</p>
                            {results.errors.map((err, i) => (
                                <p key={i} className="text-xs text-red-600">Fila {err.row}: {err.address} — {err.error}</p>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-center pt-4">
                        <button
                            onClick={() => { setStep(1); setRows([]); setFileName(''); setResults(null) }}
                            className="px-6 py-2.5 bg-[#003DA5] text-white rounded-xl text-sm font-bold hover:bg-[#002d7a] transition-colors flex items-center gap-2"
                        >
                            <Upload className="w-4 h-4" /> Nueva Importación
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
