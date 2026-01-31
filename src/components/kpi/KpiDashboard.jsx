
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, FunnelChart, Funnel, LabelList
} from 'recharts'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export default function KpiDashboard() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [kpis, setKpis] = useState([])
    const [goals, setGoals] = useState(null)
    const [viewMode, setViewMode] = useState('month') // 'month' | 'quarter'

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

    // --- Calculations ---

    // 1. Gauge / Progress Logic (Pie Chart Data)
    const { gaugeData, currentMonthBilling, monthlyGoal, gaugePercentage } = useMemo(() => {
        const now = new Date()
        const start = startOfMonth(now)
        const end = endOfMonth(now)

        const billing = kpis
            .filter(k => {
                const dates = new Date(k.week_start_date)
                return dates >= start && dates <= end
            })
            .reduce((sum, item) => sum + (item.billing_primary || 0), 0)

        const goal = (goals?.annual_billing_goal || 0) / 12
        const pct = goal > 0 ? (billing / goal) * 100 : 0
        const clampedPct = Math.min(pct, 100)

        // Data for PieChart: [Progress, Remaining]
        const data = [
            { name: 'Progreso', value: clampedPct },
            { name: 'Restante', value: 100 - clampedPct }
        ]
        return { gaugeData: data, currentMonthBilling: billing, monthlyGoal: goal, gaugePercentage: pct }
    }, [kpis, goals])


    // 2. Funnel Logic (Aggregated Total)
    const funnelData = useMemo(() => {
        const aggs = kpis.reduce((acc, curr) => ({
            conversations: acc.conversations + (curr.conversations_started || 0),
            interviews: acc.interviews + (curr.sales_interviews || 0) + (curr.buying_interviews || 0),
            listings: acc.listings + (curr.new_listings || 0),
            sales: acc.sales + (curr.signed_promises || 0)
        }), { conversations: 0, interviews: 0, listings: 0, sales: 0 })

        return [
            { name: 'Conversaciones', value: aggs.conversations, fill: '#60a5fa' },
            { name: 'Entrevistas', value: aggs.interviews, fill: '#818cf8' },
            { name: 'Captaciones', value: aggs.listings, fill: '#a78bfa' },
            { name: 'Ventas', value: aggs.sales, fill: '#c084fc' },
        ]
    }, [kpis])

    // 3. Activity Trend (Weekly) - AreaChart
    const trendData = useMemo(() => {
        const sorted = [...kpis].sort((a, b) => new Date(a.week_start_date) - new Date(b.week_start_date))
        const recent = sorted.slice(-8)

        return recent.map(k => ({
            week: format(new Date(k.week_start_date), 'dd/MM'),
            conversations: k.conversations_started || 0,
            interviews: (k.sales_interviews || 0) + (k.buying_interviews || 0),
            fullDate: k.week_start_date
        }))
    }, [kpis])

    const COLORS = ['#3b82f6', '#e2e8f0'] // Blue, Gray

    // Custom Tooltip for Charts
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-sm">
                    <p className="font-semibold text-slate-700 mb-1">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-500 capitalize">{entry.name}:</span>
                            <span className="font-medium text-slate-900">{entry.value}</span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="bg-primary/10 p-1.5 rounded-lg text-primary">📊</span>
                Mi Tablero de Rendimiento
            </h2>

            {/* Top Cards Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Gauge Card (Modernized with PieChart) */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-900 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        {/* Background decoration */}
                        <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor" className="text-blue-500"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5 7.51-3.41 .99-6.59-3.41 7.51-6.59 .99z"></path></svg>
                    </div>

                    <h3 className="text-slate-500 font-medium z-10 relative">Meta Mensual (Estimado)</h3>
                    <div className="h-48 relative flex items-center justify-center -mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={gaugeData}
                                    cx="50%"
                                    cy="70%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius={60}
                                    outerRadius={85}
                                    paddingAngle={5}
                                    dataKey="value"
                                    cornerRadius={8}
                                >
                                    {gaugeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-[65%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{Math.round(gaugePercentage)}%</span>
                        </div>
                    </div>
                    <div className="text-center -mt-6">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(currentMonthBilling)}
                        </p>
                        <p className="text-xs text-slate-400">
                            de {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monthlyGoal)}
                        </p>
                    </div>
                </div>

                {/* Quick Stat 1 */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-500/20 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                    <div>
                        <h3 className="text-blue-100 font-medium text-sm">Facturación Anual Acumulada</h3>
                        <p className="text-3xl font-bold mt-2 tracking-tight">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(kpis.reduce((acc, curr) => acc + (curr.billing_primary || 0), 0))}
                        </p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-blue-100">
                        <span>vs Meta: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(goals?.annual_billing_goal || 0)}</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded text-white">Anual</span>
                    </div>
                </div>

                {/* Quick Stat 2 */}
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-6 rounded-2xl shadow-lg shadow-purple-500/20 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                    <div>
                        <h3 className="text-violet-100 font-medium text-sm">Captaciones Totales (Año)</h3>
                        <p className="text-3xl font-bold mt-2 tracking-tight">
                            {kpis.reduce((acc, curr) => acc + (curr.new_listings || 0), 0)}
                        </p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-violet-100">
                        <span>Propiedades en cartera</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded text-white">YTD</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Funnel Chart - Modernized */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-900">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Embudo de Conversión</h3>
                        <select className="text-xs bg-slate-50 border-none rounded-md px-2 py-1 text-slate-500 focus:ring-0">
                            <option>Este Año</option>
                        </select>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart>
                                <Tooltip content={<CustomTooltip />} />
                                <Funnel
                                    dataKey="value"
                                    data={funnelData}
                                    isAnimationActive
                                >
                                    <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
                                </Funnel>
                            </FunnelChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Trend Chart - AreaChart with Gradient */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-900">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tendencia de Actividad</h3>
                        <span className="text-xs text-slate-400">Últimas 8 semanas</span>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorCov" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorInt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Area type="monotone" dataKey="conversations" name="Conversaciones" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCov)" activeDot={{ r: 6, strokeWidth: 0 }} />
                                <Area type="monotone" dataKey="interviews" name="Entrevistas" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorInt)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    )
}
