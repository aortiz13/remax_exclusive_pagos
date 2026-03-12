import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getCustomPublicUrl } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Input, Textarea, Label } from '@/components/ui'
import { FileText, Send, ArrowLeft, ArrowRight, Loader2, Save, Download, Upload, Image as ImageIcon, BarChart3, X, Plus, File, Trash2, Camera, Check, RefreshCw, Lock, Eye, Paperclip, Mail, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
// Gotenberg URL - uses Vite proxy in dev to bypass CORS
const GOTENBERG_URL = '/api/gotenberg'

// Fixed portals list
const FIXED_PORTALS = [
    { key: 'remax', label: 'PORTAL RE/MAX', subtitle: '(Visitas a nuestro sitio web y contactos de la Red)' },
    { key: 'portal_inmobiliario', label: 'PORTAL INMOBILIARIO', subtitle: '(Incluye P. Inmobiliario y Mercado Libre)' },
    { key: 'proppit', label: 'GRUPO PROPPIT', subtitle: '(Incluye iCasas, Trovit, Nestoria, Mitula, Nuroa)' },
    { key: 'yapo', label: 'YAPO', subtitle: null },
    { key: 'toctoc', label: 'TOCTOC', subtitle: null },
]

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
    const [previewChartImage, setPreviewChartImage] = useState(null)
    const [logoBase64, setLogoBase64] = useState(null)

    const chartCanvasRef = useRef(null)
    const chartInputRef = useRef(null)
    const exteriorInputRef = useRef(null)
    const interiorInputRef = useRef(null)
    const anexoInputRef = useRef(null)
    const [propertyPhotos, setPropertyPhotos] = useState([])
    const [showPhotoPicker, setShowPhotoPicker] = useState(null) // null | 'exterior' | 'interior'
    const [showSendPreview, setShowSendPreview] = useState(false)
    const [sendPreviewHtml, setSendPreviewHtml] = useState('')
    const [isResendMode, setIsResendMode] = useState(false)
    const [emailDraft, setEmailDraft] = useState({ to: '', subject: '', body: '' })
    const [preGeneratedPdf, setPreGeneratedPdf] = useState({ blobUrl: null, base64: null, filename: '', generating: false })

    const [formData, setFormData] = useState({
        portales: {
            remax: { impresiones: '', contactos: '' },
            portal_inmobiliario: { impresiones: '', contactos: '' },
            proppit: { impresiones: '', contactos: '' },
            yapo: { impresiones: '', contactos: '' },
            toctoc: { impresiones: '', contactos: '' },
        },
        portales_custom: [],
        visitas_coordinadas: '',
        visitas_realizadas: '',
        actividades: [''],
        conclusiones_recomendaciones: [''],
        proximos_pasos: [''],
        greeting_text: '',
        greeting_heading: '',
        anexos: [],
        cover_address: '',
    })

    useEffect(() => {
        fetchReport()
    }, [reportId])

    // Preload logo as base64 for PDF rendering (avoids cross-origin issues in iframe)
    useEffect(() => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0)
                setLogoBase64(canvas.toDataURL('image/png'))
            } catch (e) { console.warn('Could not convert logo to base64:', e) }
        }
        img.src = '/primerolog.png'
    }, [])

    // Fetch property photos when report is loaded
    useEffect(() => {
        if (report?.property_id) {
            supabase
                .from('property_photos')
                .select('*')
                .eq('property_id', report.property_id)
                .order('position', { ascending: true })
                .order('created_at', { ascending: true })
                .then(({ data }) => {
                    if (data && data.length > 0) {
                        setPropertyPhotos(data)
                        // Auto-default: first photo → exterior, second → interior
                        setPropertyImages(prev => ({
                            exterior: prev.exterior || data[0]?.url || null,
                            interior: prev.interior || data[1]?.url || null,
                        }))
                    }
                })
        }
    }, [report?.property_id])

    const fetchReport = async () => {
        if (!reportId) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('management_reports')
                .select(`
                    *,
                    properties:property_id(id, address, commune, image_url, status, unit_number, property_type),
                    owner:owner_contact_id(first_name, last_name, email, phone)
                `)
                .eq('id', reportId)
                .single()

            if (error) throw error

            let agentData = null
            if (data.agent_id) {
                const { data: agentProfile } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, email')
                    .eq('id', data.agent_id)
                    .single()
                agentData = agentProfile
            }

            // Dynamically resolve current owner from property_contacts
            if (data.property_id) {
                const { data: ownerLink } = await supabase
                    .from('property_contacts')
                    .select('contact_id, contacts:contact_id(id, first_name, last_name, email, phone)')
                    .eq('property_id', data.property_id)
                    .eq('role', 'propietario')
                    .limit(1)
                    .single()

                if (ownerLink?.contacts) {
                    data.owner = ownerLink.contacts
                    // Update owner_contact_id if it changed
                    if (ownerLink.contact_id !== data.owner_contact_id) {
                        data.owner_contact_id = ownerLink.contact_id
                        supabase.from('management_reports')
                            .update({ owner_contact_id: ownerLink.contact_id })
                            .eq('id', reportId)
                            .then(() => { })
                    }
                }
            }

            // Merge agent data into the report data object
            const reportDataWithAgent = { ...data, agent: agentData };
            setReport(reportDataWithAgent);

            // Build formatted cover address
            const prop = data.properties
            if (prop && !data.report_data?.cover_address) {
                const rawAddr = prop.address || ''
                const commune = (prop.commune || '').trim()

                // Parse: split by comma, keep only meaningful street parts
                // Filter out commune, region, provincia, postal code, country
                const skipPatterns = [
                    /^chile$/i,
                    /^región/i, /^region/i,
                    /^provincia/i,
                    /^\d{5,}$/, // postal codes
                    /^santiago metropolitan/i,
                ]
                const parts = rawAddr.split(',').map(p => p.trim()).filter(p => {
                    if (!p) return false
                    if (commune && p.toLowerCase() === commune.toLowerCase()) return false
                    return !skipPatterns.some(rx => rx.test(p))
                })

                // Take only the first 2 meaningful parts (street type + street name, or number + street)
                const streetParts = parts.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim()

                // Build: Street, Depto. X, Comuna
                let formatted = streetParts || rawAddr
                const isDept = (prop.property_type || '').toLowerCase().includes('depart')
                const unitNum = (prop.unit_number || '').trim()
                if (isDept && unitNum) {
                    // If unit_number already has "Depto" in it, use as-is
                    if (/depto/i.test(unitNum)) {
                        formatted += `, ${unitNum}`
                    } else {
                        formatted += `, Depto. ${unitNum}`
                    }
                }
                if (commune) {
                    formatted += `, ${commune}`
                }

                setFormData(prev => ({ ...prev, cover_address: formatted }))
            }

            if (data.properties?.image_url) {
                setPropertyImages(prev => ({ ...prev, exterior: data.properties.image_url }))
            }

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

            // Populate form with backward compatibility
            if (data.report_data && Object.keys(data.report_data).length > 0) {
                const rd = data.report_data
                setFormData(prev => {
                    // Migrate old portal data: convert visitas -> impresiones if needed
                    const migratedPortales = { ...prev.portales }
                    for (const key of Object.keys(migratedPortales)) {
                        if (rd.portales?.[key]) {
                            const old = rd.portales[key]
                            migratedPortales[key] = {
                                impresiones: old.impresiones || old.visitas || '',
                                contactos: old.contactos || '',
                            }
                        }
                    }

                    // Migrate old text fields (string → array)
                    const migrateToArray = (val) => {
                        if (Array.isArray(val)) return val.length > 0 ? val : ['']
                        if (typeof val === 'string' && val.trim()) return val.split('\n').filter(l => l.trim())
                        return ['']
                    }
                    const conclusiones_recomendaciones = migrateToArray(rd.conclusiones_recomendaciones || rd.analisis_mercado)
                    const proximos_pasos = migrateToArray(rd.proximos_pasos || rd.conclusiones)

                    // Generate default greeting if not set
                    const ownerFirstName = data.owner?.first_name || ''
                    const defaultGreeting = `Deseo informarle de las actividades realizadas para la ${data.properties?.status?.includes('En Arriendo') ? 'comercialización de arriendo' : 'venta'} de su propiedad, y el control estadístico de las visualizaciones en los portales principales aunado a un breve resumen de la gestión realizada hasta el momento.`

                    return {
                        ...prev,
                        portales: migratedPortales,
                        portales_custom: rd.portales_custom || [],
                        visitas_coordinadas: rd.visitas_coordinadas || '',
                        visitas_realizadas: rd.visitas_realizadas || '',
                        actividades: migrateToArray(rd.actividades),
                        conclusiones_recomendaciones,
                        proximos_pasos,
                        greeting_text: rd.greeting_text || defaultGreeting,
                        greeting_heading: rd.greeting_heading || '',
                        anexos: rd.anexos || [],
                        cover_address: rd.cover_address || '',
                    }
                })
            } else {
                // Set default greeting for new reports
                const ownerFirstName = data.owner?.first_name || ''
                const defaultGreeting = `Deseo informarle de las actividades realizadas para la ${data.properties?.status?.includes('En Arriendo') ? 'comercialización de arriendo' : 'venta'} de su propiedad, y el control estadístico de las visualizaciones en los portales principales aunado a un breve resumen de la gestión realizada hasta el momento.`
                setFormData(prev => ({ ...prev, greeting_text: defaultGreeting }))
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

    const handleAnexoUpload = async (file) => {
        if (!file) return
        const maxSize = 10 * 1024 * 1024
        if (file.size > maxSize) {
            toast.error('El archivo no debe superar 10MB')
            return
        }
        try {
            const ext = file.name.split('.').pop().toLowerCase()
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const filePath = `management-reports/${reportId}/anexos/${Date.now()}-${safeName}`
            const { error: uploadError } = await supabase.storage
                .from('mandates')
                .upload(filePath, file, { cacheControl: '3600', upsert: true })

            if (uploadError) throw uploadError

            const publicUrl = getCustomPublicUrl('mandates', filePath)
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)

            setFormData(prev => ({
                ...prev,
                anexos: [...prev.anexos, { url: publicUrl, name: file.name, type: ext, isImage, title: '', description: '' }]
            }))
            toast.success('Anexo cargado')
        } catch (err) {
            console.error('Upload error:', err)
            toast.error('Error al cargar anexo')
        }
    }

    const removeAnexo = async (index) => {
        const anexo = formData.anexos[index]
        if (anexo?.url) {
            try {
                // Extract storage path from the URL
                const match = anexo.url.match(/\/storage\/v1\/object\/public\/mandates\/(.+)/)
                if (match) {
                    await supabase.storage.from('mandates').remove([decodeURIComponent(match[1])])
                }
            } catch (err) {
                console.error('Error deleting file from storage:', err)
            }
        }
        setFormData(prev => ({
            ...prev,
            anexos: prev.anexos.filter((_, i) => i !== index)
        }))
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

    const updateCustomPortal = (index, field, value) => {
        setFormData(prev => {
            const updated = [...prev.portales_custom]
            updated[index] = { ...updated[index], [field]: value }
            return { ...prev, portales_custom: updated }
        })
    }

    const addCustomPortal = () => {
        setFormData(prev => ({
            ...prev,
            portales_custom: [...prev.portales_custom, { nombre: '', impresiones: '', contactos: '' }]
        }))
    }

    const removeCustomPortal = (index) => {
        setFormData(prev => ({
            ...prev,
            portales_custom: prev.portales_custom.filter((_, i) => i !== index)
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

    // --- Open Send Preview Modal ---
    const openSendPreview = async (resend = false) => {
        if (!resend) {
            const hasActividades = formData.actividades.some(a => a.trim())
            const hasConclusiones = formData.conclusiones_recomendaciones.some(a => a.trim())
            if (!hasActividades && !hasConclusiones) {
                toast.error('Completa al menos las actividades y conclusiones')
                return
            }
        }

        // Check Gmail
        const { data: gmailAccount, error: gmailError } = await supabase
            .from('gmail_accounts')
            .select('id')
            .eq('agent_id', profile?.id || report.agent_id)
            .single()
        if (gmailError || !gmailAccount) {
            toast.error('Debes conectar tu cuenta de correo en la sección "Casilla" antes de enviar informes.', { duration: 6000 })
            return
        }

        const ownerEmail = report.owner?.email
        if (!ownerEmail) {
            toast.error('El propietario no tiene un correo electrónico registrado.')
            return
        }

        // Capture chart
        if (!chartImage && chartCanvasRef.current) {
            try { setPreviewChartImage(chartCanvasRef.current.toDataURL('image/png')) } catch (e) { }
        }
        await new Promise(resolve => setTimeout(resolve, 200))

        // Build PDF preview HTML (same as handleDownloadPdf)
        const reportEl = document.getElementById('pdf-offscreen-content')
        if (reportEl) {
            const footerName = `${report?.agent?.first_name || profile?.first_name || ''} ${report?.agent?.last_name || profile?.last_name || ''}`.trim()
            const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(el => el.outerHTML).join('\n')
            let reportHtml = reportEl.innerHTML
            reportHtml = reportHtml.replace(/src="\/([^"]+)"/g, `src="${window.location.origin}/$1"`)
            const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte</title>${styles}
                <style>
                    @page { size: A4; margin: 0; }
                    body { margin: 0; padding: 0; padding-bottom: 50px; background: white; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    footer { display: none !important; }
                    section { border-bottom: none !important; }
                    .print-footer {
                        position: fixed; bottom: 0; left: 0; right: 0; height: 50px;
                        display: flex; align-items: center; justify-content: space-between;
                        padding: 0 32px; border-top: 1px solid #e5e7eb; background: #f9fafb;
                        font-family: 'Public Sans', 'Inter', sans-serif; z-index: 9999;
                    }
                    .print-footer .footer-text { font-size: 10px; color: #6b7280; }
                    .print-footer .footer-text p { margin: 0; }
                    .print-footer img { height: 64px; object-fit: contain; }
                </style></head><body>
                <div class="print-footer">
                    <div class="footer-text">
                        <p>© ${new Date().getFullYear()} RE/MAX Exclusive</p>
                        <p>${footerName}</p>
                    </div>
                    <img src="${logoBase64 || (window.location.origin + '/primerolog.png')}" alt="RE/MAX" />
                </div>
                ${reportHtml}</body></html>`
            setSendPreviewHtml(previewHtml)
        }

        // Pre-fill email draft
        const ownerName = `${report.owner?.first_name || ''}`.trim()
        const propertyAddr = report.properties?.address || ''
        const propCommune = report.properties?.commune || ''
        const defaultBody = `Estimado/a ${ownerName || 'Propietario/a'},\n\nJunto con saludar, adjunto el informe de gestión correspondiente a su propiedad ubicada en ${propertyAddr}${propCommune ? `, ${propCommune}` : ''}.\n\nEn el archivo adjunto encontrará el detalle completo de las actividades realizadas, estadísticas de visualizaciones en portales y las conclusiones del período.\n\nQuedo atento/a a cualquier comentario o consulta.\n\nSaludos cordiales,`

        setEmailDraft({
            to: ownerEmail,
            subject: `Informe de Gestion #${report.report_number} - ${propertyAddr}`,
            body: defaultBody,
        })
        setIsResendMode(resend)
        setShowSendPreview(true)

        // Generate PDF in background using the shared builder (same as Download PDF)
        const pdfFilename = `Informe_Gestion_${report.report_number}_${(report.properties?.address || '').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        setPreGeneratedPdf({ blobUrl: null, base64: null, filename: pdfFilename, generating: true })
        setTimeout(async () => {
            try {
                const result = await buildPdfFromReport()
                if (result) {
                    setPreGeneratedPdf({ blobUrl: result.blobUrl, base64: result.base64, filename: pdfFilename, generating: false })
                } else {
                    setPreGeneratedPdf(prev => ({ ...prev, generating: false }))
                }
            } catch (err) {
                console.error('Error pre-generating PDF:', err)
                setPreGeneratedPdf(prev => ({ ...prev, generating: false }))
            }
        }, 100)
    }

    // --- Confirm Send from Preview Modal ---
    const confirmSend = async () => {
        setSending(true)
        try {
            // Save report data on first send
            if (!isResendMode) {
                const fullData = getFullFormData()
                await supabase
                    .from('management_reports')
                    .update({ report_data: fullData, status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    .eq('id', reportId)
            }

            const agentName = `${report.agent?.first_name || profile?.first_name || ''} ${report.agent?.last_name || profile?.last_name || ''}`.trim()
            const agentEmail = report.agent?.email || profile?.email || ''
            const propertyAddr = report.properties?.address || ''

            // Build HTML email from the editable draft body
            const bodyLines = emailDraft.body.split('\n').filter(l => l.trim())
            const bodyHtml = `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
                    ${bodyLines.map(line => `<p style="font-size: 15px; line-height: 1.7; color: #4a4a4a; margin: 0 0 16px 0;">${line}</p>`).join('\n')}
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                        <div style="color: #1a1a1a; font-weight: 700; font-size: 15px;">${agentName}</div>
                        <div style="color: #003DA5; font-size: 13px; font-weight: 600; margin-top: 2px;">Agente RE/MAX Exclusive</div>
                        ${agentEmail ? `<div style="color: #6b7280; font-size: 13px; margin-top: 4px;">${agentEmail}</div>` : ''}
                    </div>
                    <div style="margin-top: 32px; padding: 16px 0; border-top: 1px solid #e5e7eb; text-align: center;">
                        <span style="color: #9ca3af; font-size: 11px;">© ${new Date().getFullYear()} RE/MAX Exclusive · Santiago, Chile</span>
                    </div>
                </div>
            `

            // Fetch document anexos as base64
            const documentAnexos = formData.anexos.filter(a => !a.isImage)
            const emailAttachments = []
            for (const anexo of documentAnexos) {
                try {
                    const response = await fetch(anexo.url)
                    if (!response.ok) continue
                    const blob = await response.blob()
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onload = () => resolve(reader.result.split(',')[1])
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                    })
                    const mimeMap = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
                    emailAttachments.push({ filename: anexo.name || `anexo.${anexo.type}`, mimeType: mimeMap[anexo.type] || 'application/octet-stream', data: base64 })
                } catch (err) { console.warn('Could not fetch anexo:', anexo.name, err) }
            }

            // Use pre-generated PDF if available, otherwise generate via shared builder
            if (preGeneratedPdf.base64) {
                emailAttachments.unshift({ filename: preGeneratedPdf.filename, mimeType: 'application/pdf', data: preGeneratedPdf.base64 })
            } else {
                toast.loading('Generando PDF del informe...', { id: 'pdf-gen' })
                try {
                    const result = await buildPdfFromReport()
                    if (result) {
                        const propertyAddr = report.properties?.address || ''
                        emailAttachments.unshift({ filename: `Informe_Gestion_${report.report_number}_${propertyAddr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, mimeType: 'application/pdf', data: result.base64 })
                    }
                } catch (pdfErr) { console.warn('Could not generate PDF attachment:', pdfErr) }
                toast.dismiss('pdf-gen')
            }

            // Send via Gmail
            const { data: sessionData } = await supabase.auth.getSession()
            const token = sessionData?.session?.access_token
            if (!token) throw new Error('No se encontró una sesión activa.')

            const { error: sendError } = await supabase.functions.invoke('gmail-send', {
                headers: { Authorization: `Bearer ${token}` },
                body: { to: emailDraft.to, subject: emailDraft.subject, bodyHtml, attachments: emailAttachments }
            })
            if (sendError) throw new Error(sendError.message || 'Error al enviar el correo')

            if (!isResendMode) {
                // Create next report — check if property is published to decide status
                const nextDueDate = new Date()
                nextDueDate.setDate(nextDueDate.getDate() + 15)

                // Check current property publication status
                const { data: propData } = await supabase
                    .from('properties')
                    .select('status')
                    .eq('id', report.property_id)
                    .single()

                const isPublished = propData?.status?.includes('Publicada')

                await supabase.from('management_reports').insert({
                    property_id: report.property_id,
                    mandate_id: report.mandate_id,
                    agent_id: report.agent_id,
                    owner_contact_id: report.owner_contact_id,
                    report_number: report.report_number + 1,
                    due_date: isPublished ? nextDueDate.toISOString().split('T')[0] : '2099-12-31',
                    status: isPublished ? 'pending' : 'waiting_publication'
                })
                toast.success('¡Informe enviado al propietario!')
                setShowSendPreview(false)
                navigate('/informes-gestion')
            } else {
                await supabase.from('management_reports').update({ sent_at: new Date().toISOString() }).eq('id', reportId)
                toast.success('¡Informe re-enviado al propietario!')
                setShowSendPreview(false)
            }
        } catch (err) {
            console.error('Error sending report:', err)
            toast.error('Error al enviar el informe: ' + (err.message || ''))
        } finally {
            setSending(false)
        }
    }

    // --- Auto-generated bar chart ---
    const getChartData = useCallback(() => {
        const entries = []
        for (const p of FIXED_PORTALS) {
            const d = formData.portales[p.key]
            const imp = parseInt(d?.impresiones) || 0
            const con = parseInt(d?.contactos) || 0
            if (imp > 0 || con > 0) {
                entries.push({ label: p.label.replace('PORTAL ', '').replace('GRUPO ', ''), impresiones: imp, contactos: con })
            }
        }
        for (const c of formData.portales_custom) {
            const imp = parseInt(c.impresiones) || 0
            const con = parseInt(c.contactos) || 0
            if ((imp > 0 || con > 0) && c.nombre) {
                entries.push({ label: c.nombre, impresiones: imp, contactos: con })
            }
        }
        return entries
    }, [formData.portales, formData.portales_custom])

    const drawChart = useCallback((canvas) => {
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const data = getChartData()

        // HiDPI scaling for crisp rendering
        const dpr = window.devicePixelRatio || 2
        const logicalW = 720
        const logicalH = 400
        canvas.width = logicalW * dpr
        canvas.height = logicalH * dpr
        canvas.style.width = logicalW + 'px'
        canvas.style.height = logicalH + 'px'
        ctx.scale(dpr, dpr)

        const W = logicalW
        const H = logicalH
        const needsRotation = data.length > 4
        const pad = { top: 40, bottom: needsRotation ? 100 : 50, left: 60, right: 25 }

        ctx.clearRect(0, 0, W, H)

        // Background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)

        if (data.length === 0) {
            ctx.fillStyle = '#94a3b8'
            ctx.font = '16px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('Ingresa datos en la tabla para generar el gráfico', W / 2, H / 2)
            return
        }

        // RE/MAX brand colors (flat)
        const COLOR_BLUE = '#003DA5'
        const COLOR_RED = '#C8102E'

        // Legend at top-right
        ctx.font = '13px Inter, sans-serif'
        ctx.textAlign = 'left'
        const legendY = 20
        ctx.fillStyle = COLOR_BLUE
        ctx.fillRect(W - 260, legendY - 5, 14, 14)
        ctx.fillStyle = '#334155'
        ctx.fillText('Visualizaciones', W - 242, legendY + 7)
        ctx.fillStyle = COLOR_RED
        ctx.fillRect(W - 130, legendY - 5, 14, 14)
        ctx.fillStyle = '#334155'
        ctx.fillText('Contactos', W - 112, legendY + 7)

        const maxVal = Math.max(...data.flatMap(d => [d.impresiones, d.contactos]), 1)
        const chartW = W - pad.left - pad.right
        const chartH = H - pad.top - pad.bottom
        const groupW = chartW / data.length
        const barW = Math.min(Math.max(groupW * 0.28, 16), 42)
        const gap = Math.min(barW * 0.15, 5)

        // Y-axis labels + horizontal grid lines
        const steps = 5
        ctx.fillStyle = '#64748b'
        ctx.font = '12px Inter, sans-serif'
        ctx.textAlign = 'right'
        for (let i = 0; i <= steps; i++) {
            const y = pad.top + chartH - (chartH * i / steps)
            const val = Math.round(maxVal * i / steps)
            ctx.fillText(val.toLocaleString(), pad.left - 10, y + 4)
            // Horizontal grid line
            ctx.beginPath()
            ctx.strokeStyle = i === 0 ? '#94a3b8' : '#e2e8f0'
            ctx.lineWidth = i === 0 ? 1 : 0.5
            ctx.moveTo(pad.left, y)
            ctx.lineTo(W - pad.right, y)
            ctx.stroke()
        }

        // Y-axis line (left vertical)
        ctx.beginPath()
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1
        ctx.moveTo(pad.left, pad.top)
        ctx.lineTo(pad.left, pad.top + chartH)
        ctx.stroke()

        // Bars
        data.forEach((d, i) => {
            const x = pad.left + groupW * i + groupW / 2
            const h1 = (d.impresiones / maxVal) * chartH
            const h2 = (d.contactos / maxVal) * chartH

            // Visualizaciones bar (flat RE/MAX blue)
            ctx.fillStyle = COLOR_BLUE
            const bx1 = x - barW - gap / 2
            const by1 = pad.top + chartH - h1
            ctx.fillRect(bx1, by1, barW, h1)

            // Contactos bar (flat RE/MAX red)
            ctx.fillStyle = COLOR_RED
            const bx2 = x + gap / 2
            const by2 = pad.top + chartH - h2
            ctx.fillRect(bx2, by2, barW, h2)

            // Values on bars
            ctx.fillStyle = '#1e293b'
            ctx.font = 'bold 12px Inter, sans-serif'
            ctx.textAlign = 'center'
            if (d.impresiones > 0) ctx.fillText(d.impresiones.toLocaleString(), bx1 + barW / 2, by1 - 6)
            if (d.contactos > 0) ctx.fillText(d.contactos.toLocaleString(), bx2 + barW / 2, by2 - 6)

            // X labels
            ctx.fillStyle = '#334155'
            const fontSize = needsRotation ? 11 : 12
            ctx.font = `${fontSize}px Inter, sans-serif`
            const maxLabelLen = needsRotation ? 20 : 18
            const labelText = d.label.length > maxLabelLen ? d.label.substring(0, maxLabelLen) + '…' : d.label
            if (needsRotation) {
                ctx.save()
                ctx.translate(x, pad.top + chartH + 10)
                ctx.rotate(-Math.PI / 4)
                ctx.textAlign = 'right'
                ctx.fillText(labelText, 0, 0)
                ctx.restore()
            } else {
                ctx.textAlign = 'center'
                ctx.fillText(labelText, x, pad.top + chartH + 22)
            }
        })
    }, [getChartData])

    // Redraw chart when data changes
    useEffect(() => {
        if (!chartImage && chartCanvasRef.current) {
            drawChart(chartCanvasRef.current)
        }
    }, [formData.portales, formData.portales_custom, chartImage, drawChart])



    // -- Bullet list helpers --
    const updateBulletItem = (field, index, value) => {
        setFormData(prev => {
            const updated = [...prev[field]]
            updated[index] = value
            return { ...prev, [field]: updated }
        })
    }

    const addBulletItem = (field, afterIndex) => {
        setFormData(prev => {
            const updated = [...prev[field]]
            updated.splice(afterIndex + 1, 0, '')
            return { ...prev, [field]: updated }
        })
        // Focus the new input after render
        setTimeout(() => {
            const inputs = document.querySelectorAll(`[data-bullet="${field}"]`)
            inputs[afterIndex + 1]?.focus()
        }, 50)
    }

    const removeBulletItem = (field, index) => {
        setFormData(prev => {
            const updated = [...prev[field]]
            if (updated.length <= 1) return prev // Keep at least 1
            updated.splice(index, 1)
            return { ...prev, [field]: updated }
        })
        // Focus the previous input
        setTimeout(() => {
            const inputs = document.querySelectorAll(`[data-bullet="${field}"]`)
            const focusIdx = Math.max(0, index - 1)
            inputs[focusIdx]?.focus()
        }, 50)
    }

    const handleBulletKeyDown = (e, field, index) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            addBulletItem(field, index)
        } else if (e.key === 'Backspace' && formData[field][index] === '' && formData[field].length > 1) {
            e.preventDefault()
            removeBulletItem(field, index)
        }
    }

    const renderBulletSection = (title, field, placeholder, emptyText) => (
        <div className="mb-6">
            <div className="bg-[#1B3A5C] text-white px-4 py-2 text-sm font-bold">{title}</div>
            <div className="border border-gray-300 border-t-0 p-4">
                {isSent ? (
                    <div className="space-y-1.5">
                        {(formData[field] || ['']).filter(item => item.trim()).length > 0 ? (
                            (formData[field] || ['']).filter(item => item.trim()).map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                    <span className="text-gray-400 mt-0.5 flex-shrink-0">□</span>
                                    <span>{item}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-400">{emptyText}</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {(formData[field] || ['']).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 group">
                                <span className="text-gray-400 text-sm flex-shrink-0">□</span>
                                <input
                                    data-bullet={field}
                                    type="text"
                                    value={item}
                                    onChange={(e) => updateBulletItem(field, idx, e.target.value)}
                                    onKeyDown={(e) => handleBulletKeyDown(e, field, idx)}
                                    placeholder={idx === 0 ? placeholder : 'Presiona Enter para agregar otro...'}
                                    className="flex-1 text-sm py-1.5 px-2 border-0 border-b border-transparent focus:border-gray-300 outline-none bg-transparent transition-colors placeholder:text-gray-300"
                                />
                                {formData[field].length > 1 && (
                                    <button onClick={() => removeBulletItem(field, idx)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button onClick={() => addBulletItem(field, formData[field].length - 1)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-500 transition-colors mt-1 ml-5">
                            <Plus className="w-3 h-3" />
                            Agregar ítem
                        </button>
                    </div>
                )}
            </div>
        </div>
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    if (!report) return null

    const isSent = report.status === 'sent'
    const isWaiting = report.status === 'waiting_publication'
    const isAdminRole = ['superadministrador', 'comercial', 'legal', 'tecnico'].includes(profile?.role)
    const isOwnerAgent = user?.id === report.agent_id
    const isReadOnly = isAdminRole && !isOwnerAgent
    const agentName = `${report.agent?.first_name || profile?.first_name || ''} ${report.agent?.last_name || profile?.last_name || ''}`.trim()
    const ownerFirstName = report.owner?.first_name || ''
    const propertyAddress = report.properties?.address || 'Dirección de la propiedad'
    const propertyCommune = report.properties?.commune || ''

    // -- PDF-style Report Component --
    const ReportContent = ({ isPreview = false }) => {
        const isSentOrPreview = isSent || isPreview || isReadOnly
        return (
            <div className={cn("bg-white text-black", isPreview ? "w-[210mm] pdf-print-area" : "max-w-4xl mx-auto")} style={{ fontFamily: "'Public Sans', 'Inter', sans-serif" }}>

                {/* === SECTION 1: COVER PAGE === */}
                <section data-pdf-section="cover-intro" className="relative w-full min-h-[450px] overflow-hidden group">
                    {propertyImages.exterior ? (
                        <img src={propertyImages.exterior} alt="Exterior" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 w-full h-full bg-gray-200 flex items-center justify-center">
                            <ImageIcon className="w-16 h-16 text-gray-400" />
                        </div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,61,165,0.85), transparent 70%)' }} />
                    <div className="absolute bottom-8 left-12 right-12 text-white">
                        <div className="bg-white p-5 inline-block mb-5 shadow-xl">
                            <img src={logoBase64 || '/primerolog.png'} alt="RE/MAX Exclusive" className="h-[84px] object-contain" />
                        </div>
                        <h1 className="text-5xl font-extrabold uppercase tracking-tight leading-none mb-2">
                            Reporte de<br />Actividades
                        </h1>
                        <div className="w-24 h-1.5 bg-[#E11B22] mt-5 mb-5" />
                        {isSentOrPreview ? (
                            <p className="text-2xl font-light opacity-90">{formData.cover_address || `${propertyAddress}${propertyCommune ? `, ${propertyCommune}` : ''}`}</p>
                        ) : (
                            <input
                                type="text"
                                value={formData.cover_address || `${propertyAddress}${propertyCommune ? `, ${propertyCommune}` : ''}`}
                                onChange={(e) => setFormData(prev => ({ ...prev, cover_address: e.target.value }))}
                                className="text-2xl font-light opacity-90 bg-transparent border-0 border-b border-white/30 focus:border-white outline-none w-full text-white placeholder:text-white/50 py-1"
                                placeholder="Dirección de la propiedad"
                            />
                        )}
                    </div>
                    {/* Hover controls for photo selection */}
                    {!isSentOrPreview && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            {propertyPhotos.length > 0 && (
                                <button onClick={() => setShowPhotoPicker('exterior')} className="bg-white/90 hover:bg-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg text-sm">
                                    <Camera className="w-4 h-4" /> Elegir foto
                                </button>
                            )}
                            <button onClick={() => exteriorInputRef.current?.click()} className="bg-white/90 hover:bg-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg text-sm">
                                <Upload className="w-4 h-4" /> Subir
                            </button>
                        </div>
                    )}
                    <input ref={exteriorInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0], 'exterior')} />
                </section>

                {/* === SECTION 2: INTRODUCTION === */}
                <section data-pdf-section="cover-intro" className="px-12 py-12 bg-gray-50 border-b border-gray-100">
                    <div className="flex gap-12 items-center">
                        {/* Interior image with offset red border */}
                        <div className="w-2/5 flex-shrink-0">
                            <div className="relative group">
                                <div className="absolute -top-3 -left-3 w-full h-full border-2 border-[#E11B22] z-0" />
                                {propertyImages.interior ? (
                                    <img src={propertyImages.interior} alt="Interior" className="relative z-10 w-full aspect-square object-cover" />
                                ) : (
                                    <div className="relative z-10 w-full aspect-square bg-gray-200 flex flex-col items-center justify-center text-gray-400">
                                        <ImageIcon className="w-12 h-12" />
                                        <span className="text-sm mt-2">Foto interior</span>
                                    </div>
                                )}
                                {!isSentOrPreview && (
                                    <div className="absolute inset-0 z-20 bg-black/0 hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all gap-2">
                                        {propertyPhotos.length > 0 && (
                                            <button onClick={() => setShowPhotoPicker('interior')} className="bg-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg text-sm">
                                                <Camera className="w-4 h-4" /> Elegir
                                            </button>
                                        )}
                                        <button onClick={() => interiorInputRef.current?.click()} className="bg-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg text-sm">
                                            <Upload className="w-4 h-4" /> Subir
                                        </button>
                                    </div>
                                )}
                                <input ref={interiorInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0], 'interior')} />
                            </div>
                        </div>
                        {/* Greeting text */}
                        <div className="w-3/5">
                            <span className="text-[#E11B22] font-bold uppercase tracking-[0.3em] text-xs mb-4 block">Introducción</span>
                            {isSentOrPreview ? (
                                <h3 className="text-2xl font-bold text-[#003DA5] mb-5">{formData.greeting_heading || `Estimado/a ${ownerFirstName},`}</h3>
                            ) : (
                                <input
                                    type="text"
                                    value={formData.greeting_heading || `Estimado/a ${ownerFirstName},`}
                                    onChange={(e) => setFormData(prev => ({ ...prev, greeting_heading: e.target.value }))}
                                    className="text-2xl font-bold text-[#003DA5] mb-5 bg-transparent border-0 border-b border-transparent focus:border-gray-300 outline-none w-full py-1 transition-colors"
                                    placeholder="Estimado/a..."
                                />
                            )}
                            <div className="w-12 h-1 bg-gray-200 mb-5" />
                            {isSentOrPreview ? (
                                <p className="text-base leading-relaxed text-gray-600 font-light whitespace-pre-wrap">{formData.greeting_text}</p>
                            ) : (
                                <Textarea
                                    value={formData.greeting_text}
                                    onChange={(e) => setFormData(prev => ({ ...prev, greeting_text: e.target.value }))}
                                    rows={5}
                                    className="text-base leading-relaxed text-gray-600 font-light border-gray-200 rounded-lg resize-none focus-visible:ring-1 focus-visible:ring-[#003DA5] shadow-none w-full bg-transparent"
                                    placeholder="Escriba el saludo al propietario..."
                                />
                            )}
                        </div>
                    </div>
                </section>

                {/* === SECTION 3: PORTAL STATISTICS === */}
                <section data-pdf-section="statistics" className="px-12 py-12 border-b border-gray-100" style={{ pageBreakBefore: isPreview ? 'always' : 'auto' }}>
                    <div className="mb-8 flex justify-between items-end">
                        <div>
                            <span className="text-[#E11B22] font-bold uppercase tracking-[0.3em] text-xs mb-2 block">Estadísticas</span>
                            <h2 className="text-3xl font-bold text-[#003DA5] uppercase"> En Portales</h2>
                        </div>
                        <div className="text-right text-gray-400 text-xs font-semibold uppercase">Periodo Actual</div>
                    </div>

                    <div className="rounded-xl overflow-hidden shadow-sm border border-gray-100">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#003DA5] text-white">
                                    <th className="py-4 px-6 text-left font-bold uppercase tracking-wider">Canal de Publicación</th>
                                    <th className="py-4 px-6 text-center font-bold uppercase tracking-wider">Visualizaciones</th>
                                    <th className="py-4 px-6 text-center font-bold uppercase tracking-wider">Contactos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {FIXED_PORTALS.map((portal, idx) => (
                                    <tr key={portal.key} className={cn("hover:bg-gray-50 transition-colors", idx % 2 === 1 && "bg-gray-50/30")}>
                                        <td className="py-4 px-6 font-semibold text-gray-800">
                                            {portal.label}
                                            {portal.subtitle && <span className="block text-xs text-gray-400 font-normal mt-0.5">{portal.subtitle}</span>}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {isSentOrPreview ? (
                                                <span className="text-[#003DA5] font-bold">{formData.portales[portal.key]?.impresiones || '0'}</span>
                                            ) : (
                                                <Input type="number" placeholder="0" value={formData.portales[portal.key]?.impresiones || ''} onChange={(e) => updatePortal(portal.key, 'impresiones', e.target.value)} className="w-20 text-center text-sm mx-auto font-bold text-[#003DA5]" />
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {isSentOrPreview ? (
                                                <span className="text-gray-600 italic">{formData.portales[portal.key]?.contactos || '0'}</span>
                                            ) : (
                                                <Input type="number" placeholder="0" value={formData.portales[portal.key]?.contactos || ''} onChange={(e) => updatePortal(portal.key, 'contactos', e.target.value)} className="w-20 text-center text-sm mx-auto" />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {/* Custom portal rows */}
                                {formData.portales_custom.map((cp, idx) => (
                                    <tr key={`custom-${idx}`} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 px-6 font-semibold text-gray-800">
                                            {isSentOrPreview ? (
                                                <span>{cp.nombre || 'Otro portal'}</span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Input placeholder="Nombre del portal" value={cp.nombre} onChange={(e) => updateCustomPortal(idx, 'nombre', e.target.value)} className="text-sm w-44" />
                                                    <button onClick={() => removeCustomPortal(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {isSentOrPreview ? (
                                                <span className="text-[#003DA5] font-bold">{cp.impresiones || '0'}</span>
                                            ) : (
                                                <Input type="number" placeholder="0" value={cp.impresiones} onChange={(e) => updateCustomPortal(idx, 'impresiones', e.target.value)} className="w-20 text-center text-sm mx-auto font-bold text-[#003DA5]" />
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {isSentOrPreview ? (
                                                <span className="text-gray-600 italic">{cp.contactos || '0'}</span>
                                            ) : (
                                                <Input type="number" placeholder="0" value={cp.contactos} onChange={(e) => updateCustomPortal(idx, 'contactos', e.target.value)} className="w-20 text-center text-sm mx-auto" />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Add portal button */}
                    {!isSentOrPreview && (
                        <div className="mt-3 flex justify-center">
                            <Button variant="outline" size="sm" onClick={addCustomPortal} className="gap-2 text-sm text-gray-500">
                                <Plus className="w-4 h-4" /> Agregar portal
                            </Button>
                        </div>
                    )}

                    {/* Global visit fields */}
                    <div className="mt-8 grid grid-cols-2 gap-6">
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                            <label className="block text-xs font-bold text-[#003DA5] uppercase tracking-wider mb-2">Visitas Coordinadas</label>
                            {isSentOrPreview ? (
                                <p className="text-3xl font-bold text-gray-800">{formData.visitas_coordinadas || '0'}</p>
                            ) : (
                                <Input type="number" placeholder="0" value={formData.visitas_coordinadas} onChange={(e) => setFormData(prev => ({ ...prev, visitas_coordinadas: e.target.value }))} className="text-2xl font-bold text-center" />
                            )}
                        </div>
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                            <label className="block text-xs font-bold text-[#003DA5] uppercase tracking-wider mb-2">Visitas Realizadas (Efectivas)</label>
                            {isSentOrPreview ? (
                                <p className="text-3xl font-bold text-gray-800">{formData.visitas_realizadas || '0'}</p>
                            ) : (
                                <Input type="number" placeholder="0" value={formData.visitas_realizadas} onChange={(e) => setFormData(prev => ({ ...prev, visitas_realizadas: e.target.value }))} className="text-2xl font-bold text-center" />
                            )}
                        </div>
                    </div>
                </section>

                {/* === SECTION 4: CHART === */}
                <section data-pdf-section="chart" className="px-12 py-12 border-b border-gray-100 bg-white" style={{ pageBreakBefore: isPreview ? 'always' : 'auto' }}>
                    <h3 className="text-center text-sm font-bold text-[#003DA5] uppercase tracking-wider mb-2">Visualizaciones vs. Contactos</h3>
                    <p className="text-center text-xs text-gray-400 mb-8">Comparativa por portal de publicación</p>
                    <div className="relative max-w-3xl mx-auto min-h-[280px] overflow-hidden group flex items-center justify-center">
                        {(() => {
                            const imgSrc = isPreview ? (chartImage || previewChartImage) : chartImage
                            if (imgSrc) return <img src={imgSrc} alt="Gráfico" className="max-w-full max-h-[350px] object-contain" />
                            if (isPreview) return <p className="text-gray-400 text-sm">Sin datos de gráfico</p>
                            return <canvas ref={chartCanvasRef} className="max-w-full" />
                        })()}
                        {!isSentOrPreview && (
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => chartInputRef.current?.click()} className="bg-white/90 hover:bg-white rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-md text-xs">
                                    <Upload className="w-3 h-3" /> Subir gráfico
                                </button>
                                {chartImage && (
                                    <button onClick={() => setChartImage(null)} className="bg-red-500 text-white rounded-full p-1.5" title="Volver al gráfico automático">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}
                        <input ref={chartInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0], 'chart')} />
                    </div>
                </section>

                {/* === SECTION 5: MANAGEMENT SUMMARY === */}
                <section data-pdf-section="management" className="px-12 py-12 border-b border-gray-100 allow-break" style={{ pageBreakBefore: isPreview ? 'always' : 'auto' }}>
                    <div className="mb-10">
                        <span className="text-[#E11B22] font-bold uppercase tracking-[0.3em] text-xs mb-2 block">Gestión</span>
                        <h2 className="text-3xl font-bold text-[#003DA5] uppercase">Resumen Operativo</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-10">
                        {/* Left: Actividades */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-[#003DA5] flex items-center justify-center rounded-lg flex-shrink-0">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                                <h4 className="text-lg font-bold text-[#003DA5]">Actividades Ejecutadas</h4>
                            </div>
                            {isSentOrPreview ? (
                                <ul className="space-y-3 text-gray-600">
                                    {(formData.actividades || ['']).filter(i => i.trim()).map((item, idx) => (
                                        <li key={idx} className="flex gap-3"><span className="text-[#E11B22]">●</span> {item}</li>
                                    ))}
                                    {(formData.actividades || []).filter(i => i.trim()).length === 0 && <li className="text-gray-400 italic">Sin actividades registradas</li>}
                                </ul>
                            ) : (
                                <div className="space-y-1.5">
                                    {(formData.actividades || ['']).map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 group">
                                            <span className="text-[#E11B22] flex-shrink-0 mt-2">●</span>
                                            <textarea data-bullet="actividades" rows={1} value={item} ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }} onChange={(e) => { updateBulletItem('actividades', idx, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBulletKeyDown(e, 'actividades', idx) } }} placeholder={idx === 0 ? 'Ej: Publicación en portales...' : 'Enter para agregar otro...'} className="flex-1 text-sm py-1.5 px-2 border-0 border-b border-transparent focus:border-gray-300 outline-none bg-transparent transition-colors placeholder:text-gray-300 resize-none overflow-hidden" />
                                            {formData.actividades.length > 1 && (
                                                <button onClick={() => removeBulletItem('actividades', idx)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={() => addBulletItem('actividades', formData.actividades.length - 1)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#003DA5] transition-colors mt-1 ml-5"><Plus className="w-3 h-3" /> Agregar ítem</button>
                                </div>
                            )}
                        </div>

                        {/* Right: Conclusiones y Recomendaciones */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-[#E11B22] flex items-center justify-center rounded-lg flex-shrink-0">
                                    <BarChart3 className="w-5 h-5 text-white" />
                                </div>
                                <h4 className="text-lg font-bold text-[#003DA5]">Conclusiones</h4>
                            </div>
                            {isSentOrPreview ? (
                                <ul className="space-y-3 text-gray-600 font-medium bg-gray-50 p-5 rounded-xl">
                                    {(formData.conclusiones_recomendaciones || ['']).filter(i => i.trim()).map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                    {(formData.conclusiones_recomendaciones || []).filter(i => i.trim()).length === 0 && <li className="text-gray-400">Sin conclusiones registradas</li>}
                                </ul>
                            ) : (
                                <div className="space-y-1.5 bg-gray-50 p-4 rounded-xl">
                                    {(formData.conclusiones_recomendaciones || ['']).map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 group">
                                            <span className="text-[#E11B22] flex-shrink-0 mt-2">●</span>
                                            <textarea data-bullet="conclusiones_recomendaciones" rows={1} value={item} ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }} onChange={(e) => { updateBulletItem('conclusiones_recomendaciones', idx, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBulletKeyDown(e, 'conclusiones_recomendaciones', idx) } }} placeholder={idx === 0 ? 'Ej: Se recomienda ajustar...' : 'Enter para agregar otro...'} className="flex-1 text-sm py-1.5 px-2 border-0 border-b border-transparent focus:border-gray-300 outline-none bg-transparent transition-colors placeholder:text-gray-300 resize-none overflow-hidden" />
                                            {formData.conclusiones_recomendaciones.length > 1 && (
                                                <button onClick={() => removeBulletItem('conclusiones_recomendaciones', idx)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={() => addBulletItem('conclusiones_recomendaciones', formData.conclusiones_recomendaciones.length - 1)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#003DA5] transition-colors mt-1 ml-5"><Plus className="w-3 h-3" /> Agregar ítem</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Próximos Pasos - Full Width */}
                    <div className="mt-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-[#003DA5] flex items-center justify-center rounded-lg flex-shrink-0">
                                <ArrowRight className="w-5 h-5 text-white" />
                            </div>
                            <h4 className="text-lg font-bold text-[#003DA5]">Próximos Pasos</h4>
                        </div>
                        {isSentOrPreview ? (
                            <ul className="space-y-3 text-gray-600 pl-2">
                                {(formData.proximos_pasos || ['']).filter(i => i.trim()).map((item, idx) => (
                                    <li key={idx} className="flex gap-3"><span className="text-[#E11B22] mt-0.5">●</span> {item}</li>
                                ))}
                                {(formData.proximos_pasos || []).filter(i => i.trim()).length === 0 && <li className="text-gray-400 italic">Sin próximos pasos registrados</li>}
                            </ul>
                        ) : (
                            <div className="space-y-1.5">
                                {(formData.proximos_pasos || ['']).map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2 group">
                                        <span className="text-[#E11B22] flex-shrink-0 mt-2">●</span>
                                        <textarea data-bullet="proximos_pasos" rows={1} value={item} ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }} onChange={(e) => { updateBulletItem('proximos_pasos', idx, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBulletKeyDown(e, 'proximos_pasos', idx) } }} placeholder={idx === 0 ? 'Ej: Coordinar reunión...' : 'Enter para agregar otro...'} className="flex-1 text-sm py-1.5 px-2 border-0 border-b border-transparent focus:border-gray-300 outline-none bg-transparent transition-colors placeholder:text-gray-300 resize-none overflow-hidden" />
                                        {formData.proximos_pasos.length > 1 && (
                                            <button onClick={() => removeBulletItem('proximos_pasos', idx)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => addBulletItem('proximos_pasos', formData.proximos_pasos.length - 1)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#003DA5] transition-colors mt-1 ml-5"><Plus className="w-3 h-3" /> Agregar ítem</button>
                            </div>
                        )}
                    </div>
                </section>

                {/* === SECTION 6: ANEXOS === */}
                {/* Hide entire section in preview/sent mode if no anexos */}
                {(formData.anexos.length > 0 || !isSentOrPreview) && (
                    <section data-pdf-section="anexos" className="px-12 py-12 border-b border-gray-100" style={{ pageBreakBefore: isPreview ? 'always' : 'auto' }}>
                        <div className="mb-6">
                            <span className="text-[#E11B22] font-bold uppercase tracking-[0.3em] text-xs mb-2 block">Documentación</span>
                            <h2 className="text-2xl font-bold text-[#003DA5] uppercase">Anexos</h2>
                        </div>

                        {/* Image anexos with title + description */}
                        {formData.anexos.filter(a => a.isImage).map((anexo, idx) => {
                            const globalIdx = formData.anexos.indexOf(anexo)
                            return (
                                <div key={globalIdx} className="mb-8 relative group anexo-block">
                                    {isSentOrPreview ? (
                                        <>
                                            {anexo.title && <h4 className="text-lg font-bold text-[#003DA5] mb-1">{anexo.title}</h4>}
                                            {anexo.description && <p className="text-sm text-gray-600 mb-3 leading-relaxed">{anexo.description}</p>}
                                        </>
                                    ) : (
                                        <div className="mb-3 space-y-2">
                                            <input
                                                type="text"
                                                value={anexo.title || ''}
                                                onChange={(e) => {
                                                    const updated = [...formData.anexos]
                                                    updated[globalIdx] = { ...updated[globalIdx], title: e.target.value }
                                                    setFormData(prev => ({ ...prev, anexos: updated }))
                                                }}
                                                placeholder="Título del anexo (opcional)"
                                                className="w-full text-lg font-bold text-[#003DA5] bg-transparent border-0 border-b border-gray-200 focus:border-[#003DA5] outline-none py-1 placeholder:text-gray-300 placeholder:font-normal"
                                            />
                                            <textarea
                                                value={anexo.description || ''}
                                                onChange={(e) => {
                                                    const updated = [...formData.anexos]
                                                    updated[globalIdx] = { ...updated[globalIdx], description: e.target.value }
                                                    setFormData(prev => ({ ...prev, anexos: updated }))
                                                }}
                                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                                                rows={1}
                                                placeholder="Descripción breve (opcional)"
                                                className="w-full text-sm text-gray-600 bg-transparent border-0 border-b border-gray-200 focus:border-gray-400 outline-none py-1 resize-none overflow-hidden placeholder:text-gray-300"
                                            />
                                        </div>
                                    )}
                                    <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                                        <img src={anexo.url} alt={anexo.title || anexo.name} className="w-full max-h-[500px] object-contain bg-gray-50" />
                                    </div>
                                    {!isSentOrPreview && (
                                        <button onClick={() => removeAnexo(globalIdx)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )
                        })}

                        {/* Document anexos */}
                        {formData.anexos.filter(a => !a.isImage).length > 0 && (
                            <div className="space-y-2 mb-6">
                                {formData.anexos.filter(a => !a.isImage).map((anexo, idx) => {
                                    const globalIdx = formData.anexos.indexOf(anexo)
                                    return (
                                        <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-5 py-3 group border border-gray-100">
                                            <File className="w-5 h-5 text-[#003DA5] flex-shrink-0" />
                                            <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#003DA5] hover:underline truncate flex-1 font-medium">{anexo.name}</a>
                                            <span className="text-xs text-gray-400 uppercase font-semibold">{anexo.type}</span>
                                            {!isSentOrPreview && (
                                                <button onClick={() => removeAnexo(globalIdx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Upload */}
                        {!isSentOrPreview && (
                            <button onClick={() => anexoInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-[#003DA5] hover:text-[#003DA5] transition-colors">
                                <Upload className="w-7 h-7" />
                                <span className="text-sm font-medium">Subir anexo</span>
                                <span className="text-xs">Imágenes o documentos (PDF, Excel)</span>
                            </button>
                        )}
                        <input ref={anexoInputRef} type="file" accept="image/*,.pdf,.xlsx,.xls,.doc,.docx" className="hidden" onChange={(e) => handleAnexoUpload(e.target.files?.[0])} />
                    </section>
                )}

                {/* === FOOTER === */}
                <footer className="px-8 py-6 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="text-xs text-gray-500">
                        <p>© {new Date().getFullYear()} RE/MAX Exclusive</p>
                        <p className="mt-0.5">{agentName}</p>
                    </div>
                    <img src={logoBase64 || '/primerolog.png'} alt="RE/MAX" className="h-10 object-contain" />
                </footer>
            </div>
        )
    }

    // -- Property Photo Picker Modal --
    const PhotoPickerModal = () => {
        if (!showPhotoPicker) return null

        const selectPhoto = (photo) => {
            setPropertyImages(prev => ({ ...prev, [showPhotoPicker]: photo.url }))
            setShowPhotoPicker(null)
        }

        const currentUrl = propertyImages[showPhotoPicker]
        const slotLabel = showPhotoPicker === 'exterior' ? 'Foto Exterior' : 'Foto Interior'

        return (
            <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPhotoPicker(null)}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <div>
                            <h3 className="font-bold text-gray-900">Seleccionar {slotLabel}</h3>
                            <p className="text-xs text-gray-500">Elige una foto de la propiedad</p>
                        </div>
                        <button onClick={() => setShowPhotoPicker(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Photo grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-3 gap-3">
                            {propertyPhotos.map(photo => {
                                const isSelected = photo.url === currentUrl
                                return (
                                    <div
                                        key={photo.id}
                                        onClick={() => selectPhoto(photo)}
                                        className={`relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${isSelected
                                            ? 'border-blue-500 ring-2 ring-blue-200'
                                            : 'border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        <img src={photo.url} alt={photo.caption || 'Foto'} className="w-full h-full object-cover" />
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                                <div className="bg-blue-500 text-white rounded-full p-1.5">
                                                    <Check className="w-5 h-5" />
                                                </div>
                                            </div>
                                        )}
                                        {photo.caption && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                                                <p className="text-white text-[10px] truncate">{photo.caption}</p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ─── Shared PDF Builder (used by both Download and Send) ──────────────────
    // Uses Gotenberg (Chromium-based) for vectorial PDFs with real text (~3-8 MB)
    const buildPdfFromReport = async () => {
        // Capture chart image if not already set
        if (!chartImage && chartCanvasRef.current) {
            try { setPreviewChartImage(chartCanvasRef.current.toDataURL('image/png')) } catch (e) { }
        }
        await new Promise(resolve => setTimeout(resolve, 200))

        const reportEl = document.getElementById('pdf-offscreen-content')
        if (!reportEl) return null

        const footerAgentName = `${report?.agent?.first_name || profile?.first_name || ''} ${report?.agent?.last_name || profile?.last_name || ''}`.trim()
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(el => el.outerHTML).join('\n')
        let reportHtml = reportEl.innerHTML
        // Convert relative paths to absolute
        reportHtml = reportHtml.replace(/src="\/([^"]+)"/g, `src="${window.location.origin}/$1"`)

        // Convert all external images to inline base64 for Gotenberg
        const imgRegex = /src="(https?:\/\/[^"]+)"/g
        const imageUrls = [...new Set([...reportHtml.matchAll(imgRegex)].map(m => m[1]))]
        for (const url of imageUrls) {
            try {
                const resp = await fetch(url)
                if (!resp.ok) continue
                const blob = await resp.blob()
                const b64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result)
                    reader.onerror = reject
                    reader.readAsDataURL(blob)
                })
                reportHtml = reportHtml.split(url).join(b64)
            } catch (e) {
                console.warn('Could not inline image:', url, e)
            }
        }

        // If we have a preloaded logo base64, replace any remaining logo references
        if (logoBase64) {
            reportHtml = reportHtml.replace(/src="[^"]*primerolog\.png[^"]*"/g, `src="${logoBase64}"`)
        }

        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte</title>${styles}
            <style>
                @page {
                    size: A4;
                    margin: 0;
                }
                body {
                    margin: 0;
                    padding: 0;
                    width: 794px;
                    background: white;
                    font-family: 'Public Sans', 'Inter', ui-sans-serif, system-ui, sans-serif;
                }
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                footer { display: none !important; }
                section { border-bottom: none !important; }
                /* Cover page: pull up past Gotenberg top margin for full-bleed */
                section[data-pdf-section="cover-intro"] {
                    margin-top: -0.35in;
                }
                /* Fixed footer on every printed page */
                .pdf-page-footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 42px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 32px;
                    border-top: 1px solid #e5e7eb;
                    background: #f9fafb;
                    font-family: 'Public Sans', 'Inter', sans-serif;
                    z-index: 9999;
                }
                .pdf-page-footer .footer-text {
                    font-size: 9px;
                    color: #6b7280;
                }
                .pdf-page-footer .footer-text p {
                    margin: 0;
                }
                .pdf-page-footer img {
                    height: 36px;
                    object-fit: contain;
                }
            </style></head><body>
            <div class="pdf-page-footer">
                <div class="footer-text">
                    <p>© ${new Date().getFullYear()} RE/MAX Exclusive</p>
                    <p>${footerAgentName}</p>
                </div>
                <img src="${logoBase64 || (window.location.origin + '/primerolog.png')}" alt="RE/MAX" />
            </div>
            ${reportHtml}
        </body></html>`

        // Send HTML to Gotenberg for PDF generation
        const formData = new FormData()
        const htmlBlob = new Blob([fullHtml], { type: 'text/html' })
        formData.append('files', htmlBlob, 'index.html')
        // Gotenberg Chromium options
        formData.append('paperWidth', '8.27')   // A4 width in inches
        formData.append('paperHeight', '11.7')   // A4 height in inches
        formData.append('marginTop', '0.35')     // ~9mm top margin for breathing room
        formData.append('marginBottom', '0.45')  // Space for the fixed footer (42px ≈ 0.44in)
        formData.append('marginLeft', '0')
        formData.append('marginRight', '0')
        formData.append('printBackground', 'true')
        formData.append('preferCssPageSize', 'false')
        formData.append('waitDelay', '2s')  // Wait for images/fonts to load

        const response = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            const errText = await response.text()
            throw new Error(`Gotenberg PDF generation failed: ${response.status} ${errText}`)
        }

        const pdfBlob = await response.blob()
        console.log(`PDF generated via Gotenberg: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`)

        // Convert to base64 for email attachment
        const pdfBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result.split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(pdfBlob)
        })

        const blobUrl = URL.createObjectURL(pdfBlob)
        return { base64: pdfBase64, blobUrl }
    }

    // -- Direct PDF Download (uses shared builder) --
    const handleDownloadPdf = async () => {
        toast.loading('Generando PDF...', { id: 'pdf-download' })
        try {
            const result = await buildPdfFromReport()
            if (!result) {
                toast.error('No se pudo generar el PDF', { id: 'pdf-download' })
                return
            }
            const propertyAddr = report.properties?.address || ''
            const filename = `Informe_Gestion_${report.report_number}_${propertyAddr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
            // Download via blob URL
            const a = document.createElement('a')
            a.href = result.blobUrl
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            toast.success('PDF descargado', { id: 'pdf-download' })
        } catch (err) {
            console.error('Error generating PDF:', err)
            toast.error('Error al generar el PDF', { id: 'pdf-download' })
        }
    }

    return (
        <div className="space-y-6">
            {/* Read-only banner for admin roles */}
            {isReadOnly && (
                <div className="max-w-4xl mx-auto rounded-xl p-4 flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-slate-900">Vista de solo lectura</p>
                        <p className="text-xs text-slate-500">Solo el agente responsable puede editar y enviar este informe.</p>
                    </div>
                </div>
            )}

            {/* Waiting for publication banner */}
            {isWaiting && !isReadOnly && (
                <div className="max-w-4xl mx-auto rounded-xl p-4 flex items-center gap-3 bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 shadow-sm">
                    <div className="p-2 bg-slate-100 rounded-lg">
                        <Clock className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-slate-900">⏳ Esperando Publicación</p>
                        <p className="text-xs text-slate-500">Este informe se activará automáticamente cuando la propiedad cambie a estado "Publicada". El plazo de 15 días comenzará a contar desde ese momento.</p>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => navigate('/informes-gestion')} className="gap-2 text-slate-500">
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Informe de Gestión #{report.report_number}</h1>
                        <p className="text-xs text-slate-500">{propertyAddress}{propertyCommune ? ` · ${propertyCommune}` : ''} — {ownerFirstName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2">
                        <Download className="w-4 h-4" />
                        Descargar PDF
                    </Button>
                    {!isReadOnly && !isSent && !isWaiting && (
                        <>
                            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar
                            </Button>
                            <Button size="sm" onClick={() => openSendPreview(false)} disabled={sending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Enviar al Propietario
                            </Button>
                        </>
                    )}
                    {!isReadOnly && isWaiting && (
                        <div className="flex items-center gap-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                            ⏳ Esperando publicación
                        </div>
                    )}
                    {!isReadOnly && isSent && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                                ✅ Enviado el {new Date(report.sent_at).toLocaleDateString('es-CL')}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => openSendPreview(true)} disabled={sending} className="gap-2">
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Re-enviar
                            </Button>
                        </div>
                    )}
                    {isReadOnly && isSent && (
                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                            ✅ Enviado el {new Date(report.sent_at).toLocaleDateString('es-CL')}
                        </div>
                    )}
                </div>
            </div>

            {/* Report Content */}
            <div className="shadow-xl rounded-2xl overflow-hidden border border-gray-200">
                {ReportContent({})}
            </div>

            {/* Bottom Action Bar */}
            {isReadOnly ? (
                <div className="max-w-4xl mx-auto flex justify-end gap-3 pb-8">
                    <Button variant="outline" onClick={handleDownloadPdf} className="gap-2">
                        <Download className="w-4 h-4" />
                        Descargar PDF
                    </Button>
                </div>
            ) : isWaiting ? (
                <div className="max-w-4xl mx-auto flex justify-end gap-3 pb-8">
                    <Button variant="outline" onClick={handleDownloadPdf} className="gap-2">
                        <Download className="w-4 h-4" />
                        Descargar PDF
                    </Button>
                    <div className="flex items-center gap-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                        ⏳ Esperando publicación para habilitar envío
                    </div>
                </div>
            ) : !isSent ? (
                <div className="max-w-4xl mx-auto flex justify-end gap-3 pb-8">
                    <Button variant="outline" onClick={handleDownloadPdf} className="gap-2">
                        <Download className="w-4 h-4" />
                        Descargar PDF
                    </Button>
                    <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2 px-6">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Borrador
                    </Button>
                    <Button onClick={() => openSendPreview(false)} disabled={sending} className="gap-2 px-6 bg-blue-600 hover:bg-blue-700 text-white">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar al Propietario
                    </Button>
                </div>
            ) : (
                <div className="max-w-4xl mx-auto flex justify-end gap-3 pb-8">
                    <Button variant="outline" onClick={handleDownloadPdf} className="gap-2">
                        <Download className="w-4 h-4" />
                        Descargar PDF
                    </Button>
                    <Button variant="outline" onClick={() => openSendPreview(true)} disabled={sending} className="gap-2 px-6">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Re-enviar al Propietario
                    </Button>
                </div>
            )}
            <PhotoPickerModal />
            {/* Send Preview Modal */}
            {showSendPreview && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex" onClick={() => !sending && setShowSendPreview(false)}>
                    <div className="flex w-full h-full" onClick={(e) => e.stopPropagation()}>
                        {/* Left: PDF Preview */}
                        <div className="flex-1 bg-gray-100 flex flex-col min-w-0">
                            <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
                                <FileText className="w-5 h-5 text-[#003DA5]" />
                                <h3 className="font-bold text-gray-900">Vista previa del PDF</h3>
                            </div>
                            <div className="flex-1 overflow-auto p-4">
                                <iframe
                                    srcDoc={sendPreviewHtml}
                                    className="w-full h-full bg-white shadow-xl border border-gray-200 rounded-lg"
                                    style={{ minHeight: '100%' }}
                                    title="PDF Preview"
                                />
                            </div>
                        </div>

                        {/* Right: Email Composer */}
                        <div className="w-[420px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gradient-to-r from-[#003DA5] to-[#002d7a]">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-white" />
                                    <h3 className="font-bold text-white">{isResendMode ? 'Re-enviar Informe' : 'Enviar Informe'}</h3>
                                </div>
                                <button onClick={() => !sending && setShowSendPreview(false)} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                {/* To */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Para</label>
                                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        <span className="text-sm text-gray-700 font-medium">{emailDraft.to}</span>
                                    </div>
                                </div>

                                {/* Subject */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Asunto</label>
                                    <Input
                                        value={emailDraft.subject}
                                        onChange={(e) => setEmailDraft(prev => ({ ...prev, subject: e.target.value }))}
                                        className="text-sm font-medium"
                                    />
                                </div>

                                {/* Body */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Cuerpo del correo</label>
                                    <Textarea
                                        value={emailDraft.body}
                                        onChange={(e) => setEmailDraft(prev => ({ ...prev, body: e.target.value }))}
                                        rows={10}
                                        className="text-sm leading-relaxed resize-none"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1.5">La firma del agente se agrega automáticamente</p>
                                </div>

                                {/* Attachments */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Archivos adjuntos</label>
                                    <div className="space-y-2">
                                        <div
                                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors cursor-pointer ${preGeneratedPdf.generating ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100 hover:bg-red-100'}`}
                                            onClick={async () => {
                                                if (preGeneratedPdf.generating) return
                                                if (preGeneratedPdf.blobUrl) {
                                                    window.open(preGeneratedPdf.blobUrl, '_blank')
                                                } else {
                                                    // Generate PDF on-demand and open in new tab
                                                    try {
                                                        setPreGeneratedPdf(prev => ({ ...prev, generating: true }))
                                                        const result = await buildPdfFromReport()
                                                        if (result) {
                                                            const pdfFilename = preGeneratedPdf.filename || `Informe_Gestion_${report.report_number}.pdf`
                                                            setPreGeneratedPdf({ blobUrl: result.blobUrl, base64: result.base64, filename: pdfFilename, generating: false })
                                                            window.open(result.blobUrl, '_blank')
                                                        } else {
                                                            setPreGeneratedPdf(prev => ({ ...prev, generating: false }))
                                                            toast.error('No se pudo generar el PDF')
                                                        }
                                                    } catch (err) {
                                                        console.error('Error generating PDF on click:', err)
                                                        setPreGeneratedPdf(prev => ({ ...prev, generating: false }))
                                                        toast.error('Error al generar el PDF')
                                                    }
                                                }
                                            }}
                                            title={preGeneratedPdf.generating ? 'Generando PDF...' : 'Click para abrir el PDF en otra pestaña'}
                                        >
                                            {preGeneratedPdf.generating ? (
                                                <Loader2 className="w-4 h-4 text-orange-500 animate-spin flex-shrink-0" />
                                            ) : (
                                                <File className="w-4 h-4 text-red-500 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{preGeneratedPdf.filename || `Informe_Gestion_${report.report_number}.pdf`}</p>
                                                <p className="text-[11px] text-gray-400">
                                                    {preGeneratedPdf.generating ? 'Generando PDF...' : 'Click para abrir el PDF'}
                                                </p>
                                            </div>
                                            {preGeneratedPdf.generating ? (
                                                <Paperclip className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                                            ) : (
                                                <Eye className="w-4 h-4 text-red-400 flex-shrink-0" />
                                            )}
                                        </div>
                                        {formData.anexos.filter(a => !a.isImage).map((anexo, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                                                <File className="w-4 h-4 text-[#003DA5] flex-shrink-0" />
                                                <p className="text-sm text-gray-700 truncate flex-1">{anexo.name}</p>
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold flex-shrink-0">{anexo.type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer buttons */}
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowSendPreview(false)}
                                    disabled={sending}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={confirmSend}
                                    disabled={sending || preGeneratedPdf.generating}
                                    className="flex-1 gap-2 bg-[#003DA5] hover:bg-[#002d7a] text-white"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : preGeneratedPdf.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {sending ? 'Enviando...' : preGeneratedPdf.generating ? 'Preparando PDF...' : (isResendMode ? 'Re-enviar' : 'Enviar')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                , document.body)}
            {/* Hidden offscreen container for PDF rendering */}
            <div id="pdf-offscreen-content" style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm' }}>
                {ReportContent({ isPreview: true })}
            </div>
        </div>
    )
}
