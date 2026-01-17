import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Input, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Separator, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, FileText, Trash2, Play, Search, MapPin, User, Calendar, MoreVertical, Building2, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardTour } from '../hooks/useDashboardTour'

export default function Dashboard() {
    const { user } = useAuth()
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [requestToDelete, setRequestToDelete] = useState(null)
    const navigate = useNavigate()
    const { startTour } = useDashboardTour()

    useEffect(() => {
        startTour()
    }, [startTour])

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
            toast.error('Error al cargar solicitudes')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteClick = (id, e) => {
        e?.stopPropagation()
        setRequestToDelete(id)
    }

    const confirmDelete = async () => {
        if (!requestToDelete) return

        try {
            const { error } = await supabase
                .from('requests')
                .delete()
                .eq('id', requestToDelete)

            if (error) throw error
            setRequests(prev => prev.filter(r => r.id !== requestToDelete))
            toast.success('Solicitud eliminada')
        } catch (error) {
            console.error('Error deleting request:', error)
            toast.error('Error al eliminar la solicitud')
        } finally {
            setRequestToDelete(null)
        }
    }

    const resumeRequest = (id) => {
        navigate(`/request/${id}`)
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-CL', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    const getProgress = (step) => {
        return Math.min((step / 5) * 100, 100)
    }

    const filteredRequests = requests.filter(request => {
        const searchLower = searchTerm.toLowerCase()
        const address = request.data?.direccion?.toLowerCase() || ''
        const client = (request.data?.arrendatarioNombre || request.data?.dueñoNombre || '').toLowerCase()
        return address.includes(searchLower) || client.includes(searchLower)
    })

    return (
        <div className="min-h-[calc(100vh-80px)] bg-slate-50/50 dark:bg-slate-950/50">
            <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div id="tour-welcome">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Panel de Control</h1>
                        <p className="text-slate-500 mt-1">Gestiona tus solicitudes de contrato y seguimiento.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => startTour(true)} className="hidden sm:flex" title="Iniciar guía">
                            <HelpCircle className="mr-2 h-4 w-4" />
                            Guía
                        </Button>
                        <Button id="tour-new-request" onClick={() => navigate('/new-request')} size="lg" className="shadow-lg shadow-primary/20">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Nueva Solicitud
                        </Button>
                    </div>
                </div>

                {/* Search and Filter Bar */}
                <div id="tour-search" className="bg-white dark:bg-slate-900 rounded-lg border shadow-sm p-4 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por dirección, cliente..."
                            className="pl-9 bg-slate-50 border-0 focus-visible:ring-1 focus-visible:bg-white transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Placeholder for future filters */}
                    <div className="hidden sm:flex items-center text-sm text-slate-500">
                        {filteredRequests.length} {filteredRequests.length === 1 ? 'solicitud' : 'solicitudes'}
                    </div>
                </div>

                {/* Content Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 rounded-xl bg-slate-200 animate-pulse" />
                        ))}
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">No se encontraron solicitudes</h3>
                        <p className="text-slate-500 mb-4 max-w-sm mx-auto">
                            {searchTerm ? 'Intenta con otros términos de búsqueda.' : 'Comienza creando tu primera solicitud de contrato.'}
                        </p>
                        {!searchTerm && (
                            <Button onClick={() => navigate('/new-request')} variant="outline">
                                Crear Solicitud
                            </Button>
                        )}
                    </div>
                ) : (
                    <div id="tour-requests-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRequests.map((request) => (
                            <Card
                                key={request.id}
                                className="group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-800 cursor-pointer overflow-hidden relative"
                                onClick={() => resumeRequest(request.id)}
                            >
                                {/* Status Indicator Color Line */}
                                <div className={`absolute top-0 left-0 w-1 h-full ${request.status === 'submitted' ? 'bg-green-500' : 'bg-amber-400'}`} />

                                <CardHeader className="pb-3 pl-6">
                                    <div className="flex justify-between items-start">
                                        <Badge variant={request.status === 'submitted' ? 'default' : 'secondary'} className={request.status === 'submitted' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200'}>
                                            {request.status === 'submitted' ? 'Enviada' : 'Borrador'}
                                        </Badge>
                                        <div className="relative z-10">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400 hover:text-red-500" onClick={(e) => handleDeleteClick(request.id, e)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg font-bold line-clamp-1 mt-2 flex items-center gap-2" title={request.data?.direccion}>
                                        <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                                        {request.data?.direccion || 'Nueva Propiedad'}
                                    </CardTitle>
                                    <CardDescription className="line-clamp-1">
                                        {request.data?.comuna || 'Ubicación pendiente'}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="pl-6 pb-6 pt-0 space-y-4">
                                    <Separator />
                                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-slate-400" />
                                            <span className="truncate">
                                                {request.data?.arrendatarioNombre || request.data?.dueñoNombre || 'Cliente sin asignar'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-slate-400" />
                                            <span>Actualizado: {formatDate(request.updated_at)}</span>
                                        </div>
                                    </div>

                                    {request.status === 'draft' && (
                                        <div className="space-y-1.5 pt-2">
                                            <div className="flex justify-between text-xs font-medium text-slate-500">
                                                <span>Progreso</span>
                                                <span>{Math.round(getProgress(request.step))}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all duration-500 ease-out"
                                                    style={{ width: `${getProgress(request.step)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
                <AlertDialog open={!!requestToDelete} onOpenChange={(open) => !open && setRequestToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente la solicitud y todos los datos asociados.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
