
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import Stepper from '../components/layout/Stepper'
// StepAgente removed
import StepPropiedad from '../components/steps/StepPropiedad'
import StepDueñoBanco from '../components/steps/StepDueñoBanco'
import StepArrendatario from '../components/steps/StepArrendatario'
import StepCalculos from '../components/steps/StepCalculos'
import StepResumen from '../components/steps/StepResumen'
import { Button } from '@/components/ui'
import { Save } from 'lucide-react'

export default function RequestForm() {
    const { id } = useParams()
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [currentStep, setCurrentStep] = useState(1)
    const [loading, setLoading] = useState(!!id)

    const [formData, setFormData] = useState({
        // Initial State will be overwritten if loading from DB or Profile
        agenteNombre: '',
        agenteApellido: '',
        agenteEmail: '',
        agenteTelefono: '',
        // Propiedad
        tipoPropiedad: '',
        direccion: '',
        comuna: '',
        // Dueño
        dueñoNombre: '',
        dueñoRut: '',
        dueñoEmail: '',
        dueñoTelefono: '',
        // Arrendatario
        arrendatarioNombre: '',
        arrendatarioApellido: '',
        arrendatarioEmail: '',
        arrendatarioTelefono: '',
        arrendatarioRut: '',
        // Banco
        bancoNombre: '',
        bancoTipoCuenta: '',
        bancoNroCuenta: '',
        bancoRutTitular: '',
        // Financiero
        canonArriendo: '',
        chkProporcional: false,
        diasProporcionales: '',
        chkMesAdelantado: false,
        garantia: '',
        gastosNotariales: '',
        chkSeguro: false,
        montoSeguro: '',
        costoDominioVigente: '',
        honorariosAdmin: '',
    })

    // Load Request if ID exists
    useEffect(() => {
        if (id) {
            const fetchRequest = async () => {
                const { data, error } = await supabase
                    .from('requests')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (error) {
                    console.error('Error fetching request:', error)
                    toast.error('Error al cargar la solicitud')
                    navigate('/dashboard')
                    return
                }

                if (data) {
                    setFormData(data.data)
                    setCurrentStep(data.step || 1)
                }
                setLoading(false)
            }
            fetchRequest()
        } else {
            // PREFILL AGENT DATA FROM PROFILE FOR NEW REQUESTS
            if (profile) {
                setFormData(prev => ({
                    ...prev,
                    agenteNombre: profile.first_name || '',
                    agenteApellido: profile.last_name || '',
                    agenteEmail: user?.email || '',
                    agenteTelefono: profile.phone || ''
                }))
            }
        }
    }, [id, profile, user, navigate])

    const saveDraft = async () => {
        if (!user) return

        const payload = {
            user_id: user.id,
            step: currentStep,
            data: formData,
            status: 'draft',
            updated_at: new Date()
        }

        try {
            let error
            if (id) {
                const { error: updateError } = await supabase
                    .from('requests')
                    .update(payload)
                    .eq('id', id)
                error = updateError
            } else {
                const { data: newRequest, error: insertError } = await supabase
                    .from('requests')
                    .insert(payload)
                    .select()
                    .single()

                if (!insertError && newRequest) {
                    navigate(`/request/${newRequest.id}`, { replace: true })
                }
                error = insertError
            }

            if (error) throw error
            toast.success('Borrador guardado exitosamente')
        } catch (error) {
            console.error('Error saving draft:', error)
            toast.error('Error al guardar el borrador')
        }
    }

    const nextStep = () => {
        setCurrentStep(prev => Math.min(prev + 1, 5))
        saveDraft() // Auto-save on step change? Optional, but good UX.
    }

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    const handleUpdate = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    if (loading) return <div className="p-8 text-center">Cargando solicitud...</div>

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20">
            {/* Top Stepper Area */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 py-8 mb-8 shadow-sm">
                <div className="max-w-4xl mx-auto">
                    <Stepper currentStep={currentStep} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="container max-w-4xl mx-auto px-4">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {id ? 'Editar Solicitud' : 'Nueva Solicitud'}
                        </h1>
                        <Button variant="ghost" size="sm" onClick={saveDraft} className="text-muted-foreground hover:text-primary">
                            <Save className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Guardar Borrador</span>
                        </Button>
                    </div>

                    <div className="mt-8">
                        {currentStep === 1 && (
                            <StepPropiedad
                                data={formData}
                                onUpdate={handleUpdate}
                                onNext={nextStep}
                                onBack={() => navigate('/dashboard')}
                            />
                        )}
                        {currentStep === 2 && (
                            <StepDueñoBanco
                                data={formData}
                                onUpdate={handleUpdate}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {currentStep === 3 && (
                            <StepArrendatario
                                data={formData}
                                onUpdate={handleUpdate}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {currentStep === 4 && (
                            <StepCalculos
                                data={formData}
                                onUpdate={handleUpdate}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {currentStep === 5 && (
                            <StepResumen
                                data={formData}
                                onBack={prevStep}
                                onComplete={async () => {
                                    if (id) {
                                        await supabase.from('requests').update({ status: 'submitted' }).eq('id', id)
                                    }
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
