import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Separator, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui'
import { useNavigate } from 'react-router-dom'
import { Trash2, Search, MapPin, Receipt, FileText, ArrowUpRight, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardTour } from '../hooks/useDashboardTour'
import { motion } from 'framer-motion'
import StickyNotesWidget from '../components/dashboard/StickyNotesWidget'
import QuickContactWidget from '../components/dashboard/QuickContactWidget'
import DailyCalendarWidget from '../components/dashboard/DailyCalendarWidget'

export default function Dashboard() {
    const [filterStatus, setFilterStatus] = useState('all') // 'all', 'pending', 'finalized'
    const [isContactModalOpen, setIsContactModalOpen] = useState(false)

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
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const filteredRequests = requests.filter(request => {
        // Search Filter
        const searchLower = searchTerm.toLowerCase()
        const address = (request.data?.direccion || request.data?.propiedadDireccion || '').toLowerCase()
        const client = (
            request.data?.arrendatarioNombre ||
            request.data?.dueñoNombre ||
            request.data?.comuna ||
            request.data?.compradorNombre ||
            request.data?.vendedorNombre ||
            ''
        ).toLowerCase()
        const matchesSearch = address.includes(searchLower) || client.includes(searchLower)

        // Status Filter
        let matchesStatus = true
        const status = request.status || 'draft'

        if (filterStatus === 'pending') {
            matchesStatus = status === 'submitted' || status === 'pendiente'
        } else if (filterStatus === 'finalized') {
            matchesStatus = status === 'realizado' || status === 'rechazado'
        }

        return matchesSearch && matchesStatus
    })

    const getStatusBadge = (status) => {
        switch (status) {
            case 'realizado':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">Realizado</span>
            case 'rechazado':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">Rechazado</span>
            case 'submitted':
            case 'pendiente':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white">Pendiente</span>
            case 'draft':
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500 text-white">Borrador</span>
        }
    }

    return (
        <div className="min-h-[calc(100vh-80px)] pb-12">
            <div className="container max-w-7xl mx-auto space-y-6">

                {/* Header Section with Global Search */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
                    <div id="tour-welcome">
                        <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                            Panel de Control
                        </h1>
                        <p className="text-slate-500 text-sm">Resumen de operaciones.</p>
                    </div>

                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar en todo..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Column: Main Content (3/4) */}
                    <div className="lg:col-span-3 space-y-8">

                        {/* Quick Actions Row */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Accesos Rápidos</h2>
                            <div className="flex flex-wrap gap-4">
                                {/* Primary Action: Contract */}
                                <Button
                                    size="lg"
                                    className="h-12 px-6 shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white transition-all transform hover:-translate-y-0.5"
                                    onClick={() => navigate('/request/contract/new')}
                                >
                                    <FileText className="mr-2 h-5 w-5" />
                                    Redacción de Contrato
                                </Button>

                                {/* Secondary Actions */}
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="h-12 px-6 border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                                    onClick={() => navigate('/request/payment/new')}
                                >
                                    <Receipt className="mr-2 h-5 w-5 text-blue-500" />
                                    Link de Pago
                                </Button>

                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="h-12 px-6 border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                                    onClick={() => navigate('/request/invoice/new')}
                                >
                                    <Receipt className="mr-2 h-5 w-5 text-emerald-500" />
                                    Factura
                                </Button>

                                <div className="ml-auto">
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        className="h-12 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white"
                                        onClick={() => setIsContactModalOpen(true)}
                                    >
                                        <UserPlus className="mr-2 h-5 w-5" />
                                        Nuevo Contacto
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Requests Table Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mis Solicitudes</h2>

                                {/* Status Tabs */}
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                    <button
                                        onClick={() => setFilterStatus('all')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${filterStatus === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        Todas
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('pending')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${filterStatus === 'pending' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        Pendientes
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('finalized')}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${filterStatus === 'finalized' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        Finalizadas
                                    </button>
                                </div>
                            </div>

                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 font-semibold">
                                            <tr>
                                                <th className="px-6 py-4">Tipo</th>
                                                <th className="px-6 py-4">Descripción / Cliente</th>
                                                <th className="px-6 py-4">Estado</th>
                                                <th className="px-6 py-4">Fecha</th>
                                                <th className="px-6 py-4 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">Cargando...</td>
                                                </tr>
                                            ) : filteredRequests.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-12 text-center">
                                                        <div className="flex flex-col items-center justify-center text-slate-500">
                                                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                                                <Search className="w-6 h-6 text-slate-300" />
                                                            </div>
                                                            <p>No se encontraron solicitudes</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredRequests.map((request) => (
                                                    <tr
                                                        key={request.id}
                                                        onClick={() => resumeRequest(request.id)}
                                                        className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${request.type === 'invoice' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                                {request.type === 'invoice' ? <Receipt className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-slate-900 dark:text-white">
                                                                {request.data?.direccion || request.data?.propiedadDireccion || 'Nueva Solicitud'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                                <MapPin className="w-3 h-3" />
                                                                {request.data?.comuna || 'Ubicación pendiente'}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {getStatusBadge(request.status)}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500">
                                                            {formatDate(request.updated_at)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                                onClick={(e) => handleDeleteClick(request.id, e)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    </div>

                    {/* Right Column: Sidebar (1/4) */}
                    <div className="lg:col-span-1 space-y-6">
                        <DailyCalendarWidget />
                        <div className="sticky top-24">
                            <StickyNotesWidget />
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
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

                {/* New Contact Modal */}
                <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Nuevo Contacto</DialogTitle>
                            <DialogDescription>
                                Agrega un nuevo contacto rápidamente a tu CRM.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-2">
                            <QuickContactWidget onComplete={() => setIsContactModalOpen(false)} isModal={true} />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
