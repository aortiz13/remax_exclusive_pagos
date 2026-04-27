import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileSpreadsheet, Play, Phone } from 'lucide-react'
import { voiceFetch, voiceUpload } from './voiceApi.js'

const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-600', scheduled: 'bg-blue-100 text-blue-700', running: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700', paused: 'bg-orange-100 text-orange-700' }

export default function OutboundCampaigns() {
    const [campaigns, setCampaigns] = useState([])
    const [showNew, setShowNew] = useState(false)
    const [uploading, setUploading] = useState(null)
    const [manualCall, setManualCall] = useState({ phone: '', name: '' })
    const fileRefs = useRef({})
    const [form, setForm] = useState({ name: '', type: 'debt_collection', scheduled_at: '', script_prompt: '' })

    const load = () => voiceFetch('/campaigns').then(setCampaigns).catch(console.error)
    useEffect(() => { load() }, [])

    const createCampaign = async e => {
        e.preventDefault()
        await voiceFetch('/campaigns', { method: 'POST', body: JSON.stringify(form) })
        setShowNew(false)
        setForm({ name: '', type: 'debt_collection', scheduled_at: '', script_prompt: '' })
        load()
    }

    const uploadExcel = async (campaignId, file) => {
        setUploading(campaignId)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const d = await voiceUpload(`/campaigns/${campaignId}/upload`, fd)
            alert(`Importados: ${d.imported} contactos. Omitidos: ${d.skipped}`)
            load()
        } catch (err) {
            alert(`Error: ${err.message}`)
        } finally { setUploading(null) }
    }

    const startCampaign = async id => {
        if (!confirm('¿Iniciar las llamadas de esta campaña ahora?')) return
        await voiceFetch(`/campaigns/${id}/start`, { method: 'POST' })
        load()
    }

    const makeManualCall = async () => {
        if (!manualCall.phone) return
        try {
            const d = await voiceFetch('/campaigns/call', { method: 'POST', body: JSON.stringify(manualCall) })
            alert(`Llamada iniciada: ${d.call_id}`)
            setManualCall({ phone: '', name: '' })
        } catch (err) { alert(`Error: ${err.message}`) }
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Campañas de Llamadas Salientes</h1>
                    <p className="text-sm text-gray-500 mt-1">Cobranza de arriendos, seguimiento y avisos</p>
                </div>
                <div className="flex gap-3">
                    <Link to="/voice-agent" className="text-sm text-gray-500 hover:text-gray-900 flex items-center">← Dashboard</Link>
                    <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <Plus size={16} /> Nueva campaña
                    </button>
                </div>
            </div>

            {/* Llamada manual */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Phone size={15} /> Llamada saliente manual</h3>
                <div className="flex gap-3 items-end flex-wrap">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Número</label>
                        <input value={manualCall.phone} onChange={e => setManualCall(m => ({ ...m, phone: e.target.value }))} placeholder="+56912345678" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-44" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Nombre (opcional)</label>
                        <input value={manualCall.name} onChange={e => setManualCall(m => ({ ...m, name: e.target.value }))} placeholder="Nombre del contacto" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52" />
                    </div>
                    <button onClick={makeManualCall} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                        <Phone size={15} /> Llamar ahora
                    </button>
                </div>
            </div>

            {/* Modal nueva campaña */}
            {showNew && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
                        <h2 className="text-lg font-semibold mb-4">Nueva Campaña</h2>
                        <form onSubmit={createCampaign} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Nombre</label>
                                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Tipo</label>
                                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                                    <option value="debt_collection">Cobranza de arriendos</option>
                                    <option value="follow_up">Seguimiento de leads</option>
                                    <option value="announcement">Aviso / Comunicado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Fecha y hora de inicio</label>
                                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                <p className="text-xs text-gray-400 mt-1">Deja vacío para iniciar manualmente</p>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Script adicional (opcional)</label>
                                <textarea value={form.script_prompt} onChange={e => setForm(f => ({ ...f, script_prompt: e.target.value }))} rows={3} placeholder="Instrucciones adicionales para el agente en esta campaña..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                            </div>
                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear campaña</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lista campañas */}
            <div className="space-y-4">
                {campaigns.map(c => (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {c.type} · {c.calls_made || 0}/{c.total_contacts || 0} llamadas
                                    {c.scheduled_at && ` · Programada: ${new Date(c.scheduled_at).toLocaleString('es-CL')}`}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <label className={`flex items-center gap-2 px-3 py-1.5 text-xs border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 ${uploading === c.id ? 'opacity-50' : ''}`}>
                                    <FileSpreadsheet size={13} />
                                    {uploading === c.id ? 'Subiendo...' : 'Cargar Excel'}
                                    <input ref={el => (fileRefs.current[c.id] = el)} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                        onChange={e => { if (e.target.files[0]) uploadExcel(c.id, e.target.files[0]); e.target.value = '' }} />
                                </label>
                                {(c.status === 'draft' || c.status === 'scheduled') && (
                                    <button onClick={() => startCampaign(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                                        <Play size={12} /> Iniciar ahora
                                    </button>
                                )}
                            </div>
                        </div>
                        {c.type === 'debt_collection' && (
                            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                                <p className="font-medium text-gray-700 mb-1">Formato Excel esperado:</p>
                                <p>Columnas: <span className="font-mono">Nombre | Telefono | Dirección | Monto | Meses | Agente | Teléfono Agente</span></p>
                            </div>
                        )}
                    </div>
                ))}
                {!campaigns.length && <div className="bg-white rounded-xl border border-gray-200 py-14 text-center text-sm text-gray-400">No hay campañas creadas. Crea una para empezar.</div>}
            </div>
        </div>
    )
}
