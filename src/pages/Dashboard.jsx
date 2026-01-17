
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, FileText, Trash2, Play } from 'lucide-react'

export default function Dashboard() {
    const { user } = useAuth()
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        if (user) {
            fetchRequests()
        }
    }, [user])

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('requests')
                .select('*')
                .order('updated_at', { ascending: false })

            if (error) throw error
            setRequests(data)
        } catch (error) {
            console.error('Error loading requests:', error)
        } finally {
            setLoading(false)
        }
    }

    const deleteRequest = async (id) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta solicitud?')) return

        try {
            const { error } = await supabase
                .from('requests')
                .delete()
                .eq('id', id)

            if (error) throw error
            setRequests(prev => prev.filter(r => r.id !== id))
        } catch (error) {
            console.error('Error deleting request:', error)
            alert('Error al eliminar la solicitud')
        }
    }

    const resumeRequest = (id) => {
        navigate(`/request/${id}`)
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-CL', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="container max-w-5xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Mis Solicitudes</h1>
                    <p className="text-slate-500 mt-1">Administra tus solicitudes de pago</p>
                </div>
                <Button onClick={() => navigate('/new-request')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nueva Solicitud
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-8">Cargando...</div>
            ) : requests.length === 0 ? (
                <Card className="text-center py-12">
                    <CardContent>
                        <div className="flex justify-center mb-4">
                            <FileText className="h-12 w-12 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2">No tienes solicitudes</h3>
                        <p className="text-slate-500 mb-4">Comienza creando una nueva solicitud de pago.</p>
                        <Button onClick={() => navigate('/new-request')} variant="outline">
                            Crear Primera Solicitud
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {requests.map((request) => (
                        <Card key={request.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-lg">
                                            {request.data?.agenteNombre ? `Solicitud de ${request.data.agenteNombre}` : 'Borrador sin nombre'}
                                        </span>
                                        <Badge variant={request.status === 'submitted' ? 'default' : 'secondary'}>
                                            {request.status === 'submitted' ? 'Enviada' : 'Borrador'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Última actualización: {formatDate(request.updated_at)} • Paso {request.step}/6
                                    </p>
                                    <p className="text-sm text-slate-600 truncate max-w-md">
                                        {request.data?.direccion || 'Dirección no especificada'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {request.status === 'draft' && (
                                        <Button variant="outline" size="sm" onClick={() => resumeRequest(request.id)}>
                                            <Play className="mr-2 h-3 w-3" />
                                            Retomar
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => deleteRequest(request.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
