import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import Stepper from '../components/layout/Stepper'
import StepPropiedad from '../components/steps/StepPropiedad'
import StepDueñoBanco from '../components/steps/StepDueñoBanco'
import StepArrendatario from '../components/steps/StepArrendatario'
import StepCalculos from '../components/steps/StepCalculos'
import StepResumen from '../components/steps/StepResumen'
import StepParte from '../components/steps/StepParte'
import StepComision from '../components/steps/StepComision'
import { Button, Card, CardContent } from '@/components/ui'
import { Save, Building, Briefcase } from 'lucide-react'

export default function RequestForm() {
    const { id } = useParams()
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [currentStep, setCurrentStep] = useState(1) // 0 = Selection, 1+ = Flow
    const [loading, setLoading] = useState(!!id)

    const [formData, setFormData] = useState({
        // General
        tipoSolicitud: '', // 'arriendo' | 'compraventa'

        // Agent
        agenteNombre: '',
        agenteApellido: '',
        agenteEmail: '',
        agenteTelefono: '',
        // Propiedad
        tipoPropiedad: '',
        direccion: '',
        comuna: '',
        // Arriendo Specific
        dueñoNombre: '',
        dueñoRut: '',
        dueñoEmail: '',
        dueñoTelefono: '',
        arrendatarioNombre: '',
        arrendatarioApellido: '',
        arrendatarioEmail: '',
        arrendatarioTelefono: '',
        arrendatarioRut: '',
        bancoNombre: '',
        bancoTipoCuenta: '',
        bancoNroCuenta: '',
        bancoRutTitular: '',
        // Calculos Arriendo
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
        duracionContrato: '',
        contractType: '', // 'residential' | 'commercial'
        conAdministracion: false,
        porcentajeAdministracion: '',

        // Compraventa Specific
        vendedorNombre: '',
        vendedorRut: '',
        vendedorEmail: '',
        compradorNombre: '',
        compradorRut: '',
        compradorEmail: '',
        montoComision: '',

        // New Rental Fields (Puntas & Addresses & Logic)
        arriendoRole: 'Ambas', // 'Ambas' | 'Arrendador' | 'Arrendatario'
        dueñoDireccion: '',
        dueñoComuna: '', // Separate from property commune
        arrendatarioDireccion: '',
        arrendatarioComuna: '',
        fechaEnvioLink: '', // Date string
        ufValue: '', // Store the UF value used for calculation
        ingresoManual: false, // For manual fee override
        feeAlertTriggered: false, // If manual fee is below minimum
        chkCondicionesEspeciales: false, // New: Special conditions toggle
        condicionesEspeciales: '', // New: Special conditions text

        // Independent Fees Logic (Arriendo)
        honorariosEncargadoA: '', // Result for A (Owner)
        honorariosEncargadoB: '', // Result for B (Tenant) - if needed to persist
        ingresoManualA: false,
        ingresoManualB: false,
        montoManualA: '',
        montoManualB: '',

        // Independent Commission Logic (Compraventa)
        dividirComision: false,
        comisionVendedor: '',
        comisionComprador: '',
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

                if (data && data.data) {
                    // Merge DB data with default structure to prevent missing field errors
                    setFormData(prev => ({ ...prev, ...data.data }))
                }
                setLoading(false)
            }
            fetchRequest()
        } else {
            // New Request - Pre-fill Agent Info
            if (profile) {
                setFormData(prev => ({
                    ...prev,
                    agenteNombre: profile.first_name || '',
                    agenteApellido: profile.last_name || '',
                    agenteEmail: user?.email || '',
                    agenteTelefono: profile.phone || ''
                }))
            }
            setLoading(false)
        }
    }, [id, user, profile, navigate])


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
        setCurrentStep(prev => prev + 1)
        saveDraft()
    }

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    const handleUpdate = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSelectType = (type) => {
        handleUpdate('tipoSolicitud', type)
        // If type selected, proceed to Step 1 (or Step 1 is Propiedad for both)
        // We are already at step 1 technically if we consider selection as step 0 or transient state.
        // Let's say Selection is not a "Step" in the Stepper, just pre-requisite.
    }

    if (loading) return <div className="p-8 text-center">Cargando solicitud...</div>

    // SELECTION SCREEN if no type selected
    if (!formData.tipoSolicitud) {
        return (
            <div className="container max-w-4xl mx-auto px-4 py-12">
                <h1 className="text-3xl font-bold text-center mb-2">Nueva Solicitud de Link de Pago</h1>
                <p className="text-muted-foreground text-center mb-8">Seleccione el tipo de operación para continuar.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                    <Card
                        className="cursor-pointer hover:border-primary hover:shadow-md transition-all group"
                        onClick={() => handleSelectType('arriendo')}
                    >
                        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                            <div className="p-4 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Building className="w-10 h-10" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Arriendo</h3>
                                <p className="text-sm text-muted-foreground mt-1">Generar solicitud de link de pago por arriendo</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer hover:border-primary hover:shadow-md transition-all group"
                        onClick={() => handleSelectType('compraventa')}
                    >
                        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                            <div className="p-4 rounded-full bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                <Briefcase className="w-10 h-10" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Compraventa</h3>
                                <p className="text-sm text-muted-foreground mt-1">Generar solicitud de link de pago por compra venta de propiedades</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center mt-12">
                    <Button variant="outline" onClick={() => navigate('/dashboard')}>Cancelar y Volver</Button>
                </div>
            </div>
        )
    }

    // Determine Logic based on Type
    const isArriendo = formData.tipoSolicitud === 'arriendo'

    // STEPS CONFIG
    const ARRIENDO_STEPS = [
        { id: 1, label: 'Propiedad' },
        { id: 2, label: 'Dueño / Banco' },
        { id: 3, label: 'Arrendatario' },
        { id: 4, label: 'Cálculos' },
        { id: 5, label: 'Resumen' },
    ]

    const COMPRAVENTA_STEPS = [
        { id: 1, label: 'Propiedad' },
        { id: 2, label: 'Vendedor' },
        { id: 3, label: 'Comprador' },
        { id: 4, label: 'Comisión' },
        { id: 5, label: 'Resumen' },
    ]

    const currentSteps = isArriendo ? ARRIENDO_STEPS : COMPRAVENTA_STEPS

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20">
            {/* Top Stepper Area */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-6 mb-8">
                <div className="max-w-4xl mx-auto">
                    <Stepper currentStep={currentStep} steps={currentSteps} />
                    <div className="text-center mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        {formData.tipoSolicitud}
                    </div>
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
                        {/* SHARED STEP 1: PROPIEDAD */}
                        {currentStep === 1 && (
                            <StepPropiedad
                                data={formData}
                                onUpdate={handleUpdate}
                                onNext={nextStep}
                                onBack={() => setFormData(prev => ({ ...prev, tipoSolicitud: '' }))} // Back to Selection
                            />
                        )}

                        {/* ARRIENDO FLOW */}
                        {isArriendo && (
                            <>
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
                            </>
                        )}

                        {/* COMPRAVENTA FLOW */}
                        {!isArriendo && (
                            <>
                                {currentStep === 2 && (
                                    <StepParte
                                        type="Vendedor"
                                        data={formData}
                                        onUpdate={handleUpdate}
                                        onNext={nextStep}
                                        onBack={prevStep}
                                    />
                                )}
                                {currentStep === 3 && (
                                    <StepParte
                                        type="Comprador"
                                        data={formData}
                                        onUpdate={handleUpdate}
                                        onNext={nextStep}
                                        onBack={prevStep}
                                    />
                                )}
                                {currentStep === 4 && (
                                    <StepComision
                                        data={formData}
                                        onUpdate={handleUpdate}
                                        onNext={nextStep}
                                        onBack={prevStep}
                                    />
                                )}
                            </>
                        )}

                        {/* SHARED STEP 5: RESUMEN */}
                        {currentStep === 5 && (
                            <StepResumen
                                data={formData}
                                onUpdate={handleUpdate}
                                onBack={prevStep}
                                onComplete={async () => {
                                    if (id) {
                                        await supabase.from('requests').update({ status: 'submitted' }).eq('id', id)
                                    }
                                    // Could redirect here or StepResumen handles it.
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
