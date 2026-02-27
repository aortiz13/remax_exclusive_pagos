import { Dialog, DialogContent, DialogHeader, DialogTitle, Badge } from '@/components/ui'
import { useEffect, useState } from 'react'
import { supabase, getCustomPublicUrl } from '@/services/supabase'
import { triggerEvaluacionComercialCompletionWebhook } from '@/services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    FileText, Receipt, User, Building2, Calendar,
    ClipboardList, ExternalLink, Banknote, PiggyBank,
    FilePlus, BarChart3, Phone, Mail
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Type configuration (label + colour) ────────────────────────────────────
const TYPE_CONFIG = {
    contract: { icon: FileText, label: 'Contrato', color: 'text-indigo-600' },
    annex: { icon: FilePlus, label: 'Anexo', color: 'text-purple-600' },
    invoice: { icon: Receipt, label: 'Factura', color: 'text-emerald-600' },
    payment: { icon: Banknote, label: 'Link de Pago', color: 'text-emerald-600' },
    evaluacion_comercial: { icon: BarChart3, label: 'Evaluación Comercial', color: 'text-sky-600' },
    calculation: { icon: Receipt, label: 'Cálculo', color: 'text-blue-600' },
}

// Resolve display type from the stored request object
function resolveType(req) {
    if (req.type && TYPE_CONFIG[req.type]) return req.type
    if (req.data?.contract_type) return 'contract'
    if (req.data?.tipoSolicitud) return 'payment'
    return 'contract'
}

// Resolve the main address from any request type
function resolveAddress(data = {}) {
    return (
        data.propiedadDireccion ||
        data.direccion_propiedad ||
        data.direccion ||
        data.propiedad?.direccion ||
        null
    )
}

// Resolve the main commune
function resolveComuna(data = {}) {
    return (
        data.propiedadComuna ||
        data.comuna_propiedad ||
        data.comuna ||
        data.propiedad?.comuna ||
        null
    )
}

// ─── Shared UI helpers ───────────────────────────────────────────────────────

/** Hides when value is empty (for optional fields in contracts) */
function Field({ label, value, className = '' }) {
    if (value === null || value === undefined || value === '') return null
    return (
        <div className={`space-y-1 ${className}`}>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">{value}</p>
        </div>
    )
}

/** Always visible — shows '-' when empty. Use for payment link fields so every field the agent filled shows */
function RField({ label, value, className = '' }) {
    return (
        <div className={`space-y-1 ${className}`}>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">{value ?? '-'}</p>
        </div>
    )
}

/** Always shows Sí / No for boolean-like values */
function BoolField({ label, value, className = '' }) {
    const isYes = value === true || value === 'true' || value === 1 || value === '1'
    return (
        <div className={`space-y-1 ${className}`}>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
            <p className={`text-sm font-semibold ${isYes ? 'text-emerald-600' : 'text-slate-500'}`}>
                {isYes ? 'Sí' : 'No'}
            </p>
        </div>
    )
}

function Section({ title, icon: Icon, children }) {
    return (
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
}


// ─── Type-specific detail panels ─────────────────────────────────────────────

/** Link de Pago / Honorarios — covers ALL fields from the 5-step form */
function PaymentDetails({ data }) {
    const tipoLabel = {
        arriendo: 'Arriendo',
        venta: 'Venta',
        honorarios_arriendo: 'Honorarios Arriendo',
    }[data.tipoSolicitud] || data.tipoSolicitud || '-'

    const contractTypeLabel = data.contractType === 'commercial' ? 'Comercial' : 'Residencial'

    const fmt = (val) =>
        val ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(val)) : '-'

    return (
        <>
            {/* ── Propiedad ─────────────────────────────────────────── */}
            <Section title="Propiedad" icon={Building2}>
                <RField label="Tipo de operación" value={tipoLabel} />
                <RField label="Tipo de propiedad" value={data.tipoPropiedad} />
                <RField label="Dirección" value={resolveAddress(data)} className="md:col-span-2" />
                <RField label="Comuna" value={resolveComuna(data)} />
                <RField label="Tipo contrato" value={data.contractType ? contractTypeLabel : null} />
            </Section>

            {/* ── Dueño / Banco (Arriendo) ─────────────────────────── */}
            {(data.dueñoNombre || data.dueñoRut || data.dueñoEmail) && (
                <Section title="Dueño / Propietario" icon={User}>
                    <RField label="Nombre" value={data.dueñoNombre} />
                    <RField label="RUT" value={data.dueñoRut} />
                    <RField label="Email" value={data.dueñoEmail} />
                    <RField label="Teléfono" value={data.dueñoTelefono} />
                    <RField label="Dirección" value={data.dueñoDireccion} />
                    <RField label="Comuna" value={data.dueñoComuna} />
                </Section>
            )}

            {/* ── Datos bancarios ─────────────────────────────────── */}
            {(data.bancoNombre || data.bancoNroCuenta) && (
                <Section title="Cuenta Bancaria (Dueño)" icon={Banknote}>
                    <RField label="Banco" value={data.bancoNombre} />
                    <RField label="Tipo de cuenta" value={data.bancoTipoCuenta} />
                    <RField label="N° cuenta" value={data.bancoNroCuenta} />
                    <RField label="RUT titular" value={data.bancoRutTitular} />
                </Section>
            )}

            {/* ── Arrendatario ─────────────────────────────────────── */}
            {(data.arrendatarioNombre || data.arrendatarioRut || data.arrendatarioEmail) && (
                <Section title="Arrendatario" icon={User}>
                    <RField label="Nombre" value={[data.arrendatarioNombre, data.arrendatarioApellido].filter(Boolean).join(' ') || null} />
                    <RField label="RUT" value={data.arrendatarioRut} />
                    <RField label="Email" value={data.arrendatarioEmail} />
                    <RField label="Teléfono" value={data.arrendatarioTelefono} />
                    <RField label="Dirección" value={data.arrendatarioDireccion} />
                    <RField label="Comuna" value={data.arrendatarioComuna} />
                </Section>
            )}

            {/* ── Vendedor (Honorarios Venta) ───────────────────────── */}
            {(data.vendedorNombre || data.vendedorRut) && (
                <Section title="Vendedor" icon={User}>
                    <RField label="Nombre" value={data.vendedorNombre} />
                    <RField label="RUT" value={data.vendedorRut} />
                    <RField label="Email" value={data.vendedorEmail} />
                </Section>
            )}

            {/* ── Comprador (Honorarios Venta) ─────────────────────── */}
            {(data.compradorNombre || data.compradorRut) && (
                <Section title="Comprador" icon={User}>
                    <RField label="Nombre" value={data.compradorNombre} />
                    <RField label="RUT" value={data.compradorRut} />
                    <RField label="Email" value={data.compradorEmail} />
                </Section>
            )}

            {/* ── Cálculos y Pagos Iniciales ───────────────────────── */}
            <Section title="Cálculos y Pagos Iniciales" icon={PiggyBank}>
                <RField label="Canon de arriendo" value={fmt(data.canonArriendo)} />
                <RField label="Garantía" value={fmt(data.garantia)} />
                <RField label="Duración contrato" value={data.duracionContrato ? `${data.duracionContrato} meses` : null} />
                <RField label="Fecha envío link" value={data.fechaEnvioLink} />

                <BoolField label="Días proporcionales" value={data.chkProporcional} />
                {data.chkProporcional && <RField label="\u00a0\u00a0→ Cantidad de días" value={data.diasProporcionales} />}

                <BoolField label="Mes adelantado" value={data.chkMesAdelantado} />

                <RField label="Cert. dominio vigente" value={fmt(data.costoDominioVigente)} />

                <BoolField label="Seguro de restitución" value={data.chkSeguro} />
                {data.chkSeguro && <RField label="\u00a0\u00a0→ Monto seguro" value={fmt(data.montoSeguro)} />}

                <BoolField label="Gastos notariales (Propietario)" value={data.incluyeGastosNotarialesArrendador} />
                {data.incluyeGastosNotarialesArrendador && (
                    <RField label="\u00a0\u00a0→ Monto notaría propietario" value={fmt(data.montoGastosNotarialesArrendador)} />
                )}

                <BoolField label="Gastos notariales (Arrendatario)" value={data.incluyeGastosNotarialesArrendatario} />
                {data.incluyeGastosNotarialesArrendatario && (
                    <RField label="\u00a0\u00a0→ Monto notaría arrendatario" value={fmt(data.montoGastosNotarialesArrendatario)} />
                )}
            </Section>

            {/* ── Honorarios ───────────────────────────────────────── */}
            <Section title="Honorarios" icon={Receipt}>
                <RField label="Hon. propietario (neto)" value={fmt(data.honorariosAdmin || data.honorariosEncargadoA)} />
                <RField label="Comisión total" value={fmt(data.totalComision)} />
                <RField label="Monto Comisión" value={fmt(data.montoComision)} />
                <RField label="Comisión vendedor" value={fmt(data.comisionVendedor)} />
                <RField label="Comisión comprador" value={fmt(data.comisionComprador)} />

                <BoolField label="Con administración" value={data.conAdministracion} />
                {data.conAdministracion && (
                    <RField label="\u00a0\u00a0→ % Administración" value={data.porcentajeAdministracion ? `${data.porcentajeAdministracion}%` : null} />
                )}

                <BoolField label="Dividir comisión" value={data.dividirComision} />
            </Section>

            {/* ── Condiciones Especiales ────────────────────────────── */}
            <Section title="Condiciones Especiales" icon={ClipboardList}>
                <BoolField label="Tiene condiciones especiales" value={data.chkCondicionesEspeciales} />
                {data.chkCondicionesEspeciales && (
                    <RField label="Detalle" value={data.condicionesEspeciales} className="md:col-span-2" />
                )}
            </Section>
        </>
    )
}


/** Contrato (buy-sell / lease) */
function ContractDetails({ data }) {
    const contractLabel = {
        'buy-sell': 'Compraventa',
        lease: 'Arriendo',
        annex: 'Anexo',
    }[data.contract_type] || data.contract_type

    // Multiple parties (vendedor_1, vendedor_2, ...)
    const partyRows = (prefix, label) => {
        const rows = []
        for (let i = 1; i <= 4; i++) {
            // ContractForm stores keys as e.g. "vendedor_1 _nombres" (with trailing space before _)
            const key = `${prefix}_${i}`
            const keyS = `${prefix}_${i} ` // legacy with trailing space
            const name = [data[`${key}_nombres`] || data[`${keyS}_nombres`], data[`${key}_apellidos`] || data[`${keyS}_apellidos`]].filter(Boolean).join(' ')
                || data[`${key}_juridica_razon`] || data[`${keyS}_juridica_razon`]
            if (!name) break
            rows.push(
                <Section key={`${prefix}-${i}`} title={`${label} ${i > 1 ? i : ''}`} icon={User}>
                    <Field label="Nombre" value={name} />
                    <Field label="RUT" value={data[`${key}_rut`] || data[`${key}_juridica_rut`]} />
                    <Field label="Nacionalidad" value={data[`${key}_nacionalidad`]} />
                    <Field label="Estado civil" value={data[`${key}_civil`]} />
                    <Field label="Email" value={data[`${key}_email`] || data[`${key}_juridica_rep_email`]} />
                    <Field label="Teléfono" value={data[`${key}_telefono`] || data[`${key}_juridica_telefono`]} />
                    <Field label="Domicilio" value={data[`${key}_direccion`] || data[`${key}_juridica_direccion`]} className="md:col-span-2" />
                </Section>
            )
        }
        return rows
    }

    return (
        <>
            <Section title="Datos de la Operación" icon={FileText}>
                <Field label="Tipo de contrato" value={contractLabel} />
                <Field label="Código RE/MAX" value={data.codigo_remax} />
                <Field label="Fecha cierre de negocio" value={data.fecha_cierre} />
                <Field label="Fecha firma promesa" value={data.fecha_promesa} />
                <Field label="Fecha escritura" value={data.fecha_escritura} />
                <Field label="Fecha entrega propiedad" value={data.fecha_entrega} />
            </Section>

            <Section title="Propiedad" icon={Building2}>
                <Field label="Dirección" value={resolveAddress(data)} className="md:col-span-2" />
                <Field label="Comuna" value={resolveComuna(data)} />
                <Field label="ROL propiedad" value={data.rol_propiedad} />
                <Field label="Tipo de propiedad" value={data.tipo_propiedad} />
            </Section>

            <Section title="Valores" icon={PiggyBank}>
                <Field label="Valor de venta" value={data.valor_venta ? `${data.valor_venta} ${data.moneda_venta?.toUpperCase() || ''}` : null} />
                <Field label="Forma de pago" value={data.forma_pago} />
                <Field label="Canon de arriendo" value={data.canon_arriendo} />
                <Field label="Garantía" value={data.garantia} />
                <Field label="Fecha inicio arriendo" value={data.fecha_inicio_arriendo} />
                <Field label="Duración contrato" value={data.duracion_contrato} />
            </Section>

            {/* Dynamic parties */}
            {['buy-sell'].includes(data.contract_type) && partyRows('vendedor', 'Vendedor')}
            {['buy-sell'].includes(data.contract_type) && partyRows('comprador', 'Comprador')}
            {['lease', 'annex'].includes(data.contract_type) && partyRows('arrendador', 'Arrendador')}
            {['lease', 'annex'].includes(data.contract_type) && partyRows('arrendatario', 'Arrendatario')}
        </>
    )
}

/** Anexo de Contrato */
function AnnexDetails({ data }) {
    return (
        <>
            <Section title="Contrato Original" icon={FileText}>
                <Field label="Dirección propiedad" value={resolveAddress(data)} className="md:col-span-2" />
                <Field label="Motivo del anexo" value={data.motivo_anexo} className="md:col-span-2" />
                <Field label="Nuevo canon" value={data.nuevo_canon} />
                <Field label="Nueva fecha término" value={data.nueva_fecha_termino} />
                <Field label="Otras modificaciones" value={data.otras_modificaciones} className="md:col-span-2" />
            </Section>
        </>
    )
}

/** Factura */
function InvoiceDetails({ data }) {
    return (
        <>
            <Section title="Factura" icon={Receipt}>
                <Field label="Vendedor" value={data.vendedorNombre} />
                <Field label="RUT vendedor" value={data.vendedorRut} />
                <Field label="Comprador" value={data.compradorNombre} />
                <Field label="RUT comprador" value={data.compradorRut} />
                <Field label="Monto comisión" value={data.montoComision} />
                <Field label="Notas" value={data.notas} className="md:col-span-2" />
            </Section>
        </>
    )
}

/** Evaluación Comercial */
function EvalComercialDetails({ data }) {
    return (
        <>
            <Section title="Datos de la Evaluación" icon={BarChart3}>
                <Field label="Tipo de evaluación" value={data.tipo_evaluacion} />
                <Field label="Dirección" value={resolveAddress(data)} className="md:col-span-2" />
                <Field label="Comuna" value={resolveComuna(data)} />
                <Field label="Tipo de propiedad" value={data.tipo_propiedad || data.tipoPropiedad} />
                <Field label="Superficie útil" value={data.superficie_util} />
                <Field label="Superficie terreno" value={data.superficie_terreno} />
                <Field label="Dormitorios" value={data.dormitorios} />
                <Field label="Baños" value={data.banos} />
                <Field label="Precio estimado" value={data.precio_estimado} />
                <Field label="Notas adicionales" value={data.notas} className="md:col-span-2" />
            </Section>

            <Section title="Propietario" icon={User}>
                <Field label="Nombre" value={data.propietario?.nombre || data.propietarioNombre} />
                <Field label="Email" value={data.propietario?.email || data.propietarioEmail} />
                <Field label="Teléfono" value={data.propietario?.telefono || data.propietarioTelefono} />
            </Section>
        </>
    )
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function RequestDetailModal({ request, isOpen, onClose }) {
    const [auditLogs, setAuditLogs] = useState([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [contractFiles, setContractFiles] = useState([])
    const [attachmentFiles, setAttachmentFiles] = useState([])
    const [completionNotes, setCompletionNotes] = useState('')
    const [hasObservaciones, setHasObservaciones] = useState('none')
    const [isCompleting, setIsCompleting] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
                setIsAdmin(['superadministrador', 'legal', 'comercial', 'administracion'].includes(data?.role))
            }
        }
        checkAdmin()
    }, [])

    useEffect(() => {
        if (isOpen && request) fetchAuditLogs()
    }, [isOpen, request])

    const fetchAuditLogs = async () => {
        setLoadingLogs(true)
        try {
            const { data, error } = await supabase
                .from('request_audit_logs')
                .select('*, actor:actor_id(first_name, last_name, email)')
                .eq('request_id', request.id)
                .order('created_at', { ascending: false })
            if (error) throw error
            setAuditLogs(data || [])
        } catch (e) {
            console.error('Error fetching audit logs:', e)
        } finally {
            setLoadingLogs(false)
        }
    }

    if (!request) return null

    const resolvedType = resolveType(request)
    const typeParams = TYPE_CONFIG[resolvedType] || TYPE_CONFIG.contract
    const Icon = typeParams.icon
    const data = request.data || {}

    // Agent name helpers
    const agentName = data.agente?.nombre
        ? `${data.agente.nombre} ${data.agente.apellido || ''}`.trim()
        : data.agenteNombre
            ? `${data.agenteNombre} ${data.agenteApellido || ''}`.trim()
            : request.user
                ? `${request.user.first_name || ''} ${request.user.last_name || ''}`.trim()
                : null

    const agentEmail = data.agente?.email || data.agenteEmail || request.user?.email
    const agentPhone = data.agente?.telefono || data.agenteTelefono || request.user?.phone
    const agentNombreDraft = data.agente_nombre || null  // contract form stores it differently
    const agentEmailDraft = data.agente_email || null

    // ── Upload helpers ──────────────────────────────────────────────────────
    const uploadFiles = async (files, folder) => {
        const uploadedUrls = []
        for (const file of files) {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${request.id}/${folder}/${fileName}`
            const { error: uploadError } = await supabase.storage.from('contracts').upload(filePath, file)
            if (uploadError) throw uploadError
            const publicUrl = getCustomPublicUrl('contracts', filePath)
            uploadedUrls.push({ name: file.name, url: publicUrl })
        }
        return uploadedUrls
    }

    const fileToBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => resolve(reader.result)
            reader.onerror = (e) => reject(e)
        })

    const handleComplete = async () => {
        if (resolvedType === 'evaluacion_comercial') {
            if (hasObservaciones === 'none') {
                toast.error('Por favor indica si la evaluación tiene o no observaciones.')
                return
            }
        } else {
            if (contractFiles.length === 0) {
                toast.error('Por favor adjunta al menos un archivo de contrato.')
                return
            }
        }

        setIsCompleting(true)
        try {
            const contractArray = Array.from(contractFiles)
            const attachmentArray = Array.from(attachmentFiles)

            const [contractUrls, attachmentUrls, base64Documents] = await Promise.all([
                resolvedType === 'evaluacion_comercial'
                    ? uploadFiles(contractArray, 'evaluaciones')
                    : uploadFiles(contractArray, 'contracts'),
                resolvedType === 'evaluacion_comercial'
                    ? uploadFiles(attachmentArray, 'evaluaciones_adjuntos')
                    : uploadFiles(attachmentArray, 'attachments'),
                Promise.all([...contractArray, ...attachmentArray].map(async (file) => ({
                    nombre: file.name,
                    tipo: file.type,
                    base64: await fileToBase64(file)
                })))
            ])

            let webhookRes
            if (resolvedType === 'evaluacion_comercial') {
                const payload = {
                    request_id: request.id,
                    estado: 'Realizada',
                    observaciones: hasObservaciones === 'true',
                    notas: completionNotes,
                    agente: data.agente,
                    propiedad: data.propiedad,
                    propietario: data.propietario,
                    documentos: base64Documents
                }
                await triggerEvaluacionComercialCompletionWebhook(payload)
                webhookRes = { ok: true }
            } else {
                const payload = {
                    request_id: request.id,
                    agente_nombre: agentName || agentNombreDraft,
                    agente_email: agentEmail || agentEmailDraft,
                    tipo_solicitud: typeParams.label,
                    contexto_solicitud: resolveAddress(data) || 'Solicitud Genérica',
                    notas: completionNotes,
                    contratos: contractUrls,
                    adjuntos: attachmentUrls,
                    admin_email: 'departamento.legal@remax-exclusive.cl'
                }
                webhookRes = await fetch('https://workflow.remax-exclusive.cl/webhook/enviar-contrato', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
            }

            if (!webhookRes.ok) throw new Error('Error enviando notificación al agente via Webhook')

            const { error: updateError } = await supabase
                .from('requests')
                .update({
                    status: 'realizado',
                    data: {
                        ...data,
                        completion_data: {
                            completed_at: new Date().toISOString(),
                            notes: completionNotes,
                            contracts: contractUrls,
                            attachments: attachmentUrls
                        }
                    }
                })
                .eq('id', request.id)

            if (updateError) throw updateError

            const { data: { user } } = await supabase.auth.getUser()
            await supabase.from('request_audit_logs').insert({
                request_id: request.id,
                actor_id: user.id,
                previous_status: request.status,
                new_status: 'realizado'
            })

            toast.success('Solicitud completada y enviada con éxito.')
            onClose()
            window.location.reload()
        } catch (error) {
            console.error('Error completing request:', error)
            toast.error('Error al completar la solicitud: ' + error.message)
        } finally {
            setIsCompleting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full bg-slate-100 dark:bg-slate-800 ${typeParams.color}`}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">
                                {typeParams.label}
                            </DialogTitle>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                <Badge variant="outline" className="capitalize">{request.status}</Badge>
                                <span>•</span>
                                <span>
                                    {format(new Date(request.created_at || request.updated_at), "d 'de' MMMM, yyyy", { locale: es })}
                                </span>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                    {/* ── Left column: all fields ──────────────────────────── */}
                    <div className="lg:col-span-2 space-y-4">

                        {/* Agent info */}
                        <Section title="Agente Solicitante" icon={User}>
                            <Field label="Nombre" value={agentName || agentNombreDraft} />
                            <Field label="Email" value={agentEmail || agentEmailDraft} />
                            <Field label="Teléfono" value={agentPhone} />
                        </Section>

                        {/* Type-specific fields */}
                        {(resolvedType === 'payment') && <PaymentDetails data={data} />}
                        {(resolvedType === 'contract') && <ContractDetails data={data} />}
                        {(resolvedType === 'annex') && <AnnexDetails data={data} />}
                        {(resolvedType === 'invoice') && <InvoiceDetails data={data} />}
                        {(resolvedType === 'evaluacion_comercial') && <EvalComercialDetails data={data} />}

                        {/* Agent-uploaded documents */}
                        {data.archivos_adjuntos?.length > 0 && (
                            <Section title="Documentos Adjuntos del Agente" icon={FileText}>
                                <div className="space-y-2 col-span-2">
                                    {data.archivos_adjuntos.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-primary" />
                                                <span className="text-sm font-medium">{file.name}</span>
                                            </div>
                                            <a
                                                href={file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium bg-primary/10 px-2 py-1 rounded-md"
                                            >
                                                Ver <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* Completion panel (admin only, not done yet) */}
                        {isAdmin && request.status !== 'realizado' && (
                            <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    Completar Solicitud y Enviar
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-lg border border-slate-200 dark:border-slate-800 space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            {resolvedType === 'evaluacion_comercial' ? 'Archivos Adicionales' : 'Contrato Redactado (Obligatorio)'}
                                        </label>
                                        <input
                                            type="file"
                                            multiple
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                            onChange={(e) => setContractFiles(e.target.files)}
                                        />
                                    </div>

                                    {resolvedType !== 'evaluacion_comercial' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Adjuntos Adicionales (Opcional)
                                            </label>
                                            <input
                                                type="file"
                                                multiple
                                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                                onChange={(e) => setAttachmentFiles(e.target.files)}
                                            />
                                        </div>
                                    )}

                                    {resolvedType === 'evaluacion_comercial' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Estado de Observaciones <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={hasObservaciones}
                                                onChange={(e) => setHasObservaciones(e.target.value)}
                                            >
                                                <option value="none" disabled>Seleccione una opción</option>
                                                <option value="true">Con Observaciones</option>
                                                <option value="false">Sin Observaciones</option>
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Notas / Instrucciones al Agente
                                        </label>
                                        <textarea
                                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            placeholder="Ej: Estimado agente, adjunto contrato para revisión..."
                                            value={completionNotes}
                                            onChange={(e) => setCompletionNotes(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleComplete}
                                            disabled={isCompleting}
                                            className="bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isCompleting ? 'Enviando...' : 'Completar y Enviar'}
                                            {!isCompleting && <ClipboardList className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right column: audit timeline ─────────────────────── */}
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

                            <div className="relative pl-4">
                                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950 bg-primary" />
                                <div className="text-xs text-slate-500 mb-1">
                                    {format(new Date(request.created_at || request.updated_at), "d MMM yyyy, HH:mm", { locale: es })}
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
