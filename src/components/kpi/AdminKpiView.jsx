
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Settings, Save, Search, Filter, Download } from 'lucide-react'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    Tabs, TabsContent, TabsList, TabsTrigger,
    Button, Input, Card, CardHeader, CardTitle, CardContent, CardDescription
} from "@/components/ui"
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth } from 'date-fns'
import { es } from 'date-fns/locale'

import { BillingVsGoalChart, ConversionFunnelChart, ActivityScatterPlot, StockTrendChart } from './KPICharts'
import { KPIMetricsCards } from './KPIMetricsCards'

export default function AdminKpiView() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('all')
    const [dateRange, setDateRange] = useState('6m') // '3m', '6m', '1y', 'ytd'

    // Data States
    const [kpiData, setKpiData] = useState([]) // Raw rows for table
    const [dashboardMetrics, setDashboardMetrics] = useState({
        totalBilling: 0,
        avgTicket: 0,
        conversionRate: 0,
        activeAgents: 0
    })
    const [chartsData, setChartsData] = useState({
        financials: [],
        funnel: [],
        scatter: [],
        stock: []
    })

    const [targets, setTargets] = useState({
        daily_conversations: 10,
        weekly_prelisting: 2,
        weekly_prebuying: 1,
        monthly_captures: 4,
        monthly_closing: 1,
        monthly_billing_goal: 5000000 // New global billing goal
    })

    useEffect(() => {
        fetchAgents()
        fetchSettings()
    }, [])

    useEffect(() => {
        fetchData()
    }, [selectedAgent, dateRange])

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
            if (data?.value) setTargets(prev => ({ ...prev, ...data.value }))
        } catch (e) { console.error(e) }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            // Calculate date range
            const now = new Date()
            let startDate = subMonths(now, 6)
            if (dateRange === '3m') startDate = subMonths(now, 3)
            if (dateRange === '1y') startDate = subMonths(now, 12)
            if (dateRange === 'ytd') startDate = startOfMonth(new Date(now.getFullYear(), 0, 1))

            // Fetch KPI Records
            let query = supabase
                .from('kpi_records')
                .select(`
                    *,
                    profiles:agent_id (first_name, last_name)
                `)
                .gte('date', format(startDate, 'yyyy-MM-dd'))
                .order('date', { ascending: false })

            if (selectedAgent !== 'all') {
                query = query.eq('agent_id', selectedAgent)
            }

            const { data, error } = await query
            if (error) throw error

            setKpiData(data || [])
            processDashboardData(data || [], startDate, now)

        } catch (error) {
            console.error('Error fetching KPI data:', error)
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    const processDashboardData = (records, startDate, endDate) => {
        // 1. Financials (Billing vs Goal)
        const months = eachMonthOfInterval({ start: startDate, end: endDate })
        const financialsData = months.map(month => {
            const monthRecords = records.filter(r => isSameMonth(new Date(r.date), month))
            const totalBilling = monthRecords.reduce((sum, r) => sum + (r.billing_primary || 0) + (r.billing_secondary || 0), 0)

            // Goal scaling: if 'all' agents, multiply goal by num agents (approx) or keep global? 
            // Let's assume global goal is per agent, so if 'all', we sum them up? 
            // For simplicity, let's just show raw numbers.

            return {
                name: format(month, 'MMM', { locale: es }),
                billing: totalBilling,
                goal: targets.monthly_billing_goal * (selectedAgent === 'all' ? (agents.length || 1) : 1)
            }
        })

        // 2. Funnel (Aggregated)
        const funnelTotals = records.reduce((acc, r) => ({
            conversations: acc.conversations + (r.conversations_started || 0),
            interviews: acc.interviews + (r.sales_interviews || 0) + (r.buying_interviews || 0),
            captures: acc.captures + (r.new_listings || 0),
            closings: acc.closings + (r.signed_promises || 0)
        }), { conversations: 0, interviews: 0, captures: 0, closings: 0 })

        const funnelData = [
            { name: 'Conversaciones', value: funnelTotals.conversations },
            { name: 'Entrevistas', value: funnelTotals.interviews },
            { name: 'Captaciones', value: funnelTotals.captures },
            { name: 'Cierres', value: funnelTotals.closings }
        ]

        // 3. Scatter (Effort vs Result) - Only meaningful when viewing 'all' agents
        const agentStats = {}
        records.forEach(r => {
            const agentId = r.agent_id
            const name = r.profiles ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}` : 'Unknown'
            if (!agentStats[agentId]) agentStats[agentId] = { name, effort: 0, result: 0 }

            // Effort = Conversations + Interviews + Coffees
            agentStats[agentId].effort += (r.conversations_started || 0) + (r.sales_interviews || 0) + (r.relational_coffees || 0)
            // Result = Captures + Closings
            agentStats[agentId].result += (r.new_listings || 0) + (r.signed_promises || 0)
        })
        const scatterData = Object.values(agentStats)

        // 4. Stock Trend (Stock vs In/Out)
        const stockData = months.map(month => {
            const monthRecords = records.filter(r => isSameMonth(new Date(r.date), month))
            // Use daily records max, or sum of weekly? 
            // Ideally we want the snapshot of active_portfolio at end of month or avg. 
            // Let's take the MAX active_portfolio reported in that month as a proxy.
            const maxStock = monthRecords.reduce((max, r) => Math.max(max, r.active_portfolio || 0), 0)
            const newListings = monthRecords.reduce((sum, r) => sum + (r.new_listings || 0), 0)
            const sold = monthRecords.reduce((sum, r) => sum + (r.signed_promises || 0), 0) // Should be 'sold' but promise is proxy

            return {
                name: format(month, 'MMM', { locale: es }),
                stock: maxStock, // This is tricky aggregation, sum if 'all'? No, stock is state. Sum of agents stocks.
                new: newListings,
                sold: sold
            }
        })

        // Correct Stock Sum logic for 'all' agents:
        // We need to sum the max stock of EACH agent for that month.
        if (selectedAgent === 'all') {
            stockData.forEach((point, idx) => {
                const month = months[idx]
                const recordsInMonth = records.filter(r => isSameMonth(new Date(r.date), month))
                const uniqueAgents = [...new Set(recordsInMonth.map(r => r.agent_id))]
                let totalStock = 0
                uniqueAgents.forEach(aid => {
                    const agentRecords = recordsInMonth.filter(r => r.agent_id === aid)
                    // Take last reported stock
                    const lastRecord = agentRecords.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
                    if (lastRecord) totalStock += (lastRecord.active_portfolio || 0)
                })
                point.stock = totalStock
            })
        }


        // 5. Metrics Cards
        const totalBilling = records.reduce((sum, r) => sum + (r.billing_primary || 0) + (r.billing_secondary || 0), 0)
        const totalClosings = funnelTotals.closings
        const avgTicket = totalClosings > 0 ? totalBilling / totalClosings : 0
        const conversionRate = funnelTotals.interviews > 0 ? (funnelTotals.captures / funnelTotals.interviews) * 100 : 0

        // Active agents: Users with at least 1 record in last 30 days
        const last30Days = new Date()
        last30Days.setDate(last30Days.getDate() - 30)
        const activeAgentIds = new Set(records.filter(r => new Date(r.date) > last30Days).map(r => r.agent_id))

        setDashboardMetrics({
            totalBilling,
            avgTicket,
            conversionRate,
            activeAgents: activeAgentIds.size
        })

        setChartsData({
            financials: financialsData,
            funnel: funnelData,
            scatter: scatterData,
            stock: stockData
        })
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
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tablero CEO</h1>
                    <p className="text-slate-500">Visión estratégica y operativa del negocio</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[140px] border-0 focus:ring-0">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="3m">Últimos 3 meses</SelectItem>
                            <SelectItem value="6m">Últimos 6 meses</SelectItem>
                            <SelectItem value="1y">Último año</SelectItem>
                            <SelectItem value="ytd">Año a la fecha (YTD)</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="h-6 w-px bg-slate-200" />

                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                        <SelectTrigger className="w-[200px] border-0 focus:ring-0">
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

                    <Button size="icon" variant="ghost" onClick={fetchData} disabled={loading}>
                        <Search className="w-4 h-4 text-slate-500" />
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="bg-white border text-slate-500 mb-6">
                    <TabsTrigger value="dashboard">Dashboard Estratégico</TabsTrigger>
                    <TabsTrigger value="records">Registros Detallados</TabsTrigger>
                    <TabsTrigger value="settings">Configuración Metas</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Metrics Cards */}
                    <KPIMetricsCards metrics={dashboardMetrics} />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Financials */}
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>Facturación vs Meta</CardTitle>
                                <CardDescription>Rendimiento financiero mensual</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-0">
                                <BillingVsGoalChart data={chartsData.financials} />
                            </CardContent>
                        </Card>

                        {/* Funnel */}
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>Embudo de Conversión</CardTitle>
                                <CardDescription>Salud del proceso comercial</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-0">
                                <ConversionFunnelChart data={chartsData.funnel} />
                            </CardContent>
                        </Card>

                        {/* Scatter Plot (Only specific if viewing All, or single bubble if agent) */}
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>Matriz Esfuerzo vs Resultado</CardTitle>
                                <CardDescription>Identificación de High Performers</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-0">
                                <ActivityScatterPlot data={chartsData.scatter} />
                            </CardContent>
                        </Card>

                        {/* Stock Trend */}
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>Tendencia de Cartera</CardTitle>
                                <CardDescription>Evolución del stock de propiedades y rotación</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-0">
                                <StockTrendChart data={chartsData.stock} />
                            </CardContent>
                        </Card>
                    </div>

                </TabsContent>

                <TabsContent value="records">
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
                                    <TableRow><TableCell colSpan={8} className="text-center py-8">No hay registros para este periodo.</TableCell></TableRow>
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
                            <CardTitle>Configuración de Metas Globales</CardTitle>
                            <CardDescription>
                                Estos valores se utilizan como referencia para las barras de progreso y cálculos de cumplimiento.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Meta Facturación Mensual (Por Agente)</label>
                                    <Input
                                        type="number"
                                        value={targets.monthly_billing_goal}
                                        onChange={(e) => handleTargetChange('monthly_billing_goal', e.target.value)}
                                    />
                                    <p className="text-xs text-slate-400">Objetivo base para cálculo de cumplimiento ($)</p>
                                </div>

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
