import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Settings, Save, Search, Filter, Calendar as CalendarIcon, ArrowRightLeft, GripHorizontal, Columns3, Eye, EyeOff } from 'lucide-react'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    Tabs, TabsContent, TabsList, TabsTrigger,
    Button, Input, Card, CardHeader, CardTitle, CardContent, CardDescription,
    Popover, PopoverContent, PopoverTrigger,
    Calendar, Label, Switch, Badge, Checkbox
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

// Column definitions for the records table
const RECORD_COLUMNS = [
    { key: 'conversations_started', label: 'I.C.', align: 'center' },
    { key: 'relational_coffees', label: 'Cafés', align: 'center' },
    { key: 'sales_interviews', label: 'Ent. Venta', align: 'center' },
    { key: 'buying_interviews', label: 'Ent. Compra', align: 'center' },
    { key: 'commercial_evaluations', label: 'Eval. Com.', align: 'center' },
    { key: 'new_listings', label: 'Captaciones', align: 'center' },
    { key: 'active_portfolio', label: 'Cartera', align: 'center' },
    { key: 'price_reductions', label: 'Bajas Precio', align: 'center' },
    { key: 'portfolio_visits', label: 'Vis. Prop.', align: 'center' },
    { key: 'buyer_visits', label: 'Vis. Comp.', align: 'center' },
    { key: 'offers_in_negotiation', label: 'Ofertas Neg.', align: 'center' },
    { key: 'signed_promises', label: 'Promesas', align: 'center' },
    { key: 'referrals_count', label: 'Referidos', align: 'center' },
    { key: 'billing_primary', label: 'Fact. Prim.', align: 'right', isCurrency: true },
    { key: 'billing_secondary', label: 'Fact. Sec.', align: 'right', isCurrency: true },
]

const DEFAULT_VISIBLE = RECORD_COLUMNS.map(c => c.key)

export default function AdminKpiView() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('all')

    // Filters
    const [dateRange, setDateRange] = useState('6m') // '3m', '6m', '1y', 'ytd', 'custom'
    const [customDate, setCustomDate] = useState({ from: undefined, to: undefined })
    const [tempDate, setTempDate] = useState({ from: undefined, to: undefined }) // Temp state for calendar
    const [comparisonMode] = useState('none') // Fixed to none
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem('kpi_records_visible_cols')
        return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
    })

    const toggleColumn = (key) => {
        setVisibleColumns(prev => {
            const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
            localStorage.setItem('kpi_records_visible_cols', JSON.stringify(next))
            return next
        })
    }

    const activeColumns = RECORD_COLUMNS.filter(c => visibleColumns.includes(c.key))

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
        <div className="w-full space-y-8 min-h-0 overflow-hidden">
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
                        <Popover open={isCustomDateOpen} onOpenChange={(open) => {
                            if (open) setTempDate(customDate) // Sync when opening
                            setIsCustomDateOpen(open)
                        }}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-9 justify-start text-left font-normal"
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formatDateRange(customDate.from, customDate.to)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="center">
                                <div className="scale-90 origin-top">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={tempDate?.from}
                                        selected={tempDate}
                                        onSelect={setTempDate}
                                        numberOfMonths={2}
                                        locale={es}
                                    />
                                    <div className="p-3 border-t flex justify-end">
                                        <Button size="sm" onClick={() => {
                                            setCustomDate(tempDate)
                                            setIsCustomDateOpen(false)
                                        }}>
                                            OK
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}



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
                    {(() => {
                        // Aggregate DAILY kpi_records per agent
                        const dailyRecords = kpiData.filter(r => r.period_type === 'daily');
                        const agentMap = {};
                        dailyRecords.forEach(r => {
                            const aid = r.agent_id;
                            if (!agentMap[aid]) {
                                agentMap[aid] = {
                                    agent_id: aid,
                                    name: r.profiles ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() : 'Sin nombre',
                                    conversations_started: 0, relational_coffees: 0, sales_interviews: 0,
                                    buying_interviews: 0, commercial_evaluations: 0, new_listings: 0,
                                    active_portfolio: 0, price_reductions: 0, portfolio_visits: 0,
                                    buyer_visits: 0, offers_in_negotiation: 0, signed_promises: 0,
                                    billing_primary: 0, billing_secondary: 0, referrals_count: 0,
                                };
                            }
                            const a = agentMap[aid];
                            a.conversations_started += (r.conversations_started || 0);
                            a.relational_coffees += (r.relational_coffees || 0);
                            a.sales_interviews += (r.sales_interviews || 0);
                            a.buying_interviews += (r.buying_interviews || 0);
                            a.commercial_evaluations += (r.commercial_evaluations || 0);
                            a.new_listings += (r.new_listings || 0);
                            a.active_portfolio = Math.max(a.active_portfolio, r.active_portfolio || 0);
                            a.price_reductions += (r.price_reductions || 0);
                            a.portfolio_visits += (r.portfolio_visits || 0);
                            a.buyer_visits += (r.buyer_visits || 0);
                            a.offers_in_negotiation += (r.offers_in_negotiation || 0);
                            a.signed_promises += (r.signed_promises || 0);
                            a.billing_primary += Number(r.billing_primary || 0);
                            a.billing_secondary += Number(r.billing_secondary || 0);
                            a.referrals_count += (r.referrals_count || 0);
                        });
                        const rows = Object.values(agentMap).sort((a, b) => b.billing_primary - a.billing_primary);
                        const totals = rows.reduce((acc, r) => {
                            RECORD_COLUMNS.forEach(c => { acc[c.key] = (acc[c.key] || 0) + (r[c.key] || 0) });
                            return acc;
                        }, {});
                        const fmtCLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
                        const colSpan = activeColumns.length + 1;

                        return (
                            <div className="space-y-3">
                                {/* Column toggle toolbar */}
                                <div className="flex justify-end">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <Columns3 className="h-4 w-4" />
                                                Columnas ({activeColumns.length}/{RECORD_COLUMNS.length})
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" className="w-56 p-3">
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center mb-2 pb-2 border-b">
                                                    <span className="text-sm font-medium">Columnas visibles</span>
                                                    <button
                                                        className="text-xs text-indigo-600 hover:underline"
                                                        onClick={() => {
                                                            const allKeys = RECORD_COLUMNS.map(c => c.key)
                                                            const next = visibleColumns.length === allKeys.length ? allKeys.slice(0, 6) : allKeys
                                                            setVisibleColumns(next)
                                                            localStorage.setItem('kpi_records_visible_cols', JSON.stringify(next))
                                                        }}
                                                    >
                                                        {visibleColumns.length === RECORD_COLUMNS.length ? 'Mostrar mínimo' : 'Mostrar todas'}
                                                    </button>
                                                </div>
                                                {RECORD_COLUMNS.map(col => (
                                                    <label key={col.key} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer text-sm">
                                                        <Checkbox
                                                            checked={visibleColumns.includes(col.key)}
                                                            onCheckedChange={() => toggleColumn(col.key)}
                                                        />
                                                        {col.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Table */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead className="sticky left-0 bg-slate-50 z-10 min-w-[140px]">Agente</TableHead>
                                                    {activeColumns.map(col => (
                                                        <TableHead key={col.key} className={col.align === 'right' ? 'text-right' : 'text-center'}>
                                                            {col.label}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {loading ? (
                                                    <TableRow><TableCell colSpan={colSpan} className="text-center py-8">Cargando...</TableCell></TableRow>
                                                ) : rows.length === 0 ? (
                                                    <TableRow><TableCell colSpan={colSpan} className="text-center py-8">No hay registros diarios para este periodo.</TableCell></TableRow>
                                                ) : (
                                                    <>
                                                        {rows.map(row => (
                                                            <TableRow key={row.agent_id} className="hover:bg-slate-50/50">
                                                                <TableCell className="sticky left-0 bg-white z-10 font-medium">{row.name}</TableCell>
                                                                {activeColumns.map(col => (
                                                                    <TableCell key={col.key} className={`${col.align === 'right' ? 'text-right font-mono' : 'text-center'}`}>
                                                                        {col.isCurrency ? fmtCLP(row[col.key]) : row[col.key]}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        ))}
                                                        <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                            <TableCell className="sticky left-0 bg-slate-100 z-10">TOTAL ({rows.length} agentes)</TableCell>
                                                            {activeColumns.map(col => (
                                                                <TableCell key={col.key} className={`${col.align === 'right' ? 'text-right font-mono' : 'text-center'}`}>
                                                                    {col.isCurrency ? fmtCLP(totals[col.key] || 0) : (totals[col.key] || 0)}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    </>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
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
