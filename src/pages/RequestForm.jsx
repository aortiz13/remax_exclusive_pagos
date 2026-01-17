
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import Stepper from '../components/layout/Stepper'
import StepAgente from '../components/steps/StepAgente'
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
        setCurrentStep(prev => Math.min(prev + 1, 6))
        saveDraft() // Auto-save on step change? Optional, but good UX.
    }

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    const handleUpdate = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    if (loading) return <div className="p-8 text-center">Cargando solicitud...</div>

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                    {id ? 'Editando Solicitud' : 'Nueva Solicitud'}
                </h2>
                <Button variant="outline" onClick={saveDraft}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Borrador
                </Button>
            </div>

            <Stepper currentStep={currentStep} />

            <div className="mt-6 md:mt-8">
                {currentStep === 1 && (
                    <StepAgente
                        data={formData}
                        onUpdate={handleUpdate}
                        onNext={nextStep}
                    />
                )}
                {currentStep === 2 && (
                    <StepPropiedad
                        data={formData}
                        onUpdate={handleUpdate}
                        onNext={nextStep}
                        onBack={prevStep}
                    />
                )}
                {currentStep === 3 && (
                    <StepDueñoBanco
                        data={formData}
                        onUpdate={handleUpdate}
                        onNext={nextStep}
                        onBack={prevStep}
                    />
                )}
                {currentStep === 4 && (
                    <StepArrendatario
                        data={formData}
                        onUpdate={handleUpdate}
                        onNext={nextStep}
                        onBack={prevStep}
                    />
                )}
                {currentStep === 5 && (
                    <StepCalculos
                        data={formData}
                        onUpdate={handleUpdate}
                        onNext={nextStep}
                        onBack={prevStep}
                    />
                )}
                {currentStep === 6 && (
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
    )
}
