import React from 'react'
import { Card, CardContent, Button } from '@/components/ui'
import { Users, User, ArrowRightLeft } from 'lucide-react'

export default function StepHonorariosConfig({ data, onUpdate, onNext, onBack }) {
    const isVenta = data.tipoSolicitud === 'venta'

    // Labels based on operation type
    const roles = isVenta
        ? [
            { id: 'Ambas', label: 'Ambas Puntas', sub: 'Cobro a Vendedor y Comprador', icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-50' },
            { id: 'Vendedor', label: 'Punta Vendedora', sub: 'Solo cobro a Vendedor', icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
            { id: 'Comprador', label: 'Punta Compradora', sub: 'Solo cobro a Comprador', icon: User, color: 'text-green-600', bg: 'bg-green-50' }
        ]
        : [
            { id: 'Ambas', label: 'Ambas Puntas', sub: 'Cobro a Arrendador y Arrendatario', icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-50' },
            { id: 'Arrendador', label: 'Punta Arrendadora', sub: 'Solo cobro a Arrendador', icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
            { id: 'Arrendatario', label: 'Punta Arrendataria', sub: 'Solo cobro a Arrendatario', icon: User, color: 'text-green-600', bg: 'bg-green-50' }
        ]

    const currentRole = isVenta ? data.ventaRole : data.arriendoRole

    const handleSelect = (roleId) => {
        if (isVenta) {
            onUpdate('ventaRole', roleId)
        } else {
            onUpdate('arriendoRole', roleId)
        }
    }

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <div className="mb-8 space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Users className="w-6 h-6" />
                        Configuración de la Operación
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Seleccione quién pagará los honorarios de esta operación.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-8">
                    {roles.map((role) => {
                        const Icon = role.icon
                        const isActive = currentRole === role.id

                        return (
                            <div
                                key={role.id}
                                onClick={() => handleSelect(role.id)}
                                className={`
                                    flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                                    ${isActive
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                        : 'border-slate-100 bg-white hover:border-primary/40 hover:bg-slate-50'}
                                `}
                            >
                                <div className={`p-3 rounded-lg mr-4 ${role.bg} ${role.color}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className={`font-bold ${isActive ? 'text-primary' : 'text-slate-800'}`}>
                                        {role.label}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {role.sub}
                                    </p>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-primary bg-primary' : 'border-slate-200'}`}>
                                    {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="flex justify-between pt-4 gap-4">
                    <Button type="button" variant="outline" onClick={onBack} className="w-full md:w-auto">
                        Atrás
                    </Button>
                    <Button
                        type="button"
                        onClick={onNext}
                        className="w-full md:w-auto"
                        disabled={!currentRole}
                    >
                        Siguiente
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
