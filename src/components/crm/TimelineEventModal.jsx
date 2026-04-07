import { useNavigate } from 'react-router-dom'
import { supabase, getCustomPublicUrl } from '../../services/supabase'
import {
    X, Zap, CheckCircle2, Circle, Mail, FileSignature, ClipboardCheck,
    ScrollText, Activity, Home, User, Calendar, MapPin, DollarSign,
    Briefcase, MessageSquare, FileText, ExternalLink, Clock,
    ArrowUpRight, Tag, Phone, StickyNote, Eye, MousePointerClick
} from 'lucide-react'
import { Button } from '@/components/ui'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TYPE_HEADERS = {
    accion: { icon: Zap, label: 'Detalle de Acción', gradient: 'from-[#003aad] to-blue-700' },
    tarea: { icon: CheckCircle2, label: 'Detalle de Tarea', gradient: 'from-amber-500 to-amber-600' },
    actividad: { icon: Activity, label: 'Detalle de Actividad', gradient: 'from-slate-500 to-slate-600' },
    correo: { icon: Mail, label: 'Detalle de Correo', gradient: 'from-slate-500 to-slate-600' },
    mandato: { icon: FileSignature, label: 'Detalle de Mandato', gradient: 'from-[#003aad] to-blue-700' },
    evaluacion: { icon: ClipboardCheck, label: 'Detalle de Evaluación', gradient: 'from-slate-500 to-slate-600' },
    nota: { icon: StickyNote, label: 'Detalle de Nota', gradient: 'from-amber-500 to-amber-600' },
    log: { icon: Activity, label: 'Detalle de Registro', gradient: 'from-slate-500 to-slate-600' },
    inspeccion: { icon: ClipboardCheck, label: 'Detalle de Inspección', gradient: 'from-teal-500 to-teal-600' },
    email_open: { icon: Eye, label: 'Apertura de Correo', gradient: 'from-indigo-500 to-indigo-600' },
    email_click: { icon: ArrowUpRight, label: 'Clic en Correo', gradient: 'from-emerald-500 to-emerald-600' },
}

function formatDate(iso) {
    if (!iso) return '—'
    try {
        return format(new Date(iso), "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es })
    } catch {
        return '—'
    }
}

function formatShortDate(iso) {
    if (!iso) return '—'
    try {
        return format(new Date(iso), "d MMM yyyy", { locale: es })
    } catch {
        return '—'
    }
}

function formatPrice(price, currency) {
    if (!price) return null
    const num = parseFloat(price)
    if (currency === 'UF') return `${num.toLocaleString('es-CL')} UF`
    if (currency === 'CLP') return `$${num.toLocaleString('es-CL')} CLP`
    return `$${num.toLocaleString('es-CL')}`
}

function getFileUrl(filePath) {
    // Handle legacy entries stored as objects {path, index} instead of strings
    const path = typeof filePath === 'object' ? filePath?.path : filePath
    return getCustomPublicUrl('mandates', path)
}

function getFileName(filePath) {
    const path = typeof filePath === 'object' ? filePath?.path : filePath
    if (!path || typeof path !== 'string') return 'Documento'
    const parts = path.split('/')
    const filename = parts[parts.length - 1]
    // Remove the random prefix: timestamp_random.ext → just show Doc N
    return filename
}

// ── Detail Row Component ──────────────────────────────────────

function DetailRow({ icon: Icon, label, value, onClick, className = '' }) {
    if (!value) return null
    return (
        <div className={`flex items-start gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${className}`}>
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">{label}</p>
                {onClick ? (
                    <p
                        className="text-sm text-blue-600 dark:text-blue-400 font-medium cursor-pointer hover:underline truncate"
                        onClick={onClick}
                    >
                        {value}
                    </p>
                ) : (
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap">{value}</p>
                )}
            </div>
        </div>
    )
}

// ── Main Modal Component ──────────────────────────────────────

const TimelineEventModal = ({ event, isOpen, onClose }) => {
    const navigate = useNavigate()

    if (!isOpen || !event) return null

    const header = TYPE_HEADERS[event.type] || TYPE_HEADERS.log
    const HeaderIcon = header.icon
    const meta = event.meta || {}

    const handleNavigate = (path) => {
        onClose()
        navigate(path)
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto animate-in zoom-in-95 fade-in slide-in-from-bottom-3 duration-300"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={`bg-gradient-to-r ${header.gradient} px-6 py-5 relative`}>
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <HeaderIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-white/80 text-xs font-medium uppercase tracking-wider">{header.label}</p>
                                <h2 className="text-white text-lg font-bold leading-snug mt-0.5 line-clamp-2">
                                    {event.title}
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">

                        {/* Date */}
                        <DetailRow icon={Calendar} label="Fecha" value={formatDate(event.date)} />

                        {/* Description */}
                        {event.description && (
                            <DetailRow icon={MessageSquare} label="Descripción" value={event.description} />
                        )}

                        {/* ── Type-specific fields ── */}

                        {/* Action specifics */}
                        {event.type === 'accion' && (
                            <>
                                {meta.dealType && <DetailRow icon={Briefcase} label="Tipo de Negocio" value={meta.dealType} />}
                                {meta.closingValue && <DetailRow icon={DollarSign} label="Valor de Cierre" value={formatPrice(meta.closingValue)} />}
                                {meta.grossFees && <DetailRow icon={DollarSign} label="Honorarios Brutos" value={formatPrice(meta.grossFees)} />}
                                {meta.isConversationStarter && <DetailRow icon={MessageSquare} label="Tipo" value="Inicio de conversación" />}
                            </>
                        )}

                        {/* Task specifics */}
                        {event.type === 'tarea' && (
                            <>
                                <DetailRow
                                    icon={meta.completed ? CheckCircle2 : Circle}
                                    label="Estado"
                                    value={meta.completed ? '✅ Completada' : '⏳ Pendiente'}
                                />
                                {meta.completed && meta.completedAt && (
                                    <DetailRow icon={CheckCircle2} label="Completada el" value={formatDate(meta.completedAt)} />
                                )}
                                {meta.completed && meta.executionDate && (
                                    <DetailRow icon={Calendar} label="Fecha programada" value={formatDate(meta.executionDate)} />
                                )}
                                {meta.taskType && meta.taskType !== 'task' && (
                                    <DetailRow icon={Tag} label="Tipo de Tarea" value={meta.taskType} />
                                )}
                                {meta.location && <DetailRow icon={MapPin} label="Ubicación" value={meta.location} />}
                            </>
                        )}

                        {/* Email specifics */}
                        {event.type === 'correo' && (
                            <>
                                {meta.from && <DetailRow icon={Mail} label="De" value={meta.from} />}
                                {meta.to && <DetailRow icon={ArrowUpRight} label="Para" value={meta.to} />}
                                {meta.tracking && (
                                    <>
                                        <div className="flex flex-col sm:flex-row gap-4 mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Aperturas
                                                </div>
                                                <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                                                    {meta.tracking.opens_count}
                                                </p>
                                            </div>
                                            <div className="w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    <MousePointerClick className="w-3.5 h-3.5" />
                                                    Clics en enlaces
                                                </div>
                                                <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                                                    {meta.tracking.clicks_count}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {/* Mandate specifics */}
                        {event.type === 'mandato' && (
                            <>
                                {meta.operationType && <DetailRow icon={Briefcase} label="Operación" value={meta.operationType} />}
                                {meta.captureType && <DetailRow icon={Tag} label="Tipo Captación" value={meta.captureType} />}
                                {meta.price && <DetailRow icon={DollarSign} label="Precio" value={formatPrice(meta.price, meta.currency)} />}
                                {meta.address && <DetailRow icon={MapPin} label="Dirección" value={meta.address} />}
                                {meta.commune && <DetailRow icon={MapPin} label="Comuna" value={meta.commune} />}
                                {meta.startDate && <DetailRow icon={Calendar} label="Fecha Inicio" value={formatShortDate(meta.startDate)} />}
                                {meta.endDate && <DetailRow icon={Clock} label="Fecha Término" value={formatShortDate(meta.endDate)} />}
                                {meta.status && <DetailRow icon={Tag} label="Estado" value={meta.status} />}

                                {/* Documents */}
                                {meta.fileUrls?.length > 0 && (
                                    <div className="py-3 border-b border-gray-100 dark:border-gray-800">
                                        <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium mb-2.5 flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5" />
                                            Documentos ({meta.fileUrls.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {meta.fileUrls.map((url, i) => (
                                                <a
                                                    key={i}
                                                    href={getFileUrl(url)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all hover:shadow-sm border border-blue-100 dark:border-blue-800"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    Documento {i + 1}
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Evaluation specifics */}
                        {event.type === 'evaluacion' && (
                            <>
                                {meta.status && <DetailRow icon={Tag} label="Estado" value={meta.status} />}
                            </>
                        )}

                        {/* Inspection specifics */}
                        {event.type === 'inspeccion' && (
                            <>
                                <DetailRow icon={Tag} label="Estado" value={meta.statusLabel} />
                                {meta.inspectionDate && <DetailRow icon={Calendar} label="Fecha Inspección" value={formatShortDate(meta.inspectionDate)} />}
                                {meta.ownerName && <DetailRow icon={User} label="Propietario" value={meta.ownerName} />}
                                {meta.tenantName && <DetailRow icon={User} label="Arrendatario" value={meta.tenantName} />}
                                {meta.agentName && <DetailRow icon={Briefcase} label="Agente" value={meta.agentName} />}
                                {meta.observations && <DetailRow icon={MessageSquare} label="Observaciones" value={meta.observations} />}
                                {meta.recommendations && <DetailRow icon={MessageSquare} label="Recomendaciones" value={meta.recommendations} />}
                                {meta.sentAt && <DetailRow icon={Mail} label="Enviado el" value={formatDate(meta.sentAt)} />}
                                {meta.pdfUrl && (
                                    <div className="py-3 border-b border-gray-100 dark:border-gray-800">
                                        <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium mb-2.5 flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5" />
                                            PDF del Informe
                                        </p>
                                        <a
                                            href={meta.pdfUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all hover:shadow-sm border border-teal-100 dark:border-teal-800"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Ver PDF
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Activity log details */}
                        {event.type === 'log' && meta.details && Object.keys(meta.details).length > 0 && (() => {
                            const DETAIL_LABELS = {
                                zone: 'Zona', source: 'Fuente', bedrooms: 'Dormitorios',
                                bathrooms: 'Baños', short_id: 'ID Corto', amenities: 'Características',
                                max_budget: 'Presupuesto Máx.', property_type: 'Tipo Inmueble',
                                operation_type: 'Tipo Operación', address: 'Dirección',
                                commune: 'Comuna', region: 'Región', email: 'Correo',
                                phone: 'Teléfono', contactId: 'ID Contacto', propertyId: 'ID Propiedad',
                                m2_total: 'm² Totales', m2_built: 'm² Construidos',
                                parking_spaces: 'Estacionamientos', year_built: 'Año Construcción',
                                observations: 'Observaciones', tracking_id: 'ID de Rastreo', clicked_url: 'URL Visitada',
                                is_real_open: 'Apertura Verificada'
                            }
                            return (
                                <div className="py-3 border-b border-gray-100 dark:border-gray-800">
                                    <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium mb-2">
                                        Detalles Adicionales
                                    </p>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-1.5 text-xs">
                                        {Object.entries(meta.details)
                                            .filter(([k]) => k !== 'id')
                                            .map(([key, value]) => (
                                                <div key={key} className="flex gap-2">
                                                    <span className="font-semibold text-gray-500 shrink-0">
                                                        {DETAIL_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:
                                                    </span>
                                                    <span className="text-gray-700 dark:text-gray-300">
                                                        {Array.isArray(value) ? value.join(', ') : String(value)}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Related entities */}
                        {(meta.contactNames || meta.contactName || meta.propertyAddress) && (
                            <div className="py-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium mb-2.5">
                                    Entidades Relacionadas
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {(meta.contactNames || meta.contactName) && (
                                        <button
                                            onClick={() => meta.contactId && handleNavigate(`/crm/contact/${meta.contactId}`)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <User className="w-3.5 h-3.5" />
                                            {meta.contactNames || meta.contactName}
                                            {meta.contactId && <ArrowUpRight className="w-3 h-3" />}
                                        </button>
                                    )}
                                    {meta.propertyAddress && (
                                        <button
                                            onClick={() => meta.propertyId && handleNavigate(`/crm/property/${meta.propertyId}`)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <Home className="w-3.5 h-3.5" />
                                            {meta.propertyAddress}
                                            {meta.propertyId && <ArrowUpRight className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={onClose}>
                            Cerrar
                        </Button>
                        {event.type === 'mandato' && meta.propertyId && (
                            <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => handleNavigate(`/crm/property/${meta.propertyId}`)}
                            >
                                <Home className="w-3.5 h-3.5 mr-1.5" />
                                Ver Propiedad
                            </Button>
                        )}
                        {event.type === 'tarea' && meta.contactId && (
                            <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => handleNavigate(`/crm/contact/${meta.contactId}`)}
                            >
                                <User className="w-3.5 h-3.5 mr-1.5" />
                                Ver Contacto
                            </Button>
                        )}
                        {event.type === 'inspeccion' && meta.inspectionId && (
                            <Button
                                size="sm"
                                className="bg-teal-500 hover:bg-teal-600 text-white"
                                onClick={() => handleNavigate(`/inspecciones/${meta.inspectionId}`)}
                            >
                                <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
                                Ver Inspección
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default TimelineEventModal
