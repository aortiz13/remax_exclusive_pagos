import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

export default function Stepper({ currentStep, steps }) {
    const defaultSteps = [
        { id: 1, label: 'Propiedad' },
        { id: 2, label: 'Dueño / Banco' },
        { id: 3, label: 'Arrendatario' },
        { id: 4, label: 'Cálculos' },
        { id: 5, label: 'Resumen' },
    ]

    const actualSteps = steps || defaultSteps
    const progress = (currentStep / (actualSteps.length || 1)) * 100

    return (
        <div className="w-full">
            <div className="flex items-center justify-between relative max-w-2xl mx-auto">
                {/* Background Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStep - 1) / (actualSteps.length - 1)) * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                </div>

                {actualSteps.map((step, index) => {
                    const isActive = step.id === currentStep
                    const isCompleted = step.id < currentStep

                    return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center group">
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                }}
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors duration-300 shadow-sm",
                                    isActive
                                        ? "bg-primary border-primary text-primary-foreground"
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
                            </motion.div>

                            {/* Label */}
                            <div className="absolute top-12 whitespace-nowrap hidden sm:block">
                                <span className={cn(
                                    "text-xs font-bold transition-all duration-300 uppercase tracking-wider",
                                    isActive ? "text-primary translate-y-0 opacity-100" : isCompleted ? "text-slate-600 dark:text-slate-400" : "text-slate-300 dark:text-slate-700"
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
                <motion.span
                    key={currentStep}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-bold text-primary uppercase tracking-widest"
                >
                    {actualSteps.find(s => s.id === currentStep)?.label}
                </motion.span>
            </div>

            {/* Add some padding for the bottom labels on desktop */}
            <div className="hidden sm:block h-6" />
        </div>
    )
}
