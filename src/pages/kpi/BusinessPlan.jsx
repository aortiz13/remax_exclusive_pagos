import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Target, TrendingUp, Lightbulb, Rocket, PieChart as PieChartIcon, Plus, Trash2, Save, ChevronDown, ChevronUp, GripVertical, AlertCircle, Building2, Car } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1']

export default function BusinessPlan() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [year, setYear] = useState(new Date().getFullYear())
    const [activeTab, setActiveTab] = useState('investment') // investment | goals | tracking

    // Data States
    const [plan, setPlan] = useState({
        mission: '',
        vision: '',
        mantra_text: '',
        annual_goal: 0,
        monthly_goal: 0
    })

    const [investments, setInvestments] = useState([])
    const [actualIncome, setActualIncome] = useState(0)

    // Expandable Sections (Accordions)
    const [expandedSections, setExpandedSections] = useState({
        marketing: false, // Collapsed by default as requested
        technology: false,
        office: false,
        transportation: false,
        other: false
    })

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }

    useEffect(() => {
        if (user) {
            fetchData()
        }
    }, [user, year])

    const fetchData = async () => {
        setLoading(true)
        try {
            const { data: planData, error: planError } = await supabase
                .from('business_plans')
                .select('*')
                .eq('agent_id', user.id)
                .eq('year', year)
                .single()

            if (planError && planError.code !== 'PGRST116') throw planError

            if (planData) {
                setPlan(planData)
                const { data: investData, error: investError } = await supabase
                    .from('business_plan_investments')
                    .select('*')
                    .eq('plan_id', planData.id)

                if (investError) throw investError
                setInvestments(investData || [])
            } else {
                setPlan({
                    mission: '',
                    vision: '',
                    mantra_text: '',
                    annual_goal: 0,
                    monthly_goal: 0
                })
                setInvestments([])
            }
            setActualIncome(0) // Placeholder
        } catch (error) {
            console.error('Error fetching business plan:', error)
            toast.error('Error al cargar el plan de negocios')
        } finally {
            setLoading(false)
        }
    }

    const handlePlanChange = (e) => {
        const { name, value } = e.target
        setPlan(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleInvestmentChange = (id, field, value) => {
        setInvestments(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const addInvestment = (category) => {
        const newInvestment = {
            id: crypto.randomUUID(),
            category,
            subcategory: '',
            amount: 0,
            is_custom: true,
            isNew: true
        }
        setInvestments(prev => [...prev, newInvestment])
        // Auto expand the section when adding
        const sectionKey = category === 'Marketing' ? 'marketing' : category === 'Tecnología' ? 'technology' : category === 'Oficina' ? 'office' : category === 'Movilización' ? 'transportation' : 'other'
        setExpandedSections(prev => ({ ...prev, [sectionKey]: true }))
    }

    const removeInvestment = (id) => {
        setInvestments(prev => prev.filter(item => item.id !== id))
    }

    const savePlan = async () => {
        setLoading(true)
        try {
            const { data: savedPlan, error: planError } = await supabase
                .from('business_plans')
                .upsert({
                    agent_id: user.id,
                    year,
                    ...plan,
                    ...(plan.id ? { id: plan.id } : { updated_at: new Date() })
                }, { onConflict: 'agent_id, year' })
                .select()
                .single()

            if (planError) throw planError

            if (savedPlan) {
                await supabase
                    .from('business_plan_investments')
                    .delete()
                    .eq('plan_id', savedPlan.id)

                const investmentsToInsert = investments.map(inv => ({
                    plan_id: savedPlan.id,
                    category: inv.category,
                    subcategory: inv.subcategory,
                    amount: Number(inv.amount),
                    is_custom: inv.is_custom
                }))

                if (investmentsToInsert.length > 0) {
                    const { error: investError } = await supabase
                        .from('business_plan_investments')
                        .insert(investmentsToInsert)

                    if (investError) throw investError
                }

                setPlan(savedPlan)
                const { data: newInvestments } = await supabase
                    .from('business_plan_investments')
                    .select('*')
                    .eq('plan_id', savedPlan.id)
                setInvestments(newInvestments || [])
            }

            toast.success('Plan de negocios guardado correctamente')
        } catch (error) {
            console.error('Error saving plan:', error)
            toast.error('Error al guardar el plan')
        } finally {
            setLoading(false)
        }
    }

    // Chart Data Preparation
    const chartData = investments.reduce((acc, curr) => {
        const existing = acc.find(item => item.name === curr.category)
        if (existing) {
            existing.value += Number(curr.amount || 0)
        } else {
            acc.push({ name: curr.category, value: Number(curr.amount || 0) })
        }
        return acc
    }, [])

    const totalInvestment = investments.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    // Helper to get category total
    const getCategoryTotal = (cat) => investments.filter(i => i.category === cat).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const getCategoryItems = (cat) => investments.filter(i => i.category === cat)

    // Ensure default items exist
    useEffect(() => {
        if (!loading && investments.length === 0 && !plan.id) {
            const defaults = [
                { id: '1', category: 'Marketing', subcategory: 'Portales Inmobiliarios', amount: 0, is_custom: false },
                { id: '2', category: 'Marketing', subcategory: 'Redes Sociales (Ads)', amount: 0, is_custom: false },
                { id: '3', category: 'Marketing', subcategory: 'Branding Personal', amount: 0, is_custom: false },
                { id: '4', category: 'Tecnología', subcategory: 'Suscripciones de Software', amount: 0, is_custom: false },
                { id: '5', category: 'Tecnología', subcategory: 'Traslado y Logística', amount: 0, is_custom: false },
                { id: '6', category: 'Tecnología', subcategory: 'Mantenimiento de Oficina', amount: 0, is_custom: false },
                { id: '7', category: 'Oficina', subcategory: 'Cuotas de Oficina (Plan de Asociación) y Membresía', amount: 0, is_custom: false },
                { id: '8', category: 'Oficina', subcategory: 'Papelería y Otros gastos', amount: 0, is_custom: false },
                { id: '9', category: 'Movilización', subcategory: 'Transporte Público o Combustible', amount: 0, is_custom: false },
                { id: '10', category: 'Movilización', subcategory: 'Gastos generales vehículo propio', amount: 0, is_custom: false },
            ]
            setInvestments(defaults)
        }
    }, [loading, plan.id])


    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 h-[calc(100vh-100px)] overflow-hidden flex flex-col">
            {/* Header Area */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Target className="w-6 h-6 text-blue-600" />
                        Mi Plan de Negocio
                    </h1>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="bg-transparent text-lg font-bold text-blue-600 rounded-lg focus:ring-0 cursor-pointer hover:bg-gray-100 transition-colors border-none py-1 px-2"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={savePlan}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                    <Save className="w-4 h-4" />
                    {loading ? 'Guardando...' : 'Guardar Plan'}
                </button>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 overflow-hidden">

                {/* ZONA 1: Left Column (Fixed) */}
                <div className="flex flex-col gap-3 overflow-y-auto pr-2 pb-4">

                    {/* Compact Mantra */}
                    <div className="bg-slate-900 p-4 rounded-xl shadow-lg shadow-blue-900/10 flex flex-col justify-between min-h-[120px] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
                            <Rocket className="w-12 h-12 text-white" />
                        </div>
                        <div className="relative z-10">
                            <label className="text-[0.65rem] font-bold text-blue-200 uppercase tracking-wider mb-1 block opacity-80">Mantra del Emprendedor</label>
                            <textarea
                                name="mantra_text"
                                value={plan.mantra_text || ''}
                                onChange={handlePlanChange}
                                placeholder="Escribe tu mantra aquí..."
                                className="w-full text-lg font-bold text-white bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-600 resize-none leading-tight min-h-[60px]"
                                rows={2}
                            />
                        </div>
                        <div className="relative z-10 pt-2 border-t border-white/10 mt-2 flex items-center justify-between">
                            <span className="text-[0.65rem] font-semibold text-slate-400 uppercase">Meta Anual</span>
                            <span className="text-sm font-bold text-blue-300 font-mono">${Number(plan.annual_goal).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Stacked Mission & Vision */}
                    <div className="space-y-3">
                        {/* Mission */}
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group">
                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1 group-hover:text-blue-500 transition-colors">
                                <Rocket className="w-3 h-3" />
                                Misión
                            </label>
                            <textarea
                                name="mission"
                                value={plan.mission || ''}
                                onChange={handlePlanChange}
                                placeholder="¿Cuál es tu propósito?"
                                rows={2}
                                className="w-full text-xs text-gray-700 font-medium resize-none border-none p-0 focus:ring-0 placeholder:text-gray-300 bg-transparent leading-relaxed"
                            />
                        </div>

                        {/* Vision */}
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-purple-100 group">
                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1 group-hover:text-purple-500 transition-colors">
                                <Lightbulb className="w-3 h-3" />
                                Visión
                            </label>
                            <textarea
                                name="vision"
                                value={plan.vision || ''}
                                onChange={handlePlanChange}
                                placeholder="¿Dónde quieres estar?"
                                rows={2}
                                className="w-full text-xs text-gray-700 font-medium resize-none border-none p-0 focus:ring-0 placeholder:text-gray-300 bg-transparent leading-relaxed"
                            />
                        </div>
                    </div>

                    {/* KPIs moved to bottom */}
                    <div className="mt-auto grid grid-cols-2 gap-2">
                        {/* Annual Goal Chip */}
                        <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center">
                            <label className="block text-[0.55rem] font-bold text-gray-400 uppercase mb-0.5">Meta Anual</label>
                            <input
                                type="number"
                                name="annual_goal"
                                value={plan.annual_goal}
                                onChange={handlePlanChange}
                                className="w-full text-sm font-bold text-gray-800 border-none p-0 focus:ring-0 bg-transparent"
                                placeholder="0"
                            />
                        </div>

                        {/* Monthly Goal Chip */}
                        <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center">
                            <label className="block text-[0.55rem] font-bold text-gray-400 uppercase mb-0.5">Mensual</label>
                            <input
                                type="number"
                                name="monthly_goal"
                                value={plan.monthly_goal}
                                onChange={handlePlanChange}
                                className="w-full text-sm font-bold text-gray-800 border-none p-0 focus:ring-0 bg-transparent"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* ZONA 2: Right Column (Tabs) */}
                <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
                    {/* Badge for Total Investment */}
                    <div className="absolute top-3 right-4 z-10 bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
                        <span className="uppercase text-[0.6rem] tracking-wider text-gray-400 font-bold">Total Inversión</span>
                        <span className="text-gray-900 font-bold">${totalInvestment.toLocaleString()}</span>
                    </div>

                    <Tabs defaultValue="investment" className="flex flex-col h-full w-full">
                        <div className="border-b border-gray-100 px-6 pt-3">
                            <TabsList className="bg-transparent w-full justify-start h-9 p-0 space-x-6">
                                <TabsTrigger
                                    value="investment"
                                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 pb-2 text-xs uppercase tracking-wide font-semibold text-gray-400 data-[state=active]:text-blue-600 transition-colors"
                                >
                                    Plan de Inversión
                                </TabsTrigger>
                                <TabsTrigger
                                    value="goals"
                                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 pb-2 text-xs uppercase tracking-wide font-semibold text-gray-400 data-[state=active]:text-blue-600 transition-colors opacity-50 cursor-not-allowed"
                                    disabled
                                >
                                    Objetivos
                                </TabsTrigger>
                                <TabsTrigger
                                    value="tracking"
                                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 pb-2 text-xs uppercase tracking-wide font-semibold text-gray-400 data-[state=active]:text-blue-600 transition-colors opacity-50 cursor-not-allowed"
                                    disabled
                                >
                                    Seguimiento
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="investment" className="flex-1 p-0 m-0 overflow-hidden">
                            <div className="flex flex-col md:flex-row h-full">
                                {/* Left Sub-column: Categories List (60%) */}
                                <div className="w-full md:w-[60%] h-full overflow-y-auto p-5 border-r border-gray-100 custom-scrollbar">
                                    <div className="space-y-3">
                                        {[
                                            {
                                                [
                                                { key: 'marketing', label: 'Marketing y Publicidad', color: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-100', bg: 'bg-blue-50' },
                                                { key: 'technology', label: 'Tecnología y Operaciones', color: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-100', bg: 'bg-purple-50' },
                                                { key: 'office', label: 'Oficina', color: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-100', bg: 'bg-amber-50' },
                                                { key: 'transportation', label: 'Movilización', color: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-100', bg: 'bg-emerald-50' },
                                                { key: 'other', label: 'Otros Gastos', color: 'bg-gray-500', text: 'text-gray-600', border: 'border-gray-100', bg: 'bg-gray-50' }
                                                ].map((section) => {
                                                    const catName = section.key === 'marketing' ? 'Marketing' :
                                                        section.key === 'technology' ? 'Tecnología' :
                                                            section.key === 'office' ? 'Oficina' :
                                                                section.key === 'transportation' ? 'Movilización' : 'Otros';
                                                    const total = getCategoryTotal(catName);
                                                    const items = getCategoryItems(catName);

                                                    return (
                                                        <div key={section.key} className={`border rounded-lg overflow-hidden transition-all ${expandedSections[section.key] ? 'border-gray-200 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
                                                            <button
                                                                onClick={() => toggleSection(section.key)}
                                                                className={`w-full flex items-center justify-between p-3.5 ${expandedSections[section.key] ? 'bg-gray-50' : 'bg-white'}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-1.5 rounded-md ${section.bg} ${section.text}`}>
                                                                        {section.key === 'marketing' && <Target className="w-3.5 h-3.5" />}
                                                                        {section.key === 'technology' && <Lightbulb className="w-3.5 h-3.5" />}
                                                                        {section.key === 'office' && <Building2 className="w-3.5 h-3.5" />}
                                                                        {section.key === 'transportation' && <Car className="w-3.5 h-3.5" />}
                                                                        {section.key === 'other' && <Plus className="w-3.5 h-3.5" />}
                                                                    </div>
                                                                    <span className="font-semibold text-gray-700 text-sm">{section.label}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm font-bold text-gray-800 font-mono tracking-tight">${total.toLocaleString()}</span>
                                                                    {expandedSections[section.key] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                                </div>
                                                            </button>

                                                            <AnimatePresence>
                                                                {expandedSections[section.key] && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        className="border-t border-gray-100 bg-white"
                                                                    >
                                                                        <div className="p-3 space-y-2">
                                                                            {items.map(item => (
                                                                                <div key={item.id} className="flex gap-2 items-center group py-1">
                                                                                    <input
                                                                                        value={item.subcategory}
                                                                                        onChange={(e) => handleInvestmentChange(item.id, 'subcategory', e.target.value)}
                                                                                        disabled={!item.is_custom}
                                                                                        className={`flex-1 py-1 px-2 rounded text-xs border ${item.is_custom ? 'border-gray-200 focus:border-blue-400 bg-white' : 'border-transparent bg-transparent font-medium text-gray-600'} focus:ring-0 outline-none transition-all placeholder:text-gray-300`}
                                                                                        placeholder="Nombre del ítem"
                                                                                    />
                                                                                    <div className="relative w-28 shrink-0">
                                                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 text-[0.65rem]">$</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            value={item.amount}
                                                                                            onChange={(e) => handleInvestmentChange(item.id, 'amount', e.target.value)}
                                                                                            className="w-full py-1 pl-4 pr-1 rounded border border-gray-100 focus:border-blue-500 outline-none text-right font-medium text-xs text-gray-800 font-mono hover:border-gray-200 transition-colors"
                                                                                        />
                                                                                    </div>
                                                                                    {item.is_custom && (
                                                                                        <button onClick={() => removeInvestment(item.id)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                                                            <Trash2 className="w-3 h-3" />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                            <button
                                                                                onClick={() => addInvestment(catName)}
                                                                                className={`text-[0.7rem] ${section.text} font-medium hover:${section.bg} px-2 py-1.5 rounded transition-colors flex items-center gap-1.5 w-full justify-center border border-dashed border-transparent hover:border-${section.text.split('-')[1]}-200 mt-2`}
                                                                            >
                                                                                <Plus className="w-3 h-3" /> Agregar nuevo gasto
                                                                            </button>
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    )
                                                })
                                            }
                                    </div>
                                </div>

                                {/* Right Sub-column: Chart (40%) */}
                                <div className="w-full md:w-[40%] h-full bg-slate-50/50 flex flex-col items-center justify-center p-6 border-l border-gray-100">
                                    <div className="flex flex-col items-center gap-0 w-full max-w-[240px]">
                                        {totalInvestment > 0 ? (
                                            <div className="w-full aspect-square relative mb-4">
                                                {/* Centered Total inside Donut */}
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                    <span className="text-[0.6rem] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Total</span>
                                                    <span className="text-xl font-bold text-gray-800 tracking-tight">${(totalInvestment / 1000).toFixed(0)}k</span>
                                                </div>

                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={chartData}
                                                            innerRadius={65}
                                                            outerRadius={85}
                                                            paddingAngle={4}
                                                            dataKey="value"
                                                            stroke="none"
                                                            cornerRadius={4}
                                                        >
                                                            {chartData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            formatter={(value) => `$${value.toLocaleString()}`}
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px' }}
                                                            itemStyle={{ fontWeight: 600, color: '#1f2937' }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-400 py-12">
                                                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                                    <PieChartIcon className="w-6 h-6 opacity-30" />
                                                </div>
                                                <p className="text-xs font-medium">Sin datos de inversión</p>
                                            </div>
                                        )}

                                        {/* Simplified Legend - Directly below chart, no gap */}
                                        <div className="grid grid-cols-1 gap-1 w-full">
                                            {chartData.map((item, index) => (
                                                <div key={index} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-white hover:shadow-sm transition-all cursor-default group">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full ring-2 ring-white" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                        <span className="text-gray-500 font-medium truncate max-w-[100px] group-hover:text-gray-800 transition-colors">{item.name}</span>
                                                    </div>
                                                    <span className="font-bold text-gray-700 bg-white px-1.5 py-0.5 rounded text-[0.65rem] border border-gray-100 group-hover:border-gray-200">{Math.round((item.value / totalInvestment) * 100)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
