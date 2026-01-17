import React from 'react'

export default function Stepper({ currentStep }) {
    const steps = [
        { id: 1, label: 'Propiedad' },
        { id: 2, label: 'Dueño / Banco' },
        { id: 3, label: 'Arrendatario' },
        { id: 4, label: 'Cálculos' },
        { id: 5, label: 'Resumen' },
    ]

    return (
        <div className="w-full">
            {/* Desktop Vertical Stepper */}
            <div className="hidden lg:flex flex-col gap-8 relative">
                {/* Vertical Line */}
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200 -z-10" />

                {steps.map((step) => {
                    const isActive = step.id === currentStep
                    const isCompleted = step.id < currentStep

                    return (
                        <div key={step.id} className="flex items-center gap-4 group">
                            <div
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 z-10
                                    ${isActive
                                        ? 'bg-primary border-primary text-primary-foreground scale-110 shadow-lg'
                                        : isCompleted
                                            ? 'bg-green-500 border-green-500 text-white'
                                            : 'bg-white border-slate-300 text-slate-400 group-hover:border-slate-400'
                                    }
                                `}
                            >
                                {isCompleted ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    step.id
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-sm font-semibold transition-colors duration-300 ${isActive ? 'text-primary' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                                    {step.label}
                                </span>
                                {isActive && (
                                    <span className="text-xs text-slate-500 animate-in fade-in slide-in-from-left-2">
                                        En progreso
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Mobile Horizontal Stepper (Compact) */}
            <div className="flex lg:hidden justify-between items-center relative px-2">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10" />
                {steps.map((step) => {
                    const isActive = step.id === currentStep
                    const isCompleted = step.id < currentStep
                    return (
                        <div key={step.id} className="bg-background px-1">
                            <div
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                                    ${isActive
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : isCompleted
                                            ? 'bg-green-500 border-green-500 text-white'
                                            : 'bg-background border-slate-300 text-slate-400'
                                    }
                                `}
                            >
                                {isCompleted ? (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : step.id}
                            </div>
                        </div>
                    )
                })}
            </div>
            {/* Mobile Step Label */}
            <div className="lg:hidden text-center mt-3">
                <span className="text-sm font-medium text-primary block">
                    {steps.find(s => s.id === currentStep)?.label}
                </span>
            </div>
        </div>
    )
}
