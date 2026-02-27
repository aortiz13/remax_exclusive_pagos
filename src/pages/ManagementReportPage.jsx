import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getCustomPublicUrl } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Input, Textarea, Label } from '@/components/ui'
import { FileText, Send, ArrowLeft, Loader2, Save, Eye, Upload, Image as ImageIcon, BarChart3, X } from 'lucide-react'
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
    const [propertyImages, setPropertyImages] = useState({ exterior: null, interior: null })
    const [chartImage, setChartImage] = useState(null)
    const [showPdfPreview, setShowPdfPreview] = useState(false)
    const chartInputRef = useRef(null)
    const exteriorInputRef = useRef(null)
    const interiorInputRef = useRef(null)

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
                    properties:property_id(id, address, commune, image_url),
                    owner:owner_contact_id(first_name, last_name, email, phone)
                `)
                .eq('id', reportId)
                .single()

            if (error) throw error

            // Fetch agent profile separately
            let agentData = null
            if (data.agent_id) {
                const { data: agentProfile } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, email')
                    .eq('id', data.agent_id)
                    .single()
                agentData = agentProfile
            }

            const reportWithAgent = { ...data, agent: agentData }
            setReport(reportWithAgent)

            // Load property image as exterior
            if (data.properties?.image_url) {
                setPropertyImages(prev => ({ ...prev, exterior: data.properties.image_url }))
            }

            // Load saved images from report_data
            if (data.report_data?.images) {
                if (data.report_data.images.interior) {
                    setPropertyImages(prev => ({ ...prev, interior: data.report_data.images.interior }))
                }
                if (data.report_data.images.exterior && !data.properties?.image_url) {
                    setPropertyImages(prev => ({ ...prev, exterior: data.report_data.images.exterior }))
                }
                if (data.report_data.images.chart) {
                    setChartImage(data.report_data.images.chart)
                }
            }

            // Populate form
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

    const handleImageUpload = async (file, type) => {
        if (!file) return
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            toast.error('La imagen no debe superar 5MB')
            return
        }

        try {
            const ext = file.name.split('.').pop()
            const filePath = `management-reports/${reportId}/${type}-${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage
                .from('mandates')
                .upload(filePath, file, { cacheControl: '3600', upsert: true })

            if (uploadError) throw uploadError

            const publicUrl = getCustomPublicUrl('mandates', filePath)

            if (type === 'chart') {
                setChartImage(publicUrl)
            } else {
                setPropertyImages(prev => ({ ...prev, [type]: publicUrl }))
            }
            toast.success('Imagen cargada')
        } catch (err) {
            console.error('Upload error:', err)
            toast.error('Error al cargar imagen')
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

    const getFullFormData = () => ({
        ...formData,
        images: {
            exterior: propertyImages.exterior,
            interior: propertyImages.interior,
            chart: chartImage
        }
    })

    const handleSave = async () => {
        setSaving(true)
        try {
            await supabase
                .from('management_reports')
                .update({ report_data: getFullFormData(), updated_at: new Date().toISOString() })
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
            const fullData = getFullFormData()
            await supabase
                .from('management_reports')
                .update({ report_data: fullData, status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', reportId)

            const agentName = `${report.agent?.first_name || profile?.first_name || ''} ${report.agent?.last_name || profile?.last_name || ''}`.trim()
            const ownerName = `${report.owner?.first_name || ''} ${report.owner?.last_name || ''}`.trim()

            fetch('https://workflow.remax-exclusive.cl/webhook/management-report-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report_data: fullData,
                    report_number: report.report_number,
                    owner_email: report.owner?.email,
                    owner_name: ownerName,
                    agent_name: agentName,
                    agent_email: report.agent?.email || profile?.email,
                    property_address: report.properties?.address || '',
                    property_image: propertyImages.exterior || '',
                    chart_image: chartImage || ''
                })
            }).catch(err => console.error('Report webhook error:', err))

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

            toast.success('¡Informe enviado al propietario!')
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

    const isSent = report.status === 'sent'
    const agentName = `${report.agent?.first_name || profile?.first_name || ''} ${report.agent?.last_name || profile?.last_name || ''}`.trim()
    const ownerName = `${report.owner?.first_name || ''} ${report.owner?.last_name || ''}`.trim()
    const propertyAddress = report.properties?.address || 'Dirección de la propiedad'
    const propertyCommune = report.properties?.commune || ''

    // -- PDF-style Report Component --
    const ReportContent = ({ isPreview = false }) => (
        <div className={cn("bg-white text-black", isPreview ? "w-[210mm]" : "max-w-4xl mx-auto")}>

            {/* === PAGE 1: COVER === */}
            <div className="relative bg-white" style={{ pageBreakAfter: isPreview ? 'always' : 'auto' }}>
                {/* Agent Name Header */}
                <div className="text-center py-4 border-b">
                    <p className="text-sm font-medium text-gray-600">{agentName}</p>
                </div>

                {/* Cover Layout */}
                <div className="grid grid-cols-2 gap-0 mt-4 mx-6">
                    {/* Left: Title Block */}
                    <div className="bg-[#1B3A5C] text-white p-8 flex flex-col justify-center min-h-[280px]">
                        <h1 className="text-3xl font-black leading-tight tracking-tight">
                            REPORTE DE<br />ACTIVIDADES
                        </h1>
                        <div className="mt-6">
                            <p className="text-lg font-semibold">{propertyAddress}</p>
                            {propertyCommune && <p className="text-lg">{propertyCommune}</p>}
                        </div>
                    </div>
                    {/* Right: Property Exterior Image */}
                    <div className="relative min-h-[280px] bg-gray-100 overflow-hidden group">
                        {propertyImages.exterior ? (
                            <img src={propertyImages.exterior} alt="Exterior" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                <ImageIcon className="w-12 h-12" />
                                <span className="text-sm">Foto exterior</span>
                            </div>
                        )}
                        {!isSent && (
                            <button
                                onClick={() => exteriorInputRef.current?.click()}
                                className="absolute inset-0 bg-black/0 hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <div className="bg-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
                                    <Upload className="w-4 h-4" />
                                    <span className="text-sm font-medium">Cambiar foto</span>
                                </div>
                            </button>
                        )}
                        <input ref={exteriorInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0], 'exterior')} />
                    </div>
                </div>

                {/* RE/MAX Logo */}
                <div className="flex justify-end px-6 mt-2">
                    <img src="/primerolog.png" alt="RE/MAX Exclusive" className="h-14 object-contain" />
                </div>

                {/* Second Section: Interior Image + Greeting */}
                <div className="grid grid-cols-2 gap-0 mx-6 mt-6">
                    {/* Left: Red background with interior image */}
                    <div className="bg-[#C8102E] p-4 min-h-[240px] flex items-center justify-center relative group overflow-hidden">
                        {propertyImages.interior ? (
                            <img src={propertyImages.interior} alt="Interior" className="w-[85%] h-[85%] object-cover shadow-xl" />
                        ) : (
                            <div className="w-[85%] h-[85%] bg-white/20 flex flex-col items-center justify-center text-white/70 gap-2 rounded">
                                <ImageIcon className="w-10 h-10" />
                                <span className="text-sm">Foto interior</span>
                            </div>
                        )}
                        {!isSent && (
                            <button
                                onClick={() => interiorInputRef.current?.click()}
                                className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <div className="bg-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg text-black">
                                    <Upload className="w-4 h-4" />
                                    <span className="text-sm font-medium">Cambiar foto</span>
                                </div>
                            </button>
                        )}
                        <input ref={interiorInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0], 'interior')} />
                    </div>
                    {/* Right: Greeting message */}
                    <div className="bg-[#1B3A5C] text-white p-8 flex items-center min-h-[240px]">
                        <div>
                            <div className="w-8 h-0.5 bg-white mb-4" />
                            <p className="font-semibold text-lg mb-3">
                                Estimado/a {ownerName},
                            </p>
                            <p className="text-sm leading-relaxed text-blue-100">
                                Deseo informarle de las actividades realizadas para la {report.properties?.status?.includes('En Arriendo') ? 'comercialización de arriendo' : 'venta'} de su propiedad, y el control estadístico de las visitas a los portales principales aunado a un breve resumen de la gestión realizada hasta el momento.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* === PAGE 2: PORTAL STATS === */}
            <div className="bg-white px-6 py-8" style={{ pageBreakBefore: isPreview ? 'always' : 'auto', pageBreakAfter: isPreview ? 'always' : 'auto' }}>
                <div className="text-center pb-4 border-b mb-8">
                    <p className="text-sm font-medium text-gray-600">{agentName}</p>
                </div>

                {/* Stats Title */}
                <div className="mb-6">
                    <div className="bg-[#1B3A5C] text-white px-6 py-3 inline-block">
                        <h2 className="text-xl font-black tracking-tight">ESTADÍSTICAS DE PORTALES</h2>
                    </div>
                </div>

                {/* Stats Table */}
                <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                        <tr className="bg-[#1B3A5C] text-white">
                            <th className="border border-gray-300 px-4 py-3 font-bold text-center w-1/3">SITIO WEB<br />(PRINCIPALES PORTALES)</th>
                            <th className="border border-gray-300 px-4 py-3 font-bold text-center w-1/3">TOTAL DE VISITAS A LA<br />PUBLICACIÓN</th>
                            <th className="border border-gray-300 px-4 py-3 font-bold text-center w-1/3">CONTACTOS / VISITAS A<br />LA PROPIEDAD</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* RE/MAX */}
                        <tr>
                            <td className="border border-gray-300 px-4 py-4 text-center font-medium text-gray-700">PORTAL RE/MAX<br /><span className="text-xs text-gray-500">(Visitas a nuestro sitio web y contactos de la Red)</span></td>
                            <td className="border border-gray-300 px-4 py-4 text-center">
                                {isSent ? <span>□ {formData.portales.remax.visitas || '0'} Visitas</span> : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Input type="number" placeholder="0" value={formData.portales.remax.visitas} onChange={(e) => updatePortal('remax', 'visitas', e.target.value)} className="w-20 text-center text-sm" />
                                        <span className="text-sm text-gray-500">Visitas</span>
                                    </div>
                                )}
                            </td>
                            <td className="border border-gray-300 px-4 py-4 text-center">
                                {isSent ? <span>□ {formData.portales.remax.contactos || '0'} Contactos / {formData.portales.remax.visitas_realizadas || '0'} Visitas realizadas</span> : (
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-1"><Input type="number" placeholder="0" value={formData.portales.remax.contactos} onChange={(e) => updatePortal('remax', 'contactos', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Contactos</span></div>
                                        <div className="flex items-center gap-1"><Input type="number" placeholder="0" value={formData.portales.remax.visitas_realizadas} onChange={(e) => updatePortal('remax', 'visitas_realizadas', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Visitas realizadas</span></div>
                                    </div>
                                )}
                            </td>
                        </tr>
                        {/* Portal Inmobiliario */}
                        <tr>
                            <td className="border border-gray-300 px-4 py-4 text-center font-medium text-gray-700">PORTAL INMOBILIARIO<br /><span className="text-xs text-gray-500">(Incluye P. Inmobiliario y Mercado Libre)</span></td>
                            <td className="border border-gray-300 px-4 py-4 text-center">
                                {isSent ? <span>□ {formData.portales.portal_inmobiliario.visitas || '0'} Visitas</span> : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Input type="number" placeholder="0" value={formData.portales.portal_inmobiliario.visitas} onChange={(e) => updatePortal('portal_inmobiliario', 'visitas', e.target.value)} className="w-20 text-center text-sm" />
                                        <span className="text-sm text-gray-500">Visitas</span>
                                    </div>
                                )}
                            </td>
                            <td className="border border-gray-300 px-4 py-4 text-center">
                                {isSent ? <span>□ {formData.portales.portal_inmobiliario.contactos || '0'} Contacto / {formData.portales.portal_inmobiliario.visitas_coordinadas || '0'} Visita coordinada</span> : (
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-1"><Input type="number" placeholder="0" value={formData.portales.portal_inmobiliario.contactos} onChange={(e) => updatePortal('portal_inmobiliario', 'contactos', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Contactos</span></div>
                                        <div className="flex items-center gap-1"><Input type="number" placeholder="0" value={formData.portales.portal_inmobiliario.visitas_coordinadas} onChange={(e) => updatePortal('portal_inmobiliario', 'visitas_coordinadas', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Visitas coordinadas</span></div>
                                    </div>
                                )}
                            </td>
                        </tr>
                        {/* PROPPIT */}
                        <tr>
                            <td className="border border-gray-300 px-4 py-4 text-center font-medium text-gray-700">GRUPO PROPPIT<br /><span className="text-xs text-gray-500">(Incluye iCasas, Trovit, Nestoria, Mitula, Nuroa)</span></td>
                            <td className="border border-gray-300 px-4 py-4 text-center">
                                {isSent ? <span>□ {formData.portales.proppit.impresiones || '0'} Impresiones / {formData.portales.proppit.visitas || '0'} Visitas</span> : (
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-1"><Input type="number" placeholder="0" value={formData.portales.proppit.impresiones} onChange={(e) => updatePortal('proppit', 'impresiones', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Impresiones</span></div>
                                        <div className="flex items-center gap-1"><Input type="number" placeholder="0" value={formData.portales.proppit.visitas} onChange={(e) => updatePortal('proppit', 'visitas', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Visitas</span></div>
                                    </div>
                                )}
                            </td>
                            <td className="border border-gray-300 px-4 py-4 text-center">
                                {isSent ? <span>□ {formData.portales.proppit.contactos || '0'} Contactos</span> : (
                                    <div className="flex items-center justify-center gap-1"><Input type="number" placeholder="0" value={formData.portales.proppit.contactos} onChange={(e) => updatePortal('proppit', 'contactos', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Contactos</span></div>
                                )}
                            </td>
                        </tr>
                        {/* YAPO */}
                        <tr>
                            <td className="border border-gray-300 px-4 py-4 text-center font-medium text-gray-700">YAPO</td>
                            <td className="border border-gray-300 px-4 py-4 text-center">
                                {isSent ? <span>□ {formData.portales.yapo.impresiones || '0'} Impresiones / {formData.portales.yapo.visitas || '0'} Visitas</span> : (
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-1"><Input type="number" placeholder="0" value={formData.portales.yapo.impresiones} onChange={(e) => updatePortal('yapo', 'impresiones', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Impresiones</span></div>
                                        <div className="flex items-center gap-1"><Input type="number" placeholder="0" value={formData.portales.yapo.visitas} onChange={(e) => updatePortal('yapo', 'visitas', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Visitas</span></div>
                                    </div>
                                )}
                            </td>
                            <td className="border border-gray-300 px-4 py-4 text-center">
                                {isSent ? <span>□ {formData.portales.yapo.contactos || '0'}</span> : (
                                    <div className="flex items-center justify-center gap-1"><Input type="number" placeholder="0" value={formData.portales.yapo.contactos} onChange={(e) => updatePortal('yapo', 'contactos', e.target.value)} className="w-16 text-center text-sm" /><span className="text-xs text-gray-500">Contactos</span></div>
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* === PAGE 3: CHART + GESTIÓN REALIZADA === */}
            <div className="bg-white px-6 py-8" style={{ pageBreakBefore: isPreview ? 'always' : 'auto' }}>
                <div className="text-center pb-4 border-b mb-8">
                    <p className="text-sm font-medium text-gray-600">{agentName}</p>
                </div>

                {/* Chart Section */}
                <div className="mb-8">
                    <p className="text-center text-sm font-medium text-gray-600 mb-4">Total de Visitas a la Publicación por Portal</p>
                    <div className="relative min-h-[280px] border border-dashed border-gray-300 rounded-lg overflow-hidden group bg-gray-50 flex items-center justify-center">
                        {chartImage ? (
                            <img src={chartImage} alt="Gráfico" className="max-w-full max-h-[300px] object-contain" />
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-gray-400">
                                <BarChart3 className="w-16 h-16" />
                                <p className="text-sm font-medium">Sube aquí tu gráfico de visitas por portal</p>
                                <p className="text-xs">PNG, JPG o captura de pantalla</p>
                            </div>
                        )}
                        {!isSent && (
                            <button onClick={() => chartInputRef.current?.click()} className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                <div className="bg-white rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
                                    <Upload className="w-4 h-4" />
                                    <span className="text-sm font-medium">{chartImage ? 'Cambiar gráfico' : 'Subir gráfico'}</span>
                                </div>
                            </button>
                        )}
                        {chartImage && !isSent && (
                            <button onClick={() => setChartImage(null)} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <input ref={chartInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0], 'chart')} />
                    </div>
                </div>

                {/* Gestión Realizada */}
                <div>
                    <div className="bg-[#1B3A5C] text-white px-6 py-3 inline-block mb-4">
                        <h2 className="text-xl font-black tracking-tight">GESTIÓN REALIZADA</h2>
                    </div>

                    <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead>
                            <tr className="bg-[#1B3A5C] text-white">
                                <th className="border border-gray-300 px-4 py-3 font-bold text-center w-1/2">ACTIVIDADES</th>
                                <th className="border border-gray-300 px-4 py-3 font-bold text-center w-1/2">ACTIVIDADES CONCLUSIONES DEL<br />ANÁLISIS DE MERCADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-gray-300 px-4 py-4 align-top">
                                    {isSent ? (
                                        <div className="whitespace-pre-wrap text-sm text-gray-700">{formData.actividades || 'Sin actividades registradas'}</div>
                                    ) : (
                                        <Textarea placeholder="□ Publicación en 10 Portales Inmobiliarios..." value={formData.actividades} onChange={(e) => setFormData(prev => ({ ...prev, actividades: e.target.value }))} rows={10} className="border-none shadow-none resize-none text-sm p-0 focus-visible:ring-0" />
                                    )}
                                </td>
                                <td className="border border-gray-300 px-4 py-4 align-top">
                                    {isSent ? (
                                        <div className="whitespace-pre-wrap text-sm text-gray-700">{formData.analisis_mercado || 'Sin análisis registrado'}</div>
                                    ) : (
                                        <Textarea placeholder="□ Según el informe de mercado actualizado..." value={formData.analisis_mercado} onChange={(e) => setFormData(prev => ({ ...prev, analisis_mercado: e.target.value }))} rows={10} className="border-none shadow-none resize-none text-sm p-0 focus-visible:ring-0" />
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Conclusiones */}
                    {(formData.conclusiones || !isSent) && (
                        <div className="mt-6">
                            <div className="bg-[#1B3A5C] text-white px-6 py-3 inline-block mb-4">
                                <h2 className="text-xl font-black tracking-tight">CONCLUSIONES Y PRÓXIMOS PASOS</h2>
                            </div>
                            {isSent ? (
                                <div className="border border-gray-300 p-4 whitespace-pre-wrap text-sm text-gray-700">{formData.conclusiones}</div>
                            ) : (
                                <Textarea placeholder="Conclusiones del período y acciones planificadas..." value={formData.conclusiones} onChange={(e) => setFormData(prev => ({ ...prev, conclusiones: e.target.value }))} rows={5} className="border border-gray-300 text-sm resize-none" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )

    // -- PDF Preview Modal --
    if (showPdfPreview) {
        return (
            <div className="fixed inset-0 z-[200] bg-gray-600 overflow-auto">
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-6 py-3 flex items-center justify-between shadow-sm print:hidden">
                    <h3 className="font-bold text-slate-900">Vista previa del informe</h3>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                            <FileText className="w-4 h-4" />
                            Imprimir / PDF
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setShowPdfPreview(false)}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
                <div className="flex justify-center py-8 print:py-0">
                    <div className="shadow-2xl print:shadow-none">
                        <ReportContent isPreview={true} />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => navigate('/informes-gestion')} className="gap-2 text-slate-500">
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Informe de Gestión #{report.report_number}</h1>
                        <p className="text-xs text-slate-500">{propertyAddress}{propertyCommune ? ` · ${propertyCommune}` : ''} — {ownerName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowPdfPreview(true)} className="gap-2">
                        <Eye className="w-4 h-4" />
                        Ver PDF
                    </Button>
                    {!isSent && (
                        <>
                            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar
                            </Button>
                            <Button size="sm" onClick={handleSend} disabled={sending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Enviar al Propietario
                            </Button>
                        </>
                    )}
                    {isSent && (
                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                            ✅ Enviado el {new Date(report.sent_at).toLocaleDateString('es-CL')}
                        </div>
                    )}
                </div>
            </div>

            {/* Report Content (editable) */}
            <div className="shadow-xl rounded-2xl overflow-hidden border border-gray-200">
                <ReportContent />
            </div>

            {/* Bottom Action Bar */}
            {!isSent && (
                <div className="max-w-4xl mx-auto flex justify-end gap-3 pb-8">
                    <Button variant="outline" onClick={() => setShowPdfPreview(true)} className="gap-2">
                        <Eye className="w-4 h-4" />
                        Ver PDF
                    </Button>
                    <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2 px-6">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Borrador
                    </Button>
                    <Button onClick={handleSend} disabled={sending} className="gap-2 px-6 bg-blue-600 hover:bg-blue-700 text-white">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar al Propietario
                    </Button>
                </div>
            )}
        </div>
    )
}
