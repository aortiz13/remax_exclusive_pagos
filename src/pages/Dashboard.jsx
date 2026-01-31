import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Input, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Separator, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, FileText, Trash2, Play, Search, MapPin, User, Calendar, MoreVertical, Building2, HelpCircle, Receipt, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardTour } from '../hooks/useDashboardTour'
import { motion, AnimatePresence } from 'framer-motion'

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
        const request = requests.find(r => r.id === id)
        if (request?.type === 'invoice') {
            navigate(`/request/invoice/${id}`)
        } else if (request?.data?.contract_type) {
            navigate(`/request/contract/${id}`)
        } else {
            navigate(`/request/${id}`)
        }
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
        // Handle standard requests (direccion) and invoices (propiedadDireccion)
        const address = (request.data?.direccion || request.data?.propiedadDireccion || '').toLowerCase()

        // Handle standard requests (arrendatario/dueño) and invoices (comprador/vendedor)
        const client = (
            request.data?.arrendatarioNombre ||
            request.data?.dueñoNombre ||
            request.data?.comuna || // Include comuna too
            request.data?.compradorNombre ||
            request.data?.vendedorNombre ||
            ''
        ).toLowerCase()

        return address.includes(searchLower) || client.includes(searchLower)
    })

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    }

    return (
        <div className="min-h-[calc(100vh-80px)]">
            <div className="container max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
                    <div id="tour-welcome">
                        <h1 className="text-4xl font-display font-bold tracking-tight text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                            Panel de Control
                        </h1>
                        <p className="text-slate-500 mt-2 text-lg">Gestiona tus operaciones inmobiliarias.</p>
                    </div>
                </div>

                {/* Quick Actions Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    id="tour-new-request"
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                    {/* Card 1: Link de Pago */}
                    <div
                        className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer"
                        onClick={() => navigate('/request/payment/new')}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowUpRight className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />

                        <div className="relative z-10">
                            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                                <Receipt className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Link de Pago</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Cálculo de arriendo y generación de link Webpay.</p>
                        </div>
                    </div>

                    {/* Card 2: Redacción de Contrato */}
                    <div
                        className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer"
                        onClick={() => navigate('/request/contract/new')}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowUpRight className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-all" />

                        <div className="relative z-10">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
                                <FileText className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Redacción de Contrato</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Solicitud de contratos de compraventa o arriendo.</p>
                        </div>
                    </div>

                    {/* Card 3: Solicitud de Factura */}
                    <div
                        className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 cursor-pointer"
                        onClick={() => navigate('/request/invoice/new')}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowUpRight className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all" />

                        <div className="relative z-10">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
                                <Receipt className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Solicitud de Factura</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Emisión de factura por comisiones de venta/arriendo.</p>
                        </div>
                    </div>
                </motion.div>

                {/* Search and Filter Bar */}
                <div id="tour-search" className="sticky top-20 z-20 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 rounded-2xl border border-white/20 shadow-lg p-2 flex items-center gap-2 transition-all">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar solicitudes..."
                            className="w-full pl-11 pr-4 py-3 bg-transparent border-none text-sm focus:outline-none focus:ring-0 text-slate-900 placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Content Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 rounded-3xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
                        ))}
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 mb-6">
                            <Search className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No se encontraron solicitudes</h3>
                        <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                            Comienza creando tu primera solicitud utilizando los accesos directos de arriba.
                        </p>
                    </div>
                ) : (
                    <motion.div
                        variants={container}
                        initial="hidden"
                        animate="show"
                        id="tour-requests-list"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20"
                    >
                        {filteredRequests.map((request) => (
                            <motion.div
                                key={request.id}
                                variants={item}
                                onClick={() => resumeRequest(request.id)}
                            >
                                <div className="group h-full bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-slate-200 dark:border-slate-800 p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`
                                            px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                                            ${request.status === 'realizado' ? 'bg-green-100 text-green-700' :
                                                request.status === 'rechazado' ? 'bg-red-100 text-red-700' :
                                                    request.status === 'submitted' || request.status === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-600'}
                                        `}>
                                            {request.status === 'submitted' ? 'PENDIENTE' : request.status || 'BORRADOR'}
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-300 hover:text-red-500 transition-colors" onClick={(e) => handleDeleteClick(request.id, e)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="mb-6">
                                        <h4 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 mb-1">
                                            {request.data?.direccion || request.data?.propiedadDireccion || 'Nueva Solicitud'}
                                        </h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {request.data?.comuna || 'Ubicación pendiente'}
                                        </p>
                                    </div>

                                    <Separator className="mb-4 bg-slate-100 dark:bg-slate-800" />

                                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                            {request.type === 'invoice' ? <Receipt className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                            <span className="capitalize">{request.type === 'invoice' ? 'Factura' : 'Contrato'}</span>
                                        </div>
                                        <span>{formatDate(request.updated_at)}</span>
                                    </div>

                                    {/* Progress Bar for Drafts */}
                                    {request.status === 'draft' && (
                                        <div className="mt-4 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-500 ease-out"
                                                style={{ width: `${getProgress(request.step)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                <AlertDialog open={!!requestToDelete} onOpenChange={(open) => !open && setRequestToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción es irreversible. Se perderán todos los datos asociados.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
