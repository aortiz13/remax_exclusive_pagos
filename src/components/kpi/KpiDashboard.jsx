
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, Cell, FunnelChart, Funnel, LabelList
} from 'recharts'
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, isSameWeek } from 'date-fns'
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

            // Fetch KPIs for the whole year (to filter locally or could filter in query)
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

    // 1. Gauge / Progress Logic
    const currentMonthBilling = useMemo(() => {
        const now = new Date()
        const start = startOfMonth(now)
        const end = endOfMonth(now)

        return kpis
            .filter(k => {
                const dates = new Date(k.week_start_date)
                return dates >= start && dates <= end
            })
            .reduce((sum, item) => sum + (item.billing_primary || 0), 0) // Should verify if secondary counts
    }, [kpis])

    const monthlyGoal = useMemo(() => {
        if (!goals) return 0
        // Simplification: Divide Quarter goal or Annual goal
        // Ideally should be smarter, but for now let's assume Annual / 12
        return (goals.annual_billing_goal || 0) / 12
    }, [goals])

    const gaugePercentage = monthlyGoal > 0 ? (currentMonthBilling / monthlyGoal) * 100 : 0

    // 2. Funnel Logic (Aggregated Total)
    const funnelData = useMemo(() => {
        const aggs = kpis.reduce((acc, curr) => ({
            conversations: acc.conversations + (curr.conversations_started || 0),
            interviews: acc.interviews + (curr.sales_interviews || 0), // Prelisting
            listings: acc.listings + (curr.new_listings || 0),
            sales: acc.sales + (curr.signed_promises || 0) // Proxies for "Ventas"
        }), { conversations: 0, interviews: 0, listings: 0, sales: 0 })

        return [
            { name: 'Conversaciones', value: aggs.conversations, fill: '#60a5fa' },
            { name: 'Entrevistas', value: aggs.interviews, fill: '#818cf8' },
            { name: 'Captaciones', value: aggs.listings, fill: '#a78bfa' },
            { name: 'Ventas (Promesas)', value: aggs.sales, fill: '#c084fc' },
        ]
    }, [kpis])

    // 3. Activity Trend (Weekly)
    const trendData = useMemo(() => {
        // Take last 8 weeks for clarity
        const sorted = [...kpis].sort((a, b) => new Date(a.week_start_date) - new Date(b.week_start_date))
        const recent = sorted.slice(-8)

        return recent.map(k => ({
            week: format(new Date(k.week_start_date), 'dd/MM'),
            conversations: k.conversations_started || 0,
            interviews: (k.sales_interviews || 0) + (k.buying_interviews || 0),
        }))
    }, [kpis])

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">Mi Tablero de Rendimiento</h2>

            {/* Top Cards Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Gauge Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">Meta Mensual (Estimado)</h3>
                    <div className="relative w-48 h-24 overflow-hidden mt-4">
                        <div className="absolute top-0 left-0 w-full h-full bg-gray-200 rounded-t-full"></div>
                        <div
                            className="absolute top-0 left-0 w-full h-full bg-blue-600 rounded-t-full origin-bottom transition-all duration-1000 ease-out"
                            style={{ transform: `rotate(${Math.min(gaugePercentage, 100) * 1.8 - 180}deg)` }}
                        ></div>
                    </div>
                    <div className="mt-2 text-center">
                        <span className="text-3xl font-bold text-gray-800">{Math.round(gaugePercentage)}%</span>
                        <p className="text-sm text-gray-500">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(currentMonthBilling)} / {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(monthlyGoal)}
                        </p>
                    </div>
                </div>

                {/* Quick Stat 1 */}
                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl shadow-sm border border-blue-100">
                    <h3 className="text-gray-500 font-medium">Facturación Anual Acumulada</h3>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(kpis.reduce((acc, curr) => acc + (curr.billing_primary || 0), 0))}
                    </p>
                    <p className="text-xs text-blue-400 mt-1">vs Meta: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(goals?.annual_billing_goal || 0)}</p>
                </div>

                {/* Quick Stat 2 */}
                <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-xl shadow-sm border border-purple-100">
                    <h3 className="text-gray-500 font-medium">Captaciones Totales (Año)</h3>
                    <p className="text-3xl font-bold text-purple-600 mt-2">
                        {kpis.reduce((acc, curr) => acc + (curr.new_listings || 0), 0)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Funnel Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Embudo de Conversión (Total Año)</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart>
                                <Tooltip />
                                <Funnel
                                    dataKey="value"
                                    data={funnelData}
                                    isAnimationActive
                                >
                                    <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                                </Funnel>
                            </FunnelChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Trend Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Tendencia de Actividad (Últimas 8 Semanas)</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="week" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="conversations" name="Conversaciones" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="interviews" name="Entrevistas" stroke="#8b5cf6" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    )
}
