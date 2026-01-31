
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { format } from 'date-fns'

export default function AdminKpiView() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('all')
    const [kpiData, setKpiData] = useState([])

    useEffect(() => {
        fetchAgents()
        fetchKpiData()
    }, [])

    useEffect(() => {
        fetchKpiData()
    }, [selectedAgent])

    const fetchAgents = async () => {
        try {
            // Fetch all profiles
            const { data, error } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email')
                .neq('role', 'admin') // Optional: hide admins if they mark KPIs

            if (error) throw error
            setAgents(data || [])
        } catch (error) {
            console.error('Error fetching agents:', error)
        }
    }

    const fetchKpiData = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('weekly_kpis')
                .select(`
                    *,
                    profiles:agent_id (first_name, last_name, email)
                `)
                .order('week_start_date', { ascending: false })

            if (selectedAgent !== 'all') {
                query = query.eq('agent_id', selectedAgent)
            }

            const { data, error } = await query
            if (error) throw error
            setKpiData(data || [])

        } catch (error) {
            console.error('Error fetching KPI data:', error)
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Administración de KPIs</h2>

                <div className="w-64">
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por Agente" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los Agentes</SelectItem>
                            {agents.map(agent => (
                                <SelectItem key={agent.id} value={agent.id}>
                                    {agent.first_name} {agent.last_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Semana</TableHead>
                                <TableHead>Agente</TableHead>
                                <TableHead>Conversaciones</TableHead>
                                <TableHead>Entrevistas</TableHead>
                                <TableHead>Captaciones</TableHead>
                                <TableHead>Ventas</TableHead>
                                <TableHead className="text-right">Facturación</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">Cargando datos...</TableCell>
                                </TableRow>
                            ) : kpiData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">No hay registros encontrados.</TableCell>
                                </TableRow>
                            ) : (
                                kpiData.map((kpi) => (
                                    <TableRow key={kpi.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(kpi.week_start_date), 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            {kpi.profiles?.first_name} {kpi.profiles?.last_name}
                                        </TableCell>
                                        <TableCell>{kpi.conversations_started}</TableCell>
                                        <TableCell>{(kpi.sales_interviews || 0) + (kpi.buying_interviews || 0)}</TableCell>
                                        <TableCell>{kpi.new_listings}</TableCell>
                                        <TableCell>{kpi.signed_promises}</TableCell>
                                        <TableCell className="text-right">
                                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(kpi.billing_primary || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
