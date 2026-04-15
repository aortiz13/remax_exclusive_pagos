import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Target, TrendingUp, Lightbulb, Rocket, PieChart as PieChartIcon, Plus, Trash2, Save,
    ChevronDown, ChevronUp, Building2, Car, Crown, ArrowRight, Clock, Calendar,
    Users, DollarSign, Search, Megaphone, Eye, Heart, Activity, Zap,
    Calculator, Briefcase, Award, BarChart3
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
    ASSOCIATION_PLANS, getPlanPercentage, DEFAULT_INVESTMENTS, DEFAULT_CHANNELS,
    DEFAULT_ACTIVITIES, INVESTMENT_CATEGORIES, CHANNEL_CONFIG, fmtCLP, fmtNum
} from './businessPlanDefaults'
import { fetchUFValue } from '../../services/ufService'

const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981']

/* ── Tooltip helper: shows explanation after 1s hover ── */
const Tip = ({ children, text, className = '' }) => (
    <span className={`relative group/tip inline-flex items-baseline cursor-help ${className}`}>
        {children}
        <span className="pointer-events-none opacity-0 group-hover/tip:opacity-100 group-hover/tip:delay-1000 transition-opacity duration-200 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-[0.6rem] leading-relaxed font-normal normal-case tracking-normal whitespace-normal max-w-[220px] w-max shadow-xl before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-slate-900">
            {text}
        </span>
    </span>
)
const CHANNEL_ICONS = { Prospección: Search, Marketing: Megaphone, Seguimiento: Eye, Fidelización: Heart }
const CONFIG_TABS = [
    { key: 'investment', label: 'Inversión', icon: DollarSign },
    { key: 'operative', label: 'Operativo', icon: Calculator },
    { key: 'channels', label: 'Canales', icon: Calendar },
    { key: 'hours', label: 'Horas', icon: Clock },
]

export default function BusinessPlan({ agentId: externalAgentId, readOnly = false }) {
    const { user, profile } = useAuth()
    const targetAgentId = externalAgentId || user?.id
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [year, setYear] = useState(new Date().getFullYear())
    const [mode, setMode] = useState('kpis')
    const [configTab, setConfigTab] = useState('investment')

    const [plan, setPlan] = useState({
        mission: '', vision: '', mantra_text: '', monthly_goal: 0,
        remax_percentage: 9.5, seller_percentage: 95,
        office_participation: 60,
        avg_sale_value: 300000000, sale_commission: 2,
        avg_rental_value: 1200000, rental_commission: 50,
        work_days_per_week: 6, previous_year_billing: 0,
        daily_conversations: 10, weekly_seller_meetings: 2,
        weekly_buyer_meetings: 1, monthly_captures: 4, monthly_deals_in_process: 2
    })
    const [investments, setInvestments] = useState([])
    const [channels, setChannels] = useState([])
    const [activities, setActivities] = useState([])
    const [agentPlan, setAgentPlan] = useState('EJECUTIVO')
    const [kpiData, setKpiData] = useState({ billing: 0 })
    const [ticketData, setTicketData] = useState({ avgSaleReal: 0, avgRentalReal: 0, saleCount: 0, rentalCount: 0 })
    const [investExpanded, setInvestExpanded] = useState({})
    const [showStaticGoals, setShowStaticGoals] = useState(false)
    const toggleInvest = (cat) => setInvestExpanded(p => ({ ...p, [cat]: !p[cat] }))

    // ===== CALCULATIONS =====
    const annualGoal = useMemo(() => (Number(plan.monthly_goal) || 0) * 12, [plan.monthly_goal])
    const totalInvestment = useMemo(() => investments.reduce((s, i) => {
        const a = Number(i.amount) || 0; return s + (i.entry_type === 'monthly' ? a * 12 : a)
    }, 0), [investments])
    const planPct = useMemo(() => getPlanPercentage(agentPlan), [agentPlan])
    const remaxPct = useMemo(() => (Number(plan.remax_percentage) || 9.5) / 100, [plan.remax_percentage])
    const officePct = 1 - planPct
    const sellerPct = useMemo(() => (Number(plan.seller_percentage) || 95) / 100, [plan.seller_percentage])
    const landlordPct = useMemo(() => 1 - sellerPct, [sellerPct])
    const minBilling = useMemo(() => {
        const d = planPct * (1 - remaxPct); return d > 0 ? (annualGoal + totalInvestment) / d : 0
    }, [annualGoal, totalInvestment, planPct, remaxPct])
    const billingVend = useMemo(() => minBilling * sellerPct, [minBilling, sellerPct])
    const billingArr = useMemo(() => minBilling * landlordPct, [minBilling, landlordPct])
    const minTransSale = useMemo(() => {
        const d = (Number(plan.avg_sale_value) || 1) * ((Number(plan.sale_commission) || 1) / 100)
        return d > 0 ? Math.ceil(billingVend / d) : 0
    }, [billingVend, plan.avg_sale_value, plan.sale_commission])
    const minTransRental = useMemo(() => {
        const d = (Number(plan.avg_rental_value) || 1) * ((Number(plan.rental_commission) || 1) / 100)
        return d > 0 ? Math.ceil(billingArr / d) : 0
    }, [billingArr, plan.avg_rental_value, plan.rental_commission])
    const totalChH = useMemo(() => channels.reduce((s, c) => s + (Number(c.hours_per_week) || 0), 0), [channels])
    const totalActH = useMemo(() => activities.reduce((s, a) => s + (Number(a.hours_per_week) || 0), 0), [activities])
    const totalWeekH = totalChH + totalActH
    const minDailyH = useMemo(() => Math.ceil(totalWeekH / (Number(plan.work_days_per_week) || 6)), [totalWeekH, plan.work_days_per_week])
    const billingProg = minBilling > 0 ? Math.min((kpiData.billing / minBilling) * 100, 100) : 0
    const fmtPct = (pct) => {
        if (pct <= 0) return '0'
        if (pct < 1) return '< 1'
        if (pct < 10) return pct.toFixed(1)
        return pct.toFixed(0)
    }
    const planInfo = ASSOCIATION_PLANS.find(p => p.key === agentPlan) || ASSOCIATION_PLANS[1]
    const chartData = INVESTMENT_CATEGORIES.map(cat => ({
        name: cat.label, value: investments.filter(i => i.category === cat.key).reduce((s, i) => {
            const a = Number(i.amount) || 0; return s + (i.entry_type === 'monthly' ? a * 12 : a)
        }, 0)
    })).filter(d => d.value > 0)

    // ===== DATA FETCH =====
    useEffect(() => { if (targetAgentId) fetchData() }, [targetAgentId, year])
    const fetchData = async () => {
        setLoading(true)
        try {
            const { data: prof } = await supabase.from('profiles').select('association_plan').eq('id', targetAgentId).single()
            if (prof?.association_plan) setAgentPlan(prof.association_plan)
            const { data: pd, error: pe } = await supabase.from('business_plans').select('*').eq('agent_id', targetAgentId).eq('year', year).maybeSingle()
            if (pe) throw pe
            if (pd) {
                setPlan(pd)
                const [{ data: inv }, { data: ch }, { data: act }] = await Promise.all([
                    supabase.from('business_plan_investments').select('*').eq('plan_id', pd.id),
                    supabase.from('business_plan_channels').select('*').eq('plan_id', pd.id).order('position'),
                    supabase.from('business_plan_activities').select('*').eq('plan_id', pd.id).order('position'),
                ])
                setInvestments(inv?.length ? inv : DEFAULT_INVESTMENTS.map((d, i) => ({ ...d, id: `def-${i}`, isNew: true })))
                setChannels(ch?.length ? ch : DEFAULT_CHANNELS.map((d, i) => ({ ...d, id: `ch-${i}`, isNew: true })))
                setActivities(act?.length ? act : DEFAULT_ACTIVITIES.map((d, i) => ({ ...d, id: `act-${i}`, isNew: true })))
            } else {
                setPlan(p => ({ ...p, mission: '', vision: '', mantra_text: '', monthly_goal: 0 }))
                setInvestments(DEFAULT_INVESTMENTS.map((d, i) => ({ ...d, id: `def-${i}`, isNew: true })))
                setChannels(DEFAULT_CHANNELS.map((d, i) => ({ ...d, id: `ch-${i}`, isNew: true })))
                setActivities(DEFAULT_ACTIVITIES.map((d, i) => ({ ...d, id: `act-${i}`, isNew: true })))
            }
            const { data: kpi } = await supabase.rpc('get_kpi_summary', {
                target_agent_id: targetAgentId, start_date: `${year}-01-01`, end_date: `${year}-12-31`
            })
            if (kpi) setKpiData({ billing: kpi.billing_primary || 0 })

            // Fetch real ticket data from properties (infer operation from status when operation_type is null)
            const { data: allProps } = await supabase.from('properties')
                .select('price, operation_type, status, currency')
                .eq('agent_id', targetAgentId)
                .not('price', 'is', null)
                .gt('price', 0)

            // Get current UF value for conversion
            const ufResult = await fetchUFValue()
            const ufValue = ufResult ? ufResult.valor : 38500 // fallback

            const salePrices = [], rentalPrices = []
            const inactiveStatuses = ['retirada', 'vendida', 'arrendada', 'suspendida']

            for (const p of (allProps || [])) {
                let price = Number(p.price)
                if (price <= 0) continue

                // Exclude inactive properties from the projected business plan ticket
                if (Array.isArray(p.status)) {
                    const s = p.status.map(t => t.toLowerCase())
                    if (s.some(t => inactiveStatuses.includes(t))) continue
                }

                // Convert UF/CLF to CLP
                if (p.currency === 'UF' || p.currency === 'CLF') {
                    price = price * ufValue
                }

                let opType = p.operation_type
                if (!opType && Array.isArray(p.status)) {
                    const s = p.status.map(t => t.toLowerCase())
                    if (s.some(t => t.includes('venta'))) opType = 'venta'
                    else if (s.some(t => t.includes('arriendo'))) opType = 'arriendo'
                }
                
                if (opType === 'venta') salePrices.push(price)
                else if (opType === 'arriendo') rentalPrices.push(price)
            }
            setTicketData({
                avgSaleReal: salePrices.length > 0 ? salePrices.reduce((a, b) => a + b, 0) / salePrices.length : 0,
                avgRentalReal: rentalPrices.length > 0 ? rentalPrices.reduce((a, b) => a + b, 0) / rentalPrices.length : 0,
                saleCount: salePrices.length,
                rentalCount: rentalPrices.length,
            })
        } catch (e) { console.error(e); toast.error('Error al cargar plan') }
        finally { setLoading(false) }
    }

    // ===== SAVE =====
    const savePlan = async () => {
        setSaving(true)
        try {
            const payload = {
                agent_id: targetAgentId, year,
                mission: plan.mission, vision: plan.vision, mantra_text: plan.mantra_text,
                monthly_goal: Number(plan.monthly_goal) || 0, annual_goal: annualGoal,
                remax_percentage: Number(plan.remax_percentage), seller_percentage: Number(plan.seller_percentage),
                office_participation: Number(plan.office_participation) || 60,
                avg_sale_value: Number(plan.avg_sale_value), sale_commission: Number(plan.sale_commission),
                avg_rental_value: Number(plan.avg_rental_value), rental_commission: Number(plan.rental_commission),
                work_days_per_week: Number(plan.work_days_per_week), previous_year_billing: Number(plan.previous_year_billing),
                daily_conversations: Number(plan.daily_conversations), weekly_seller_meetings: Number(plan.weekly_seller_meetings),
                weekly_buyer_meetings: Number(plan.weekly_buyer_meetings), monthly_captures: Number(plan.monthly_captures),
                monthly_deals_in_process: Number(plan.monthly_deals_in_process),
                updated_at: new Date().toISOString(), ...(plan.id ? { id: plan.id } : {})
            }
            const { data: saved, error } = await supabase.from('business_plans').upsert(payload, { onConflict: 'agent_id, year' }).select().single()
            if (error) throw error
            await Promise.all([
                supabase.from('business_plan_investments').delete().eq('plan_id', saved.id),
                supabase.from('business_plan_channels').delete().eq('plan_id', saved.id),
                supabase.from('business_plan_activities').delete().eq('plan_id', saved.id),
            ])
            await Promise.all([
                investments.filter(i => i.subcategory).length && supabase.from('business_plan_investments').insert(
                    investments.filter(i => i.subcategory).map(i => ({ plan_id: saved.id, category: i.category, subcategory: i.subcategory, amount: Number(i.amount) || 0, is_custom: i.is_custom, entry_type: i.entry_type || 'annual' }))
                ),
                channels.filter(c => c.action_name).length && supabase.from('business_plan_channels').insert(
                    channels.filter(c => c.action_name).map(c => ({ plan_id: saved.id, channel: c.channel, action_name: c.action_name, hours_per_week: Number(c.hours_per_week) || 0, position: c.position }))
                ),
                activities.filter(a => a.activity_name).length && supabase.from('business_plan_activities').insert(
                    activities.filter(a => a.activity_name).map(a => ({ plan_id: saved.id, activity_name: a.activity_name, hours_per_week: Number(a.hours_per_week) || 0, position: a.position }))
                ),
            ])
            setPlan(saved); toast.success('Plan guardado'); fetchData()
        } catch (e) { console.error(e); toast.error('Error al guardar') }
        finally { setSaving(false) }
    }

    // ===== HANDLERS =====
    const hp = (e) => setPlan(p => ({ ...p, [e.target.name]: e.target.value }))
    const hInv = (id, f, v) => setInvestments(p => p.map(i => i.id === id ? { ...i, [f]: v } : i))
    const addInv = (cat) => setInvestments(p => [...p, { id: crypto.randomUUID(), category: cat, subcategory: '', amount: 0, is_custom: true, entry_type: 'annual', isNew: true }])
    const rmInv = (id) => setInvestments(p => p.filter(i => i.id !== id))
    const hCh = (id, f, v) => setChannels(p => p.map(c => c.id === id ? { ...c, [f]: v } : c))
    const addCh = (channel) => setChannels(p => [...p, { id: crypto.randomUUID(), channel, action_name: '', hours_per_week: 0, position: p.filter(c => c.channel === channel).length, isNew: true }])
    const rmCh = (id) => setChannels(p => p.filter(c => c.id !== id))
    const hAct = (id, f, v) => setActivities(p => p.map(a => a.id === id ? { ...a, [f]: v } : a))
    const addAct = () => setActivities(p => [...p, { id: crypto.randomUUID(), activity_name: '', hours_per_week: 0, position: p.length, isNew: true }])
    const rmAct = (id) => setActivities(p => p.filter(a => a.id !== id))

    if (loading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Cargando plan...</span>
            </div>
        </div>
    )

    // ===== RENDER FUNCTIONS FOR EACH TAB =====

    // Helper for progress ring SVG
    const ProgressRing = ({ pct, size = 80, stroke = 6, color = '#3b82f6' }) => {
        const r = (size - stroke) / 2, circ = 2 * Math.PI * r
        return (
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/10" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                    strokeDasharray={circ} strokeDashoffset={circ - (circ * Math.min(pct, 100) / 100)}
                    strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
        )
    }

    const renderSummary = () => {
        const projected = { sale: Number(plan.avg_sale_value) || 0, rental: Number(plan.avg_rental_value) || 0 }
        const real = { sale: ticketData.avgSaleReal, rental: ticketData.avgRentalReal }
        const salePct = projected.sale > 0 ? (real.sale / projected.sale) * 100 : 0
        const rentalPct = projected.rental > 0 ? (real.rental / projected.rental) * 100 : 0
        const saleDelta = real.sale - projected.sale
        const rentalDelta = real.rental - projected.rental
        const saleDeltaPct = projected.sale > 0 ? Math.abs(saleDelta / projected.sale * 100) : 0
        const rentalDeltaPct = projected.rental > 0 ? Math.abs(rentalDelta / projected.rental * 100) : 0
        const getColor = (pct) => Math.abs(100 - pct) <= 20 ? 'emerald' : Math.abs(100 - pct) <= 40 ? 'amber' : 'red'
        // showStaticGoals state is at component level

        // Billing breakdown by type (real accumulated)
        const realSaleBilling = ticketData.saleCount * (ticketData.avgSaleReal || 0) * ((Number(plan.sale_commission) || 2) / 100)
        const realRentalBilling = ticketData.rentalCount * (ticketData.avgRentalReal || 0) * ((Number(plan.rental_commission) || 50) / 100)

        return (
            <div className="p-4 md:p-5 space-y-5 overflow-y-auto h-full">

                {/* ═══════════════════════════════════════════════════════════════
                    3 CARDS — Facturación · Ventas · Arriendos
                   ═══════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                        {
                            title: `Facturación ${year}`,
                            icon: DollarSign,
                            iconBg: 'bg-blue-50',
                            iconColor: 'text-blue-500',
                            real: kpiData.billing,
                            goal: minBilling,
                            pct: billingProg,
                            barColor: 'bg-blue-400',
                            goalLabel: fmtCLP(minBilling),
                            tipReal: 'Facturación acumulada real del año, calculada desde propiedades cerradas del agente.',
                            tipGoal: 'Meta de facturación bruta anual: (meta mensual × 12 + inversiones) ÷ (% plan × (1 − % RE/MAX)).',
                            tipPct: 'Porcentaje de avance: facturación real ÷ meta proyectada × 100.',
                        },
                        {
                            title: 'Ventas',
                            icon: TrendingUp,
                            iconBg: 'bg-indigo-50',
                            iconColor: 'text-indigo-500',
                            real: realSaleBilling,
                            goal: billingVend,
                            pct: billingVend > 0 ? Math.min((realSaleBilling / billingVend) * 100, 100) : 0,
                            barColor: 'bg-indigo-400',
                            goalLabel: fmtCLP(billingVend),
                            transCount: ticketData.saleCount,
                            transGoal: minTransSale,
                            ringColor: '#6366f1',
                            tipReal: 'Comisión generada por ventas: transacciones cerradas × ticket promedio real × % comisión venta.',
                            tipGoal: 'Facturación requerida por ventas: meta total × porcentaje asignado a vendedores.',
                            tipPct: 'Avance de ventas: comisión real ÷ meta de ventas × 100.',
                            tipTrans: 'Transacciones de venta cerradas vs objetivo mínimo requerido.',
                        },
                        {
                            title: 'Arriendos',
                            icon: Building2,
                            iconBg: 'bg-violet-50',
                            iconColor: 'text-violet-500',
                            real: realRentalBilling,
                            goal: billingArr,
                            pct: billingArr > 0 ? Math.min((realRentalBilling / billingArr) * 100, 100) : 0,
                            barColor: 'bg-violet-400',
                            goalLabel: fmtCLP(billingArr),
                            transCount: ticketData.rentalCount,
                            transGoal: minTransRental,
                            ringColor: '#8b5cf6',
                            tipReal: 'Comisión generada por arriendos: transacciones cerradas × ticket promedio real × % comisión arriendo.',
                            tipGoal: 'Facturación requerida por arriendos: meta total × porcentaje asignado a arrendadores.',
                            tipPct: 'Avance de arriendos: comisión real ÷ meta de arriendos × 100.',
                            tipTrans: 'Transacciones de arriendo cerradas vs objetivo mínimo requerido.',
                        },
                    ].map((card, i) => {
                        const Icon = card.icon
                        const transPct = card.transGoal > 0 ? Math.min((card.transCount / card.transGoal) * 100, 100) : 0
                        const ringSize = 36
                        const ringStroke = 3
                        const ringRadius = (ringSize - ringStroke) / 2
                        const ringCircumference = 2 * Math.PI * ringRadius
                        const ringOffset = ringCircumference - (transPct / 100) * ringCircumference
                        return (
                            <div key={i} className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-100/80 transition-all duration-300">
                                {/* ── Header: Icon + Title + Transaction Ring ── */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <Tip text={card.tipPct}>
                                            <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                                                <Icon className={`w-5 h-5 ${card.iconColor}`} strokeWidth={1.8} />
                                            </div>
                                        </Tip>
                                        <h5 className="text-[0.85rem] font-semibold text-slate-700 tracking-tight">{card.title}</h5>
                                    </div>
                                    {/* Mini transaction ring (only for Ventas & Arriendos) */}
                                    {card.transGoal != null && (
                                        <Tip text={card.tipTrans}>
                                            <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
                                                <svg width={ringSize} height={ringSize} className="-rotate-90">
                                                    <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                                                        fill="none" stroke="#e2e8f0" strokeWidth={ringStroke} />
                                                    <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                                                        fill="none" stroke={card.ringColor} strokeWidth={ringStroke}
                                                        strokeLinecap="round"
                                                        strokeDasharray={ringCircumference}
                                                        strokeDashoffset={ringOffset}
                                                        className="transition-all duration-1000 ease-out" />
                                                </svg>
                                                <span className="absolute text-[8px] font-bold text-slate-600">{card.transCount}/{card.transGoal}</span>
                                            </div>
                                        </Tip>
                                    )}
                                </div>

                                {/* ── Big number + /goal ── */}
                                <div className="flex items-baseline gap-2 mb-5">
                                    <Tip text={card.tipReal}>
                                        <span className="text-[1.75rem] font-bold text-slate-900 leading-none tracking-tight">{fmtCLP(card.real)}</span>
                                    </Tip>
                                    <Tip text={card.tipGoal}>
                                        <span className="text-sm text-slate-400 font-normal">/ {card.goalLabel}</span>
                                    </Tip>
                                </div>

                                {/* ── Progress bar ── */}
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${card.barColor}`}
                                        style={{ width: `${Math.min(card.pct, 100)}%` }} />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* SECTION 3: Ticket Promedio — Proyectado vs Real */}
                <div>
                    <h4 className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" /> Ticket Promedio — Proyectado vs Real
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {[
                            {
                                title: 'Venta',
                                icon: TrendingUp,
                                iconBg: 'bg-indigo-50',
                                iconColor: 'text-indigo-500',
                                projected: projected.sale,
                                realVal: real.sale,
                                pct: salePct,
                                count: ticketData.saleCount,
                                delta: saleDelta,
                                deltaPct: saleDeltaPct,
                                barColor: 'bg-indigo-400',
                                tipProjected: 'Ticket promedio proyectado: meta facturación ventas ÷ meta mín. transacciones de venta.',
                                tipReal: 'Ticket promedio real de venta: facturación real de ventas ÷ propiedades vendidas.',
                                tipDelta: 'Diferencia absoluta y porcentual entre ticket real y proyectado.',
                                tipCount: 'N° de propiedades vendidas cerradas en el período.',
                            },
                            {
                                title: 'Arriendo',
                                icon: Building2,
                                iconBg: 'bg-violet-50',
                                iconColor: 'text-violet-500',
                                projected: projected.rental,
                                realVal: real.rental,
                                pct: rentalPct,
                                count: ticketData.rentalCount,
                                delta: rentalDelta,
                                deltaPct: rentalDeltaPct,
                                barColor: 'bg-violet-400',
                                tipProjected: 'Ticket promedio proyectado: meta facturación arriendos ÷ meta mín. transacciones de arriendo.',
                                tipReal: 'Ticket promedio real de arriendo: facturación real de arriendos ÷ propiedades arrendadas.',
                                tipDelta: 'Diferencia absoluta y porcentual entre ticket real y proyectado.',
                                tipCount: 'N° de propiedades arrendadas cerradas en el período.',
                            },
                        ].map((t, i) => {
                            const Icon = t.icon
                            return (
                                <div key={i} className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-100/80 transition-all duration-300">
                                    {/* ── Icon + Title + Pct badge ── */}
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl ${t.iconBg} flex items-center justify-center`}>
                                                <Icon className={`w-5 h-5 ${t.iconColor}`} strokeWidth={1.8} />
                                            </div>
                                            <h5 className="text-[0.85rem] font-semibold text-slate-700 tracking-tight">{t.title}</h5>
                                        </div>
                                        {t.realVal > 0 && (
                                            <Tip text={t.tipDelta}>
                                                <span className={`text-[0.65rem] font-bold px-2.5 py-1 rounded-lg border ${
                                                    t.pct >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                                                    : t.pct >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200'
                                                    : 'text-red-600 bg-red-50 border-red-200'
                                                }`}>{t.pct.toFixed(0)}%</span>
                                            </Tip>
                                        )}
                                    </div>

                                    {/* ── Projected + Real side by side ── */}
                                    <div className="grid grid-cols-2 gap-4 mb-5">
                                        <div>
                                            <p className="text-[0.6rem] text-slate-400 uppercase font-medium tracking-wide mb-1">Proyectado</p>
                                            <Tip text={t.tipProjected}>
                                                <p className="text-lg font-bold text-slate-900 tracking-tight">{fmtCLP(t.projected)}</p>
                                            </Tip>
                                        </div>
                                        <div>
                                            <p className="text-[0.6rem] text-slate-400 uppercase font-medium tracking-wide mb-1">Real</p>
                                            <Tip text={t.tipReal}>
                                                <p className={`text-lg font-bold tracking-tight ${t.realVal > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                                                    {t.realVal > 0 ? fmtCLP(t.realVal) : 'Sin datos'}
                                                </p>
                                            </Tip>
                                        </div>
                                    </div>

                                    {/* ── Progress bar ── */}
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3">
                                        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${t.barColor}`}
                                            style={{ width: `${Math.min(t.pct, 100)}%` }} />
                                    </div>

                                    {/* ── Footer: count + delta ── */}
                                    <div className="flex items-center justify-between">
                                        <Tip text={t.tipCount}>
                                            <span className="text-[0.6rem] text-slate-400">{t.count} propiedad{t.count !== 1 ? 'es' : ''}</span>
                                        </Tip>
                                        {t.realVal > 0 && (
                                            <Tip text={t.tipDelta}>
                                                <span className={`text-[0.6rem] font-semibold ${t.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    Δ {t.delta >= 0 ? '+' : ''}{fmtCLP(t.delta)} ({t.deltaPct.toFixed(0)}%)
                                                </span>
                                            </Tip>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* SECTION 4: Activity Objectives */}
                <div>
                    <h4 className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> Objetivos de Actividad
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[
                            { label: 'Conversaciones/día', target: plan.daily_conversations, icon: Users, color: 'blue', tip: 'N° de contactos diarios que el agente debe generar según su plan.' },
                            { label: 'Reuniones vend./sem', target: plan.weekly_seller_meetings, icon: Briefcase, color: 'emerald', tip: 'Reuniones semanales con vendedores para captar propiedades.' },
                            { label: 'Reuniones comp./sem', target: plan.weekly_buyer_meetings, icon: Users, color: 'purple', tip: 'Reuniones semanales con compradores interesados.' },
                            { label: 'Captaciones/mes', target: plan.monthly_captures, icon: Target, color: 'amber', tip: 'Propiedades nuevas que el agente debe captar al mes.' },
                            { label: 'Negocios proc./mes', target: plan.monthly_deals_in_process, icon: Activity, color: 'red', tip: 'Negocios activos en proceso de cierre al mes.' },
                        ].map((o, i) => (
                            <div key={i} className={`p-3 rounded-xl border border-${o.color}-100 bg-${o.color}-50/20`}>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <o.icon className={`w-3 h-3 text-${o.color}-500`} />
                                    <label className="text-[0.5rem] font-bold text-gray-500 uppercase leading-tight">{o.label}</label>
                                </div>
                                <Tip text={o.tip}><p className={`text-xl font-bold text-${o.color}-700 font-mono`}>{o.target}</p></Tip>
                                <p className="text-[0.5rem] text-gray-400 mt-0.5">Meta establecida</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SECTION 5: Hours Strip */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-[0.6rem] font-bold text-blue-600 uppercase">Canales</span>
                                <Tip text="Horas semanales dedicadas a canales: prospección, marketing, seguimiento, fidelización."><span className="text-sm font-bold text-blue-700">{totalChH}h</span></Tip>
                            </div>
                            <ArrowRight className="w-3 h-3 text-blue-300" />
                            <div>
                                <span className="text-[0.6rem] font-bold text-indigo-600 uppercase">Otras </span>
                                <Tip text="Horas semanales en actividades complementarias: formación, admin, networking, etc."><span className="text-sm font-bold text-indigo-700">{totalActH}h</span></Tip>
                            </div>
                            <ArrowRight className="w-3 h-3 text-blue-300" />
                            <div>
                                <span className="text-[0.6rem] font-bold text-purple-600 uppercase">Total </span>
                                <Tip text="Total semanal: horas canales + horas otras actividades."><span className="text-sm font-bold text-purple-700">{totalWeekH}h/sem</span></Tip>
                            </div>
                        </div>
                        <div className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-blue-100 text-center">
                            <p className="text-[0.5rem] font-bold text-gray-400 uppercase">Mín/día</p>
                            <Tip text="Mínimo de horas diarias de trabajo: total semanal ÷ 5 días laborables."><p className="text-lg font-bold text-gray-900">{minDailyH}<span className="text-xs text-gray-400 ml-0.5">h</span></p></Tip>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    SECTION 6: Metas Estáticas (Collapsed by default)
                   ═══════════════════════════════════════════════════════════════ */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setShowStaticGoals(prev => !prev)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-gray-200/60">
                                <Briefcase className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Configuración Base del Plan</span>
                            <span className="text-[0.55rem] text-gray-400 font-medium">(meta anual · mensual · inversión)</span>
                        </div>
                        {showStaticGoals ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {showStaticGoals && (
                        <div className="p-4 bg-white border-t border-gray-100">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                    <label className="text-[0.5rem] font-bold text-emerald-500 uppercase block mb-1">Meta Anual Utilidades</label>
                                    <Tip text="Ingreso neto que el agente quiere obtener al año: meta mensual × 12."><p className="text-sm font-bold text-emerald-700 font-mono">{fmtCLP(annualGoal)}</p></Tip>
                                </div>
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                                    <label className="text-[0.5rem] font-bold text-blue-500 uppercase block mb-1">Meta Mensual</label>
                                    <Tip text="Ingreso mensual objetivo definido por el agente en su plan de negocio."><p className="text-sm font-bold text-blue-700 font-mono">{fmtCLP(plan.monthly_goal)}</p></Tip>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                                    <label className="text-[0.5rem] font-bold text-amber-500 uppercase block mb-1">Inversión Anual</label>
                                    <Tip text="Suma anual de todas las inversiones (oficina, marketing, formación, transporte). Ítems mensuales × 12."><p className="text-sm font-bold text-amber-700 font-mono">{fmtCLP(totalInvestment)}</p></Tip>
                                </div>
                                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                                    <label className="text-[0.5rem] font-bold text-purple-500 uppercase block mb-1">Plan de Asociación</label>
                                    <Tip text="Plan de asociación RE/MAX: define el % de comisión que retiene el agente vs la oficina."><p className="text-sm font-bold text-purple-700">{planInfo.label} ({planInfo.pct}%)</p></Tip>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        )
    }

    const renderInvestment = () => (
        <div className="flex flex-col md:flex-row h-full">
            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                {INVESTMENT_CATEGORIES.map(cat => {
                    const items = investments.filter(i => i.category === cat.key)
                    const catTotal = items.reduce((s, i) => s + ((Number(i.amount) || 0) * (i.entry_type === 'monthly' ? 12 : 1)), 0)
                    const isOpen = investExpanded[cat.key]
                    return (
                        <div key={cat.key} className={`border rounded-xl overflow-hidden transition-all ${isOpen ? 'border-gray-200 shadow-sm' : 'border-gray-100'}`}>
                            <button onClick={() => toggleInvest(cat.key)} className={`w-full flex items-center justify-between p-3 ${isOpen ? 'bg-gray-50' : ''}`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-lg bg-${cat.color}-50 text-${cat.color}-600`}>
                                        {cat.icon === 'Building2' && <Building2 className="w-3.5 h-3.5" />}
                                        {cat.icon === 'Target' && <Target className="w-3.5 h-3.5" />}
                                        {cat.icon === 'Lightbulb' && <Lightbulb className="w-3.5 h-3.5" />}
                                        {cat.icon === 'Car' && <Car className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className="font-semibold text-gray-700 text-sm">{cat.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-800 font-mono">{fmtCLP(catTotal)}</span>
                                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </div>
                            </button>
                            {isOpen && (
                                <div className="border-t border-gray-100 bg-white p-3 space-y-2">
                                    {items.map(item => (
                                        <div key={item.id} className="flex gap-2 items-center group">
                                            <input value={item.subcategory} onChange={e => hInv(item.id, 'subcategory', e.target.value)} disabled={readOnly || !item.is_custom}
                                                className={`flex-1 py-1 px-2 rounded text-xs ${item.is_custom && !readOnly ? 'border border-gray-200' : 'border-0 bg-transparent font-medium text-gray-600'} focus:ring-0`} placeholder="Ítem" />
                                            {readOnly ? (
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${item.entry_type === 'monthly' ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'}`}>
                                                    {item.entry_type === 'monthly' ? 'Mensual' : 'Anual'}
                                                </span>
                                            ) : (
                                                <button onClick={() => hInv(item.id, 'entry_type', item.entry_type === 'monthly' ? 'annual' : 'monthly')}
                                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 cursor-pointer hover:opacity-80 transition-all ${item.entry_type === 'monthly' ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'}`}>
                                                    {item.entry_type === 'monthly' ? 'Mensual' : 'Anual'}
                                                </button>
                                            )}
                                            <div className="relative w-20 shrink-0">
                                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-300 text-[0.55rem]">$</span>
                                                <input type="number" value={item.amount} onChange={e => hInv(item.id, 'amount', e.target.value)} disabled={readOnly}
                                                    className={`w-full py-1 pl-3.5 pr-1 rounded border border-gray-100 text-right font-medium text-xs text-gray-800 font-mono focus:ring-0 ${readOnly ? 'bg-transparent' : ''}`} />
                                            </div>
                                            {item.entry_type === 'monthly' && Number(item.amount) > 0 && (
                                                <span className="text-[9px] text-blue-500 font-bold shrink-0 whitespace-nowrap">= {fmtCLP(Number(item.amount) * 12)}/año</span>
                                            )}
                                            {item.is_custom && !readOnly && (
                                                <button onClick={() => rmInv(item.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                                            )}
                                        </div>
                                    ))}
                                    {!readOnly && (
                                        <button onClick={() => addInv(cat.key)} className="text-[0.65rem] text-gray-500 font-medium px-2 py-1 rounded flex items-center gap-1 w-full justify-center border border-dashed border-gray-200 hover:bg-gray-50 mt-1">
                                            <Plus className="w-3 h-3" /> Agregar
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
                {/* Total */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-700 uppercase">Inversión Total Anual</span>
                    <span className="text-lg font-bold text-amber-800 font-mono">{fmtCLP(totalInvestment)}</span>
                </div>
            </div>
            {/* Chart sidebar */}
            <div className="w-full md:w-[220px] p-4 bg-slate-50/50 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col items-center justify-center shrink-0">
                {totalInvestment > 0 ? (<>
                    <div className="w-36 h-36 relative">
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[0.5rem] text-gray-400 font-bold">TOTAL</span>
                            <span className="text-sm font-bold text-gray-800">{fmtCLP(totalInvestment)}</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                            <PieChart><Pie data={chartData} innerRadius={45} outerRadius={58} paddingAngle={4} dataKey="value" stroke="none" cornerRadius={4}>
                                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie><Tooltip formatter={v => fmtCLP(v)} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '10px', padding: '4px 8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} /></PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-0.5 w-full mt-1">
                        {chartData.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-[0.6rem] px-1">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} /><span className="text-gray-500">{d.name}</span></div>
                                <span className="font-bold text-gray-700">{Math.round((d.value / totalInvestment) * 100)}%</span>
                            </div>
                        ))}
                    </div>
                </>) : (
                    <div className="text-center text-gray-400"><PieChartIcon className="w-8 h-8 opacity-20 mx-auto mb-1" /><p className="text-xs">Sin datos</p></div>
                )}
            </div>
        </div>
    )

    const renderOperative = () => (
        <div className="p-4 space-y-4 overflow-y-auto h-full">
            {/* 1. Resumen Estructura Financiera */}
            <div>
                <h4 className="text-[0.6rem] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Briefcase className="w-3 h-3" /> Resumen de la Estructura Financiera
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <label className="text-[0.5rem] font-bold text-emerald-500 uppercase block mb-1">1. Meta de Utilidades Anuales</label>
                        <p className="text-sm font-bold text-emerald-700 font-mono">{fmtCLP(annualGoal)}</p>
                        <p className="text-[0.5rem] text-emerald-400 mt-0.5">Meta mensual × 12</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <label className="text-[0.5rem] font-bold text-amber-500 uppercase block mb-1">2. Inversión Anual del Negocio</label>
                        <p className="text-sm font-bold text-amber-700 font-mono">{fmtCLP(totalInvestment)}</p>
                        <p className="text-[0.5rem] text-amber-400 mt-0.5">Desde pestaña Inversión</p>
                    </div>
                </div>
            </div>

            {/* 2. Parámetros del negocio */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                    { label: '% de RE/MAX Chile', val: '9.5%', ro: true },
                    { label: 'Plan de Asociación', val: `${planInfo.label} (${planInfo.pct}%)`, ro: true, note: 'Admin' },
                    { label: 'Participación oficina en el negocio', val: `${Math.round((1 - planPct) * 100)}%`, ro: true },
                ].map((p, i) => (
                    <div key={i} className={`p-2.5 rounded-lg border ${p.ro ? 'bg-gray-50 border-gray-100' : 'border-gray-200 hover:border-blue-200'} transition-colors`}>
                        <label className="text-[0.55rem] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">{p.label}</label>
                        {p.ro ? (
                            <div><p className="text-xs font-bold text-gray-700">{p.val}</p>
                                {p.note && <p className="text-[0.5rem] text-gray-400 flex items-center gap-0.5"><Crown className="w-2 h-2" />{p.note}</p>}
                            </div>
                        ) : (
                            <div className="flex items-center gap-0.5">
                                {p.prefix && <span className="text-gray-300 text-[0.6rem]">{p.prefix}</span>}
                                <input type="number" name={p.name} value={p.val || ''} onChange={hp} className="flex-1 text-xs font-bold text-gray-900 border-none p-0 focus:ring-0 bg-transparent w-full" />
                                {p.suffix && <span className="text-gray-400 text-[0.6rem]">{p.suffix}</span>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 3. Facturación Bruta - Prominent */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/20"><DollarSign className="w-4 h-4 text-blue-300" /></div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">3. La Facturación Bruta de mi negocio debe ser como mínimo:</h4>
                </div>
                <p className="text-2xl font-bold text-white font-mono mb-1">{fmtCLP(minBilling)}</p>
                <p className="text-[0.55rem] text-slate-400">
                    Fórmula: (Meta Utilidad Anual + Inversión Anual) / % Plan Asociación / (1 − % RE/MAX Chile)
                </p>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
                    <span className="text-[0.55rem] text-slate-400 italic">Referencia: La facturación de mi negocio el {year - 1} fue</span>
                    <div className="flex items-center gap-0.5 bg-white/10 rounded px-2 py-1">
                        <span className="text-slate-400 text-[0.6rem]">$</span>
                        <input type="number" name="previous_year_billing" value={plan.previous_year_billing || ''} onChange={hp} disabled={readOnly}
                            className="text-xs font-bold text-white border-none p-0 focus:ring-0 bg-transparent w-24" placeholder="0" />
                    </div>
                </div>
            </div>

            {/* 4. Distribución tipos de cliente */}
            <div>
                <h4 className="text-[0.6rem] font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">Distribución Tipos de Cliente</h4>
                <div className="grid grid-cols-2 gap-2.5 mb-2">
                    <div className="p-2.5 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors">
                        <label className="text-[0.55rem] font-bold text-gray-400 uppercase block mb-0.5">% Vendedores</label>
                        <div className="flex items-center gap-0.5">
                            <input type="number" name="seller_percentage" value={plan.seller_percentage || ''} onChange={hp} disabled={readOnly}
                                className="flex-1 text-xs font-bold text-gray-900 border-none p-0 focus:ring-0 bg-transparent w-full" />
                            <span className="text-gray-400 text-[0.6rem]">%</span>
                        </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                        <label className="text-[0.55rem] font-bold text-gray-400 uppercase block mb-0.5">% Arrendadores</label>
                        <p className="text-xs font-bold text-gray-700">{(100 - Number(plan.seller_percentage || 95)).toFixed(1)}%</p>
                    </div>
                </div>

                {/* Side-by-side Vendedores / Arrendadores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Vendedores */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 space-y-2">
                        <h5 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" /> Vendedores ({(sellerPct * 100).toFixed(0)}%)
                        </h5>
                        <div className="p-2 rounded-lg bg-white border border-emerald-100">
                            <label className="text-[0.5rem] font-bold text-emerald-500 uppercase block">Facturación neta requerida</label>
                            <p className="text-sm font-bold text-emerald-700 font-mono">{fmtCLP(billingVend)}</p>
                        </div>
                        <div className="p-2 rounded-lg border border-gray-200 bg-white">
                            <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-0.5">Valor prom. propiedades en zona</label>
                            <div className="flex items-center gap-0.5">
                                <span className="text-gray-300 text-[0.6rem]">$</span>
                                <input type="number" name="avg_sale_value" value={plan.avg_sale_value || ''} onChange={hp} disabled={readOnly}
                                    className="flex-1 text-xs font-bold text-gray-900 border-none p-0 focus:ring-0 bg-transparent w-full" />
                            </div>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                            <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-0.5">% Comisión promedio</label>
                            <p className="text-xs font-bold text-gray-700">2%</p>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-200">
                            <label className="text-[0.5rem] font-bold text-emerald-600 uppercase block">Nº transacciones (puntas) mínimas al año</label>
                            <p className="text-lg font-bold text-emerald-800 font-mono">{fmtNum(minTransSale)}</p>
                        </div>
                    </div>

                    {/* Arrendadores */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3 space-y-2">
                        <h5 className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" /> Arrendadores ({(landlordPct * 100).toFixed(0)}%)
                        </h5>
                        <div className="p-2 rounded-lg bg-white border border-amber-100">
                            <label className="text-[0.5rem] font-bold text-amber-500 uppercase block">Facturación neta requerida</label>
                            <p className="text-sm font-bold text-amber-700 font-mono">{fmtCLP(billingArr)}</p>
                        </div>
                        <div className="p-2 rounded-lg border border-gray-200 bg-white">
                            <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-0.5">Valor prom. propiedades en zona</label>
                            <div className="flex items-center gap-0.5">
                                <span className="text-gray-300 text-[0.6rem]">$</span>
                                <input type="number" name="avg_rental_value" value={plan.avg_rental_value || ''} onChange={hp} disabled={readOnly}
                                    className="flex-1 text-xs font-bold text-gray-900 border-none p-0 focus:ring-0 bg-transparent w-full" />
                            </div>
                        </div>
                        <div className="p-2 rounded-lg border border-gray-200 bg-white">
                            <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-0.5">% Comisión promedio</label>
                            <div className="flex items-center gap-0.5">
                                <input type="number" name="rental_commission" value={plan.rental_commission || ''} onChange={hp} disabled={readOnly}
                                    className="flex-1 text-xs font-bold text-gray-900 border-none p-0 focus:ring-0 bg-transparent w-full" />
                                <span className="text-gray-400 text-[0.6rem]">%</span>
                            </div>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-100 border border-amber-200">
                            <label className="text-[0.5rem] font-bold text-amber-600 uppercase block">Nº transacciones (puntas) mínimas al año</label>
                            <p className="text-lg font-bold text-amber-800 font-mono">{fmtNum(minTransRental)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4b. Ticket Promedio — Proyectado vs Real */}
            <div>
                <h4 className="text-[0.6rem] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BarChart3 className="w-3 h-3" /> Ticket Promedio — Proyectado vs Real
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Venta */}
                    {(() => {
                        const projected = Number(plan.avg_sale_value) || 0
                        const real = ticketData.avgSaleReal
                        const pct = projected > 0 ? Math.min((real / projected) * 100, 150) : 0
                        const delta = real - projected
                        const deltaPct = projected > 0 ? Math.abs(((real - projected) / projected) * 100) : 0
                        const barColor = deltaPct <= 20 ? 'emerald' : deltaPct <= 40 ? 'amber' : 'red'
                        return (
                            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5" /> Venta
                                    </h5>
                                    <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-${barColor}-100 text-${barColor}-700`}>
                                        {pct.toFixed(0)}% del objetivo
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2.5 rounded-lg bg-white border border-emerald-100 shadow-sm">
                                        <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-1">Proyectado</label>
                                        <p className="text-sm font-bold text-gray-800 font-mono">{fmtCLP(projected)}</p>
                                    </div>
                                    <div className={`p-2.5 rounded-lg border shadow-sm ${real > 0 ? `bg-${barColor}-50 border-${barColor}-200` : 'bg-gray-50 border-gray-200'}`}>
                                        <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-1">Real</label>
                                        <p className={`text-sm font-bold font-mono ${real > 0 ? `text-${barColor}-700` : 'text-gray-400'}`}>
                                            {real > 0 ? fmtCLP(real) : 'Sin datos'}
                                        </p>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div>
                                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 bg-${barColor}-500`}
                                            style={{ width: `${Math.min(pct, 100)}%` }} />
                                    </div>
                                    <div className="flex justify-between mt-1.5">
                                        <span className="text-[0.55rem] text-gray-400">
                                            {ticketData.saleCount > 0
                                                ? `Basado en ${ticketData.saleCount} propiedad${ticketData.saleCount > 1 ? 'es' : ''}`
                                                : 'Sin propiedades captadas'}
                                        </span>
                                        {real > 0 && (
                                            <span className={`text-[0.55rem] font-bold text-${barColor}-600`}>
                                                Δ {delta >= 0 ? '+' : ''}{fmtCLP(delta)} ({deltaPct.toFixed(0)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {/* Arriendo */}
                    {(() => {
                        const projected = Number(plan.avg_rental_value) || 0
                        const real = ticketData.avgRentalReal
                        const pct = projected > 0 ? Math.min((real / projected) * 100, 150) : 0
                        const delta = real - projected
                        const deltaPct = projected > 0 ? Math.abs(((real - projected) / projected) * 100) : 0
                        const barColor = deltaPct <= 20 ? 'emerald' : deltaPct <= 40 ? 'amber' : 'red'
                        return (
                            <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5" /> Arriendo
                                    </h5>
                                    <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-${barColor}-100 text-${barColor}-700`}>
                                        {pct.toFixed(0)}% del objetivo
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2.5 rounded-lg bg-white border border-amber-100 shadow-sm">
                                        <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-1">Proyectado</label>
                                        <p className="text-sm font-bold text-gray-800 font-mono">{fmtCLP(projected)}</p>
                                    </div>
                                    <div className={`p-2.5 rounded-lg border shadow-sm ${real > 0 ? `bg-${barColor}-50 border-${barColor}-200` : 'bg-gray-50 border-gray-200'}`}>
                                        <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-1">Real</label>
                                        <p className={`text-sm font-bold font-mono ${real > 0 ? `text-${barColor}-700` : 'text-gray-400'}`}>
                                            {real > 0 ? fmtCLP(real) : 'Sin datos'}
                                        </p>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div>
                                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 bg-${barColor}-500`}
                                            style={{ width: `${Math.min(pct, 100)}%` }} />
                                    </div>
                                    <div className="flex justify-between mt-1.5">
                                        <span className="text-[0.55rem] text-gray-400">
                                            {ticketData.rentalCount > 0
                                                ? `Basado en ${ticketData.rentalCount} propiedad${ticketData.rentalCount > 1 ? 'es' : ''}`
                                                : 'Sin propiedades captadas'}
                                        </span>
                                        {real > 0 && (
                                            <span className={`text-[0.55rem] font-bold text-${barColor}-600`}>
                                                Δ {delta >= 0 ? '+' : ''}{fmtCLP(delta)} ({deltaPct.toFixed(0)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            </div>

            {/* 5. Parámetros operativos adicionales */}
            <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg border border-gray-200">
                    <label className="text-[0.55rem] font-bold text-gray-400 uppercase block mb-0.5">Días trabajo/semana</label>
                    <input type="number" name="work_days_per_week" value={plan.work_days_per_week || ''} onChange={hp} disabled={readOnly} className="text-xs font-bold text-gray-900 border-none p-0 focus:ring-0 bg-transparent w-full" />
                </div>
            </div>

            {/* Activity objectives */}
            <div>
                <h4 className="text-[0.6rem] font-bold text-gray-500 uppercase tracking-wider mb-2">Objetivos Mínimos de Actividad</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {[
                        { label: 'Conversaciones/día', name: 'daily_conversations', icon: Users },
                        { label: 'Reuniones vend./sem', name: 'weekly_seller_meetings', icon: Briefcase },
                        { label: 'Reuniones comp./sem', name: 'weekly_buyer_meetings', icon: Users },
                        { label: 'Captaciones/mes', name: 'monthly_captures', icon: Target },
                        { label: 'Negocios proc./mes', name: 'monthly_deals_in_process', icon: Activity },
                    ].map(o => (
                        <div key={o.name} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                            <label className="text-[0.5rem] font-bold text-gray-400 uppercase block mb-1 leading-tight">{o.label}</label>
                            <p className="text-base font-bold text-gray-700">{plan[o.name]}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    const renderChannels = () => (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto h-full">
            {CHANNEL_CONFIG.map(ch => {
                const ChIcon = CHANNEL_ICONS[ch.key]
                const items = channels.filter(c => c.channel === ch.key)
                const chTotal = items.reduce((s, c) => s + (Number(c.hours_per_week) || 0), 0)
                return (
                    <div key={ch.key} className={`rounded-xl border border-${ch.color}-100 bg-${ch.color}-50/20 p-3`}>
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-1.5"><ChIcon className={`w-3.5 h-3.5 text-${ch.color}-600`} /><span className="font-bold text-xs text-gray-800">{ch.key}</span></div>
                            <span className={`text-[0.6rem] font-bold text-${ch.color}-600 bg-${ch.color}-100 px-2 py-0.5 rounded-full`}>{chTotal}h</span>
                        </div>
                        <div className="space-y-1.5">
                            {items.map(item => (
                                <div key={item.id} className="flex items-center gap-1.5 group">
                                    <input value={item.action_name} onChange={e => hCh(item.id, 'action_name', e.target.value)} disabled={readOnly}
                                        className={`flex-1 text-[0.7rem] py-1 px-2 rounded border border-gray-200 focus:border-blue-400 bg-white focus:ring-0 ${readOnly ? 'bg-transparent' : ''}`} placeholder="Acción..." />
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        <input type="number" value={item.hours_per_week} onChange={e => hCh(item.id, 'hours_per_week', e.target.value)} disabled={readOnly}
                                            className={`w-9 text-[0.7rem] py-1 px-0.5 rounded border border-gray-200 text-center font-bold focus:ring-0 ${readOnly ? 'bg-transparent' : ''}`} />
                                        <span className="text-[0.55rem] text-gray-400">h</span>
                                    </div>
                                    {!readOnly && <button onClick={() => rmCh(item.id)} className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>}
                                </div>
                            ))}
                            {!readOnly && (
                                <button onClick={() => addCh(ch.key)} className="text-[0.6rem] text-gray-500 font-medium px-2 py-1 rounded flex items-center gap-1 w-full justify-center border border-dashed border-gray-200 hover:bg-gray-50 mt-1">
                                    <Plus className="w-3 h-3" /> Agregar
                                </button>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const renderHours = () => (
        <div className="p-4 space-y-3 overflow-y-auto h-full">
            <h4 className="text-[0.6rem] font-bold text-gray-500 uppercase tracking-wider">Otras Actividades No Agendables</h4>
            <div className="space-y-1.5">
                {activities.map(act => (
                    <div key={act.id} className="flex items-center gap-2 group">
                        <Activity className="w-3 h-3 text-gray-300 shrink-0" />
                        <input value={act.activity_name} onChange={e => hAct(act.id, 'activity_name', e.target.value)} disabled={readOnly}
                            className={`flex-1 text-xs py-1.5 px-2 rounded border border-gray-200 focus:border-blue-400 bg-white focus:ring-0 ${readOnly ? 'bg-transparent' : ''}`} placeholder="Actividad..." />
                        <div className="flex items-center gap-0.5 shrink-0">
                            <input type="number" value={act.hours_per_week} onChange={e => hAct(act.id, 'hours_per_week', e.target.value)} disabled={readOnly}
                                className={`w-11 text-xs py-1.5 px-1 rounded border border-gray-200 text-center font-bold focus:ring-0 ${readOnly ? 'bg-transparent' : ''}`} />
                            <span className="text-[0.55rem] text-gray-400">h</span>
                        </div>
                        {!readOnly && <button onClick={() => rmAct(act.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                ))}
                {!readOnly && (
                    <button onClick={addAct} className="text-[0.65rem] text-blue-600 font-medium px-2 py-1.5 rounded flex items-center gap-1 w-full justify-center border border-dashed border-blue-200 hover:bg-blue-50">
                        <Plus className="w-3 h-3" /> Agregar actividad
                    </button>
                )}
            </div>
            {/* Summary */}
            <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div><p className="text-[0.55rem] font-bold text-blue-500 uppercase">Canales</p><p className="text-lg font-bold text-blue-700">{totalChH}h</p></div>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-300" />
                        <div><p className="text-[0.55rem] font-bold text-indigo-500 uppercase">Otras</p><p className="text-lg font-bold text-indigo-700">{totalActH}h</p></div>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-300" />
                        <div><p className="text-[0.55rem] font-bold text-purple-500 uppercase">Total Semanal</p><p className="text-lg font-bold text-purple-700">{totalWeekH}h</p></div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-blue-100 text-center">
                        <p className="text-[0.5rem] font-bold text-gray-400 uppercase">Mín/día</p>
                        <p className="text-2xl font-bold text-gray-900">{minDailyH}<span className="text-xs text-gray-400 ml-0.5">h</span></p>
                        <p className="text-[0.5rem] text-gray-400">{plan.work_days_per_week} días/sem</p>
                    </div>
                </div>
            </div>
        </div>
    )

    // ===== MAIN RENDER =====
    return (
        <Tabs value={mode} onValueChange={setMode} className="max-w-7xl mx-auto p-4 md:p-6 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
            {/* Header + Segmented Control */}
            <div className="flex flex-col gap-3 mb-4 shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                            <Target className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Plan de Negocio</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                                    <SelectTrigger className="text-xs font-bold text-blue-600 bg-transparent border-none p-0 focus:ring-0 cursor-pointer w-auto h-auto">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[300]">
                                        {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <span className="text-gray-300">•</span>
                                <span className="text-[0.65rem] font-semibold text-gray-400 flex items-center gap-1"><Crown className="w-3 h-3" />{planInfo.label} ({planInfo.pct}%)</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Segmented Control using shadcn Tabs style */}
                        {readOnly ? (
                            <TabsList className="grid grid-cols-2 w-[240px]">
                                <TabsTrigger value="kpis" className="flex items-center gap-1.5">
                                    <BarChart3 className="w-3.5 h-3.5" /> KPIs
                                </TabsTrigger>
                                <TabsTrigger value="config" className="flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5" /> Detalle
                                </TabsTrigger>
                            </TabsList>
                        ) : (
                            <>
                                <TabsList className="grid grid-cols-2 w-[240px]">
                                    <TabsTrigger value="kpis" className="flex items-center gap-1.5">
                                        <BarChart3 className="w-3.5 h-3.5" /> KPIs
                                    </TabsTrigger>
                                    <TabsTrigger value="config" className="flex items-center gap-1.5">
                                        <Briefcase className="w-3.5 h-3.5" /> Configurar
                                    </TabsTrigger>
                                </TabsList>
                                {mode === 'config' && (
                                    <button onClick={savePlan} disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 transition-all text-sm font-semibold">
                                        <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <TabsContent value="kpis" className="flex-1 overflow-y-auto rounded-2xl mt-0">
                {renderSummary()}
            </TabsContent>

            <TabsContent value="config" className="flex-1 flex flex-col overflow-hidden mt-0">
                {/* PERSISTENT RESULTS STRIP */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl px-6 py-5 text-white shrink-0 mb-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-5 flex-1">
                            <div className="pr-5 border-r border-white/10">
                                <p className="text-xs text-blue-300 font-bold uppercase">Fact. Bruta Mín.</p>
                                <p className="text-xl font-bold">{fmtCLP(minBilling)}</p>
                            </div>
                            <div className="pr-5 border-r border-white/10">
                                <p className="text-xs text-emerald-300 font-bold uppercase">Vendedores ({(sellerPct * 100).toFixed(0)}%)</p>
                                <p className="text-base font-bold">{fmtCLP(billingVend)} <span className="text-xs text-slate-400">· {minTransSale} trans.</span></p>
                            </div>
                            <div className="pr-5 border-r border-white/10">
                                <p className="text-xs text-amber-300 font-bold uppercase">Arrendadores ({(landlordPct * 100).toFixed(0)}%)</p>
                                <p className="text-base font-bold">{fmtCLP(billingArr)} <span className="text-xs text-slate-400">· {minTransRental} trans.</span></p>
                            </div>
                            <div className="pr-5 border-r border-white/10">
                                <p className="text-xs text-purple-300 font-bold uppercase">Horas/Día</p>
                                <p className="text-base font-bold">{minDailyH}h <span className="text-xs text-slate-400">· {totalWeekH}h/sem</span></p>
                            </div>
                        </div>
                        <div className="w-64 shrink-0">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs text-slate-300">Progreso</span>
                                <span className="text-xs font-bold text-blue-300">{fmtPct(billingProg)}%</span>
                            </div>
                            <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${billingProg >= 80 ? 'bg-emerald-400' : billingProg >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${billingProg}%` }} />
                            </div>
                            <div className="flex justify-between mt-1"><span className="text-xs text-slate-500">Actual: {fmtCLP(kpiData.billing)}</span><span className="text-xs text-slate-500">Meta: {fmtCLP(minBilling)}</span></div>
                        </div>
                    </div>
                </div>

                {/* Config: Sidebar + Tabs */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 overflow-hidden">
                    {/* LEFT SIDEBAR */}
                    <div className="flex flex-col gap-3 overflow-y-auto pr-1 pb-4">
                        {[{ name: 'mission', label: 'Misión', placeholder: '¿Cuál es tu propósito hoy?', icon: Target, color: 'blue' },
                        { name: 'vision', label: 'Visión', placeholder: '¿Dónde quieres estar?', icon: Lightbulb, color: 'purple' }].map(f => (
                            <div key={f.name} className={`p-3 rounded-xl border border-${f.color}-100 bg-${f.color}-50/30`}>
                                <label className={`text-[0.6rem] font-bold text-${f.color}-500 uppercase tracking-wider flex items-center gap-1 mb-1.5`}>
                                    <f.icon className="w-3 h-3" /> {f.label}
                                </label>
                                <textarea name={f.name} value={plan[f.name] || ''} onChange={hp} placeholder={f.placeholder} rows={2} disabled={readOnly}
                                    className="w-full text-xs text-gray-700 font-medium resize-none border-none p-0 focus:ring-0 placeholder:text-gray-300 bg-transparent leading-relaxed" />
                            </div>
                        ))}
                        <div className="p-4 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/60 to-yellow-50/40">
                            <label className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                <Zap className="w-4 h-4" /> Mantra del emprendedor
                            </label>
                            <p className="text-sm font-semibold text-gray-800 mb-4">El objetivo para mi negocio es ganar más de:</p>
                            <div className="space-y-2.5">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                                    <label className="text-[0.6rem] font-bold text-blue-300 uppercase block mb-1.5">Meta Mensual</label>
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-400 text-sm">$</span>
                                        <input type="number" name="monthly_goal" value={plan.monthly_goal || ''} onChange={hp} disabled={readOnly}
                                            className="flex-1 text-lg font-bold text-white border-none p-0 focus:ring-0 bg-transparent" placeholder="0" />
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                    <label className="text-[0.6rem] font-bold text-emerald-500 uppercase block mb-1.5">Meta Anual (×12)</label>
                                    <p className="text-lg font-bold text-emerald-700">{fmtCLP(annualGoal)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL with Config Sub-Tabs */}
                    <Tabs defaultValue="investment" className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <TabsList className="grid w-full grid-cols-4 shrink-0">
                            <TabsTrigger value="investment" className="flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5" /> Inversión
                            </TabsTrigger>
                            <TabsTrigger value="operative" className="flex items-center gap-1.5">
                                <Calculator className="w-3.5 h-3.5" /> Operativo
                            </TabsTrigger>
                            <TabsTrigger value="channels" className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" /> Canales
                            </TabsTrigger>
                            <TabsTrigger value="hours" className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Horas
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="investment" className="flex-1 overflow-hidden mt-0">
                            {renderInvestment()}
                        </TabsContent>
                        <TabsContent value="operative" className="flex-1 overflow-hidden mt-0">
                            {renderOperative()}
                        </TabsContent>
                        <TabsContent value="channels" className="flex-1 overflow-hidden mt-0">
                            {renderChannels()}
                        </TabsContent>
                        <TabsContent value="hours" className="flex-1 overflow-hidden mt-0">
                            {renderHours()}
                        </TabsContent>
                    </Tabs>
                </div>
            </TabsContent>
        </Tabs>
    )
}
