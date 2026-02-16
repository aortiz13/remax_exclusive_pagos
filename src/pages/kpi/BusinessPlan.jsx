import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Target, TrendingUp, Lightbulb, Rocket, PieChart as PieChartIcon, Plus, Trash2, Save, ChevronDown, ChevronUp, GripVertical, AlertCircle } from 'lucide-react'
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
        const sectionKey = category === 'Marketing' ? 'marketing' : category === 'Tecnología' ? 'technology' : 'other'
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
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 overflow-hidden">

                {/* ZONA 1: Left Column (Fixed) */}
                <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-4">

                    {/* Compact Mantra */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-[130px]">
                        <div>
                            <label className="text-[0.72rem] font-medium text-gray-500 uppercase tracking-wide">Mantra del Emprendedor</label>
                            <input
                                type="text"
                                name="mantra_text"
                                value={plan.mantra_text || ''}
                                onChange={handlePlanChange}
                                placeholder="El objetivo para mi negocio es ganar más de..."
                                className="w-full text-[1.1rem] font-semibold text-gray-800 border-none p-0 focus:ring-0 placeholder:text-gray-300 mt-2 bg-transparent"
                            />
                        </div>
                        <div className="flex items-baseline gap-2 mt-auto">
                            <span className="text-sm font-bold text-blue-600">Meta:</span>
                            <span className="text-lg font-bold text-gray-900">${Number(plan.annual_goal).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Stacked Mission & Vision */}
                    <div className="space-y-4">
                        {/* Mission */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-[130px] flex flex-col">
                            <label className="text-[0.72rem] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <Rocket className="w-3 h-3 text-blue-500" />
                                Misión
                            </label>
                            <textarea
                                name="mission"
                                value={plan.mission || ''}
                                onChange={handlePlanChange}
                                placeholder="¿Cuál es tu propósito?"
                                className="w-full flex-1 text-sm text-gray-700 resize-none border-none p-0 focus:ring-0 placeholder:text-gray-300 bg-transparent"
                            />
                        </div>

                        {/* Vision */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-[130px] flex flex-col">
                            <label className="text-[0.72rem] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <Lightbulb className="w-3 h-3 text-purple-500" />
                                Visión
                            </label>
                            <textarea
                                name="vision"
                                value={plan.vision || ''}
                                onChange={handlePlanChange}
                                placeholder="¿Dónde quieres estar?"
                                className="w-full flex-1 text-sm text-gray-700 resize-none border-none p-0 focus:ring-0 placeholder:text-gray-300 bg-transparent"
                            />
                        </div>
                    </div>

                    {/* KPIs moved to bottom */}
                    <div className="mt-auto space-y-3">
                        {/* Annual Goal Chip */}
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between h-[60px]">
                            <div>
                                <label className="block text-[0.65rem] font-bold text-gray-400 uppercase">Meta Anual</label>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400 text-xs">$</span>
                                    <input
                                        type="number"
                                        name="annual_goal"
                                        value={plan.annual_goal}
                                        onChange={handlePlanChange}
                                        className="w-24 text-[1.2rem] font-extrabold text-gray-800 border-none p-0 focus:ring-0 bg-transparent"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-[0.65rem] text-gray-400">Real</span>
                                <span className="text-xs font-semibold text-gray-500">${actualIncome.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Monthly Goal Chip */}
                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between h-[60px]">
                            <div>
                                <label className="block text-[0.65rem] font-bold text-gray-400 uppercase">Promedio Mensual</label>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400 text-xs">$</span>
                                    <input
                                        type="number"
                                        name="monthly_goal"
                                        value={plan.monthly_goal}
                                        onChange={handlePlanChange}
                                        className="w-24 text-[1.2rem] font-extrabold text-gray-800 border-none p-0 focus:ring-0 bg-transparent"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-[0.65rem] text-gray-400">Real</span>
                                <span className="text-xs font-semibold text-gray-500">${Math.round(actualIncome / 12).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ZONA 2: Right Column (Tabs) */}
                <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
                    {/* Badge for Total Investment */}
                    <div className="absolute top-4 right-4 z-10 bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
                        <span>Total Inversión:</span>
                        <span className="text-green-400">${totalInvestment.toLocaleString()}</span>
                    </div>

                    <Tabs defaultValue="investment" className="flex flex-col h-full w-full">
                        <div className="border-b border-gray-100 px-6 pt-4">
                            <TabsList className="bg-transparent w-full justify-start h-10 p-0 space-x-6">
                                <TabsTrigger
                                    value="investment"
                                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 pb-2 text-gray-500 data-[state=active]:text-blue-600 font-medium"
                                >
                                    Plan de Inversión
                                </TabsTrigger>
                                <TabsTrigger
                                    value="goals"
                                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 pb-2 text-gray-500 data-[state=active]:text-blue-600 font-medium opacity-50 cursor-not-allowed"
                                    disabled
                                >
                                    Objetivos <span className="ml-1 text-[10px] bg-gray-100 px-1.5 rounded text-gray-500">Pronto</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="tracking"
                                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 pb-2 text-gray-500 data-[state=active]:text-blue-600 font-medium opacity-50 cursor-not-allowed"
                                    disabled
                                >
                                    Seguimiento <span className="ml-1 text-[10px] bg-gray-100 px-1.5 rounded text-gray-500">Pronto</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="investment" className="flex-1 p-0 m-0 overflow-hidden">
                            <div className="flex flex-col md:flex-row h-full">
                                {/* Left Sub-column: Categories List (60%) */}
                                <div className="w-full md:w-[60%] h-full overflow-y-auto p-6 border-r border-gray-100">
                                    <div className="space-y-4">
                                        {[
                                            { key: 'marketing', label: 'Marketing y Publicidad', color: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-100', bg: 'bg-blue-50' },
                                            { key: 'technology', label: 'Tecnología y Operaciones', color: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-100', bg: 'bg-purple-50' },
                                            { key: 'other', label: 'Otros Gastos', color: 'bg-gray-500', text: 'text-gray-600', border: 'border-gray-100', bg: 'bg-gray-50' }
                                        ].map((section) => {
                                            const catName = section.key === 'marketing' ? 'Marketing' : section.key === 'technology' ? 'Tecnología' : 'Otros'; // Basic mapping
                                            const total = getCategoryTotal(catName);
                                            const items = getCategoryItems(catName);

                                            // Don't render "Others" if empty and not expanded, unless user wants to add? 
                                            // Let's keep it visible so they can add.

                                            return (
                                                <div key={section.key} className="border border-gray-200 rounded-lg overflow-hidden transition-all hover:border-gray-300">
                                                    <button
                                                        onClick={() => toggleSection(section.key)}
                                                        className={`w-full flex items-center justify-between p-4 ${expandedSections[section.key] ? 'bg-gray-50/50' : 'bg-white'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${section.color}`} />
                                                            <span className="font-semibold text-gray-700 text-sm">{section.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-sm font-bold text-gray-900">${total.toLocaleString()}</span>
                                                            {expandedSections[section.key] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                        </div>
                                                    </button>

                                                    <AnimatePresence>
                                                        {expandedSections[section.key] && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="border-t border-gray-100"
                                                            >
                                                                <div className="p-4 space-y-3 bg-white">
                                                                    {items.map(item => (
                                                                        <div key={item.id} className="flex gap-3 items-center group">
                                                                            <GripVertical className="w-4 h-4 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                            <input
                                                                                value={item.subcategory}
                                                                                onChange={(e) => handleInvestmentChange(item.id, 'subcategory', e.target.value)}
                                                                                disabled={!item.is_custom}
                                                                                className={`flex-1 py-1.5 px-3 rounded-md text-sm border ${item.is_custom ? 'border-gray-200 focus:border-blue-400 bg-white' : 'border-transparent bg-transparent font-medium text-gray-600'} focus:ring-0 outline-none transition-all`}
                                                                            />
                                                                            <div className="relative w-32 shrink-0">
                                                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                                                                <input
                                                                                    type="number"
                                                                                    value={item.amount}
                                                                                    onChange={(e) => handleInvestmentChange(item.id, 'amount', e.target.value)}
                                                                                    className="w-full py-1.5 pl-5 pr-2 rounded-md border border-gray-200 focus:border-blue-500 outline-none text-right font-medium text-sm text-gray-800"
                                                                                />
                                                                            </div>
                                                                            {item.is_custom && (
                                                                                <button onClick={() => removeInvestment(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => addInvestment(catName)}
                                                                        className={`text-xs ${section.text} font-medium hover:${section.bg} px-2 py-1.5 rounded transition-colors flex items-center gap-1.5 mt-2`}
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" /> Agregar ítem
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Right Sub-column: Chart (40%) */}
                                <div className="w-full md:w-[40%] h-full bg-gray-50/30 flex flex-col items-center justify-center p-6 relative">
                                    {totalInvestment > 0 ? (
                                        <div className="w-full max-w-[280px] aspect-square relative">
                                            {/* Centered Total inside Donut */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total</span>
                                                <span className="text-xl font-bold text-gray-800">${(totalInvestment / 1000).toFixed(0)}k</span>
                                            </div>

                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={chartData}
                                                        innerRadius={65}
                                                        outerRadius={90}
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        formatter={(value) => `$${value.toLocaleString()}`}
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400">
                                            <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                            <p className="text-sm">Sin datos de inversión</p>
                                        </div>
                                    )}

                                    {/* Legend */}
                                    <div className="mt-8 grid grid-cols-1 gap-2 w-full max-w-[240px]">
                                        {chartData.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                    <span className="text-gray-600 truncate max-w-[120px]">{item.name}</span>
                                                </div>
                                                <span className="font-bold text-gray-800">{Math.round((item.value / totalInvestment) * 100)}%</span>
                                            </div>
                                        ))}
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
