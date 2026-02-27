import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ArrowLeft, Construction } from 'lucide-react'

export default function ManagementReportPage() {
    const navigate = useNavigate()

    return (
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-32 space-y-6">
            <div className="p-4 bg-amber-100 rounded-2xl">
                <Construction className="w-16 h-16 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sección en Construcción</h1>
            <p className="text-slate-500 text-center max-w-md">
                Estamos trabajando en el diseño final del informe de gestión. Pronto estará disponible.
            </p>
            <Button variant="outline" onClick={() => navigate('/informes-gestion')} className="gap-2 mt-4">
                <ArrowLeft className="w-4 h-4" />
                Volver a informes
            </Button>
        </div>
    )
}
