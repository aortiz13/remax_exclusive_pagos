import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Separator, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'
import { useNavigate } from 'react-router-dom'
import { Trash2, Search, MapPin, Receipt, FileText, ArrowUpRight, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardTour } from '../hooks/useDashboardTour'
import { motion } from 'framer-motion'
import StickyNotesWidget from '../components/dashboard/StickyNotesWidget'
import QuickContactWidget from '../components/dashboard/QuickContactWidget'
import DailyCalendarWidget from '../components/dashboard/DailyCalendarWidget'
import { cn } from '@/lib/utils'

import GlobalSearch from '../components/dashboard/GlobalSearch'
import KpiDataEntry from '../components/kpi/KpiDataEntry'
import { Activity } from 'lucide-react'

export default function Dashboard() {
    const { user } = useAuth()
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [requestToDelete, setRequestToDelete] = useState(null)
    const navigate = useNavigate()
    const { startTour } = useDashboardTour()

    const [filterStatus, setFilterStatus] = useState('all') // 'all', 'pending', 'finalized'
    const [isContactModalOpen, setIsContactModalOpen] = useState(false)
    const [isKpiModalOpen, setIsKpiModalOpen] = useState(false)

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
            // Flatten the data structure since details are inside the 'data' column
            const flattenedRequests = data.map(req => ({
                ...req,
                ...(req.data || {})
            }))
            setRequests(flattenedRequests)
        } catch (error) {
            console.error('Error loading requests:', error)
            toast.error('Error al cargar solicitudes')
        } finally {
            setLoading(false)
        }
    }

    const deleteRequest = async () => {
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
            console.error('Error deleting:', error)
            toast.error('Error al eliminar solicitud')
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

    const filteredRequests = requests.filter(req => {
        if (!searchTerm) {
            if (filterStatus === 'all') return true
            if (filterStatus === 'pending') return req.status !== 'Finalizado' && req.status !== 'realizado' && req.status !== 'Realizado'
            if (filterStatus === 'finalized') return req.status === 'Finalizado' || req.status === 'realizado' || req.status === 'Realizado'
            if (filterStatus === 'draft') return req.status === 'draft' || req.status === 'borrador'
            return true
        }

        const term = searchTerm.toLowerCase()
        const matchesSearch = (
            req.direccion?.toLowerCase().includes(term) ||
            req.propiedadDireccion?.toLowerCase().includes(term) ||
            req.dueño_nombre?.toLowerCase().includes(term) ||
            req.vendedorNombre?.toLowerCase().includes(term) ||
            req.compradorNombre?.toLowerCase().includes(term) ||
            req.comuna?.toLowerCase().includes(term) ||
            req.type?.toLowerCase().includes(term) ||
            req.tipoSolicitud?.toLowerCase().includes(term)
        )

        if (filterStatus === 'all') return matchesSearch
        if (filterStatus === 'pending') return matchesSearch && req.status !== 'Finalizado' && req.status !== 'realizado' && req.status !== 'Realizado'
        if (filterStatus === 'finalized') return matchesSearch && (req.status === 'Finalizado' || req.status === 'realizado' || req.status === 'Realizado')
        if (filterStatus === 'draft') return matchesSearch && (req.status === 'draft' || req.status === 'borrador')
        return matchesSearch
    })

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'realizado':
            case 'finalizado': return 'bg-green-600 text-white hover:bg-green-700'
            case 'borrador':
            case 'draft': return 'bg-red-600 text-white hover:bg-red-700'
            case 'pendiente': return 'bg-amber-500 text-white hover:bg-amber-600'
            default: return 'bg-blue-600 text-white hover:bg-blue-700'
        }
    }

    const getStatusLabel = (status) => {
        if (!status) return 'Pendiente'
        if (status.toLowerCase() === 'draft') return 'BORRADOR'
        return status.charAt(0).toUpperCase() + status.slice(1)
    }

    const getPropertyIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'arriendo': return <Receipt className="w-4 h-4" />
            case 'venta': return <FileText className="w-4 h-4" />
            default: return <FileText className="w-4 h-4" />
        }
    }

    // Colors for property icons
    const getPropertyColor = (type) => {
        switch (type?.toLowerCase()) {
            case 'arriendo': return 'bg-purple-100 text-purple-600'
            case 'venta': return 'bg-emerald-100 text-emerald-600'
            default: return 'bg-blue-100 text-blue-600'
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    const quickActions = [
        {
            label: 'Redacción de Contrato',
            icon: FileText,
            path: '/contract-wizard',
            color: 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
        },
        {
            label: 'Link de Pago',
            icon: Receipt,
            path: '/payment-link',
            color: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
        },
        {
            label: 'Factura',
            icon: FileText,
            path: '/invoice',
            color: 'bg-amber-600 hover:bg-amber-700 text-white border-transparent'
        },
        {
            label: 'Factura',
            icon: FileText,
            path: '/invoice',
            color: 'bg-amber-600 hover:bg-amber-700 text-white border-transparent'
        },
        {
            label: 'Carga Rápida KPI',
            icon: Activity,
            action: () => setIsKpiModalOpen(true),
            color: 'bg-rose-600 hover:bg-rose-700 text-white border-transparent'
        },
    ]

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 bg-slate-50/50 min-h-screen">

            {/* Header & Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Hola, {user?.user_metadata?.first_name || 'Agente'}</h1>
                    <p className="text-slate-500">Aquí tienes el resumen de tus solicitudes</p>
                </div>

                <div className="w-full md:w-96 relative z-50">
                    {/* <GlobalSearch /> - Temporarily hidden per user request */}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Left Column: Quick Actions & Requests Table */}
                <div className="space-y-6 lg:col-span-2" data-tour="requests-list">

                    {/* Quick Actions Row - Now in Column */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3" data-tour="quick-actions">
                        <div className="mr-2 font-medium text-slate-700 text-sm md:text-base">Accesos Rápidos</div>
                        {quickActions.map((action, index) => (
                            <Button
                                key={index}
                                className={cn(
                                    "gap-2 shadow-sm transition-all",
                                    action.color
                                )}
                                onClick={() => action.action ? action.action() : navigate(action.path)}
                            >
                                <action.icon className="w-4 h-4" />
                                {action.label}
                            </Button>
                        ))}

                        <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block" />

                        <Button
                            variant="secondary"
                            className="gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700"
                            onClick={() => setIsContactModalOpen(true)}
                        >
                            <UserPlus className="w-4 h-4" />
                            Nuevo Contacto
                        </Button>
                    </div>

                    <div className="flex items-center justify-between mt-8">
                        <h2 className="text-lg font-semibold text-slate-900">Mis Solicitudes</h2>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {['all', 'pending', 'finalized', 'draft'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                        filterStatus === status
                                            ? "bg-white text-slate-900 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    {status === 'all' && 'Todas'}
                                    {status === 'pending' && 'Pendientes'}
                                    {status === 'finalized' && 'Finalizadas'}
                                    {status === 'draft' && 'Borrador'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Descripción / Cliente</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="hidden md:table-cell">Fecha</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                            No se encontraron solicitudes
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((req) => (
                                        <TableRow
                                            key={req.id}
                                            className="hover:bg-slate-50/50 group cursor-pointer"
                                            onClick={() => resumeRequest(req.id)}
                                        >
                                            <TableCell>
                                                <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", getPropertyColor(req.tipo_propiedad))}>
                                                    {getPropertyIcon(req.tipo_propiedad)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900">
                                                        {req.tipo_propiedad || 'Solicitud'} {req.comuna && `en ${req.comuna}`}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                                        <MapPin className="w-3 h-3" />
                                                        <span className="truncate max-w-[150px]">{req.direccion || 'Ubicación pendiente'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide", getStatusColor(req.status))}>
                                                    {getStatusLabel(req.status)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-xs text-slate-500">
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setRequestToDelete(req.id)
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Right Column: Widgets (Half Width) */}
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-tour="widgets">
                        {/* Calendar Widget */}
                        <div className="md:col-span-2">
                            <DailyCalendarWidget />
                        </div>

                        {/* Sticky Notes Widget - Now Full Width in Column */}
                        <div className="md:col-span-2 h-[400px]">
                            <StickyNotesWidget />
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals & Alerts */}
            <AlertDialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. La solicitud se eliminará permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteRequest} className="bg-red-600 hover:bg-red-700">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Nuevo Contacto</DialogTitle>
                        <DialogDescription>
                            Agrega un nuevo contacto rápidamente a tu base de datos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <QuickContactWidget
                            isModal={true}
                            onComplete={() => setIsContactModalOpen(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isKpiModalOpen} onOpenChange={setIsKpiModalOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Carga de KPI</DialogTitle>
                        <DialogDescription>
                            Registra tu actividad (Diaria, Semanal o Mensual).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <KpiDataEntry
                            defaultTab="daily"
                            onClose={() => setIsKpiModalOpen(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
