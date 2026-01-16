import { useState, useEffect } from 'react'
import Header from './components/layout/Header'
import Stepper from './components/layout/Stepper'
import StepAgente from './components/steps/StepAgente'
import StepPropiedad from './components/steps/StepPropiedad'
import StepDueñoBanco from './components/steps/StepDueñoBanco'
import StepCalculos from './components/steps/StepCalculos'
import StepResumen from './components/steps/StepResumen'

function App() {
  const [currentStep, setCurrentStep] = useState(1)

  useEffect(() => {
    // Dynamic Favicon from Env Var
    const faviconUrl = import.meta.env.VITE_FAVICON_URL;
    if (faviconUrl) {
      const link = document.getElementById('favicon');
      if (link) link.href = faviconUrl;
    }

    // Dynamic Title from Env Var
    const appTitle = import.meta.env.VITE_APP_TITLE;
    if (appTitle) {
      document.title = appTitle;
    }
  }, []);
  const [formData, setFormData] = useState({
    // Agente (New)
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

  // 5 Steps total now
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5))
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  const handleUpdate = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col">
      <Header />
      <main className="container max-w-4xl mx-auto px-4 py-8 flex-1">
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
            />
          )}
        </div>
      </main>
    </div>
  )
}
export default App
