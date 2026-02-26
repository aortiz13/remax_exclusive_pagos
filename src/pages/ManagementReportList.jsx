import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Badge } from '@/components/ui'
import { FileText, Clock, CheckCircle, AlertTriangle, Loader2, ChevronRight, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function ManagementReportList() {
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    const isAdmin = ['superadministrador', 'comercial', 'legal'].includes(profile?.role)

    useEffect(() => {
        fetchReports()
    }, [user, filter])

    const fetchReports = async () => {
        if (!user) return
        setLoading(true)
        try {
            let query = supabase
                .from('management_reports')
                .select(`
                    *,
                    properties:property_id(address, commune),
                    owner:owner_contact_id(first_name, last_name, email),
                    agent:agent_id(first_name, last_name)
                `)
                .order('due_date', { ascending: true })

            // Non-admin agents only see their own reports
            if (!isAdmin) {
                query = query.eq('agent_id', user.id)
            }

            if (filter !== 'all') {
                query = query.eq('status', filter)
            }

            const { data, error } = await query
            if (error) throw error
            setReports(data || [])
        } catch (err) {
            console.error('Error fetching reports:', err)
        } finally {
            setLoading(false)
        }
    }

    const statusConfig = {
        pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
        overdue: { label: 'Atrasado', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
        sent: { label: 'Enviado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle }
    }

    const overdue = reports.filter(r => r.status === 'overdue').length
    const pending = reports.filter(r => r.status === 'pending').length
    const sent = reports.filter(r => r.status === 'sent').length

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        Informes de Gestión
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Informes periódicos de gestión para propietarios
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Atrasados', count: overdue, color: 'from-red-500 to-red-600', bg: 'bg-red-50' },
                    { label: 'Pendientes', count: pending, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50' },
                    { label: 'Enviados', count: sent, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' }
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn("rounded-xl p-4 border", stat.bg)}
                    >
                        <p className="text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }}>
                            <span className={cn("bg-gradient-to-r bg-clip-text text-transparent", stat.color)}>{stat.count}</span>
                        </p>
                        <p className="text-sm font-medium text-slate-600 mt-1">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                {[
                    { key: 'all', label: 'Todos' },
                    { key: 'overdue', label: 'Atrasados' },
                    { key: 'pending', label: 'Pendientes' },
                    { key: 'sent', label: 'Enviados' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={cn(
                            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            filter === tab.key
                                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Reports List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No hay informes de gestión</p>
                    <p className="text-sm">Los informes se crean automáticamente al registrar un mandato</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map((report, i) => {
                        const cfg = statusConfig[report.status] || statusConfig.pending
                        const StatusIcon = cfg.icon
                        const dueDate = new Date(report.due_date + 'T12:00:00')
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const isOverdue = report.status === 'pending' && dueDate < today

                        // Auto-mark as overdue visually
                        const displayCfg = isOverdue ? statusConfig.overdue : cfg

                        return (
                            <motion.div
                                key={report.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => navigate(`/informes-gestion/${report.id}`)}
                                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-2 rounded-lg", isOverdue ? 'bg-red-100' : 'bg-blue-100')}>
                                            <StatusIcon className={cn("w-5 h-5", isOverdue ? 'text-red-600' : 'text-blue-600')} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                                Informe #{report.report_number}
                                                {isAdmin && report.agent && (
                                                    <span className="text-slate-400 font-normal"> — {report.agent.first_name} {report.agent.last_name}</span>
                                                )}
                                            </h3>
                                            <p className="text-sm text-slate-500">
                                                {report.properties?.address || 'Propiedad sin dirección'}
                                                {report.properties?.commune && `, ${report.properties.commune}`}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Propietario: {report.owner?.first_name} {report.owner?.last_name}
                                                {report.owner?.email && ` · ${report.owner.email}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border", displayCfg.color)}>
                                                {displayCfg.label}
                                            </span>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Vence: {dueDate.toLocaleDateString('es-CL')}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
