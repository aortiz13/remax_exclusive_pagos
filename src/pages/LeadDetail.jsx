import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { Card, CardContent, Button, Badge } from "@/components/ui"
import {
    Loader2, UserCheck, Phone, Mail, MapPin,
    Home, DollarSign, CheckCircle2
} from "lucide-react"
import { toast } from 'sonner'

// Recursive component for clean data display
const RecursiveDataViewer = ({ data, level = 0 }) => {
    if (data === null || data === undefined) return <span className="text-slate-400 italic">vacío</span>

    // Primitive types
    if (typeof data !== 'object') {
        return <span className="font-medium text-slate-700 break-all">{String(data)}</span>
    }

    // Array rendering
    if (Array.isArray(data)) {
        if (data.length === 0) return <span className="text-slate-400 italic">[]</span>
        return (
            <div className="space-y-4">
                {data.map((item, index) => (
                    <div key={index} className={`${level > 0 ? 'pl-4 border-l-2 border-slate-200' : ''}`}>
                        {data.length > 1 && <div className="text-xs font-bold text-slate-400 mb-2">Item {index + 1}</div>}
                        <RecursiveDataViewer data={item} level={level + 1} />
                    </div>
                ))}
            </div>
        )
    }

    // Object rendering
    return (
        <div className={`space-y-3 ${level > 0 ? 'mt-2' : ''}`}>
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className={`${level === 0 ? 'p-4 bg-slate-50/50 rounded-lg border border-slate-100' : 'pl-2'}`}>
                    <div className="flex flex-col gap-1">
                        <span className={`uppercase tracking-wider font-bold text-slate-500 ${level === 0 ? 'text-xs' : 'text-[10px]'}`}>
                            {key.replace(/_/g, ' ')}
                        </span>
                        <div className={`${typeof value === 'object' && value !== null ? 'mt-1' : ''}`}>
                            <RecursiveDataViewer data={value} level={level + 1} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// Extraction Helpers
const extractContactInfo = (data) => {
    const root = Array.isArray(data) ? data[0] : data || {};
    let contactBlock = root["Datos Contacto"] || root["Contacto"] || root["Cliente"];
    if (!contactBlock) contactBlock = root;

    return {
        name: contactBlock?.nombre_apellido || contactBlock?.nombre || "Cliente Potencial",
        phone: contactBlock?.telefono || contactBlock?.celular || contactBlock?.movil,
        email: contactBlock?.correo || contactBlock?.email,
        details: contactBlock?.info_adicional || ""
    }
}

const extractPropertyInfo = (data) => {
    const root = Array.isArray(data) ? data[0] : data || {};
    const propBlock = root["Datos Propiedad"] || root["Propiedad"] || root;

    return {
        type: propBlock?.tipo_inmueble || propBlock?.tipo || "Propiedad",
        transaction: propBlock?.tipo_transaccion || propBlock?.operacion || "Transacción",
        address: propBlock?.direccion_propiedad || propBlock?.direccion || propBlock?.ubicacion,
        price: propBlock?.valor_maximo || propBlock?.precio || propBlock?.presupuesto,
        beds: propBlock?.habitaciones || propBlock?.dormitorios,
        baths: propBlock?.banos || propBlock?.banos
    }
}

export default function LeadDetail() {
    const { id } = useParams()
    // const navigate = useNavigate() // Unused
    const [lead, setLead] = useState(null)
    const [loading, setLoading] = useState(true)
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('')
    const [assigning, setAssigning] = useState(false)

    useEffect(() => {
        const fetchLeadAndAgents = async () => {
            try {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
                let query = supabase.from('external_leads').select('*')
                if (isUUID) query = query.eq('id', id)
                else query = query.eq('short_id', id)

                const { data: leadData, error: leadError } = await query.single()
                if (leadError) throw leadError
                setLead(leadData)

                const { data: agentsData, error: agentsError } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, email')
                    .order('first_name')

                if (agentsError) throw agentsError
                setAgents(agentsData || [])

                if (leadData.assigned_agent_id) {
                    setSelectedAgent(leadData.assigned_agent_id)
                } else if (leadData.status === 'assigned') {
                    setSelectedAgent('remax_chile')
                }

            } catch (error) {
                console.error('Error:', error)
            } finally {
                setLoading(false)
            }
        }
        if (id) fetchLeadAndAgents()
    }, [id])

    const handleAssign = async () => {
        if (!selectedAgent) return
        setAssigning(true)

        try {
            const isRemaxChile = selectedAgent === 'remax_chile'
            const { error } = await supabase
                .from('external_leads')
                .update({
                    assigned_agent_id: isRemaxChile ? null : selectedAgent,
                    status: 'assigned'
                })
                .eq('id', lead.id)

            if (error) throw error

            const agent = isRemaxChile ? { first_name: 'Remax', last_name: 'Chile', email: 'regional@remax.cl' } : agents.find(a => a.id === selectedAgent)

            if (agent) {
                try {
                    const webhookPayload = {
                        agent: {
                            first_name: agent.first_name,
                            last_name: agent.last_name,
                            email: agent.email || '',
                            phone: agent.phone || ''
                        },
                        lead_link: `https://solicitudes.remax-exclusive.cl/nuevolead/${lead.short_id || lead.id}`,
                        lead_data: lead.raw_data
                    }
                    await fetch('https://workflow.remax-exclusive.cl/webhook/recibir_datos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(webhookPayload)
                    })
                } catch (e) { console.error(e) }
            }

            setLead(prev => ({ ...prev, assigned_agent_id: selectedAgent, status: 'assigned' }))
            toast.success('Agente asignado exitosamente')
        } catch (_) { // Removed unused error variable
            toast.error('Error al asignar')
        } finally {
            setAssigning(false)
        }
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
    if (!lead) return <div className="text-center p-10 font-bold text-slate-500">Lead no encontrado</div>

    const contact = extractContactInfo(lead.raw_data)
    const property = extractPropertyInfo(lead.raw_data)
    let assignedAgentObj = agents.find(a => a.id === lead.assigned_agent_id)
    if (!assignedAgentObj && lead.status === 'assigned') {
        assignedAgentObj = { first_name: 'Remax', last_name: 'Chile' }
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20 font-sans">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20 px-4 py-3 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        Admin
                    </div>
                    <span className="font-bold text-slate-800 tracking-tight">Asignación</span>
                </div>
                <Badge className={lead.status === 'assigned' ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"}>
                    {lead.status === 'assigned'
                        ? (assignedAgentObj ? `Asignado a ${assignedAgentObj.first_name}` : 'Asignado a Remax Chile')
                        : 'Pendiente'}
                </Badge>
            </div>

            <div className="max-w-md mx-auto p-4 space-y-6">

                {/* Hero / Lead Summary */}
                <div className="text-center space-y-2 py-4">
                    <h1 className="text-2xl font-bold text-slate-900">{contact.name}</h1>
                    <p className="text-slate-500 text-sm">
                        {property.transaction} • {property.type}
                    </p>
                </div>

                {/* Assignment Section */}
                <Card className="border-blue-100 shadow-md overflow-hidden">
                    <div className="bg-blue-50/50 p-4 border-b border-blue-100">
                        <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                            <UserCheck className="w-5 h-5" />
                            {assignedAgentObj ? 'Reasignar Agente' : 'Seleccionar Agente'}
                        </h3>
                    </div>
                    <CardContent className="p-4 space-y-4">
                        <select
                            className="w-full h-12 px-3 rounded-lg border border-slate-300 bg-white text-base focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                        >
                            <option value="">-- Elegir un Agente --</option>
                            <option value="remax_chile" className="font-bold text-blue-600">Remax Chile (Regional)</option>
                            {agents.map(agent => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.first_name} {agent.last_name}
                                </option>
                            ))}
                        </select>

                        <Button
                            className="w-full h-12 text-base font-semibold shadow-lg shadow-blue-900/10"
                            onClick={handleAssign}
                            disabled={!selectedAgent || assigning || selectedAgent === lead.assigned_agent_id}
                        >
                            {assigning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                            {lead.assigned_agent_id === selectedAgent ? 'Agente Asignado' : 'Confirmar Asignación'}
                        </Button>

                        {assignedAgentObj && (
                            <p className="text-xs text-center text-green-600 bg-green-50 py-2 rounded">
                                Actualmente asignado a: <strong>{assignedAgentObj.first_name} {assignedAgentObj.last_name}</strong>
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Full Lead Information */}
                <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-1">Información Completa</h3>
                    <Card className="border-0 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {/* Unwrap array if it's the root and just one item, for cleaner look */}
                            <div className="p-2">
                                <RecursiveDataViewer
                                    data={Array.isArray(lead.raw_data) && lead.raw_data.length === 1 ? lead.raw_data[0] : lead.raw_data}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    )
}
