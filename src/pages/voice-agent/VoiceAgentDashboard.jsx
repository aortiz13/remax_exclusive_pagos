import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, TrendingUp, Users } from 'lucide-react'
import { voiceFetch } from './voiceApi.js'

function MetricCard({ icon: Icon, label, value, color = 'blue' }) {
    const colors = { blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', purple: 'bg-purple-50 text-purple-700', orange: 'bg-orange-50 text-orange-700' }
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${colors[color]}`}><Icon size={22} /></div>
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-semibold text-gray-900">{value}</p>
            </div>
        </div>
    )
}

export default function VoiceAgentDashboard() {
    const [metrics, setMetrics] = useState(null)
    const [error, setError] = useState(null)

    useEffect(() => {
        voiceFetch('/metrics').then(setMetrics).catch(e => setError(e.message))
    }, [])

    const formatSeconds = s => s ? `${Math.floor(s / 60)}m ${s % 60}s` : '—'

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Agente de Voz Virtual</h1>
                    <p className="text-sm text-gray-500 mt-1">RE/MAX Exclusive — Métricas de llamadas</p>
                </div>
                <div className="flex gap-3">
                    <Link to="/voice-agent/calls" className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Historial de llamadas</Link>
                    <Link to="/voice-agent/campaigns" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Campañas salientes</Link>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    Error al conectar con el servicio de voz: {error}
                </div>
            )}

            {metrics && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <MetricCard icon={Phone} label="Total llamadas" value={metrics.total ?? 0} color="blue" />
                        <MetricCard icon={PhoneIncoming} label="Entrantes" value={metrics.inbound ?? 0} color="green" />
                        <MetricCard icon={PhoneOutgoing} label="Salientes" value={metrics.outbound ?? 0} color="purple" />
                        <MetricCard icon={Clock} label="Duración promedio" value={formatSeconds(metrics.avg_duration)} color="orange" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Sentimiento</h3>
                            {Object.entries(metrics.sentiments || {}).map(([k, v]) => (
                                <div key={k} className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                                    <span className="capitalize text-gray-600">{k}</span><span className="font-medium">{v}</span>
                                </div>
                            ))}
                            {!Object.keys(metrics.sentiments || {}).length && <p className="text-sm text-gray-400">Sin datos aún</p>}
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Users size={16} /> Intenciones</h3>
                            {Object.entries(metrics.intents || {}).map(([k, v]) => (
                                <div key={k} className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                                    <span className="text-gray-600">{k}</span><span className="font-medium">{v}</span>
                                </div>
                            ))}
                            {!Object.keys(metrics.intents || {}).length && <p className="text-sm text-gray-400">Sin datos aún</p>}
                        </div>
                    </div>
                </>
            )}
            {!metrics && !error && <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando métricas...</div>}
        </div>
    )
}
