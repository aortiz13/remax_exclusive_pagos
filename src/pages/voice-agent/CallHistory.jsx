import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhoneIncoming, PhoneOutgoing, ChevronRight } from 'lucide-react'
import { voiceFetch } from './voiceApi.js'

const STATUS_COLORS = { completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', no_answer: 'bg-yellow-100 text-yellow-700', ongoing: 'bg-blue-100 text-blue-700' }
const SENTIMENT_COLORS = { positive: 'text-green-600', neutral: 'text-gray-500', negative: 'text-red-500' }

export default function CallHistory() {
    const [calls, setCalls] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [filter, setFilter] = useState({ direction: '', status: '' })
    const limit = 20

    useEffect(() => {
        const params = new URLSearchParams({ page, limit })
        if (filter.direction) params.set('direction', filter.direction)
        if (filter.status) params.set('status', filter.status)
        voiceFetch(`/calls?${params}`)
            .then(d => { setCalls(d.data || []); setTotal(d.total || 0) })
            .catch(console.error)
    }, [page, filter])

    const formatDate = ts => ts ? new Date(ts).toLocaleString('es-CL') : '—'
    const formatDuration = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—'

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Historial de Llamadas</h1>
                <Link to="/voice-agent" className="text-sm text-gray-500 hover:text-gray-900">← Dashboard</Link>
            </div>
            <div className="flex gap-3 mb-5">
                <select value={filter.direction} onChange={e => setFilter(f => ({ ...f, direction: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todas las direcciones</option>
                    <option value="inbound">Entrantes</option>
                    <option value="outbound">Salientes</option>
                </select>
                <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos los estados</option>
                    <option value="completed">Completadas</option>
                    <option value="no_answer">Sin respuesta</option>
                    <option value="failed">Fallidas</option>
                </select>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Dir.</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Duración</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Sentimiento</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {calls.map(call => (
                            <tr key={call.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    {call.direction === 'inbound' ? <PhoneIncoming size={16} className="text-green-500" /> : <PhoneOutgoing size={16} className="text-blue-500" />}
                                </td>
                                <td className="px-4 py-3 text-gray-900">{call.direction === 'inbound' ? call.from_phone : call.to_phone}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[call.status] || 'bg-gray-100 text-gray-600'}`}>{call.status}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{formatDuration(call.duration_seconds)}</td>
                                <td className={`px-4 py-3 capitalize ${SENTIMENT_COLORS[call.sentiment] || 'text-gray-400'}`}>{call.sentiment || '—'}</td>
                                <td className="px-4 py-3 text-gray-500">{formatDate(call.created_at)}</td>
                                <td className="px-4 py-3">
                                    <Link to={`/voice-agent/calls/${call.id}`} className="text-blue-500 hover:text-blue-700"><ChevronRight size={16} /></Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!calls.length && <div className="py-12 text-center text-sm text-gray-400">No hay llamadas registradas aún</div>}
            </div>
            {total > limit && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                    <span>{total} llamadas totales</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40">Anterior</button>
                        <span className="px-3 py-1">Página {page}</span>
                        <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="px-3 py-1 border rounded disabled:opacity-40">Siguiente</button>
                    </div>
                </div>
            )}
        </div>
    )
}
