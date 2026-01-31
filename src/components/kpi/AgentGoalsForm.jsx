
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Target, TrendingUp } from 'lucide-react'

export default function AgentGoalsForm() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [year, setYear] = useState(new Date().getFullYear())

    // Initial State
    const initialFormState = {
        annual_billing_goal: 0,
        q1_goal: 0,
        q2_goal: 0,
        q3_goal: 0,
        q4_goal: 0,
    }

    const [formData, setFormData] = useState(initialFormState)

    useEffect(() => {
        if (user) {
            fetchGoals()
        }
    }, [user, year])

    const fetchGoals = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('agent_objectives')
                .select('*')
                .eq('agent_id', user.id)
                .eq('year', year)
                .single()

            if (error && error.code !== 'PGRST116') throw error

            if (data) {
                const { annual_billing_goal, q1_goal, q2_goal, q3_goal, q4_goal } = data
                setFormData({ annual_billing_goal, q1_goal, q2_goal, q3_goal, q4_goal })
            } else {
                setFormData(initialFormState)
            }
        } catch (error) {
            console.error('Error fetching goals:', error)
            toast.error('Error al cargar objetivos')
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
            // Check if exists
            const { data: existingData } = await supabase
                .from('agent_objectives')
                .select('id')
                .eq('agent_id', user.id)
                .eq('year', year)
                .single()

            let error
            if (existingData) {
                const { error: updateError } = await supabase
                    .from('agent_objectives')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingData.id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('agent_objectives')
                    .insert([{
                        agent_id: user.id,
                        year: year,
                        ...formData
                    }])
                error = insertError
            }

            if (error) throw error
            toast.success('Objetivos guardados correctamente')
        } catch (error) {
            console.error('Error saving goals:', error)
            toast.error('Error al guardar objetivos')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <Target className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-800">Mis Objetivos {year}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600">Año:</label>
                    <input
                        type="number"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-24"
                    />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Meta Anual */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md border-l-4 border-l-blue-600">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Meta de Facturación Anual {year}
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">Monto Global Anual</label>
                            <input
                                type="number"
                                name="annual_billing_goal"
                                value={formData.annual_billing_goal}
                                onChange={handleInputChange}
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-gray-50 hover:bg-white focus:bg-white"
                                placeholder="0.00"
                            />
                            <p className="text-sm text-gray-500">Define tu meta ambiciosa para este año.</p>
                        </div>
                    </div>
                </div>

                {/* Metas Trimestrales */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Metas Trimestrales</h3>
                    <p className="text-gray-500 mb-6 text-sm">Desglosa tu meta anual en trimestres para facilitar el seguimiento.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="Meta Trimestre 1 (Ene - Mar)" name="q1_goal" value={formData.q1_goal} onChange={handleInputChange} />
                        <InputGroup label="Meta Trimestre 2 (Abr - Jun)" name="q2_goal" value={formData.q2_goal} onChange={handleInputChange} />
                        <InputGroup label="Meta Trimestre 3 (Jul - Sep)" name="q3_goal" value={formData.q3_goal} onChange={handleInputChange} />
                        <InputGroup label="Meta Trimestre 4 (Oct - Dic)" name="q4_goal" value={formData.q4_goal} onChange={handleInputChange} />
                    </div>
                </div>

                {/* Opcional: Histórico (Placeholder purely visual as requested) */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 opacity-75">
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">Histórico de facturación</h3>
                    <p className="text-sm text-gray-500">Referencia visual de años anteriores (No editable)</p>
                    <div className="mt-4 h-24 flex items-end gap-2">
                        {/* Dummy bars */}
                        <div className="w-12 bg-gray-300 rounded-t h-1/2 mx-auto relative group">
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">2023</span>
                        </div>
                        <div className="w-12 bg-gray-400 rounded-t h-3/4 mx-auto relative group">
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">2024</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        {loading ? 'Guardando...' : 'Guardar Objetivos'}
                    </button>
                </div>
            </form>
        </div>
    )
}

const InputGroup = ({ label, name, value, onChange }) => (
    <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type="number"
            name={name}
            value={value}
            onChange={onChange}
            min="0"
            step="0.01"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-gray-50 hover:bg-white focus:bg-white"
        />
    </div>
)
