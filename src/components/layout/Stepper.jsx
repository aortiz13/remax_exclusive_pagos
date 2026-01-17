import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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
            <div className="flex items-center justify-between relative max-w-2xl mx-auto">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2" />

                {steps.map((step, index) => {
                    const isActive = step.id === currentStep
                    const isCompleted = step.id < currentStep

                    return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center group">
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300",
                                    isActive
                                        ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                                        : isCompleted
                                            ? "bg-green-500 border-green-500 text-white"
                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="h-5 w-5" />
                                ) : (
                                    <span>{step.id}</span>
                                )}
                            </div>

                            {/* Label - visible on desktop, compact on mobile if needed */}
                            <div className="absolute top-12 whitespace-nowrap hidden sm:block">
                                <span className={cn(
                                    "text-xs font-semibold transition-colors uppercase tracking-wider",
                                    isActive ? "text-primary" : isCompleted ? "text-slate-700 dark:text-slate-300" : "text-slate-400"
                                )}>
                                    {step.label}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Mobile label below the steps */}
            <div className="sm:hidden text-center mt-14">
                <span className="text-sm font-bold text-primary uppercase tracking-widest">
                    {steps.find(s => s.id === currentStep)?.label}
                </span>
            </div>

            {/* Add some padding for the bottom labels on desktop */}
            <div className="hidden sm:block h-6" />
        </div>
    )
}
