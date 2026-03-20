import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    Users, Clock, CheckCircle2, AlertCircle, TrendingUp,
    Inbox, UserCheck, BarChart3, FileCheck, Calendar, Filter
} from 'lucide-react'
import { Progress } from '@/components/ui'

// ─── Helpers ───
function cn(...classes) { return classes.filter(Boolean).join(' ') }

function formatDuration(ms) {
    if (!ms || ms <= 0) return '—'
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    if (hours >= 24) {
        const days = Math.floor(hours / 24)
        const remHours = hours % 24
        return `${days}d ${remHours}h`
    }
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
}

// ─── Quick Filter Buttons ───
const PERIOD_OPTIONS = [
    { id: 'week', label: 'Últimos 7d', days: 7 },
    { id: 'month', label: 'Este mes', days: 0 },
    { id: '3months', label: '3 meses', days: 90 },
    { id: 'all', label: 'Todo', days: 999 },
]

export default function LeadKpiDashboard() {
    const { profile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [leads, setLeads] = useState([])       // external_leads
    const [guardLeads, setGuardLeads] = useState([]) // shift_guard_leads with joins
    const [agentProfiles, setAgentProfiles] = useState({}) // id → { first_name, last_name }
    const [activePeriod, setActivePeriod] = useState('all')

    const isAdmin = ['superadministrador', 'comercial', 'administracion', 'tecnico'].includes(profile?.role)

    useEffect(() => { fetchData() }, [])

    async function fetchData() {
        setLoading(true)
        try {
            const [leadsRes, guardRes] = await Promise.all([
                supabase.from('external_leads')
                    .select('id, status, created_at, short_id, assigned_agent_id')
                    .order('created_at', { ascending: false }),
                supabase.from('shift_guard_leads')
                    .select(`
                        id, assigned_at, is_guard, created_at,
                        report_2d_sent, report_2d_sent_at,
                        report_15d_sent, report_15d_sent_at,
                        report_30d_sent, report_30d_sent_at,
                        agent_id,
                        agent:profiles!shift_guard_leads_agent_id_fkey(id, first_name, last_name),
                        external_lead:external_leads!shift_guard_leads_external_lead_id_fkey(id, created_at, status)
                    `)
                    .order('assigned_at', { ascending: false }),
            ])

            const allLeads = leadsRes.data || []
            setLeads(allLeads)
            setGuardLeads(guardRes.data || [])

            // Fetch agent profiles for all assigned leads
            const agentIds = [...new Set(allLeads.filter(l => l.assigned_agent_id).map(l => l.assigned_agent_id))]
            if (agentIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name')
                    .in('id', agentIds)
                const map = {}
                ;(profiles || []).forEach(p => { map[p.id] = p })
                setAgentProfiles(map)
            }
        } catch (err) {
            console.error('Error fetching lead KPIs:', err)
        }
        setLoading(false)
    }

    // ─── Filter by period ───
    const filteredLeads = useMemo(() => {
        const now = new Date()
        let from
        if (activePeriod === 'week') from = subDays(now, 7)
        else if (activePeriod === 'month') from = startOfMonth(now)
        else if (activePeriod === '3months') from = subDays(now, 90)
        else from = new Date(2020, 0, 1) // all time

        return leads.filter(l => new Date(l.created_at) >= from)
    }, [leads, activePeriod])

    const filteredGuardLeads = useMemo(() => {
        const now = new Date()
        let from
        if (activePeriod === 'week') from = subDays(now, 7)
        else if (activePeriod === 'month') from = startOfMonth(now)
        else if (activePeriod === '3months') from = subDays(now, 90)
        else from = new Date(2020, 0, 1)

        return guardLeads.filter(g => {
            const d = g.assigned_at || g.created_at
            return d && new Date(d) >= from
        })
    }, [guardLeads, activePeriod])

    // ─── KPI Calculations ───
    const kpis = useMemo(() => {
        const total = filteredLeads.length
        const pending = filteredLeads.filter(l => l.status === 'pending').length
        const assigned = filteredLeads.filter(l => l.status === 'assigned' || l.assigned_agent_id).length
        const assignmentRate = total > 0 ? Math.round((assigned / total) * 100) : 0

        // Average response time (assigned_at - external_lead.created_at)
        const responseTimes = filteredGuardLeads
            .filter(g => g.assigned_at && g.external_lead?.created_at)
            .map(g => new Date(g.assigned_at) - new Date(g.external_lead.created_at))
            .filter(t => t > 0)
        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0

        // Leads per agent — based on external_leads.assigned_agent_id
        const agentMap = {}
        filteredLeads.forEach(l => {
            if (l.assigned_agent_id && agentProfiles[l.assigned_agent_id]) {
                const p = agentProfiles[l.assigned_agent_id]
                const name = `${p.first_name} ${p.last_name}`.trim()
                if (!agentMap[l.assigned_agent_id]) agentMap[l.assigned_agent_id] = { name, id: l.assigned_agent_id, count: 0 }
                agentMap[l.assigned_agent_id].count++
            }
        })
        const leadsPerAgent = Object.values(agentMap)
            .sort((a, b) => b.count - a.count)

        // Report compliance (from shift_guard_leads — only source with report flags)
        const totalGL = filteredGuardLeads.length
        const rep2d = filteredGuardLeads.filter(g => g.report_2d_sent).length
        const rep15d = filteredGuardLeads.filter(g => g.report_15d_sent).length
        const rep30d = filteredGuardLeads.filter(g => g.report_30d_sent).length
        const rep2dPct = totalGL > 0 ? Math.round((rep2d / totalGL) * 100) : 0
        const rep15dPct = totalGL > 0 ? Math.round((rep15d / totalGL) * 100) : 0
        const rep30dPct = totalGL > 0 ? Math.round((rep30d / totalGL) * 100) : 0

        return {
            total, pending, assigned, assignmentRate,
            avgResponseTime, leadsPerAgent,
            rep2d, rep2dPct, rep15d, rep15dPct, rep30d, rep30dPct, totalGL
        }
    }, [filteredLeads, filteredGuardLeads, agentProfiles])

    // ─── Chart data ───
    const agentChartData = useMemo(() =>
        kpis.leadsPerAgent.slice(0, 10).map(a => ({ name: a.name.split(' ')[0], leads: a.count }))
    , [kpis])

    const reportChartData = useMemo(() => [
        { name: '48h', cumplido: kpis.rep2dPct, pendiente: 100 - kpis.rep2dPct },
        { name: '15d', cumplido: kpis.rep15dPct, pendiente: 100 - kpis.rep15dPct },
        { name: '30d', cumplido: kpis.rep30dPct, pendiente: 100 - kpis.rep30dPct },
    ], [kpis])

    const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6']

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-100 shadow-xl rounded-xl text-sm">
                    <p className="font-bold text-slate-800 mb-1">{label}</p>
                    {payload.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-500">{entry.name}:</span>
                            <span className="font-bold text-slate-700">{entry.value}{entry.name === 'cumplido' ? '%' : ''}</span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header with period filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Leads Derivados</h2>
                    <p className="text-sm text-slate-500">Seguimiento de leads web asignados a agentes</p>
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {PERIOD_OPTIONS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setActivePeriod(p.id)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                                activePeriod === p.id
                                    ? 'bg-white shadow-sm text-slate-900'
                                    : 'text-slate-500 hover:text-slate-700'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Metric Cards Row ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={Inbox} color="blue"
                    title="Leads Recibidos" value={kpis.total}
                    subtitle="Total en el período"
                />
                <MetricCard
                    icon={AlertCircle} color="amber"
                    title="Pendientes" value={kpis.pending}
                    subtitle="Sin asignar"
                    alert={kpis.pending > 5}
                />
                <MetricCard
                    icon={UserCheck} color="emerald"
                    title="Asignados" value={kpis.assigned}
                    subtitle={`${kpis.assignmentRate}% tasa de asignación`}
                />
                <MetricCard
                    icon={Clock} color="violet"
                    title="Tiempo Respuesta" value={formatDuration(kpis.avgResponseTime)}
                    subtitle="Promedio de asignación"
                    isText
                />
            </div>

            {/* ─── Charts Row ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Leads por Agente */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="flex items-center gap-2 mb-6">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-bold text-slate-900">Leads por Agente</h3>
                    </div>
                    {agentChartData.length > 0 ? (
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={agentChartData} layout="vertical" barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false}
                                        tick={{ fill: '#475569', fontSize: 13, fontWeight: 500 }} width={90} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="leads" name="Leads" fill="#3b82f6" radius={[0, 6, 6, 0]} maxBarSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
                            Sin datos de agentes para este período
                        </div>
                    )}
                </div>

                {/* Cumplimiento de Reportes */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="flex items-center gap-2 mb-6">
                        <FileCheck className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-lg font-bold text-slate-900">Cumplimiento de Reportes</h3>
                    </div>

                    <div className="space-y-5">
                        <ReportRow
                            label="Reporte 48h"
                            sent={kpis.rep2d}
                            total={kpis.totalGL}
                            pct={kpis.rep2dPct}
                            color="amber"
                        />
                        <ReportRow
                            label="Reporte 15 días"
                            sent={kpis.rep15d}
                            total={kpis.totalGL}
                            pct={kpis.rep15dPct}
                            color="blue"
                        />
                        <ReportRow
                            label="Reporte 30 días"
                            sent={kpis.rep30d}
                            total={kpis.totalGL}
                            pct={kpis.rep30dPct}
                            color="emerald"
                        />
                    </div>

                    {/* Agent breakdown table */}
                    {kpis.leadsPerAgent.length > 0 && (
                        <div className="mt-6 border-t border-slate-100 pt-4">
                            <h4 className="text-sm font-semibold text-slate-600 mb-3">Detalle por Agente</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-slate-400 uppercase tracking-wider">
                                            <th className="text-left pb-2 font-medium">Agente</th>
                                            <th className="text-center pb-2 font-medium">Leads</th>
                                            <th className="text-center pb-2 font-medium">48h</th>
                                            <th className="text-center pb-2 font-medium">15d</th>
                                            <th className="text-center pb-2 font-medium">30d</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kpis.leadsPerAgent.map((ag, i) => {
                                            // Get report compliance from shift_guard_leads for this agent
                                            const myGuardLeads = filteredGuardLeads.filter(g =>
                                                g.agent?.id === ag.id || g.agent_id === ag.id
                                            )
                                            const r2d = myGuardLeads.filter(g => g.report_2d_sent).length
                                            const r15d = myGuardLeads.filter(g => g.report_15d_sent).length
                                            const r30d = myGuardLeads.filter(g => g.report_30d_sent).length
                                            const glTotal = myGuardLeads.length
                                            return (
                                                <tr key={i} className="border-t border-slate-50">
                                                    <td className="py-2 font-medium text-slate-700">{ag.name}</td>
                                                    <td className="py-2 text-center">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                                            {ag.count}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-center">
                                                        <StatusDot done={r2d} total={glTotal} />
                                                    </td>
                                                    <td className="py-2 text-center">
                                                        <StatusDot done={r15d} total={glTotal} />
                                                    </td>
                                                    <td className="py-2 text-center">
                                                        <StatusDot done={r30d} total={glTotal} />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}


// ─── Sub-components ───

function MetricCard({ icon: Icon, color, title, value, subtitle, alert = false, isText = false }) {
    const colorMap = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
    }
    const c = colorMap[color] || colorMap.blue

    return (
        <div className={cn(
            'bg-white p-5 rounded-2xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100',
            'relative overflow-hidden group hover:shadow-md transition-shadow',
            alert && 'ring-2 ring-amber-200'
        )}>
            <div className="flex items-center gap-3 mb-3">
                <div className={cn('p-2 rounded-xl', c.bg, c.text)}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-slate-500">{title}</span>
            </div>
            <p className={cn(
                'font-bold text-slate-900',
                isText ? 'text-2xl' : 'text-3xl'
            )}>
                {value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
            <div className={cn('absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-20 blur-2xl pointer-events-none', c.bg)} />
        </div>
    )
}

function ReportRow({ label, sent, total, pct, color }) {
    const colorMap = {
        amber: 'bg-amber-500',
        blue: 'bg-blue-500',
        emerald: 'bg-emerald-500',
    }
    const pctColor = pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{sent}/{total}</span>
                    <span className={cn('text-sm font-bold', pctColor)}>{pct}%</span>
                </div>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all duration-700', colorMap[color] || 'bg-blue-500')}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

function StatusDot({ done, total }) {
    if (total === 0) return <span className="text-slate-300">—</span>
    const pct = Math.round((done / total) * 100)
    const color = pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-rose-400'

    return (
        <span className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            pct >= 100 ? 'text-emerald-700' : pct > 0 ? 'text-amber-700' : 'text-rose-600'
        )}>
            <span className={cn('w-2 h-2 rounded-full', color)} />
            {done}/{total}
        </span>
    )
}
