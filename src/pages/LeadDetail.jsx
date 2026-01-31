import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { Card, CardContent, Button, Badge } from "@/components/ui" // Verify imports
import {
    Loader2, UserCheck, AlertCircle, Phone, Mail, MapPin,
    Home, DollarSign, User, Copy, CheckCircle2
} from "lucide-react"
import { toast } from 'sonner'

// Extraction Helpers (Shared logic - ideally utility function but keeping inline for speed)
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
    const navigate = useNavigate()
    const [lead, setLead] = useState(null)
    const [loading, setLoading] = useState(true)
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('')
    const [assigning, setAssigning] = useState(false)

    useEffect(() => {
        const fetchLeadAndAgents = async () => {
            try {
                // 1. Fetch Lead
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
                let query = supabase.from('external_leads').select('*')
                if (isUUID) query = query.eq('id', id)
                else query = query.eq('short_id', id)

                const { data: leadData, error: leadError } = await query.single()
                if (leadError) throw leadError
                setLead(leadData)

                // 2. Fetch Agents
                const { data: agentsData, error: agentsError } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, email')
                    .order('first_name')

                if (agentsError) throw agentsError
                setAgents(agentsData || [])

                if (leadData.assigned_agent_id) {
                    setSelectedAgent(leadData.assigned_agent_id)
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
            const { error } = await supabase
                .from('external_leads')
                .update({ assigned_agent_id: selectedAgent, status: 'assigned' })
                .eq('id', lead.id) // Ensure we use UUID for update

            if (error) throw error

            // Trigger Webhook
            const agent = agents.find(a => a.id === selectedAgent)
            if (agent) {
                try {
                    const webhookPayload = {
                        agent: {
                            first_name: agent.first_name,
                            last_name: agent.last_name,
                            email: agent.email,
                            phone: agent.phone
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
        } catch (error) {
            toast.error('Error al asignar')
        } finally {
            setAssigning(false)
        }
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
    if (!lead) return <div className="text-center p-10 font-bold text-slate-500">Lead no encontrado</div>

    const contact = extractContactInfo(lead.raw_data)
    const property = extractPropertyInfo(lead.raw_data)
    const assignedAgentObj = agents.find(a => a.id === lead.assigned_agent_id)

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
                    {lead.status === 'assigned' ? 'Asignado' : 'Pendiente'}
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

                {/* Assignment Section - Prominent */}
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

                {/* Lead Details Preview */}
                <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-1">Resumen del Lead</h3>

                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {contact.phone && (
                                    <div className="flex items-center gap-3 p-4">
                                        <Phone className="w-5 h-5 text-slate-400" />
                                        <span className="font-medium text-slate-700">{contact.phone}</span>
                                    </div>
                                )}
                                {contact.email && (
                                    <div className="flex items-center gap-3 p-4">
                                        <Mail className="w-5 h-5 text-slate-400" />
                                        <span className="font-medium text-slate-700 text-sm break-all">{contact.email}</span>
                                    </div>
                                )}
                                {property.price && (
                                    <div className="flex items-center gap-3 p-4">
                                        <DollarSign className="w-5 h-5 text-slate-400" />
                                        <span className="font-medium text-slate-700">{property.price}</span>
                                    </div>
                                )}
                                {property.address && (
                                    <div className="flex items-center gap-3 p-4">
                                        <MapPin className="w-5 h-5 text-slate-400" />
                                        <span className="font-medium text-slate-700 text-sm">{property.address}</span>
                                    </div>
                                )}
                                {(property.beds || property.baths) && (
                                    <div className="flex items-center gap-3 p-4">
                                        <Home className="w-5 h-5 text-slate-400" />
                                        <span className="font-medium text-slate-700 text-sm">
                                            {property.beds ? `${property.beds} Dorm` : ''}
                                            {property.beds && property.baths ? ' • ' : ''}
                                            {property.baths ? `${property.baths} Baños` : ''}
                                        </span>
                                    </div>
                                )}
                                {contact.details && (
                                    <div className="flex items-start gap-3 p-4">
                                        <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5" />
                                        <span className="font-medium text-slate-700 text-sm italic">"{contact.details}"</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    )
}
