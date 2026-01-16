import React from 'react'

export default function Stepper({ currentStep }) {
    const steps = [
        { id: 1, label: 'Agente' },
        { id: 2, label: 'Propiedad' },
        { id: 3, label: 'Dueño / Banco' },
        { id: 4, label: 'Arrendatario' },
        { id: 5, label: 'Cálculos' },
        { id: 6, label: 'Resumen' },
    ]

    return (
        <div className="w-full">
            <div className="flex justify-between items-center relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 transform -translate-y-1/2 rounded" />

                {steps.map((step) => {
                    const isActive = step.id === currentStep
                    const isCompleted = step.id < currentStep

                    return (
                        <div key={step.id} className="flex flex-col items-center gap-2 bg-background px-2">
                            <div
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                                    ${isActive
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : isCompleted
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-background border-slate-300 text-slate-500'
                                    }
                                `}
                            >
                                {isCompleted ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    step.id
                                )}
                            </div>
                            <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-primary' : 'text-slate-500'}`}>
                                {step.label}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
