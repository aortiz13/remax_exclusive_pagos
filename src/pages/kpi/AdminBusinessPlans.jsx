import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'
import { Users, Target, Search } from 'lucide-react'
import BusinessPlan from './BusinessPlan'

const NON_AGENT_ROLES = ['superadministrador', 'tecnico', 'comercial', 'legal', 'administracion']

export default function AdminBusinessPlans() {
    const { profile } = useAuth()
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState(null)
    const [loading, setLoading] = useState(true)

    // Guard: only non-agent roles can access
    if (profile && !NON_AGENT_ROLES.includes(profile.role)) {
        return <Navigate to="/kpis/business-plan" replace />
    }

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email, role')
                .not('role', 'in', `(${NON_AGENT_ROLES.join(',')})`)
                .order('first_name')
            setAgents(data || [])
        } catch (e) {
            console.error('Error fetching agents:', e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header + Agent Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                        <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Planes de Negocio</h1>
                        <p className="text-sm text-gray-500">Vista de lectura de los planes de cada agente</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    <Users className="w-4 h-4 text-gray-400 ml-2" />
                    <Select value={selectedAgent || ''} onValueChange={setSelectedAgent}>
                        <SelectTrigger className="w-[280px] border-0 focus:ring-0">
                            <SelectValue placeholder="Seleccionar agente..." />
                        </SelectTrigger>
                        <SelectContent className="z-[300]">
                            {agents.map(agent => (
                                <SelectItem key={agent.id} value={agent.id}>
                                    {agent.first_name} {agent.last_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-[40vh]">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <span className="text-sm text-gray-400">Cargando agentes...</span>
                    </div>
                </div>
            ) : !selectedAgent ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 mb-4">
                        <Search className="w-12 h-12 text-indigo-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700 mb-1">Selecciona un agente</h3>
                    <p className="text-sm text-gray-400 max-w-sm">
                        Usa el selector de arriba para ver el plan de negocio de cualquier agente en modo lectura.
                    </p>
                </div>
            ) : (
                <div key={selectedAgent}>
                    <BusinessPlan agentId={selectedAgent} readOnly />
                </div>
            )}
        </div>
    )
}
