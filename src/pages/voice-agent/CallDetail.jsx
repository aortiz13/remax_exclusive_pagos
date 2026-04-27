import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Phone, User, Mail, MessageSquare, ArrowLeftRight } from 'lucide-react'
import { voiceFetch } from './voiceApi.js'

const ACTION_LABELS = {
    email_sent: { label: 'Email enviado', color: 'blue' },
    whatsapp_remax: { label: 'WhatsApp a RE/MAX', color: 'green' },
    whatsapp_client: { label: 'WhatsApp al cliente', color: 'teal' },
    transfer: { label: 'Transferencia a humano', color: 'orange' },
    lead_captured: { label: 'Lead capturado', color: 'purple' },
}

export default function CallDetail() {
    const { id } = useParams()
    const [call, setCall] = useState(null)

    useEffect(() => {
        voiceFetch(`/calls/${id}`).then(setCall).catch(console.error)
    }, [id])

    if (!call) return <div className="p-6 text-sm text-gray-400">Cargando...</div>
    const lead = call.call_leads?.[0]

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-gray-900">Detalle de Llamada</h1>
                <Link to="/voice-agent/calls" className="text-sm text-gray-500 hover:text-gray-900">← Historial</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Phone size={15} /> Información de la llamada</h3>
                    <dl className="space-y-2 text-sm">
                        {[['Dirección', call.direction], ['Estado', call.status], ['Desde', call.from_phone || '—'], ['Hacia', call.to_phone || '—'],
                          ['Duración', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'],
                          ['Sentimiento', call.sentiment || '—'], ['Intención', call.intent || '—']].map(([k, v]) => (
                            <div key={k} className="flex justify-between"><dt className="text-gray-500">{k}</dt><dd className="capitalize">{v}</dd></div>
                        ))}
                    </dl>
                </div>
                {lead && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><User size={15} /> Lead capturado</h3>
                        <dl className="space-y-2 text-sm">
                            {[['Nombre', lead.name], ['Teléfono', lead.phone], ['Email', lead.email], ['Operación', lead.operation_type],
                              ['Interés', lead.property_interest], ['Presupuesto', lead.budget_range]].map(([k, v]) => (
                                <div key={k} className="flex justify-between"><dt className="text-gray-500">{k}</dt><dd className="text-right max-w-[200px] truncate capitalize">{v || '—'}</dd></div>
                            ))}
                        </dl>
                    </div>
                )}
            </div>
            {call.summary && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Resumen</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{call.summary}</p>
                </div>
            )}
            {call.call_actions?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Acciones ejecutadas</h3>
                    {call.call_actions.map(action => (
                        <div key={action.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                            <span className="text-gray-700">{ACTION_LABELS[action.action_type]?.label || action.action_type}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${action.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {action.success ? 'Exitoso' : 'Error'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {call.transcript && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Transcripción</h3>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{call.transcript}</pre>
                </div>
            )}
        </div>
    )
}
