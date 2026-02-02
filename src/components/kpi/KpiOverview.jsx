
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, FunnelChart, Funnel, LabelList, BarChart, Bar
} from 'recharts'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Activity } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Button,
    Input,
    Label
} from '@/components/ui'

export default function KpiOverview() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [kpis, setKpis] = useState([])
    const [goals, setGoals] = useState(null)

    useEffect(() => {
        if (user) {
            fetchDashboardData()
        }
    }, [user])

    const fetchDashboardData = async () => {
        setLoading(true)
        try {
            const currentYear = new Date().getFullYear()

            // Fetch Goals
            const { data: goalsData } = await supabase
                .from('agent_objectives')
                .select('*')
                .eq('agent_id', user.id)
                .eq('year', currentYear)
                .single()
            setGoals(goalsData)

            // Fetch KPIs for the whole year
            const { data: kpiData } = await supabase
                .from('weekly_kpis')
                .select('*')
                .eq('agent_id', user.id)
                .order('week_start_date', { ascending: true })

            setKpis(kpiData || [])

        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const [funnelFilter, setFunnelFilter] = useState('year') // 'week', 'month', 'year', 'custom'
    const [showCustomDateDialog, setShowCustomDateDialog] = useState(false)
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
    const [tempDateRange, setTempDateRange] = useState({ start: '', end: '' })

    const handleFilterChange = (value) => {
        setFunnelFilter(value)
        if (value === 'custom') {
            setTempDateRange(customDateRange) // Initialize with current
            setShowCustomDateDialog(true)
        }
    }

    const applyCustomDate = () => {
        setCustomDateRange(tempDateRange)
        setShowCustomDateDialog(false)
    }

    // --- Calculations ---

    // 0. Filtered KPIs for Funnel
    const filteredKpis = useMemo(() => {
        const now = new Date()
        if (funnelFilter === 'year') return kpis

        let start, end

        if (funnelFilter === 'custom') {
            if (!customDateRange.start || !customDateRange.end) return kpis
            start = new Date(customDateRange.start)
            end = new Date(customDateRange.end)
            end.setHours(23, 59, 59, 999)
        } else if (funnelFilter === 'month') {
            start = startOfMonth(now)
            end = endOfMonth(now)
        } else if (funnelFilter === 'week') {
            start = startOfWeek(now, { locale: es })
            end = endOfWeek(now, { locale: es })
        }

        return kpis.filter(k => {
            const date = new Date(k.week_start_date)
            return isWithinInterval(date, { start, end })
        })
    }, [kpis, funnelFilter])

    // 1. Metrics for Top Cards
    const { gaugeData, currentMonthBilling, monthlyGoal, gaugePercentage, annualBilling, annualGoal, totalListings } = useMemo(() => {
        // ... existing logic stays same as it uses full year or specific calculations
        const now = new Date()
        const start = startOfMonth(now)
        const end = endOfMonth(now)

        const billing = kpis // Keeping Top Cards mostly Annual/Monthly fixed as per their labels
            .filter(k => {
                const dates = new Date(k.week_start_date)
                return dates >= start && dates <= end
            })
            .reduce((sum, item) => sum + (item.billing_primary || 0), 0)

        const yearBilling = kpis.reduce((acc, curr) => acc + (curr.billing_primary || 0), 0)
        const yearListings = kpis.reduce((acc, curr) => acc + (curr.new_listings || 0), 0)

        const mGoal = (goals?.annual_billing_goal || 0) / 12
        const pct = mGoal > 0 ? (billing / mGoal) * 100 : 0
        const clampedPct = Math.min(pct, 100)

        const data = [
            { name: 'Progreso', value: clampedPct },
            { name: 'Restante', value: 100 - clampedPct }
        ]
        return {
            gaugeData: data,
            currentMonthBilling: billing,
            monthlyGoal: mGoal,
            gaugePercentage: pct,
            annualBilling: yearBilling,
            annualGoal: goals?.annual_billing_goal || 0,
            totalListings: yearListings
        }
    }, [kpis, goals])


    // 2. Funnel Logic (Aggregated Total based on Filter)
    const funnelData = useMemo(() => {
        const aggs = filteredKpis.reduce((acc, curr) => ({
            conversations: acc.conversations + (curr.conversations_started || 0),
            interviews: acc.interviews + (curr.sales_interviews || 0) + (curr.buying_interviews || 0),
            listings: acc.listings + (curr.new_listings || 0),
            sales: acc.sales + (curr.signed_promises || 0)
        }), { conversations: 0, interviews: 0, listings: 0, sales: 0 })

        return [
            { name: 'Conversaciones', value: aggs.conversations, fill: '#8b5cf6' }, // Violet
            { name: 'Entrevistas', value: aggs.interviews, fill: '#6366f1' },   // Indigo
            { name: 'Captaciones', value: aggs.listings, fill: '#3b82f6' },     // Blue
            { name: 'Ventas', value: aggs.sales, fill: '#06b6d4' },             // Cyan
        ]
    }, [filteredKpis])

    // 3. Activity Trend (Weekly) - Updated for Bar style similar to reference
    const trendData = useMemo(() => {
        const sorted = [...kpis].sort((a, b) => new Date(a.week_start_date) - new Date(b.week_start_date))
        const recent = sorted.slice(-8)

        return recent.map(k => ({
            week: format(new Date(k.week_start_date), 'dd MMM', { locale: es }),
            conversations: k.conversations_started || 0,
            interviews: (k.sales_interviews || 0) + (k.buying_interviews || 0),
            listings: k.new_listings || 0,
            fullDate: k.week_start_date
        }))
    }, [kpis])

    // Colors referencing the image palette
    const GAUGE_COLORS = ['#6366f1', '#f1f5f9'] // Indigo, Slate-100

    // Custom Tooltip for Charts
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-sm p-4 border border-slate-100 shadow-xl rounded-2xl text-sm min-w-[150px]">
                    <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-4 mb-1">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload.fill }} />
                                <span className="text-slate-500 capitalize text-xs font-medium">{entry.name}</span>
                            </div>
                            <span className="font-bold text-slate-700">{entry.value}</span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-500 bg-slate-50/50 min-h-screen">

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Card 1: Monthly Goal Progress */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Target className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-slate-500 text-sm font-medium">Meta Mensual</h3>
                                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                                    {Math.round(gaugePercentage)}%
                                </p>
                            </div>
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${gaugePercentage >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>
                            {gaugePercentage >= 100 ? <TrendingUp className="w-3 h-3" /> : null}
                            <span>{gaugePercentage >= 100 ? 'Completado' : 'En progreso'}</span>
                        </div>
                    </div>

                    <div className="relative h-2 bg-slate-100 rounded-full w-full overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(gaugePercentage, 100)}%` }}
                        />
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-slate-400 font-medium">
                        <span>{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(currentMonthBilling)}</span>
                        <span>Meta: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monthlyGoal)}</span>
                    </div>
                </div>

                {/* Card 2: Annual Revenue */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-slate-500 text-sm font-medium">Facturación Anual</h3>
                            </div>
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-3xl font-bold text-slate-900 tracking-tight">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(annualBilling)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                <span>{(annualBilling / (annualGoal || 1) * 100).toFixed(1)}%</span>
                            </div>
                            <span className="text-slate-400 text-xs font-medium">de la meta anual</span>
                        </div>
                    </div>
                </div>

                {/* Card 3: Listings */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-slate-500 text-sm font-medium">Captaciones (Año)</h3>
                            </div>
                        </div>
                        <div className="p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                            <Activity className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-3xl font-bold text-slate-900 tracking-tight">
                            {totalListings}
                        </p>
                        <p className="text-slate-400 text-xs font-medium mt-2">Propiedades nuevas en cartera</p>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Activity Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Resumen de Actividad</h3>
                            <p className="text-sm text-slate-500 font-medium">Conversaciones vs Entrevistas vs Captaciones</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="text-xs font-medium bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">Filtrar</button>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} barGap={0} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="week"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                <Legend
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(value) => <span className="text-slate-600 font-medium ml-1 text-sm">{value}</span>}
                                />
                                <Bar
                                    dataKey="conversations"
                                    name="Conversaciones"
                                    fill="#8b5cf6"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={40}
                                />
                                <Bar
                                    dataKey="interviews"
                                    name="Entrevistas"
                                    fill="#6366f1"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={40}
                                />
                                <Bar
                                    dataKey="listings"
                                    name="Captaciones"
                                    fill="#3b82f6"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Funnel Chart - Side Panel */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-bold text-slate-900">Conversión</h3>
                        <Select value={funnelFilter} onValueChange={handleFilterChange}>
                            <SelectTrigger className="w-[100px] h-8 text-xs bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Periodo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="week">Semana</SelectItem>
                                <SelectItem value="month">Mes</SelectItem>
                                <SelectItem value="year">Anual</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 min-h-[300px] flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart margin={{ right: 80, left: 20 }}>
                                <Tooltip content={<CustomTooltip />} />
                                <Funnel
                                    dataKey="value"
                                    data={funnelData}
                                    isAnimationActive
                                >
                                    <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" fontSize={11} fontWeight={600} />
                                </Funnel>
                            </FunnelChart>
                        </ResponsiveContainer>

                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Tasa Cierre</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">
                                {funnelData[0].value > 0 ? ((funnelData[3].value / funnelData[0].value) * 100).toFixed(1) : 0}%
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Ventas</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">{funnelData[3].value}</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Custom Date Dialog */}
            <Dialog open={showCustomDateDialog} onOpenChange={setShowCustomDateDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Seleccionar Periodo</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start" className="text-right">
                                Inicio
                            </Label>
                            <Input
                                id="start"
                                type="date"
                                value={tempDateRange.start}
                                onChange={(e) => setTempDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="end" className="text-right">
                                Fin
                            </Label>
                            <Input
                                id="end"
                                type="date"
                                value={tempDateRange.end}
                                onChange={(e) => setTempDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" onClick={applyCustomDate}>Aplicar Filtro</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
