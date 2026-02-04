
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Settings, Save, Search, Filter } from 'lucide-react'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    Tabs, TabsContent, TabsList, TabsTrigger,
    Button, Input, Card, CardHeader, CardTitle, CardContent, CardDescription
} from "@/components/ui"
import { format } from 'date-fns'

export default function AdminKpiView() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('all')
    const [kpiData, setKpiData] = useState([])
    const [targets, setTargets] = useState({
        daily_conversations: 10,
        weekly_prelisting: 2,
        weekly_prebuying: 1,
        monthly_captures: 4,
        monthly_closing: 1
    })

    useEffect(() => {
        fetchAgents()
        fetchKpiData()
        fetchSettings()
    }, [])

    useEffect(() => {
        fetchKpiData()
    }, [selectedAgent])

    const fetchAgents = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email')
                .neq('role', 'admin')
            setAgents(data || [])
        } catch (error) {
            console.error('Error fetching agents:', error)
        }
    }

    const fetchSettings = async () => {
        try {
            const { data } = await supabase
                .from('kpi_settings')
                .select('value')
                .eq('key', 'default_targets')
                .single()
            if (data?.value) setTargets(data.value)
        } catch (e) { console.error(e) }
    }

    const fetchKpiData = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('kpi_records')
                .select(`
                    *,
                    profiles:agent_id (first_name, last_name)
                `)
                .order('date', { ascending: false })
                .limit(50)

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

    const saveSettings = async () => {
        try {
            const { error } = await supabase
                .from('kpi_settings')
                .upsert({
                    key: 'default_targets',
                    value: targets
                }, { onConflict: 'key' })

            if (error) throw error
            toast.success('Configuración guardada')
        } catch (e) {
            console.error(e)
            toast.error('Error al guardar configuración')
        }
    }

    const handleTargetChange = (name, val) => {
        setTargets(prev => ({ ...prev, [name]: parseInt(val) || 0 }))
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Administración de KPIs</h2>
                    <p className="text-slate-500">Gestina los objetivos y visualiza el rendimiento</p>
                </div>
            </div>

            <Tabs defaultValue="records" className="w-full">
                <TabsList>
                    <TabsTrigger value="records">Registros</TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2">
                        <Settings className="w-4 h-4" /> Configuración Metas
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="records" className="mt-6 space-y-6">
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="w-72">
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
                        <Button variant="outline" size="sm" onClick={fetchKpiData} disabled={loading}>
                            Actualizar
                        </Button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Agente</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Conversaciones</TableHead>
                                    <TableHead>Entrevistas</TableHead>
                                    <TableHead>Captaciones</TableHead>
                                    <TableHead>Ventas</TableHead>
                                    <TableHead className="text-right">Facturación</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell></TableRow>
                                ) : kpiData.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8">No hay registros.</TableCell></TableRow>
                                ) : (
                                    kpiData.map((kpi) => (
                                        <TableRow key={kpi.id}>
                                            <TableCell className="font-medium">
                                                {format(new Date(kpi.date), 'dd/MM/yyyy')}
                                            </TableCell>
                                            <TableCell>
                                                {kpi.profiles?.first_name} {kpi.profiles?.last_name}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${kpi.period_type === 'daily' ? 'bg-blue-100 text-blue-700' :
                                                        kpi.period_type === 'weekly' ? 'bg-indigo-100 text-indigo-700' :
                                                            'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {kpi.period_type === 'daily' ? 'Diario' : kpi.period_type === 'weekly' ? 'Semanal' : 'Mensual'}
                                                </span>
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
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Metas Globales de Actividad</CardTitle>
                            <CardDescription>
                                Define los niveles mínimos de actividad esperados por agente. Estos valores se reflejarán en sus tableros de control.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Inicios Conversación (Diario)</label>
                                    <Input
                                        type="number"
                                        value={targets.daily_conversations}
                                        onChange={(e) => handleTargetChange('daily_conversations', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Reuniones Pre-listing (Semanal)</label>
                                    <Input
                                        type="number"
                                        value={targets.weekly_prelisting}
                                        onChange={(e) => handleTargetChange('weekly_prelisting', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Reuniones Pre-buying (Semanal)</label>
                                    <Input
                                        type="number"
                                        value={targets.weekly_prebuying}
                                        onChange={(e) => handleTargetChange('weekly_prebuying', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Captaciones (Mensual)</label>
                                    <Input
                                        type="number"
                                        value={targets.monthly_captures}
                                        onChange={(e) => handleTargetChange('monthly_captures', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Cierres de Negocio (Mensual)</label>
                                    <Input
                                        type="number"
                                        value={targets.monthly_closing}
                                        onChange={(e) => handleTargetChange('monthly_closing', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                                <Button onClick={saveSettings} className="gap-2">
                                    <Save className="w-4 h-4" />
                                    Guardar Configuración
                                </Button>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
