import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from "@/components/ui"
import { Building2, FileText, ArrowLeft, Receipt } from "lucide-react"
import { Button } from "@/components/ui"

export default function NewRequestSelection() {
    const navigate = useNavigate()

    return (
        <div className="min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex flex-col items-center justify-center">
            <div className="max-w-4xl w-full space-y-8">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Nueva Solicitud</h1>
                    <p className="text-slate-500">Selecciona el tipo de gestión que deseas realizar</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card
                        className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 hover:border-primary group"
                        onClick={() => navigate('/request/payment/new')}
                    >
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                            <div className="p-6 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
                                <Receipt className="h-12 w-12 text-blue-600" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors">Link de Pago</h3>
                                <p className="text-sm text-slate-500 max-w-[200px] mx-auto">
                                    Generar solicitud para cálculo de arriendo y link de pago.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 hover:border-primary group"
                        onClick={() => navigate('/request/contract/new')}
                    >
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                            <div className="p-6 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                                <FileText className="h-12 w-12 text-indigo-600" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors">Redacción de Contrato</h3>
                                <p className="text-sm text-slate-500 max-w-[200px] mx-auto">
                                    Solicitar redacción de contratos de compraventa o arriendo.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center">
                    <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-slate-500">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel
                    </Button>
                </div>
            </div>
        </div>
    )
}
