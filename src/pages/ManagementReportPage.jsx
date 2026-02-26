import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Input, Textarea, Label } from '@/components/ui'
import { FileText, Send, ArrowLeft, Loader2, Save, BarChart3, Activity, TrendingUp, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function ManagementReportPage() {
    const { reportId } = useParams()
    const navigate = useNavigate()
    const { user, profile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [sending, setSending] = useState(false)
    const [report, setReport] = useState(null)

    const [formData, setFormData] = useState({
        portales: {
            remax: { visitas: '', contactos: '', visitas_realizadas: '' },
            portal_inmobiliario: { visitas: '', contactos: '', visitas_coordinadas: '' },
            proppit: { impresiones: '', visitas: '', contactos: '' },
            yapo: { impresiones: '', visitas: '', contactos: '' }
        },
        actividades: '',
        analisis_mercado: '',
        conclusiones: ''
    })

    useEffect(() => {
        fetchReport()
    }, [reportId])

    const fetchReport = async () => {
        if (!reportId) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('management_reports')
                .select(`
                    *,
                    properties:property_id(address, commune, region),
                    owner:owner_contact_id(first_name, last_name, email, phone),
                    agent:agent_id(first_name, last_name, email)
                `)
                .eq('id', reportId)
                .single()

            if (error) throw error
            setReport(data)

            // Populate form with existing report data if any
            if (data.report_data && Object.keys(data.report_data).length > 0) {
                setFormData(prev => ({
                    ...prev,
                    ...data.report_data,
                    portales: { ...prev.portales, ...(data.report_data.portales || {}) }
                }))
            }
        } catch (err) {
            console.error('Error fetching report:', err)
            toast.error('No se pudo cargar el informe')
            navigate('/informes-gestion')
        } finally {
            setLoading(false)
        }
    }

    const updatePortal = (portal, field, value) => {
        setFormData(prev => ({
            ...prev,
            portales: {
                ...prev.portales,
                [portal]: { ...prev.portales[portal], [field]: value }
            }
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await supabase
                .from('management_reports')
                .update({
                    report_data: formData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reportId)

            toast.success('Informe guardado')
        } catch (err) {
            toast.error('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const handleSend = async () => {
        if (!formData.actividades && !formData.conclusiones) {
            toast.error('Completa al menos las actividades y conclusiones')
            return
        }

        setSending(true)
        try {
            // 1. Save report data
            await supabase
                .from('management_reports')
                .update({
                    report_data: formData,
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', reportId)

            // 2. Send email via n8n webhook
            const agentName = `${report.agent?.first_name || profile?.first_name || ''} ${report.agent?.last_name || profile?.last_name || ''}`.trim()
            const ownerName = `${report.owner?.first_name || ''} ${report.owner?.last_name || ''}`.trim()

            const payload = {
                report_data: formData,
                report_number: report.report_number,
                owner_email: report.owner?.email,
                owner_name: ownerName,
                agent_name: agentName,
                agent_email: report.agent?.email || profile?.email,
                property_address: report.properties?.address || ''
            }

            fetch('https://workflow.remax-exclusive.cl/webhook/management-report-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(err => console.error('Report webhook error:', err))

            // 3. Create next report (due in 15 days)
            const nextDueDate = new Date()
            nextDueDate.setDate(nextDueDate.getDate() + 15)

            await supabase.from('management_reports').insert({
                property_id: report.property_id,
                mandate_id: report.mandate_id,
                agent_id: report.agent_id,
                owner_contact_id: report.owner_contact_id,
                report_number: report.report_number + 1,
                due_date: nextDueDate.toISOString().split('T')[0],
                status: 'pending'
            })

            toast.success('¡Informe enviado al propietario! Se creó el próximo informe.')
            navigate('/informes-gestion')
        } catch (err) {
            console.error('Error sending report:', err)
            toast.error('Error al enviar el informe')
        } finally {
            setSending(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    if (!report) return null

    const portalFields = [
        {
            key: 'remax',
            name: 'Portal RE/MAX',
            color: 'from-blue-500 to-blue-600',
            fields: [
                { key: 'visitas', label: 'Visitas' },
                { key: 'contactos', label: 'Contactos' },
                { key: 'visitas_realizadas', label: 'Visitas realizadas' }
            ]
        },
        {
            key: 'portal_inmobiliario',
            name: 'Portal Inmobiliario',
            color: 'from-indigo-500 to-indigo-600',
            fields: [
                { key: 'visitas', label: 'Visitas' },
                { key: 'contactos', label: 'Contactos' },
                { key: 'visitas_coordinadas', label: 'Visitas coordinadas' }
            ]
        },
        {
            key: 'proppit',
            name: 'Grupo Proppit',
            color: 'from-purple-500 to-purple-600',
            fields: [
                { key: 'impresiones', label: 'Impresiones' },
                { key: 'visitas', label: 'Visitas' },
                { key: 'contactos', label: 'Contactos' }
            ]
        },
        {
            key: 'yapo',
            name: 'Yapo',
            color: 'from-amber-500 to-amber-600',
            fields: [
                { key: 'impresiones', label: 'Impresiones' },
                { key: 'visitas', label: 'Visitas' },
                { key: 'contactos', label: 'Contactos' }
            ]
        }
    ]

    const isSent = report.status === 'sent'

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Back Button */}
            <Button variant="ghost" onClick={() => navigate('/informes-gestion')} className="gap-2 text-slate-500">
                <ArrowLeft className="w-4 h-4" />
                Volver a informes
            </Button>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                        <FileText className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">
                            Informe de Gestión #{report.report_number}
                        </h1>
                        <p className="text-blue-100 mt-1">
                            {report.properties?.address}{report.properties?.commune ? `, ${report.properties.commune}` : ''}
                        </p>
                        <p className="text-blue-200 text-sm mt-1">
                            Propietario: {report.owner?.first_name} {report.owner?.last_name}
                            {report.owner?.email && ` · ${report.owner.email}`}
                        </p>
                    </div>
                </div>
                {isSent && (
                    <div className="mt-4 flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Informe enviado el {new Date(report.sent_at).toLocaleDateString('es-CL')}</span>
                    </div>
                )}
            </motion.div>

            {/* Portal Statistics */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border p-6 space-y-5"
            >
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Visitas y Contactos en Portales
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portalFields.map(portal => (
                        <div key={portal.key} className="border rounded-xl p-4 space-y-3">
                            <h3 className={cn("font-bold text-sm bg-gradient-to-r bg-clip-text text-transparent", portal.color)}>
                                {portal.name}
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {portal.fields.map(field => (
                                    <div key={field.key}>
                                        <Label className="text-xs text-slate-400">{field.label}</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={formData.portales[portal.key]?.[field.key] || ''}
                                            onChange={(e) => updatePortal(portal.key, field.key, e.target.value)}
                                            className="mt-1 text-sm"
                                            disabled={isSent}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Activities */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border p-6 space-y-4"
            >
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    Actividades Realizadas
                </h2>
                <Textarea
                    placeholder="Describa las actividades realizadas durante el período (publicaciones, visitas coordinadas, cambios en precio, fotografías actualizadas, etc.)"
                    value={formData.actividades}
                    onChange={(e) => setFormData(prev => ({ ...prev, actividades: e.target.value }))}
                    rows={6}
                    disabled={isSent}
                    className="resize-none"
                />
            </motion.div>

            {/* Market Analysis */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border p-6 space-y-4"
            >
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Análisis de Mercado
                </h2>
                <Textarea
                    placeholder="Observaciones sobre el mercado, propiedades similares, tendencias de precios, competencia en la zona..."
                    value={formData.analisis_mercado}
                    onChange={(e) => setFormData(prev => ({ ...prev, analisis_mercado: e.target.value }))}
                    rows={4}
                    disabled={isSent}
                    className="resize-none"
                />
            </motion.div>

            {/* Conclusions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border p-6 space-y-4"
            >
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    Conclusiones y Próximos Pasos
                </h2>
                <Textarea
                    placeholder="Conclusiones del período y acciones planificadas para las próximas semanas..."
                    value={formData.conclusiones}
                    onChange={(e) => setFormData(prev => ({ ...prev, conclusiones: e.target.value }))}
                    rows={4}
                    disabled={isSent}
                    className="resize-none"
                />
            </motion.div>

            {/* Action Buttons */}
            {!isSent && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex justify-end gap-3 pb-8"
                >
                    <Button
                        variant="outline"
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-2 px-6"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Borrador
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={sending}
                        className="gap-2 px-6 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar al Propietario
                    </Button>
                </motion.div>
            )}
        </div>
    )
}
