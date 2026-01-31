
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Calendar } from 'lucide-react'
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

export default function WeeklyKpiForm() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [selectedDate, setSelectedDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))

    // Initial State structure matching DB columns
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

    useEffect(() => {
        if (user && selectedDate) {
            fetchWeeklyData()
        }
    }, [user, selectedDate])

    const fetchWeeklyData = async () => {
        setLoading(true)
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd')
            const { data, error } = await supabase
                .from('weekly_kpis')
                .select('*')
                .eq('agent_id', user.id)
                .eq('week_start_date', dateStr)
                .single()

            if (error && error.code !== 'PGRST116') throw error

            if (data) {
                // Remove id, agent_id, week_start_date, created_at from form data
                const { id, agent_id, week_start_date, created_at, ...kpiData } = data
                setFormData(kpiData)
            } else {
                setFormData(initialFormState)
            }
        } catch (error) {
            console.error('Error fetching KPI data:', error)
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value === '' ? 0 : Number(value)
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd')

            // Check if exists update, else insert
            const { data: existingData } = await supabase
                .from('weekly_kpis')
                .select('id')
                .eq('agent_id', user.id)
                .eq('week_start_date', dateStr)
                .single()

            let error
            if (existingData) {
                const { error: updateError } = await supabase
                    .from('weekly_kpis')
                    .update(formData)
                    .eq('id', existingData.id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('weekly_kpis')
                    .insert([{
                        agent_id: user.id,
                        week_start_date: dateStr,
                        ...formData
                    }])
                error = insertError
            }

            if (error) throw error
            toast.success('Datos guardados correctamente')
        } catch (error) {
            console.error('Error saving KPI data:', error)
            toast.error('Error al guardar datos')
        } finally {
            setLoading(false)
        }
    }

    const changeWeek = (direction) => {
        setSelectedDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1))
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">Carga de KPI Semanal</h2>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => changeWeek('prev')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        ←
                    </button>
                    <div className="flex items-center gap-2 font-medium text-gray-600">
                        <Calendar className="w-5 h-5" />
                        <span>Semana del {format(selectedDate, 'd MMMM yyyy', { locale: es })}</span>
                    </div>
                    <button
                        onClick={() => changeWeek('next')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        →
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Gestión (Actividades) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4 border-b pb-2">Gestión (Actividades)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="Inicio de conversaciones" name="conversations_started" value={formData.conversations_started} onChange={handleInputChange} />
                        <InputGroup label="Cafés con base relacional" name="relational_coffees" value={formData.relational_coffees} onChange={handleInputChange} />
                        <InputGroup label="Entrevistas de Venta (Prelisting)" name="sales_interviews" value={formData.sales_interviews} onChange={handleInputChange} />
                        <InputGroup label="Entrevistas de Compra (Prebuying)" name="buying_interviews" value={formData.buying_interviews} onChange={handleInputChange} />
                        <InputGroup label="Evaluaciones comerciales" name="commercial_evaluations" value={formData.commercial_evaluations} onChange={handleInputChange} />
                    </div>
                </div>

                {/* Resultados (Inventario y Cierres) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                    <h3 className="text-lg font-semibold text-green-600 mb-4 border-b pb-2">Resultados (Inventario y Cierres)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="Captaciones (Nuevas propiedades)" name="new_listings" value={formData.new_listings} onChange={handleInputChange} />
                        <InputGroup label="Cartera activa (Total propiedades)" name="active_portfolio" value={formData.active_portfolio} onChange={handleInputChange} />
                        <InputGroup label="Bajas de precio" name="price_reductions" value={formData.price_reductions} onChange={handleInputChange} />
                        <InputGroup label="Visitas a cartera (Propiedades propias)" name="portfolio_visits" value={formData.portfolio_visits} onChange={handleInputChange} />
                        <InputGroup label="Visitas con compradores" name="buyer_visits" value={formData.buyer_visits} onChange={handleInputChange} />
                        <InputGroup label="Cartas Oferta en negociación" name="offers_in_negotiation" value={formData.offers_in_negotiation} onChange={handleInputChange} />
                        <InputGroup label="Promesas firmadas" name="signed_promises" value={formData.signed_promises} onChange={handleInputChange} />
                    </div>
                </div>

                {/* Facturación */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                    <h3 className="text-lg font-semibold text-purple-600 mb-4 border-b pb-2">Facturación</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="Facturación (Monto principal)" name="billing_primary" value={formData.billing_primary} onChange={handleInputChange} type="number" step="0.01" />
                        <InputGroup label="Referidos" name="referrals_count" value={formData.referrals_count} onChange={handleInputChange} />
                        <InputGroup label="Facturación (Campo secundario)" name="billing_secondary" value={formData.billing_secondary} onChange={handleInputChange} type="number" step="0.01" />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        {loading ? 'Guardando...' : 'Guardar KPI Semanal'}
                    </button>
                </div>
            </form>
        </div>
    )
}

const InputGroup = ({ label, name, value, onChange, type = "number", step = "1" }) => (
    <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            min="0"
            step={step}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-gray-50 hover:bg-white focus:bg-white"
        />
    </div>
)
