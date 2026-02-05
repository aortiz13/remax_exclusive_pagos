
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
import PropertyMap from '../crm/PropertyMap'

export default function KpiOverview() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        daily: {},
        weekly: {},
        monthly: {},
        annual: {}
    })
    const [targets, setTargets] = useState({
        daily_conversations: 10,
        weekly_prelisting: 2,
        weekly_prebuying: 1,
        monthly_captures: 4,
        monthly_closing: 1
    })
    const [kpiRecords, setKpiRecords] = useState([])

    useEffect(() => {
        if (user) {
            fetchDashboardData()
        }
    }, [user])

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

            // 2. Fetch KPI Records (Daily/Weekly/Monthly) for this year
            const { data: records, error } = await supabase
                .from('kpi_records')
                .select('*')
                .eq('agent_id', user.id)
                .gte('date', format(startYear, 'yyyy-MM-dd'))
                .order('date', { ascending: true })

            if (error) throw error
            setKpiRecords(records || [])

            // 3. Aggregate Data
            calculateStats(records || [], now)

        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateStats = (records, now) => {
        const todayStr = format(now, 'yyyy-MM-dd')
        const startWk = startOfWeek(now, { weekStartsOn: 1 })
        const endWk = endOfWeek(now, { weekStartsOn: 1 })
        const startMth = startOfMonth(now)
        const endMth = endOfMonth(now)

        // Aggregators
        let daily = { conversations: 0 }
        let weekly = { prelisting: 0, prebuying: 0 }
        let monthly = { captures: 0, closings: 0, billing: 0 }
        let annual = { billing: 0, listings: 0 }

        records.forEach(r => {
            const rDate = new Date(r.date)

            // Annual
            annual.billing += (r.billing_primary || 0)
            annual.listings += (r.new_listings || 0)

            // Monthly
            if (isWithinInterval(rDate, { start: startMth, end: endMth })) {
                monthly.captures += (r.new_listings || 0)
                monthly.closings += (r.signed_promises || 0) // Assuming signed_promises = closing business
                monthly.billing += (r.billing_primary || 0)

                // Also add Daily/Weekly records if they fall in month
                if (r.period_type === 'daily' || r.period_type === 'weekly') {
                    // Logic already captures explicit column sums, so no double counting needed if columns are distinct
                }
            }

            // Weekly (Careful: 'monthly' records don't count for weekly activity usually)
            if (isWithinInterval(rDate, { start: startWk, end: endWk })) {
                weekly.prelisting += (r.sales_interviews || 0)
                weekly.prebuying += (r.buying_interviews || 0)
            }

            // Daily (Only 'daily' records for Today)
            if (r.period_type === 'daily' && r.date === todayStr) {
                daily.conversations += (r.conversations_started || 0)
            }
        })

        setStats({ daily, weekly, monthly, annual })
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
        // Aggregate by Week for chart
        const weeklyMap = {}
        kpiRecords.forEach(r => {
            const date = new Date(r.date)
            const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')

            if (!weeklyMap[weekStart]) {
                weeklyMap[weekStart] = { conversations: 0, interviews: 0, listings: 0 }
            }
            weeklyMap[weekStart].conversations += (r.conversations_started || 0)
            weeklyMap[weekStart].interviews += (r.sales_interviews || 0) + (r.buying_interviews || 0)
            weeklyMap[weekStart].listings += (r.new_listings || 0)
        })

        return Object.entries(weeklyMap)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .slice(-8)
            .map(([date, val]) => ({
                week: format(new Date(date), 'dd MMM', { locale: es }),
                ...val
            }))
    }, [kpiRecords])

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

            {/* New: Compliance Targets Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* 1. Daily: Conversations */}
                <CardMetric
                    title="Conversaciones (Hoy)"
                    current={stats.daily.conversations}
                    target={targets.daily_conversations}
                    icon={CheckCircle2}
                    color="text-blue-600 bg-blue-50"
                    unit="inicios"
                />

                {/* 2. Weekly: Pre-listing */}
                <CardMetric
                    title="Pre-listing (Semana)"
                    current={stats.weekly.prelisting}
                    target={targets.weekly_prelisting}
                    icon={Users}
                    color="text-indigo-600 bg-indigo-50"
                    unit="reuniones"
                />

                {/* 3. Weekly: Pre-buying */}
                <CardMetric
                    title="Pre-buying (Semana)"
                    current={stats.weekly.prebuying}
                    target={targets.weekly_prebuying}
                    icon={Users}
                    color="text-purple-600 bg-purple-50"
                    unit="reuniones"
                />

                {/* 4. Monthly: Captures & Closings (Combined or Split) */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-slate-500">Captaciones (Mes)</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stats.monthly.captures >= targets.monthly_captures ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                                {stats.monthly.captures}/{targets.monthly_captures}
                            </span>
                        </div>
                        <Progress value={Math.min((stats.monthly.captures / targets.monthly_captures) * 100, 100)} className="h-2" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-slate-500">Cierres (Mes)</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stats.monthly.closings >= targets.monthly_closing ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                                {stats.monthly.closings}/{targets.monthly_closing}
                            </span>
                        </div>
                        <Progress value={Math.min((stats.monthly.closings / targets.monthly_closing) * 100, 100)} className="h-2" />
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
                                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" iconSize={8} />
                                <Bar dataKey="conversations" name="Conversaciones" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="interviews" name="Entrevistas" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="listings" name="Captaciones" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col gap-6">
                    <h3 className="text-lg font-bold text-slate-900">Total Anual</h3>

                    <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-sm text-slate-500 mb-1">Facturación Total</p>
                        <p className="text-2xl font-bold text-slate-900">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(stats.annual.billing)}
                        </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-sm text-slate-500 mb-1">Total Captaciones</p>
                        <p className="text-2xl font-bold text-slate-900">{stats.annual.listings}</p>
                    </div>
                </div>
            </div>
            {/* Property Map Module */}
            <div className="w-full">
                <PropertyMap />
            </div>
        </div>
    )
}

function CardMetric({ title, current, target, icon: Icon, color, unit }) {
    const pct = Math.min((current / target) * 100, 100)
    const isComplete = current >= target

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
                    <span className={`text-3xl font-bold ${isComplete ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {current}
                    </span>
                    <span className="text-sm text-slate-400 font-medium mb-1">/ {target} {unit}</span>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    )
}

function cn(...classes) {
    return classes.filter(Boolean).join(' ')
}
