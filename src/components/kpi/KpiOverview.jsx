
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, FunnelChart, Funnel, LabelList, BarChart, Bar
} from 'recharts'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Activity, CheckCircle2, AlertCircle } from 'lucide-react'
import { KpiFilterBar } from './KpiFilterBar'
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
    Label,
    Progress
} from '@/components/ui'


export default function KpiOverview() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        summary: {
            conversations: 0,
            prelisting: 0,
            prebuying: 0,
            captures: 0,
            closings: 0,
            billing: 0,
            honorarios_brutos: 0,
            cierre_operacion: 0,
        },
        annual: { billing: 0, listings: 0, honorarios: 0, cierres_valor: 0 }
    })
    const [dateRange, setDateRange] = useState({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 })
    })
    const [activePeriodId, setActivePeriodId] = useState('week')
    const [targets, setTargets] = useState({
        daily_conversations: 10,
        weekly_prelisting: 2,
        weekly_prebuying: 1,
        monthly_captures: 4,
        monthly_closing: 1
    })
    const [kpiRecords, setKpiRecords] = useState([])

    useEffect(() => {
        if (user && dateRange?.from && dateRange?.to) {
            fetchDashboardData()
        }
    }, [user, dateRange])

    const fetchDashboardData = async () => {
        setLoading(true)
        try {
            const now = new Date()
            const startYear = new Date(now.getFullYear(), 0, 1) // Jan 1st

            // 1. Fetch Admin Targets
            const { data: settings } = await supabase
                .from('kpi_settings')
                .select('value')
                .eq('key', 'default_targets')
                .single()

            if (settings?.value) {
                setTargets(prev => ({ ...prev, ...settings.value }))
            }

            // 2. Fetch Summary via RPC (The efficient way)
            const { data: summaryData, error: summaryError } = await supabase.rpc('get_kpi_summary', {
                target_agent_id: user.id,
                start_date: format(dateRange.from, 'yyyy-MM-dd'),
                end_date: format(dateRange.to, 'yyyy-MM-dd')
            })

            if (summaryError) throw summaryError

            // 3. Fetch Annual Stats (Always Needed)
            const { data: annualData, error: annualError } = await supabase.rpc('get_kpi_summary', {
                target_agent_id: user.id,
                start_date: format(startYear, 'yyyy-MM-dd'),
                end_date: format(now, 'yyyy-MM-dd')
            })

            if (annualError) console.error('Error fetching annual stats:', annualError)

            // 4. Fetch Records for Chart (Only for the selected range)
            const { data: records, error: recordsError } = await supabase
                .from('kpi_records')
                .select('*')
                .eq('agent_id', user.id)
                .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
                .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
                .order('date', { ascending: true })

            if (recordsError) throw recordsError
            setKpiRecords(records || [])

            setStats({
                summary: {
                    conversations: summaryData.conversations || 0,
                    prelisting: summaryData.sales_interviews || 0,
                    prebuying: summaryData.buying_interviews || 0,
                    captures: summaryData.new_listings || 0,
                    closings: summaryData.signed_promises || 0,
                    billing: summaryData.billing || 0,
                    honorarios_brutos: summaryData.billing_primary || 0,
                    cierre_operacion: summaryData.billing_secondary || 0,
                },
                annual: {
                    billing: annualData?.billing || 0,
                    listings: annualData?.new_listings || 0,
                    honorarios: annualData?.billing_primary || 0,
                    cierres_valor: annualData?.billing_secondary || 0,
                }
            })

        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    // --- Visualization Helpers ---
    const getProgressColor = (current, target) => {
        const pct = (current / target) * 100
        if (pct >= 100) return 'bg-emerald-500' // Success
        if (pct >= 50) return 'bg-amber-500' // Warning
        return 'bg-rose-500' // Danger
    }

    const getProgressText = (current, target) => {
        const pct = (current / target) * 100
        if (pct >= 100) return 'text-emerald-600'
        return 'text-slate-600'
    }

    // Chart Data Preparation (Similar to before but using new record source)
    const trendData = useMemo(() => {
        // Adapt aggregation based on range duration
        const diffDays = Math.ceil((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24))
        const isLongRange = diffDays > 35

        if (isLongRange) {
            // Aggregate by Month or Week if very long
            // For simplicity, let's keep it by Week for now or improve later
        }

        const map = {}
        // Initialize map with empty values for the range? (Optional, maybe for advanced chart)

        kpiRecords.forEach(r => {
            // Only aggregate Daily records for the chart to avoid spikes/duplicates if we mix types
            // OR handling weekly records carefully.
            // For the Trend Chart, checking 'daily' is safest. 
            // If we have 'weekly' data, we should ideally distribute it or show it as a block.
            // Simplified Approach: Iterate and group by Date (if short range) or Week (if long).

            if (r.period_type !== 'daily') return // Skip weekly summaries in granular chart for now

            const dateKey = format(new Date(r.date), 'yyyy-MM-dd')
            // If long range, maybe group by week
            const key = isLongRange
                ? format(startOfWeek(new Date(r.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
                : dateKey

            if (!map[key]) {
                map[key] = { conversations: 0, interviews: 0, listings: 0 }
            }
            map[key].conversations += (r.conversations_started || 0)
            map[key].interviews += (r.sales_interviews || 0) + (r.buying_interviews || 0)
            map[key].listings += (r.new_listings || 0)
        })

        return Object.entries(map)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([date, val]) => ({
                label: isLongRange
                    ? format(new Date(date), 'dd MMM', { locale: es }) // Week Start
                    : format(new Date(date), 'dd', { locale: es }),    // Day
                fullDate: date,
                ...val
            }))
    }, [kpiRecords, dateRange])

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
        <div className="max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in duration-500 bg-slate-50/50 min-h-screen">

            {/* Header with Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold text-slate-800">Tu Rendimiento</h2>
                    <p className="text-muted-foreground text-sm">Resumen de actividad para el periodo seleccionado</p>
                </div>
                <KpiFilterBar onFilterChange={(range, id) => {
                    setDateRange(range)
                    setActivePeriodId(id)
                }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* 1. Daily: Conversations */}
                <CardMetric
                    title="Conversaciones"
                    current={stats.summary.conversations}
                    target={activePeriodId === 'today' ? targets.daily_conversations : (targets.daily_conversations * 5)} // Rough estimate for target scaling? Or leave static target?
                    // Better to show JUST the number if target doesn't scale well dynamically without complex logic.
                    // Let's keep target visualization but acknowledge it might need scaling logic later.
                    showTarget={activePeriodId === 'today' || activePeriodId === 'week'}
                    icon={CheckCircle2}
                    color="text-blue-600 bg-blue-50"
                    unit="inicios"
                />

                {/* 2. Weekly: Pre-listing */}
                <CardMetric
                    title="Pre-listing (Venta)"
                    current={stats.summary.prelisting}
                    target={activePeriodId === 'week' ? targets.weekly_prelisting : null}
                    showTarget={activePeriodId === 'week'}
                    icon={Users}
                    color="text-indigo-600 bg-indigo-50"
                    unit="reuniones"
                />

                {/* 3. Weekly: Pre-buying */}
                <CardMetric
                    title="Pre-buying (Compra)"
                    current={stats.summary.prebuying}
                    target={activePeriodId === 'week' ? targets.weekly_prebuying : null}
                    showTarget={activePeriodId === 'week'}
                    icon={Users}
                    color="text-purple-600 bg-purple-50"
                    unit="reuniones"
                />

                {/* 4. Monthly: Captures & Closings */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-slate-500">Captaciones</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stats.summary.captures >= targets.monthly_captures ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                                {stats.summary.captures}
                            </span>
                        </div>
                        {/* Only show progress bar if typical period */}
                        <Progress value={Math.min((stats.summary.captures / targets.monthly_captures) * 100, 100)} className="h-2" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-slate-500">Cierres</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stats.summary.closings >= targets.monthly_closing ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                                {stats.summary.closings}
                            </span>
                        </div>
                        <Progress value={Math.min((stats.summary.closings / targets.monthly_closing) * 100, 100)} className="h-2" />
                    </div>
                </div>

            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Activity Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Actividad Reciente</h3>
                            <p className="text-sm text-slate-500 font-medium">Evolución semanal</p>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                            <BarChart data={trendData} barGap={0} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="label"
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
                                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" iconSize={8} />
                                <Bar dataKey="conversations" name="Conversaciones" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="interviews" name="Entrevistas" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="listings" name="Captaciones" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right: Billing Cards stacked vertically */}
                <div className="flex flex-col gap-6">

                    {/* Honorarios Brutos */}
                    <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl text-primary bg-blue-50">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <h3 className="text-slate-500 text-sm font-medium">Honorarios Brutos</h3>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(stats.summary.honorarios_brutos)}
                        </p>
                        <p className="text-xs text-muted-foreground">Acumulado en el período seleccionado</p>
                        <div className="absolute bottom-0 right-0 w-20 h-20 rounded-full bg-blue-50/40 blur-2xl -mr-4 -mb-4 pointer-events-none" />
                    </div>

                    {/* Cierre de Operación */}
                    <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl text-emerald-600 bg-emerald-50">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <h3 className="text-slate-500 text-sm font-medium">Cierre de Operación</h3>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(stats.summary.cierre_operacion)}
                        </p>
                        <p className="text-xs text-muted-foreground">Valor total de operaciones cerradas</p>
                        <div className="absolute bottom-0 right-0 w-20 h-20 rounded-full bg-emerald-50/40 blur-2xl -mr-4 -mb-4 pointer-events-none" />
                    </div>

                </div>
            </div>

        </div>
    )
}

function CardMetric({ title, current, target, showTarget = true, icon: Icon, color, unit }) {
    const pct = target ? Math.min((current / target) * 100, 100) : 0
    const isComplete = target ? current >= target : false

    return (
        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between h-full relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${color}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
                    </div>
                </div>
            </div>

            <div className="mt-2 relative z-10">
                <div className="flex items-end gap-2">
                    <span className={cn("text-3xl font-bold", isComplete ? 'text-emerald-600' : 'text-slate-900')}>
                        {current}
                    </span>
                    {showTarget && target && (
                        <span className="text-sm text-slate-400 font-medium mb-1">/ {target} {unit}</span>
                    )}
                </div>

                {showTarget && target && (
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                        <div
                            className={cn("h-full rounded-full transition-all duration-1000", isComplete ? 'bg-emerald-500' : 'bg-blue-500')}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

function cn(...classes) {
    return classes.filter(Boolean).join(' ')
}
