import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { Card, CardContent, Button, Label, Input } from '@/components/ui'
import { UserCheck, CalendarDays, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Recursive component to render JSON nicely
const JSONViewer = ({ data, level = 0 }) => {
    if (!data) return <span className="text-muted-foreground italic">Sin datos</span>

    if (typeof data !== 'object') {
        return <span className="font-mono text-slate-700 dark:text-slate-300">{String(data)}</span>
    }

    if (Array.isArray(data)) {
        return (
            <div className="space-y-2">
                {data.map((item, index) => (
                    <div key={index} className="pl-4 border-l-2 border-slate-100 dark:border-slate-800">
                        <JSONViewer data={item} level={level + 1} />
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className={`space-y-2 ${level > 0 ? 'mt-2' : ''}`}>
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
                        {key.replace(/_/g, ' ')}
                    </span>
                    <div className="pl-1">
                        <JSONViewer data={value} level={level + 1} />
                    </div>
                </div>
            ))}
        </div>
    )
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
                const { data: leadData, error: leadError } = await supabase
                    .from('external_leads')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (leadError) throw leadError
                setLead(leadData)

                // 2. Fetch Agents (Profiles)
                // Filter for users who are agents/admins if you have role logic, 
                // for now we fetch all profiles as they are typically agents in this app context.
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
                console.error('Error fetching data:', error)
                toast.error('Error al cargar la información del lead')
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
                .update({
                    assigned_agent_id: selectedAgent,
                    status: 'assigned'
                })
                .eq('id', id)

            if (error) throw error

            setLead(prev => ({ ...prev, assigned_agent_id: selectedAgent, status: 'assigned' }))
            toast.success('Agente asignado exitosamente')

            // Optional: You could trigger an email notification via Edge Function here

        } catch (error) {
            console.error('Error assigning agent:', error)
            toast.error('Error al asignar agente')
        } finally {
            setAssigning(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Cargando información del lead...</p>
            </div>
        )
    }

    if (!lead) {
        return (
            <div className="container max-w-lg mx-auto py-20 text-center">
                <h2 className="text-xl font-bold">Lead no encontrado</h2>
                <Button className="mt-4" onClick={() => navigate('/dashboard')}>Ir al Inicio</Button>
            </div>
        )
    }

    const assignedAgentObj = agents.find(a => a.id === lead.assigned_agent_id)

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            <div className="bg-white border-b sticky top-0 z-10 px-4 py-4 shadow-sm">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-primary" />
                        Detalle de Lead
                    </h1>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${lead.status === 'assigned' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        {lead.status === 'assigned' ? 'Asignado' : 'Pendiente'}
                    </span>
                </div>
            </div>

            <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">

                {/* 1. ASSIGNMENT SECTION */}
                <Card className="border-indigo-100 shadow-md">
                    <CardContent className="p-6">
                        <Label className="text-base font-semibold mb-4 block">Asignar a Agente Inmobiliario</Label>

                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={selectedAgent}
                                    onChange={(e) => setSelectedAgent(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Agente --</option>
                                    {agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.first_name} {agent.last_name} ({agent.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Button
                                onClick={handleAssign}
                                disabled={!selectedAgent || assigning || selectedAgent === lead.assigned_agent_id}
                                className="w-full sm:w-auto"
                            >
                                {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                                {lead.assigned_agent_id === selectedAgent ? 'Reasignar' : 'Asignar Lead'}
                            </Button>
                        </div>

                        {assignedAgentObj && (
                            <div className="mt-4 p-3 bg-green-50 text-green-800 rounded-md text-sm border border-green-100 flex items-center gap-2">
                                <UserCheck className="w-4 h-4" />
                                <div>
                                    Asignado actualmente a: <strong>{assignedAgentObj.first_name} {assignedAgentObj.last_name}</strong>
                                    <div className="text-xs opacity-80">{new Date(lead.created_at).toLocaleString()}</div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 2. LEAD DATA DISPLAY */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ExternalLink className="w-5 h-5" /> Información del Lead
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Datos recibidos automáticamente desde la campaña externa.
                    </p>

                    <Card>
                        <CardContent className="p-6 overflow-auto">
                            {/* Recursive Adaptive Viewer - DEBUG MODE */}
                            {/* <JSONViewer data={lead.raw_data} /> */}
                            <pre className="text-xs font-mono bg-slate-100 p-4 rounded">
                                {JSON.stringify(lead.raw_data, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>

                    <div className="text-xs text-center text-muted-foreground pt-4">
                        ID: {lead.id} • Creado: {new Date(lead.created_at).toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    )
}
