import { Dialog, DialogContent, DialogHeader, DialogTitle, Badge } from '@/components/ui'
import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileText, Receipt, User, Building2, Calendar, ClipboardList } from 'lucide-react'

export function RequestDetailModal({ request, isOpen, onClose }) {
    const [auditLogs, setAuditLogs] = useState([])
    const [loadingLogs, setLoadingLogs] = useState(false)

    useEffect(() => {
        if (isOpen && request) {
            fetchAuditLogs()
        }
    }, [isOpen, request])

    const fetchAuditLogs = async () => {
        setLoadingLogs(true)
        try {
            const { data, error } = await supabase
                .from('request_audit_logs')
                .select(`
                    *,
                    actor:actor_id (
                        first_name,
                        last_name,
                        email
                    )
                `)
                .eq('request_id', request.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setAuditLogs(data || [])
        } catch (error) {
            console.error('Error fetching audit logs:', error)
        } finally {
            setLoadingLogs(false)
        }
    }

    if (!request) return null

    const typeConfig = {
        'contract': { icon: FileText, label: 'Contrato', color: 'text-indigo-600' },
        'invoice': { icon: Receipt, label: 'Factura', color: 'text-emerald-600' },
        'calculation': { icon: Receipt, label: 'Cálculo', color: 'text-blue-600' }
    }
    const typeParams = typeConfig[request.type || 'contract'] || typeConfig['contract']
    const Icon = typeParams.icon

    // Helper to render field safely
    const Field = ({ label, value, className = "" }) => (
        <div className={`space-y-1 ${className}`}>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">{value || '-'}</p>
        </div>
    )

    const Section = ({ title, icon: Icon, children }) => (
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-slate-500" />}
                {title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children}
            </div>
        </div>
    )

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full bg-slate-100 dark:bg-slate-800 ${typeParams.color}`}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Detalle de Solicitud</DialogTitle>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                <Badge variant="outline" className="capitalize">
                                    {request.status}
                                </Badge>
                                <span>•</span>
                                <span>{format(new Date(request.createdAt || request.updated_at), "d 'de' MMMM, yyyy", { locale: es })}</span>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                    {/* Left Column: Request Details */}
                    <div className="lg:col-span-2 space-y-4">

                        {/* Agent Info */}
                        <Section title="Agente Solicitante" icon={User}>
                            <Field label="Nombre" value={
                                request.data?.agente?.nombre
                                    ? `${request.data.agente.nombre} ${request.data.agente.apellido || ''}`
                                    : request.data?.agenteNombre
                                        ? `${request.data.agenteNombre} ${request.data.agenteApellido || ''}`
                                        : request.user
                                            ? `${request.user.first_name || ''} ${request.user.last_name || ''}`
                                            : '-'
                            } />
                            <Field label="Email" value={
                                request.data?.agente?.email
                                || request.data?.agenteEmail
                                || request.user?.email
                            } />
                            <Field label="Teléfono" value={
                                request.data?.agente?.telefono
                                || request.data?.agenteTelefono
                                || request.user?.phone
                            } />
                        </Section>

                        {/* Property Info */}
                        <Section title="Propiedad" icon={Building2}>
                            <Field label="Dirección" value={
                                request.data?.direccion ||
                                request.data?.propiedadDireccion ||
                                request.data?.direccion_propiedad
                            } className="md:col-span-2" />
                            <Field label="Comuna" value={request.data?.comuna || request.data?.comuna_propiedad || request.data?.propiedadComuna} />
                            <Field label="Tipo" value={request.data?.tipoPropiedad || request.data?.contract_type} />
                        </Section>

                        {/* Clients Info */}
                        <Section title="Clientes" icon={User}>
                            {request.type === 'invoice' ? (
                                <>
                                    <Field label="Vendedor" value={request.data?.vendedorNombre} />
                                    <Field label="Comprador" value={request.data?.compradorNombre} />
                                    <Field label="RUT Vendedor" value={request.data?.vendedorRut} />
                                    <Field label="RUT Comprador" value={request.data?.compradorRut} />
                                </>
                            ) : (
                                <>
                                    <Field label="Dueño/Arrendador" value={
                                        request.data?.dueñoNombre ||
                                        ((request.data?.arrendador_nombres || '') + ' ' + (request.data?.arrendador_apellidos || '')).trim()
                                    } />
                                    <Field label="Arrendatario" value={
                                        request.data?.arrendatarioNombre ||
                                        ((request.data?.arrendatario_nombres || '') + ' ' + (request.data?.arrendatario_apellidos || '')).trim()
                                    } />
                                    <Field label="RUT Dueño" value={request.data?.dueñoRut || request.data?.arrendador_rut} />
                                    <Field label="RUT Arrendatario" value={request.data?.arrendatarioRut || request.data?.arrendatario_rut} />
                                </>
                            )}
                        </Section>

                        {/* Financials / Specifics */}
                        <Section title="Detalles Financieros" icon={Receipt}>
                            {request.type === 'invoice' ? (
                                <>
                                    <Field label="Monto Comisión" value={request.data?.montoComision} />
                                    <Field label="Notas" value={request.data?.notas} className="md:col-span-2" />
                                </>
                            ) : (
                                <>
                                    <Field label="Canon Arriendo" value={request.data?.canonArriendo} />
                                    <Field label="Garantía" value={request.data?.garantia} />
                                    <Field label="Honorarios" value={request.data?.honorariosAdmin || request.data?.totalComision} />
                                </>
                            )}
                        </Section>
                    </div>

                    {/* Right Column: Audit Timeline */}
                    <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 lg:pl-6 pt-6 lg:pt-0">
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Historial de Cambios
                        </h3>

                        <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-8">
                            {loadingLogs ? (
                                <p className="text-sm text-slate-500 pl-2">Cargando historial...</p>
                            ) : auditLogs.length === 0 ? (
                                <p className="text-sm text-slate-500 pl-2">No hay registros de cambios.</p>
                            ) : (
                                auditLogs.map((log) => (
                                    <div key={log.id} className="relative pl-4">
                                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950 bg-slate-300 dark:bg-slate-700" />
                                        <div className="text-xs text-slate-500 mb-1">
                                            {format(new Date(log.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                                        </div>
                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                            Cambio a <span className="font-bold capitalize">{log.new_status}</span>
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            por {log.actor?.first_name || 'Desconocido'} {log.actor?.last_name || ''}
                                        </p>
                                    </div>
                                ))
                            )}

                            {/* Creation Node (approximate) */}
                            <div className="relative pl-4">
                                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950 bg-primary" />
                                <div className="text-xs text-slate-500 mb-1">
                                    {format(new Date(request.createdAt || request.updated_at), "d MMM yyyy, HH:mm", { locale: es })}
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                    Solicitud Creada
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
