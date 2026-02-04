import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Settings, Save, Search, Filter, Calendar as CalendarIcon, ArrowRightLeft, GripHorizontal } from 'lucide-react'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    Tabs, TabsContent, TabsList, TabsTrigger,
    Button, Input, Card, CardHeader, CardTitle, CardContent, CardDescription,
    Popover, PopoverContent, PopoverTrigger,
    Calendar, Label, Switch, Badge
} from "@/components/ui"
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth, subYears, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

import { BillingVsGoalChart, ConversionFunnelChart, ActivityScatterPlot, StockTrendChart } from './KPICharts'
import { KPIMetricsCards } from './KPIMetricsCards'

import { Responsive } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// Custom WidthProvider implementation to fix missing export
const WidthProvider = (ComposedComponent) => ({ measureBeforeMount, ...props }) => {
    const [width, setWidth] = useState(1200)
    const elementRef = useRef(null)

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            if (entries[0]?.contentRect?.width) {
                setWidth(entries[0].contentRect.width)
            }
        })
        if (elementRef.current) observer.observe(elementRef.current)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={elementRef} className={props.className} style={{ ...props.style, width: '100%' }}>
            <ComposedComponent {...props} width={width} />
        </div>
    )
}

const ResponsiveGridLayout = WidthProvider(Responsive)

// Helper to format date range display
const formatDateRange = (from, to) => {
    if (!from) return 'Seleccionar fechas'
    if (!to) return `${format(from, 'dd/MM/yyyy')} - ...`
    return `${format(from, 'dd/MM/yyyy')} - ${format(to, 'dd/MM/yyyy')}`
}

export default function AdminKpiView() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('all')

    // Filters
    const [dateRange, setDateRange] = useState('6m') // '3m', '6m', '1y', 'ytd', 'custom'
    const [customDate, setCustomDate] = useState({ from: undefined, to: undefined })
    const [comparisonMode, setComparisonMode] = useState('none') // 'none', 'mom', 'yoy'
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)

    // Data States
    const [kpiData, setKpiData] = useState([])
    const [prevKpiData, setPrevKpiData] = useState([]) // For comparisons
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

    // Layout configuration
    // Default:
    // 0: Financials (Top Left)
    // 1: Funnel (Top Right)
    // 2: Scatter (Bottom Left)
    // 3: Stock (Bottom Right)
    const defaultLayouts = {
        lg: [
            { i: 'financials', x: 0, y: 0, w: 6, h: 4 },
            { i: 'funnel', x: 6, y: 0, w: 6, h: 4 },
            { i: 'scatter', x: 0, y: 4, w: 6, h: 4 },
            { i: 'stock', x: 6, y: 4, w: 6, h: 4 }
        ],
        md: [
            { i: 'financials', x: 0, y: 0, w: 6, h: 4 },
            { i: 'funnel', x: 6, y: 0, w: 6, h: 4 },
            { i: 'scatter', x: 0, y: 4, w: 12, h: 4 },
            { i: 'stock', x: 0, y: 8, w: 12, h: 4 }
        ],
        sm: [
            { i: 'financials', x: 0, y: 0, w: 12, h: 4 },
            { i: 'funnel', x: 0, y: 4, w: 12, h: 4 },
            { i: 'scatter', x: 0, y: 8, w: 12, h: 4 },
            { i: 'stock', x: 0, y: 12, w: 12, h: 4 }
        ]
    }

    const [layouts, setLayouts] = useState(() => {
        const saved = localStorage.getItem('kpi_dashboard_layout')
        return saved ? JSON.parse(saved) : defaultLayouts
    })

    const onLayoutChange = (layout, layouts) => {
        setLayouts(layouts)
        localStorage.setItem('kpi_dashboard_layout', JSON.stringify(layouts))
    }

    // Toggle width helper
    const toggleWidth = (id) => {
        setLayouts(prev => {
            const currentLayout = prev.lg || []
            const item = currentLayout.find(l => l.i === id)
            if (!item) return prev

            const newWidth = item.w === 6 ? 12 : 6
            const newLayout = currentLayout.map(l => l.i === id ? { ...l, w: newWidth } : l)

            const newLayouts = { ...prev, lg: newLayout }
            localStorage.setItem('kpi_dashboard_layout', JSON.stringify(newLayouts))
            return newLayouts
        })
    }


    useEffect(() => {
        fetchAgents()
        fetchSettings()
    }, [])

    useEffect(() => {
        if (dateRange === 'custom' && (!customDate.from || !customDate.to)) return
        fetchData()
    }, [selectedAgent, dateRange, customDate, comparisonMode])

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

    const calculateDateRange = () => {
        const now = new Date()
        let start, end = now

        if (dateRange === 'custom') {
            start = customDate.from
            end = customDate.to || now
        } else if (dateRange === '3m') start = subMonths(now, 3)
        else if (dateRange === '6m') start = subMonths(now, 6)
        else if (dateRange === '1y') start = subMonths(now, 12)
        else if (dateRange === 'ytd') start = startOfMonth(new Date(now.getFullYear(), 0, 1))

        return { start, end }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            const { start, end } = calculateDateRange()
            if (!start) return // Safety check

            // 1. Fetch Current Period Data
            let query = supabase
                .from('kpi_records')
                .select(`
                    *,
                    profiles:agent_id (first_name, last_name)
                `)
                .gte('date', format(start, 'yyyy-MM-dd'))
                .lte('date', format(end, 'yyyy-MM-dd'))
                .order('date', { ascending: false })

            if (selectedAgent !== 'all') {
                query = query.eq('agent_id', selectedAgent)
            }

            const { data, error } = await query
            if (error) throw error
            setKpiData(data || [])

            // 2. Fetch Comparison Data if enabled
            let prevData = []
            if (comparisonMode !== 'none') {
                let prevStart, prevEnd
                if (comparisonMode === 'mom') {
                    // Previous period is same duration but shifted back by duration length?
                    // Usually MoM means Month vs Previous Month.
                    // If range is 6m, 'MoM' is ambiguous. Usually implies comparing vs previous PERIOD.
                    // Let's assume comparisons work best for standard ranges or months.
                    // But standard logic: shift dates back by (End - Start).
                    const duration = end.getTime() - start.getTime()
                    prevEnd = new Date(start.getTime() - 86400000) // 1 day before start
                    prevStart = new Date(prevEnd.getTime() - duration)
                } else { // YoY
                    prevStart = subYears(start, 1)
                    prevEnd = subYears(end, 1)
                }

                let prevQuery = supabase
                    .from('kpi_records')
                    .select('*') // Don't need profiles
                    .gte('date', format(prevStart, 'yyyy-MM-dd'))
                    .lte('date', format(prevEnd, 'yyyy-MM-dd'))

                if (selectedAgent !== 'all') prevQuery = prevQuery.eq('agent_id', selectedAgent)

                const { data: pData } = await prevQuery
                prevData = pData || []
            }
            setPrevKpiData(prevData)

            processDashboardData(data || [], prevData, start, end)

        } catch (error) {
            console.error('Error fetching KPI data:', error)
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    const processDashboardData = (currentRecords, prevRecords, startDate, endDate) => {
        // --- Metrics Cards Calculation ---
        const calcMetrics = (records) => {
            const totalBilling = records.reduce((sum, r) => sum + (r.billing_primary || 0) + (r.billing_secondary || 0), 0)
            const closings = records.reduce((sum, r) => sum + (r.signed_promises || 0), 0)
            const interviews = records.reduce((sum, r) => sum + (r.sales_interviews || 0) + (r.buying_interviews || 0), 0)
            const captures = records.reduce((sum, r) => sum + (r.new_listings || 0), 0)

            // Active agents: Users with at least 1 record in the current period
            const uniqueAgents = new Set(records.map(r => r.agent_id))

            return {
                totalBilling,
                avgTicket: closings > 0 ? totalBilling / closings : 0,
                conversionRate: interviews > 0 ? (captures / interviews) * 100 : 0,
                activeAgents: uniqueAgents.size
            }
        }

        const currentMetrics = calcMetrics(currentRecords)
        const prevMetrics = calcMetrics(prevRecords)

        // Enhance metrics with trends
        const metricsWithTrends = {
            ...currentMetrics,
            billingTrend: comparisonMode !== 'none' ? ((currentMetrics.totalBilling - prevMetrics.totalBilling) / (prevMetrics.totalBilling || 1)) * 100 : 0,
            ticketTrend: comparisonMode !== 'none' ? ((currentMetrics.avgTicket - prevMetrics.avgTicket) / (prevMetrics.avgTicket || 1)) * 100 : 0,
            conversionTrend: comparisonMode !== 'none' ? (currentMetrics.conversionRate - prevMetrics.conversionRate) : 0, // Absolute % diff
            agentsTrend: comparisonMode !== 'none' ? ((currentMetrics.activeAgents - prevMetrics.activeAgents) / (prevMetrics.activeAgents || 1)) * 100 : 0
        }
        setDashboardMetrics(metricsWithTrends)

        // --- Financials Chart ---
        const months = eachMonthOfInterval({ start: startDate, end: endDate })
        const financialsData = months.map(month => {
            const monthRecords = currentRecords.filter(r => isSameMonth(new Date(r.date), month))
            const totalBilling = monthRecords.reduce((sum, r) => sum + (r.billing_primary || 0) + (r.billing_secondary || 0), 0)
            return {
                name: format(month, 'MMM', { locale: es }),
                billing: totalBilling,
                goal: targets.monthly_billing_goal * (selectedAgent === 'all' ? (agents.length || 1) : 1)
            }
        })

        // --- Funnel Chart ---
        const funnelTotals = currentRecords.reduce((acc, r) => ({
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

        // --- Scatter Plot (Enhanced) ---
        const agentStats = {}
        currentRecords.forEach(r => {
            const agentId = r.agent_id
            const name = r.profiles ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}` : 'Unknown'
            if (!agentStats[agentId]) agentStats[agentId] = { name, effort: 0, result: 0 }

            agentStats[agentId].effort += (r.conversations_started || 0) + (r.sales_interviews || 0) + (r.relational_coffees || 0)
            agentStats[agentId].result += (r.new_listings || 0) + (r.signed_promises || 0)
        })

        // Calculate Score for Size:
        // Score = Effort + (Result * 10). Emphasize results heavily for "Top Performer" visual weight.
        const scatterData = Object.values(agentStats).map(stat => ({
            ...stat,
            score: stat.effort + (stat.result * 15) // Tuning weight
        }))

        // --- Stock Trend Chart ---
        const stockData = months.map(month => {
            if (selectedAgent === 'all') {
                const recordsInMonth = currentRecords.filter(r => isSameMonth(new Date(r.date), month))
                const uniqueAgentsInMonth = [...new Set(recordsInMonth.map(r => r.agent_id))]
                let totalStock = 0
                uniqueAgentsInMonth.forEach(aid => {
                    const agentRecords = recordsInMonth.filter(r => r.agent_id === aid)
                    const lastRecord = agentRecords.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
                    if (lastRecord) totalStock += (lastRecord.active_portfolio || 0)
                })
                const newListings = recordsInMonth.reduce((sum, r) => sum + (r.new_listings || 0), 0)
                const sold = recordsInMonth.reduce((sum, r) => sum + (r.signed_promises || 0), 0)
                return {
                    name: format(month, 'MMM', { locale: es }),
                    stock: totalStock,
                    new: newListings,
                    sold: sold
                }
            } else {
                const monthRecords = currentRecords.filter(r => isSameMonth(new Date(r.date), month))
                const maxStock = monthRecords.reduce((max, r) => Math.max(max, r.active_portfolio || 0), 0)
                const newListings = monthRecords.reduce((sum, r) => sum + (r.new_listings || 0), 0)
                const sold = monthRecords.reduce((sum, r) => sum + (r.signed_promises || 0), 0)
                return { name: format(month, 'MMM', { locale: es }), stock: maxStock, new: newListings, sold: sold }
            }
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

                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg shadow-sm border">

                    {/* Period Filter */}
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px] border-0 focus:ring-0">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="3m">Últimos 3 meses</SelectItem>
                            <SelectItem value="6m">Últimos 6 meses</SelectItem>
                            <SelectItem value="1y">Último año</SelectItem>
                            <SelectItem value="ytd">Año a la fecha (YTD)</SelectItem>
                            <SelectItem value="custom">Personalizado...</SelectItem>
                        </SelectContent>
                    </Select>

                    {dateRange === 'custom' && (
                        <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-9 justify-start text-left font-normal"
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formatDateRange(customDate.from, customDate.to)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={customDate.from}
                                    selected={customDate}
                                    onSelect={setCustomDate}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    )}

                    <div className="h-6 w-px bg-slate-200" />

                    {/* Comparison Switch Toggle as Select */}
                    <div className="flex items-center gap-2 px-2">
                        <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                        <Select value={comparisonMode} onValueChange={setComparisonMode}>
                            <SelectTrigger className="w-[160px] border-0 focus:ring-0 h-9">
                                <SelectValue placeholder="Comparativa" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin Comparar</SelectItem>
                                <SelectItem value="mom">Mes (MoM)</SelectItem>
                                <SelectItem value="yoy">Año (YoY)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

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
                    <KPIMetricsCards metrics={{ ...dashboardMetrics, comparisonMode }} />

                    {/* Draggable Grid */}
                    <ResponsiveGridLayout
                        className="layout"
                        layouts={layouts}
                        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                        cols={{ lg: 12, md: 12, sm: 12, xs: 4, xxs: 2 }}
                        rowHeight={100}
                        draggableHandle=".drag-handle"
                        onLayoutChange={onLayoutChange}
                        isResizable={true}
                        isDraggable={true}
                    >
                        {/* Financials */}
                        <div key="financials" className="bg-white rounded-lg shadow-sm border overflow-hidden">
                            <div className="flex justify-between items-center p-6 pb-2 drag-handle cursor-grab active:cursor-grabbing border-b bg-slate-50/50">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-semibold leading-none tracking-tight">Facturación vs Meta</h3>
                                    <p className="text-sm text-muted-foreground">Rendimiento financiero mensual</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleWidth('financials')} title="Cambiar ancho">
                                        <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                    </Button>
                                    <GripHorizontal className="h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                            <div className="p-0 h-[calc(100%-80px)]">
                                <BillingVsGoalChart data={chartsData.financials} />
                            </div>
                        </div>

                        {/* Funnel */}
                        <div key="funnel" className="bg-white rounded-lg shadow-sm border overflow-hidden">
                            <div className="flex justify-between items-center p-6 pb-2 drag-handle cursor-grab active:cursor-grabbing border-b bg-slate-50/50">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-semibold leading-none tracking-tight">Embudo de Conversión</h3>
                                    <p className="text-sm text-muted-foreground">Salud del proceso comercial</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleWidth('funnel')} title="Cambiar ancho">
                                        <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                    </Button>
                                    <GripHorizontal className="h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                            <div className="p-0 h-[calc(100%-80px)]">
                                <ConversionFunnelChart data={chartsData.funnel} />
                            </div>
                        </div>

                        {/* Scatter Plot */}
                        <div key="scatter" className="bg-white rounded-lg shadow-sm border overflow-hidden">
                            <div className="flex justify-between items-center p-6 pb-2 drag-handle cursor-grab active:cursor-grabbing border-b bg-slate-50/50">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-semibold leading-none tracking-tight">Matriz Esfuerzo vs Resultado</h3>
                                    <p className="text-sm text-muted-foreground">Identificación de High Performers</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleWidth('scatter')} title="Cambiar ancho">
                                        <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                    </Button>
                                    <GripHorizontal className="h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                            <div className="p-0 h-[calc(100%-80px)]">
                                <ActivityScatterPlot data={chartsData.scatter} />
                            </div>
                        </div>

                        {/* Stock Trend */}
                        <div key="stock" className="bg-white rounded-lg shadow-sm border overflow-hidden">
                            <div className="flex justify-between items-center p-6 pb-2 drag-handle cursor-grab active:cursor-grabbing border-b bg-slate-50/50">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-semibold leading-none tracking-tight">Tendencia de Cartera</h3>
                                    <p className="text-sm text-muted-foreground">Stock vs Ventas</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleWidth('stock')} title="Cambiar ancho">
                                        <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                    </Button>
                                    <GripHorizontal className="h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                            <div className="p-0 h-[calc(100%-80px)]">
                                <StockTrendChart data={chartsData.stock} />
                            </div>
                        </div>

                    </ResponsiveGridLayout>

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
