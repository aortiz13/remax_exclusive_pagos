import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Calendar, Save, Loader2, ArrowLeft, ArrowRight } from 'lucide-react'
import { format, startOfWeek, startOfMonth, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

// Fields that can ONLY be loaded via the ActionModal / New Mandates / Property form (not from the dashboard)
const ACTION_MODAL_ONLY_FIELDS = new Set([
    'conversations_started',
    'relational_coffees',
    'sales_interviews',
    'buying_interviews',
    'commercial_evaluations',
    'new_listings',          // Auto-contabilizado desde Nueva Captación
    'active_portfolio',      // Auto-contabilizado desde nueva propiedad activa en CRM
    'price_reductions',      // Auto-contabilizado desde Baja de Precio
    'portfolio_visits',
    'buyer_visits',
    'offers_in_negotiation', // Auto-contabilizado desde Carta Oferta
    'signed_promises',
    'billing_primary',       // Auto-contabilizado desde Cierre de Negocio
    'billing_secondary',     // Auto-contabilizado desde Cierre de Negocio
    'referrals_count',       // Auto-contabilizado desde Cierre de Negocio
])

export default function KpiDataEntry({ defaultTab = 'weekly', onClose, dashboardMode = false }) {
    const { user } = useAuth()
    const [periodType, setPeriodType] = useState(defaultTab) // 'daily', 'weekly', 'monthly'
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form State
    const initialFormState = {
        conversations_started: 0,
        relational_coffees: 0,
        sales_interviews: 0,
        buying_interviews: 0,
        commercial_evaluations: 0,
        new_listings: 0,
        active_portfolio: 0,
        price_reductions: 0,
        portfolio_visits: 0,
        buyer_visits: 0,
        offers_in_negotiation: 0,
        signed_promises: 0,
        billing_primary: 0,
        referrals_count: 0,
        billing_secondary: 0,
    }
    const [formData, setFormData] = useState(initialFormState)

    // Sync selectedDate based on period type to ensure it aligns (e.g. Monday for Weekly)
    useEffect(() => {
        let alignedDate = selectedDate
        if (periodType === 'weekly') {
            alignedDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
        } else if (periodType === 'monthly') {
            alignedDate = startOfMonth(selectedDate)
        }
        if (alignedDate.getTime() !== selectedDate.getTime()) {
            setSelectedDate(alignedDate)
        }
    }, [periodType])

    useEffect(() => {
        if (user) fetchData()
    }, [user, selectedDate, periodType])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Determine date range based on periodType
            let startDate, endDate
            if (periodType === 'weekly') {
                startDate = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
                endDate = format(addDays(new Date(startDate), 6), 'yyyy-MM-dd')
            } else if (periodType === 'monthly') {
                startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd')
                endDate = format(addMonths(new Date(startDate), 1), 'yyyy-MM-dd') // Query < first day of next month
            } else {
                startDate = format(selectedDate, 'yyyy-MM-dd')
                endDate = startDate
            }

            // For DAILY: Fetch single record as before
            if (periodType === 'daily') {
                const { data, error } = await supabase
                    .from('kpi_records')
                    .select('*')
                    .eq('agent_id', user.id)
                    .eq('period_type', 'daily')
                    .eq('date', startDate)
                    .single()

                if (error && error.code !== 'PGRST116') throw error

                if (data) {
                    const { id, agent_id, period_type, date, created_at, ...metrics } = data
                    setFormData(metrics)
                } else {
                    setFormData(initialFormState)
                }
            }
            // For WEEKLY / MONTHLY: Aggregate DAILY records
            else {
                // First, check if there is an explicit record for this period (manual override)
                const { data: manualData, error: manualError } = await supabase
                    .from('kpi_records')
                    .select('*')
                    .eq('agent_id', user.id)
                    .eq('period_type', periodType)
                    .eq('date', startDate)
                    .single()

                if (manualError && manualError.code !== 'PGRST116') throw manualError

                // If manual record exists, prioritize it? Or show sum? 
                // User asked for "automatic weighting", so aggregation is likely expected.
                // However, let's fetch daily records to aggregate.

                let query = supabase
                    .from('kpi_records')
                    .select('*')
                    .eq('agent_id', user.id)
                    .eq('period_type', 'daily')
                    .gte('date', startDate)

                if (periodType === 'monthly') {
                    // For monthly, it's safer to use strict inequality for the next month start if we used that logic
                    // But here we can just checks dates within the month
                    query = query.lt('date', endDate)
                } else {
                    // Weekly
                    query = query.lte('date', endDate)
                }

                const { data: dailyRecords, error: dailyError } = await query
                if (dailyError) throw dailyError

                // Calculate sums
                const aggregated = { ...initialFormState }
                if (dailyRecords && dailyRecords.length > 0) {
                    dailyRecords.forEach(record => {
                        Object.keys(initialFormState).forEach(key => {
                            aggregated[key] += (record[key] || 0)
                        })
                    })
                }

                // If manual Data exists and has values > aggregated, maybe use that?
                // For now, let's strictly follow "automatic weighting" -> Display Aggregated Data.
                // If user wants to "Save" this week, it will create/update the weekly record.

                // If we also want to support "Manual Weekly Entry" that is completely separate from daily:
                // We could check if aggregated is all 0, then show manualData.
                // But mixing them is confusing. 
                // Let's defaulted to aggregated totals.

                setFormData(aggregated)
            }

        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd')

            // Check existence
            const { data: existing } = await supabase
                .from('kpi_records')
                .select('id')
                .eq('agent_id', user.id)
                .eq('period_type', periodType)
                .eq('date', dateStr)
                .single()

            let error
            if (existing) {
                const { error: updateError } = await supabase
                    .from('kpi_records')
                    .update(formData)
                    .eq('id', existing.id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('kpi_records')
                    .insert([{
                        agent_id: user.id,
                        period_type: periodType,
                        date: dateStr,
                        ...formData
                    }])
                error = insertError
            }

            if (error) throw error
            toast.success('Datos guardados')
            if (onClose) onClose()
        } catch (error) {
            console.error('Error saving:', error)
            toast.error('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const changeDate = (direction) => {
        if (periodType === 'daily') setSelectedDate(prev => direction === 'next' ? addDays(prev, 1) : subDays(prev, 1))
        if (periodType === 'weekly') setSelectedDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1))
        if (periodType === 'monthly') setSelectedDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1))
    }

    const getDateLabel = () => {
        if (periodType === 'daily') return format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
        if (periodType === 'weekly') return `Semana del ${format(selectedDate, "d 'de' MMMM", { locale: es })}`
        if (periodType === 'monthly') return format(selectedDate, "MMMM yyyy", { locale: es })
    }

    return (
        <div className="space-y-6">
            {!onClose && (
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">Carga de Datos</h2>
                    <Tabs value={periodType} onValueChange={setPeriodType}>
                        <TabsList>
                            <TabsTrigger value="daily">Diaria</TabsTrigger>
                            <TabsTrigger value="weekly">Semanal</TabsTrigger>
                            <TabsTrigger value="monthly">Mensual</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            )}

            {/* Date Navigator */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <Button variant="ghost" size="icon" onClick={() => changeDate('prev')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2 font-medium text-slate-700 capitalize">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span>{getDateLabel()}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => changeDate('next')}>
                    <ArrowRight className="w-5 h-5" />
                </Button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {dashboardMode && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <span className="mt-0.5">⚠️</span>
                        <span>Los KPIs de <strong>Gestión</strong>, <strong>Captaciones Nuevas</strong>, <strong>Cartera Activa</strong>, <strong>Bajas de Precio</strong>, <strong>Visitas</strong>, <strong>Carta Oferta</strong> y <strong>Promesa Firmada</strong> se contabilizan automáticamente desde el <strong>modal de acciones</strong>, el formulario de <strong>Propiedad</strong> y el flujo de <strong>Nueva Captación</strong>.</span>
                    </div>
                )}

                {/* Form Sections (Reuse same structure as WeeklyKpiForm but generic) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Activity */}
                    <Card>
                        <CardHeader><CardTitle className="text-base text-blue-600">Gestión</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <InputKpi label="Inicios de Conversación" name="conversations_started" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('conversations_started')} />
                            <InputKpi label="Cafés Relacionales" name="relational_coffees" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('relational_coffees')} />
                            <InputKpi label="Entrevistas Venta (Prelisting)" name="sales_interviews" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('sales_interviews')} />
                            <InputKpi label="Entrevistas Compra (Prebuying)" name="buying_interviews" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('buying_interviews')} />
                            <InputKpi label="Evaluaciones Comerciales" name="commercial_evaluations" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('commercial_evaluations')} />
                        </CardContent>
                    </Card>

                    {/* Results */}
                    <Card>
                        <CardHeader><CardTitle className="text-base text-green-600">Resultados</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <InputKpi label="Captaciones Nuevas" name="new_listings" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('new_listings')} />
                            <InputKpi label="Cartera Activa" name="active_portfolio" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('active_portfolio')} />
                            <InputKpi label="Bajas de Precio" name="price_reductions" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('price_reductions')} />
                            <InputKpi label="Visitas Propiedades" name="portfolio_visits" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('portfolio_visits')} />
                            <InputKpi label="Visitas Compradores" name="buyer_visits" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('buyer_visits')} />
                            <InputKpi label="Ofertas Negociación" name="offers_in_negotiation" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('offers_in_negotiation')} />
                            <InputKpi label="Promesas Firmadas" name="signed_promises" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('signed_promises')} />
                        </CardContent>
                    </Card>

                    {/* Billing */}
                    <Card>
                        <CardHeader><CardTitle className="text-base text-purple-600">Facturación & Referidos</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <InputKpi label="Facturación Principal ($)" name="billing_primary" state={formData} setState={setFormData} type="number" step="0.01" readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('billing_primary')} />
                            <InputKpi label="Referidos" name="referrals_count" state={formData} setState={setFormData} readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('referrals_count')} />
                            <InputKpi label="Facturación Secundaria ($)" name="billing_secondary" state={formData} setState={setFormData} type="number" step="0.01" readOnly={dashboardMode && ACTION_MODAL_ONLY_FIELDS.has('billing_secondary')} />
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end sticky bottom-4 z-10">
                    <Button type="submit" size="lg" disabled={saving || loading} className="shadow-xl">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar {periodType === 'daily' ? 'Día' : periodType === 'weekly' ? 'Semana' : 'Mes'}
                    </Button>
                </div>
            </form>
        </div>
    )
}

const InputKpi = ({ label, name, state, setState, type = "number", step = "1", readOnly = false }) => (
    <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
            <label className={cn("text-xs font-medium uppercase", readOnly ? "text-slate-300" : "text-slate-500")}>{label}</label>
            {readOnly && (
                <span className="text-[10px] text-slate-400 italic">Solo vía modal de acciones</span>
            )}
        </div>
        <Input
            type={type}
            step={step}
            min="0"
            value={state[name]}
            onChange={(e) => !readOnly && setState(prev => ({ ...prev, [name]: e.target.value === '' ? 0 : Number(e.target.value) }))}
            className={cn("font-mono text-right", readOnly && "bg-slate-50 text-slate-400 cursor-not-allowed")}
            disabled={readOnly}
        />
    </div>
)
