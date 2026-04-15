import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, getCustomPublicUrl } from '../services/supabase'
import {
    getInspection, createInspection, saveInspection, submitInspection,
    uploadInspectionPhoto, uploadSignature, getDefaultFormData, markInspectionSent
} from '../services/inspectionService'
import {
    isNewFormat, convertLegacyFormData, getAddableAreas, createSection,
    renumberSections, getCategoryLabel, getFormDataForPropertyType
} from '../config/inspectionFormTemplates'
import { logActivity } from '../services/activityService'
import { LOGO_BASE64 } from '../services/logo'
import ContactPickerInline from '../components/ui/ContactPickerInline'
import SignaturePad from 'signature_pad'
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import {
    ArrowLeft, Save, Send, Camera, Trash2, Plus, CheckCircle2,
    Loader2, User, Home, ChefHat, Sofa, UtensilsCrossed, BedDouble,
    Bath, FileText, PenTool, Mail, X, Eye, Paperclip, File as FileIcon,
    ChevronDown, Trees, Sun, Waves, Shirt, Warehouse, Car, DoorOpen,
    Monitor, Coffee, Users, Briefcase, Truck, Factory, ClipboardList,
    Fence, Pencil, ImagePlus, FolderOpen, Download
} from 'lucide-react'

const LOGO_SRC = LOGO_BASE64 ? `data:image/png;base64,${LOGO_BASE64}` : '/primerolog.png'

const ESTADO_OPTIONS = [
    { value: '', label: 'Seleccionar' },
    { value: 'Bueno', label: 'Bueno' },
    { value: 'Regular', label: 'Regular' },
    { value: 'Malo', label: 'Malo' },
    { value: 'N/A', label: 'N/A' },
]

const DECLARACION_TEXT = `Este informe corresponde a una inspección visual y presencial realizada por el agente en la fecha indicada. Su alcance se limita a las condiciones observables en ese momento y a la información que fue posible recabar durante la visita.

El presente documento no constituye una inspección técnica especializada, ni reemplaza evaluaciones de carácter estructural, eléctrico, sanitario u otras revisiones profesionales. Las observaciones, conclusiones y recomendaciones aquí contenidas reflejan únicamente lo constatado en la fecha de la inspección y pueden variar con el uso posterior de la propiedad. El registro fotográfico incluido es referencial y no sustituye una revisión técnica ni exhaustiva de los elementos de la propiedad. Este informe es de carácter informativo y no implica la validación, liberación o levantamiento de obligaciones o garantías más allá de lo estipulado en el contrato de arrendamiento vigente. Finalmente, el informe está destinado al uso exclusivo del propietario y no debe ser distribuido ni compartido con terceros sin autorización expresa del agente responsable.`

export default function InspectionFormPage() {
    const { inspectionId } = useParams()
    const navigate = useNavigate()
    const { user, profile } = useAuth()

    const [inspection, setInspection] = useState(null)
    const [formData, setFormData] = useState(getDefaultFormData())
    const [photos, setPhotos] = useState([])
    const [signatureUrl, setSignatureUrl] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [sending, setSending] = useState(false)
    const [observations, setObservations] = useState('')
    const [showAddAreaMenu, setShowAddAreaMenu] = useState(false)
    const [recommendations, setRecommendations] = useState('')
    const [showSendPreview, setShowSendPreview] = useState(false)
    const [sendPreviewHtml, setSendPreviewHtml] = useState('')
    const [emailDraft, setEmailDraft] = useState({ to: '', subject: '', body: '' })
    const [preGeneratedPdf, setPreGeneratedPdf] = useState({ blobUrl: null, base64: null, filename: '', generating: false })

    const signatureCanvasRef = useRef(null)
    const signaturePadRef = useRef(null)
    const photoInputRef = useRef(null)
    const cameraInputRef = useRef(null)
    const saveTimeoutRef = useRef(null)
    const formContainerRef = useRef(null)

    // Load inspection data
    useEffect(() => {
        if (!inspectionId || !user) return
        loadInspection()
    }, [inspectionId, user])

    // Initialize signature pad
    useEffect(() => {
        if (signatureCanvasRef.current && !signaturePadRef.current) {
            const canvas = signatureCanvasRef.current
            canvas.width = canvas.offsetWidth * 2
            canvas.height = canvas.offsetHeight * 2
            const ctx = canvas.getContext('2d')
            ctx.scale(2, 2)

            signaturePadRef.current = new SignaturePad(canvas, {
                backgroundColor: 'rgb(255, 255, 255)',
                penColor: 'rgb(0, 0, 0)',
                minWidth: 0.5,
                maxWidth: 2.5,
            })
        }
    }, [loading])

    const loadInspection = async () => {
        try {
            setLoading(true)
            const data = await getInspection(inspectionId)
            setInspection(data)

            // Always compute property-derived fields from the DB relation
            const agentName = data.agent
                ? `${data.agent.first_name || ''} ${data.agent.last_name || ''}`.trim()
                : `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()

            let propertyAddress = ''
            if (data.property) {
                // Raw address format: "number, street, neighborhood, commune, province, region, zip, country"
                // Extract street + number from first 2 parts, then append commune
                const parts = (data.property.address || '').split(',').map(s => s.trim())
                const streetParts = parts.slice(0, 2) // e.g. ["733", "San Martín"]
                const streetNum = streetParts.length >= 2
                    ? `${streetParts[1]} ${streetParts[0]}` // "San Martín 733"
                    : streetParts.join(' ')
                const unit = data.property.unit_number ? ` Depto ${data.property.unit_number}` : ''
                propertyAddress = [streetNum + unit, data.property.commune].filter(Boolean).join(', ')
            } else {
                propertyAddress = data.address || ''
            }

            // Build propietarios array from DB relation (fallback to legacy fields)
            let defaultPropietarios = []
            if (data.property?.owner) {
                const nombre = `${data.property.owner.first_name || ''} ${data.property.owner.last_name || ''}`.trim()
                if (nombre) defaultPropietarios.push({ nombre, email: data.property.owner.email || '' })
            } else if (data.owner_name) {
                defaultPropietarios.push({ nombre: data.owner_name, email: '' })
            }

            let defaultArrendatarios = []
            if (data.tenant_name) {
                defaultArrendatarios.push({ nombre: data.tenant_name, email: '' })
            }

            const autoFields = {
                agente_nombre: agentName,
                fecha_inspeccion: data.inspection_date || new Date().toISOString().split('T')[0],
                direccion: propertyAddress,
                owner_email: data.property?.owner?.email || '',
            }

            if (data.form_data && Object.keys(data.form_data).length > 0) {
                // Convert legacy format if needed
                let saved = isNewFormat(data.form_data)
                    ? data.form_data
                    : convertLegacyFormData(data.form_data)

                // Merge auto-fields
                Object.entries(autoFields).forEach(([key, val]) => {
                    if (!saved[key] && val) saved[key] = val
                })

                // ── Migrate legacy propietario (string) → propietarios (array) ──
                if (!Array.isArray(saved.propietarios)) {
                    if (saved.propietario) {
                        saved.propietarios = [{ nombre: saved.propietario, email: saved.owner_email || '' }]
                    } else if (defaultPropietarios.length > 0) {
                        saved.propietarios = defaultPropietarios
                    } else {
                        saved.propietarios = []
                    }
                }
                if (saved.propietarios.length === 0 && defaultPropietarios.length > 0) {
                    saved.propietarios = defaultPropietarios
                }

                // ── Migrate legacy arrendatario (string) → arrendatarios (array) ──
                if (!Array.isArray(saved.arrendatarios)) {
                    if (saved.arrendatario) {
                        saved.arrendatarios = [{ nombre: saved.arrendatario, email: '' }]
                    } else if (defaultArrendatarios.length > 0) {
                        saved.arrendatarios = defaultArrendatarios
                    } else {
                        saved.arrendatarios = []
                    }
                }
                if (saved.arrendatarios.length === 0 && defaultArrendatarios.length > 0) {
                    saved.arrendatarios = defaultArrendatarios
                }

                // Keep owner_email in sync with first propietario
                if (!saved.owner_email && saved.propietarios.length > 0 && saved.propietarios[0].email) {
                    saved.owner_email = saved.propietarios[0].email
                }

                setFormData(saved)
            } else {
                setFormData(prev => ({
                    ...prev,
                    ...autoFields,
                    propietarios: defaultPropietarios,
                    arrendatarios: defaultArrendatarios,
                    owner_email: defaultPropietarios[0]?.email || '',
                }))
            }

            setPhotos(data.photos || [])
            setSignatureUrl(data.signature_url || null)
            setObservations(data.observations || '')
            setRecommendations(data.recommendations || '')
        } catch (err) {
            console.error('Error loading inspection:', err)
            toast.error('Error cargando la inspección')
        } finally {
            setLoading(false)
        }
    }

    // Auto-save with debounce
    const triggerAutoSave = useCallback(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(async () => {
            if (!inspection || inspection.status === 'sent') return
            try {
                await saveInspection(inspectionId, {
                    form_data: formData,
                    photos,
                    observations,
                    recommendations,
                })
            } catch (err) {
                console.error('Auto-save error:', err)
            }
        }, 2000)
    }, [inspectionId, formData, photos, observations, recommendations, inspection])

    useEffect(() => {
        if (!loading && inspection) triggerAutoSave()
        return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
    }, [formData, photos, observations, recommendations])

    // ─── Section handlers (new dynamic format) ────────────
    const updateSectionItem = (sectionIdx, itemIdx, field, value) => {
        setFormData(prev => {
            const updated = { ...prev }
            const sections = [...(updated.sections || [])]
            const section = { ...sections[sectionIdx] }
            const items = [...section.items]
            items[itemIdx] = { ...items[itemIdx], [field]: value }
            section.items = items
            sections[sectionIdx] = section
            updated.sections = sections
            return updated
        })
    }

    const addArea = (sectionKey) => {
        setFormData(prev => {
            const updated = { ...prev }
            const sections = [...(updated.sections || [])]
            const newSection = createSection(sectionKey, sections)
            if (!newSection) return prev
            sections.push(newSection)
            updated.sections = renumberSections(sections)
            return updated
        })
        setShowAddAreaMenu(false)
    }

    const removeSection = (sectionIdx) => {
        setFormData(prev => {
            const updated = { ...prev }
            const sections = [...(updated.sections || [])]
            sections.splice(sectionIdx, 1)
            updated.sections = renumberSections(sections)
            return updated
        })
    }

    // Photo upload
    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        for (const file of files) {
            try {
                toast.loading(`Subiendo ${file.name}...`, { id: `upload-${file.name}` })
                const result = await uploadInspectionPhoto(file, inspectionId, 'registro_fotografico')
                setPhotos(prev => [...prev, result])
                toast.success(`${file.name} subida`, { id: `upload-${file.name}` })
            } catch (err) {
                console.error('Photo upload error:', err)
                const msg = err.message?.includes('sesión') || err.message?.includes('expired') || err.message?.includes('token')
                    ? 'Tu sesión expiró. Recarga la página para continuar.'
                    : `Error subiendo ${file.name}`
                toast.error(msg, { id: `upload-${file.name}`, duration: 6000 })
            }
        }
        e.target.value = ''
    }

    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index))
    }

    // Signature
    const clearSignature = () => {
        if (signaturePadRef.current) {
            signaturePadRef.current.clear()
        }
        setSignatureUrl(null)
    }

    // Manual save
    const handleManualSave = async () => {
        setSaving(true)
        try {
            // Save signature if drawn
            let sigUrl = signatureUrl
            if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
                const base64 = signaturePadRef.current.toDataURL('image/png')
                sigUrl = await uploadSignature(base64, inspectionId)
                setSignatureUrl(sigUrl)
            }

            await saveInspection(inspectionId, {
                form_data: formData,
                photos,
                signature_url: sigUrl,
                observations,
                recommendations,
            })
            toast.success('Inspección guardada')
        } catch (err) {
            console.error('Save error:', err)
            toast.error('Error guardando la inspección')
        } finally {
            setSaving(false)
        }
    }

    const handleDownloadPdf = async () => {
        try {
            let blob = preGeneratedPdf.blob
            let filename = preGeneratedPdf.filename || `Inspeccion_${formData.direccion || 'Sin_Direccion'}.pdf`

            if (!blob) {
                toast.loading('Generando PDF para descarga...', { id: 'pdf-download' })
                const result = await buildInspectionPdf()
                blob = result.blob
                filename = result.filename || filename
                setPreGeneratedPdf(p => ({ ...p, ...result }))
                toast.dismiss('pdf-download')
            }

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            toast.success('Descarga iniciada')
        } catch (err) {
            console.error('Error downloading PDF:', err)
            toast.error('Error al generar el PDF para descarga')
            toast.dismiss('pdf-download')
        }
    }

    // ─── Enviar a Revisión (Agent) ───
    const handleSendForReview = async () => {
        setSubmitting(true)
        try {
            // Save signature if drawn
            let sigUrl = signatureUrl
            if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
                const base64 = signaturePadRef.current.toDataURL('image/png')
                sigUrl = await uploadSignature(base64, inspectionId)
                setSignatureUrl(sigUrl)
            }

            await saveInspection(inspectionId, {
                form_data: formData,
                photos,
                signature_url: sigUrl,
                observations,
                recommendations,
            })
            
            // submitInspection marks it as 'completed', which shows as 'En Revisión' in Dashboard
            await submitInspection(inspectionId)
            toast.success('Inspección enviada a revisión')
            navigate('/inspecciones')
        } catch (err) {
            console.error('Submit error:', err)
            toast.error('Error enviando la inspección a revisión')
        } finally {
            setSubmitting(false)
        }
    }

    // ─── Open Send Preview Modal ───
    const openSendPreview = async () => {
        // Check Gmail account
        const { data: gmailAccount, error: gmailError } = await supabase
            .from('gmail_accounts')
            .select('id')
            .eq('agent_id', profile?.id || inspection?.agent_id)
            .single()
        if (gmailError || !gmailAccount) {
            toast.error('Debes conectar tu cuenta de correo en la sección "Casilla" antes de enviar informes.', { duration: 6000 })
            return
        }

        // Check owner email — use formData.owner_email (editable) or fall back to property relation
        // Check owner email — use first propietario's email or fallback
        const ownerEmail = (formData.propietarios?.[0]?.email) || formData.owner_email || inspection?.property?.owner?.email
        if (!ownerEmail) {
            toast.error('El propietario no tiene un correo electrónico registrado. Ingresa el email en la sección "Datos de la Propiedad".')
            return
        }

        // Save current data first
        await saveInspection(inspectionId, {
            form_data: formData,
            photos,
            observations,
            recommendations,
        })

        // Build preview HTML
        // Pre-fill email — use first propietario name
        const firstOwnerName = formData.propietarios?.[0]?.nombre || `${inspection?.property?.owner?.first_name || ''}`.trim()
        const propertyAddr = formData.direccion || ''
        const defaultBody = `Estimado/a ${firstOwnerName || 'Propietario/a'},\n\nJunto con saludar, adjunto el informe de inspección correspondiente a su propiedad ubicada en ${propertyAddr}.\n\nEn el archivo adjunto encontrará el detalle completo de la inspección realizada, incluyendo el estado de cada área, observaciones relevantes, registro fotográfico y recomendaciones.\n\nQuedo atento/a a cualquier comentario o consulta.\n\nSaludos cordiales,`

        setEmailDraft({
            to: ownerEmail,
            subject: `Informe de Inspección - ${propertyAddr}`,
            body: defaultBody,
        })

        // Open modal with loading state, then generate PDF
        const pdfFilename = `Informe_Inspeccion_${propertyAddr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        setPreGeneratedPdf({ blobUrl: null, base64: null, filename: pdfFilename, generating: true })
        setSendPreviewHtml('') // Clear old HTML preview
        setShowSendPreview(true)

        // Generate PDF and show it in the preview
        setTimeout(async () => {
            try {
                const result = await buildInspectionPdf()
                if (result) {
                    setPreGeneratedPdf({ blobUrl: result.blobUrl, base64: result.base64, filename: pdfFilename, generating: false })
                } else {
                    setPreGeneratedPdf(prev => ({ ...prev, generating: false }))
                }
            } catch (err) {
                console.error('Error pre-generating PDF:', err)
                setPreGeneratedPdf(prev => ({ ...prev, generating: false }))
            }
        }, 300)
    }

    // ─── Confirm Send from Preview Modal ───
    const confirmSend = async () => {
        setSending(true)
        try {
            const agentName = formData.agente_nombre || ''
            const agentEmail = inspection?.agent?.email || profile?.email || ''

            // Build HTML email body
            const bodyLines = emailDraft.body.split('\n').filter(l => l.trim())
            const bodyHtml = `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
                    ${bodyLines.map(line => `<p style="font-size: 15px; line-height: 1.7; color: #4a4a4a; margin: 0 0 16px 0;">${line}</p>`).join('\n')}
                </div>
            `

            // Get PDF (pre-generated or generate now)
            const emailAttachments = []
            if (preGeneratedPdf.base64) {
                emailAttachments.push({ filename: preGeneratedPdf.filename, mimeType: 'application/pdf', data: preGeneratedPdf.base64 })
            } else {
                toast.loading('Generando PDF del informe...', { id: 'pdf-gen' })
                try {
                    const result = await buildInspectionPdf()
                    if (result) {
                        emailAttachments.push({ filename: preGeneratedPdf.filename || 'Informe_Inspeccion.pdf', mimeType: 'application/pdf', data: result.base64 })
                    }
                } catch (pdfErr) { console.warn('Could not generate PDF:', pdfErr) }
                toast.dismiss('pdf-gen')
            }

            // Send via Gmail
            const { data: sessionData } = await supabase.auth.getSession()
            const token = sessionData?.session?.access_token
            if (!token) throw new Error('No se encontró una sesión activa.')

            const { error: sendError } = await supabase.functions.invoke('gmail-send', {
                headers: { Authorization: `Bearer ${token}` },
                body: {
                    to: emailDraft.to,
                    cc: 'marinela.echenagucia@remax-exclusive.cl, josemiguel.raidi@remax-exclusive.cl',
                    subject: emailDraft.subject,
                    bodyHtml,
                    attachments: emailAttachments,
                }
            })
            if (sendError) throw new Error(sendError.message || 'Error al enviar el correo')

            // Upload PDF to storage
            const pdfPath = `${inspectionId}/informe_inspeccion_${Date.now()}.pdf`
            let pdfBlob
            if (preGeneratedPdf.base64) {
                const byteChars = atob(preGeneratedPdf.base64)
                const byteNumbers = new Array(byteChars.length)
                for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
                pdfBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
            } else {
                const result = await buildInspectionPdf()
                pdfBlob = result?.blob
            }

            if (pdfBlob) {
                const { error: uploadError } = await supabase.storage
                    .from('inspection-photos')
                    .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true })
                if (uploadError) console.warn('Error uploading PDF:', uploadError)
            }
            const pdfUrl = getCustomPublicUrl('inspection-photos', pdfPath)

            // Mark as completed/sent
            await submitInspection(inspectionId)
            await markInspectionSent(inspectionId, pdfUrl)

            // Delete photos from storage (they're embedded in the PDF)
            if (photos.length > 0) {
                const photoPaths = photos.map(p => p.path).filter(Boolean)
                if (photoPaths.length > 0) {
                    const { error: delError } = await supabase.storage
                        .from('inspection-photos')
                        .remove(photoPaths)
                    if (delError) console.warn('Error deleting photos:', delError)
                }
                await saveInspection(inspectionId, { photos: [] })
                setPhotos([])
            }

            toast.success('¡Informe de inspección enviado al propietario!')

            // Log to CRM timeline
            try {
                await logActivity({
                    action: 'Inspección Enviada',
                    entity_type: 'PropertyInspection',
                    entity_id: inspectionId,
                    description: `Informe de inspección enviado — ${formData.direccion || inspection?.address || ''}`,
                    details: { pdf_url: pdfUrl, address: formData.direccion, owner: formData.propietario_nombre },
                    property_id: inspection?.property_id || null,
                })
            } catch (logErr) { console.warn('Failed to log inspection activity:', logErr) }

            setShowSendPreview(false)
            navigate('/inspecciones')
        } catch (err) {
            console.error('Error sending inspection:', err)
            toast.error('Error al enviar la inspección: ' + (err.message || ''))
        } finally {
            setSending(false)
        }
    }
    // ─── PDF Builder (React-PDF) ───────────────────────────
    const buildInspectionPdf = async () => {
        // Polyfill Buffer for React-PDF (needs Node.js Buffer in browser)
        if (!window.Buffer) {
            const { Buffer } = await import('buffer')
            window.Buffer = Buffer
        }

        const { pdf } = await import('@react-pdf/renderer')
        const { default: InspectionPdfDocument } = await import('../components/InspectionPdfDocument')

        // Helper: convert any image blob to JPEG base64 via canvas (React-PDF only supports PNG/JPEG)
        const blobToJpegBase64 = (blob) => new Promise((resolve, reject) => {
            const img = new window.Image()
            img.onload = () => {
                const MAX_W = 1200
                let w = img.width, h = img.height
                if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W }
                const canvas = document.createElement('canvas')
                canvas.width = w; canvas.height = h
                canvas.getContext('2d').drawImage(img, 0, 0, w, h)
                resolve(canvas.toDataURL('image/jpeg', 0.85))
                URL.revokeObjectURL(img.src)
            }
            img.onerror = reject
            img.src = URL.createObjectURL(blob)
        })

        // Pre-process photos: fetch and convert to JPEG base64
        const processedPhotos = []
        for (const photo of photos) {
            if (photo.url) {
                try {
                    const resp = await fetch(photo.url)
                    if (!resp.ok) continue
                    const blob = await resp.blob()
                    const base64 = await blobToJpegBase64(blob)
                    processedPhotos.push({ ...photo, base64 })
                } catch (e) {
                    console.warn('Could not process photo for PDF:', photo.url, e)
                }
            }
        }

        const doc = (
            <InspectionPdfDocument
                formData={formData}
                observations={observations}
                recommendations={recommendations}
                photos={processedPhotos}
                logoBase64={LOGO_SRC}
            />
        )

        const pdfBlob = await pdf(doc).toBlob()
        const blobUrl = URL.createObjectURL(pdfBlob)

        // Convert to base64 for email attachment
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result.split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(pdfBlob)
        })

        return { blob: pdfBlob, blobUrl, base64 }
    }

    // ─── Render helpers ────────────────────────────────────
    const isAdmin = ['superadministrador', 'tecnico', 'legal', 'comercial', 'administracion'].includes(profile?.role)
    const isSent = inspection?.status === 'sent'
    const isCompleted = inspection?.status === 'completed'
    const isReadOnly = isAdmin ? false : (isSent || isCompleted)

    // NOTE: These are render FUNCTIONS (not Components) to avoid React unmount/remount
    // on every re-render, which would cause inputs to lose focus.
    const renderEstadoSelect = (value, onChange, disabled) => (
        <select
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
        >
            {ESTADO_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    )

    const removeItem = (sectionIdx, itemIdx) => {
        setFormData(prev => {
            const updated = { ...prev }
            const sections = [...(updated.sections || [])]
            const section = { ...sections[sectionIdx] }
            const items = [...section.items]
            items.splice(itemIdx, 1)
            section.items = items
            sections[sectionIdx] = section
            updated.sections = sections
            return updated
        })
    }

    const updateItemLabel = (sectionIdx, itemIdx, newLabel) => {
        setFormData(prev => {
            const updated = { ...prev }
            const sections = [...(updated.sections || [])]
            const sec = { ...sections[sectionIdx] }
            const items = [...sec.items]
            items[itemIdx] = { ...items[itemIdx], label: newLabel }
            sec.items = items
            sections[sectionIdx] = sec
            updated.sections = sections
            return updated
        })
    }

    const addOtroItem = (sectionIdx) => {
        setFormData(prev => {
            const updated = { ...prev }
            const sections = [...(updated.sections || [])]
            const section = { ...sections[sectionIdx] }
            const items = [...section.items]
            const otrosCount = items.filter(i => i.label.startsWith('Otro')).length
            items.push({ label: `Otro ${otrosCount + 1}`, estado: '', observacion: '', isCustom: true })
            section.items = items
            sections[sectionIdx] = section
            updated.sections = sections
            return updated
        })
    }

    const removeOtroItem = (sectionIdx, itemIdx) => {
        removeItem(sectionIdx, itemIdx)
    }

    // ─── Icon mapping for section icons ────────────────────
    const ICON_MAP = {
        'chef-hat': ChefHat, 'sofa': Sofa, 'bed-double': BedDouble, 'bath': Bath,
        'trees': Trees, 'sun': Sun, 'waves': Waves, 'shirt': Shirt,
        'warehouse': Warehouse, 'car': Car, 'door-open': DoorOpen, 'monitor': Monitor,
        'coffee': Coffee, 'users': Users, 'briefcase': Briefcase, 'truck': Truck,
        'factory': Factory, 'clipboard-list': ClipboardList, 'fence': Fence,
        'utensils': UtensilsCrossed, 'home': Home, 'plus': Plus,
    }
    const getSectionIcon = (iconKey) => {
        const Icon = ICON_MAP[iconKey]
        return Icon ? <Icon className="w-4 h-4" /> : null
    }

    // ─── Render a section table ───────────────────────────
    const renderSectionTable = (section, sectionIdx) => (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#003DA5] flex items-center gap-2">
                    {getSectionIcon(section.icon)}
                    {section.title}
                </h3>
                {section.removable && !isReadOnly && (
                    <button
                        data-hide-pdf
                        onClick={() => removeSection(sectionIdx)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                )}
            </div>

            {/* ── Desktop: Table layout (hidden on mobile) ── */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#003DA5] text-white">
                            <th className="text-left py-3 px-4 font-semibold text-sm w-[40%]">Ítem</th>
                            <th className="text-center py-3 px-4 font-semibold text-sm w-[25%]">Estado</th>
                            <th className="text-left py-3 px-4 font-semibold text-sm w-[35%]">Observación</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(section.items || []).map((item, idx) => (
                            <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                <td className="py-3 px-4 text-sm text-gray-700 font-medium">
                                    <div className="flex items-center gap-2">
                                        {item.isCustom || item._editing ? (
                                            <input
                                                type="text"
                                                value={item.label}
                                                onChange={e => updateItemLabel(sectionIdx, idx, e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Nombre del ítem..."
                                                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                                            />
                                        ) : (
                                            <span className="flex-1">{item.label}</span>
                                        )}
                                        {!isReadOnly && !item.isCustom && !item._editing && (
                                            <button
                                                data-hide-pdf
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => {
                                                        const updated = { ...prev }
                                                        const sections = [...(updated.sections || [])]
                                                        const sec = { ...sections[sectionIdx] }
                                                        const items = [...sec.items]
                                                        items[idx] = { ...items[idx], _editing: true }
                                                        sec.items = items
                                                        sections[sectionIdx] = sec
                                                        updated.sections = sections
                                                        return updated
                                                    })
                                                }}
                                                className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                                title="Editar nombre"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {!isReadOnly && (
                                            <button
                                                data-hide-pdf
                                                type="button"
                                                onClick={() => removeItem(sectionIdx, idx)}
                                                className="text-red-400 hover:text-red-600 flex-shrink-0"
                                                title="Eliminar ítem"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    {renderEstadoSelect(item.estado, val => updateSectionItem(sectionIdx, idx, 'estado', val), isReadOnly)}
                                </td>
                                <td className="py-3 px-4">
                                    <textarea
                                        rows={1}
                                        value={item.observacion || ''}
                                        onChange={e => {
                                            updateSectionItem(sectionIdx, idx, 'observacion', e.target.value)
                                            e.target.style.height = 'auto'
                                            e.target.style.height = e.target.scrollHeight + 'px'
                                        }}
                                        onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                                        disabled={isReadOnly}
                                        placeholder="Observaciones..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500 resize-none overflow-hidden"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Mobile: Card layout (hidden on desktop) ── */}
            <div className="md:hidden space-y-3">
                {(section.items || []).map((item, idx) => (
                    <div key={idx} className={`rounded-xl border border-gray-200 p-3.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        {/* Item name row */}
                        <div className="flex items-center gap-2 mb-2.5">
                            {item.isCustom || item._editing ? (
                                <input
                                    type="text"
                                    value={item.label}
                                    onChange={e => updateItemLabel(sectionIdx, idx, e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Nombre del ítem..."
                                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                                />
                            ) : (
                                <span className="flex-1 text-sm font-semibold text-gray-800">{item.label}</span>
                            )}
                            {!isReadOnly && !item.isCustom && !item._editing && (
                                <button
                                    data-hide-pdf
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => {
                                            const updated = { ...prev }
                                            const sections = [...(updated.sections || [])]
                                            const sec = { ...sections[sectionIdx] }
                                            const items = [...sec.items]
                                            items[idx] = { ...items[idx], _editing: true }
                                            sec.items = items
                                            sections[sectionIdx] = sec
                                            updated.sections = sections
                                            return updated
                                        })
                                    }}
                                    className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                    title="Editar nombre"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {!isReadOnly && (
                                <button
                                    data-hide-pdf
                                    type="button"
                                    onClick={() => removeItem(sectionIdx, idx)}
                                    className="text-red-400 hover:text-red-600 flex-shrink-0"
                                    title="Eliminar ítem"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        {/* Estado */}
                        <div className="mb-2">
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Estado</label>
                            {renderEstadoSelect(item.estado, val => updateSectionItem(sectionIdx, idx, 'estado', val), isReadOnly)}
                        </div>
                        {/* Observación */}
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observación</label>
                            <textarea
                                rows={1}
                                value={item.observacion || ''}
                                onChange={e => {
                                    updateSectionItem(sectionIdx, idx, 'observacion', e.target.value)
                                    e.target.style.height = 'auto'
                                    e.target.style.height = e.target.scrollHeight + 'px'
                                }}
                                onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                                disabled={isReadOnly}
                                placeholder="Observaciones..."
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500 resize-none overflow-hidden"
                            />
                        </div>
                    </div>
                ))}
            </div>

            {!isReadOnly && (
                <button
                    data-hide-pdf
                    type="button"
                    onClick={() => addOtroItem(sectionIdx)}
                    className="mt-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ml-auto"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Otro Ítem
                </button>
            )}
        </div>
    )

    // Available areas for the add-area dropdown
    const addableAreas = getAddableAreas(formData.inspection_type || 'residential')
    const categoryLabel = getCategoryLabel(formData.inspection_type || 'residential')

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#003DA5] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 text-sm">Cargando inspección...</p>
                </div>
            </div>
        )
    }

    if (!inspection) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500 text-lg mb-4">Inspección no encontrada</p>
                    <button onClick={() => navigate('/inspecciones')} className="px-6 py-3 bg-[#003DA5] text-white rounded-lg font-semibold hover:bg-[#002d7a] transition-colors">
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <Toaster position="top-right" richColors />

            {/* Top bar */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    {/* Row 1: Back + Title + Desktop buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/inspecciones')}
                                className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
                                data-hide-pdf
                            >
                                <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Volver</span>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-sm sm:text-lg font-bold text-slate-900 truncate">Formulario de Inspección</h1>
                                <p className="text-xs text-gray-500 truncate">{formData.direccion || 'Sin dirección'}</p>
                            </div>
                        </div>
                        {/* Desktop-only buttons */}
                        <div className="hidden sm:flex items-center gap-2" data-hide-pdf>
                            {isSent && (
                                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                                    <CheckCircle2 className="w-4 h-4" /> Enviado {inspection.sent_at ? `el ${new Date(inspection.sent_at).toLocaleDateString('es-CL')}` : ''}
                                </div>
                            )}
                            {isCompleted && !isSent && (
                                <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                                    <Eye className="w-4 h-4" /> En Revisión
                                </div>
                            )}
                            {!isReadOnly && (
                                <>
                                    <button
                                        onClick={handleManualSave}
                                        disabled={saving}
                                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar</>}
                                    </button>
                                    {isAdmin ? (
                                        <button
                                            onClick={openSendPreview}
                                            disabled={submitting}
                                            className="px-6 py-2 bg-[#003DA5] text-white rounded-lg text-sm font-semibold hover:bg-[#002d7a] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <Send className="w-4 h-4" /> Enviar al Propietario
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleSendForReview}
                                            disabled={submitting}
                                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <Send className="w-4 h-4" /> Enviar a Revisión
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    {/* Row 2: Mobile-only action buttons */}
                    <div className="flex sm:hidden items-center gap-2 mt-2" data-hide-pdf>
                        {isSent && (
                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
                            </div>
                        )}
                        {isCompleted && !isSent && (
                            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-medium">
                                <Eye className="w-3.5 h-3.5" /> En Revisión
                            </div>
                        )}
                        {!isReadOnly && (
                            <>
                                <button
                                    onClick={handleManualSave}
                                    disabled={saving}
                                    className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : <><Save className="w-3.5 h-3.5" /> Guardar</>}
                                </button>
                                {isAdmin ? (
                                    <button
                                        onClick={openSendPreview}
                                        disabled={submitting}
                                        className="flex-1 px-3 py-2 bg-[#003DA5] text-white rounded-lg text-xs font-semibold hover:bg-[#002d7a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        <Send className="w-3.5 h-3.5" /> Enviar
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSendForReview}
                                        disabled={submitting}
                                        className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        <Send className="w-3.5 h-3.5" /> Enviar a Revisión
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Form content */}
            <div className="max-w-4xl mx-auto py-8 px-4" ref={formContainerRef}>
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">

                    {/* ═══ HEADER ═══ */}
                    <div className="border-b border-gray-200">
                        <div className="h-1.5 bg-gradient-to-r from-[#003DA5] via-[#0056D6] to-[#E11B22]"></div>
                        <div className="px-8 py-6 flex items-center justify-between">
                            <img src={LOGO_SRC} alt="RE/MAX Exclusive" className="h-16 object-contain" />
                            <div className="text-right">
                                <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">Formulario de Inspección</h2>
                                <p className="text-sm text-gray-400 mt-1">{formData.property_type || 'Departamento'}</p>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    formData.inspection_type === 'commercial' ? 'bg-purple-100 text-purple-700' :
                                    formData.inspection_type === 'industrial' ? 'bg-amber-100 text-amber-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>{categoryLabel}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-10">

                        {/* ═══ SECCIÓN 1: Datos del Agente ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">1</div>
                                <h3 className="text-lg font-bold text-[#003DA5]">Datos del Agente</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre del Agente</label>
                                    <input
                                        type="text"
                                        value={formData.agente_nombre || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}
                                        readOnly
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 font-medium text-gray-700 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Fecha de Inspección</label>
                                    <input
                                        type="date"
                                        value={formData.fecha_inspeccion}
                                        onChange={e => setFormData(p => ({ ...p, fecha_inspeccion: e.target.value }))}
                                        disabled={isReadOnly}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 font-medium"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* ═══ SECCIÓN 2: Datos de la Propiedad ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">2</div>
                                <h3 className="text-lg font-bold text-[#003DA5]">Datos de la Propiedad</h3>
                            </div>
                            <div className="space-y-6">
                                {/* Dirección */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Dirección (incluir comuna)</label>
                                    <input
                                        type="text" value={formData.direccion}
                                        onChange={e => setFormData(p => ({ ...p, direccion: e.target.value }))}
                                        disabled={isReadOnly}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50"
                                    />
                                </div>

                                {/* ── Propietarios (múltiples) ── */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Propietario(s)</label>
                                    <div className="space-y-3">
                                        {(formData.propietarios || []).map((prop, idx) => (
                                            <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                                {/* CRM Picker per row */}
                                                {!isReadOnly && (
                                                    <div className="mb-2" data-hide-pdf>
                                                        <ContactPickerInline
                                                            label={`Buscar propietario ${idx + 1} en CRM`}
                                                            onSelectContact={(contact) => {
                                                                if (contact) {
                                                                    setFormData(p => {
                                                                        const arr = [...(p.propietarios || [])]
                                                                        arr[idx] = {
                                                                            nombre: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
                                                                            email: contact.email || ''
                                                                        }
                                                                        const updates = { ...p, propietarios: arr }
                                                                        if (idx === 0) updates.owner_email = contact.email || ''
                                                                        return updates
                                                                    })
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex gap-3 items-start">
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Nombre</label>
                                                            <input
                                                                type="text"
                                                                value={prop.nombre || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value
                                                                    setFormData(p => {
                                                                        const arr = [...(p.propietarios || [])]
                                                                        arr[idx] = { ...arr[idx], nombre: val }
                                                                        return { ...p, propietarios: arr }
                                                                    })
                                                                }}
                                                                disabled={isReadOnly}
                                                                placeholder="Nombre del propietario..."
                                                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                                                <Mail className="w-3 h-3" /> Email
                                                            </label>
                                                            <input
                                                                type="email"
                                                                value={prop.email || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value
                                                                    setFormData(p => {
                                                                        const arr = [...(p.propietarios || [])]
                                                                        arr[idx] = { ...arr[idx], email: val }
                                                                        const updates = { ...p, propietarios: arr }
                                                                        if (idx === 0) updates.owner_email = val
                                                                        return updates
                                                                    })
                                                                }}
                                                                disabled={isReadOnly}
                                                                placeholder="correo@ejemplo.cl"
                                                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                                                            />
                                                            {idx === 0 && !prop.email && !isReadOnly && (
                                                                <p className="text-[10px] text-amber-600 mt-1">⚠️ Requerido para enviar el informe</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!isReadOnly && (formData.propietarios || []).length > 1 && (
                                                        <button
                                                            type="button" data-hide-pdf
                                                            onClick={() => setFormData(p => ({ ...p, propietarios: p.propietarios.filter((_, i) => i !== idx), owner_email: idx === 0 ? (p.propietarios[1]?.email || '') : p.owner_email }))}
                                                            className="mt-6 text-red-400 hover:text-red-600 transition-colors p-1 flex-shrink-0"
                                                            title="Eliminar propietario"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {!isReadOnly && (
                                        <div className="mt-2 flex flex-wrap items-center gap-3" data-hide-pdf>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, propietarios: [...(p.propietarios || []), { nombre: '', email: '' }] }))}
                                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#003DA5] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Agregar Propietario
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* ── Arrendatarios (múltiples) ── */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Arrendatario(s)</label>
                                    <div className="space-y-3">
                                        {(formData.arrendatarios || []).map((arr, idx) => (
                                            <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                                {/* CRM Picker per row */}
                                                {!isReadOnly && (
                                                    <div className="mb-2" data-hide-pdf>
                                                        <ContactPickerInline
                                                            label={`Buscar arrendatario ${idx + 1} en CRM`}
                                                            onSelectContact={(contact) => {
                                                                if (contact) {
                                                                    setFormData(p => {
                                                                        const a = [...(p.arrendatarios || [])]
                                                                        a[idx] = {
                                                                            nombre: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
                                                                            email: contact.email || ''
                                                                        }
                                                                        return { ...p, arrendatarios: a }
                                                                    })
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex gap-3 items-start">
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Nombre</label>
                                                            <input
                                                                type="text"
                                                                value={arr.nombre || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value
                                                                    setFormData(p => {
                                                                        const a = [...(p.arrendatarios || [])]
                                                                        a[idx] = { ...a[idx], nombre: val }
                                                                        return { ...p, arrendatarios: a }
                                                                    })
                                                                }}
                                                                disabled={isReadOnly}
                                                                placeholder="Nombre del arrendatario..."
                                                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                                                <Mail className="w-3 h-3" /> Email
                                                            </label>
                                                            <input
                                                                type="email"
                                                                value={arr.email || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value
                                                                    setFormData(p => {
                                                                        const a = [...(p.arrendatarios || [])]
                                                                        a[idx] = { ...a[idx], email: val }
                                                                        return { ...p, arrendatarios: a }
                                                                    })
                                                                }}
                                                                disabled={isReadOnly}
                                                                placeholder="correo@ejemplo.cl"
                                                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                                                            />
                                                        </div>
                                                    </div>
                                                    {!isReadOnly && (formData.arrendatarios || []).length > 1 && (
                                                        <button
                                                            type="button" data-hide-pdf
                                                            onClick={() => setFormData(p => ({ ...p, arrendatarios: p.arrendatarios.filter((_, i) => i !== idx) }))}
                                                            className="mt-6 text-red-400 hover:text-red-600 transition-colors p-1 flex-shrink-0"
                                                            title="Eliminar arrendatario"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {!isReadOnly && (
                                        <div className="mt-2 flex flex-wrap items-center gap-3" data-hide-pdf>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, arrendatarios: [...(p.arrendatarios || []), { nombre: '', email: '' }] }))}
                                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#003DA5] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Agregar Arrendatario
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* ═══ DYNAMIC SECTIONS ═══ */}
                        {(formData.sections || []).map((section, sectionIdx) => (
                            <section key={section.key || sectionIdx}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">{sectionIdx + 3}</div>
                                    {section.baseKey === 'otro' && !isReadOnly ? (
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={e => {
                                                const newTitle = e.target.value
                                                setFormData(prev => {
                                                    const updated = { ...prev }
                                                    const sections = [...(updated.sections || [])]
                                                    sections[sectionIdx] = { ...sections[sectionIdx], title: newTitle }
                                                    updated.sections = sections
                                                    return updated
                                                })
                                            }}
                                            placeholder="Nombre del área..."
                                            className="text-lg font-bold text-[#003DA5] border-b-2 border-[#003DA5]/30 focus:border-[#003DA5] outline-none bg-transparent px-1 py-0.5 flex-1"
                                        />
                                    ) : (
                                        <span className="text-lg font-bold text-[#003DA5]">{section.title}</span>
                                    )}
                                </div>
                                {renderSectionTable(section, sectionIdx)}
                            </section>
                        ))}

                        {/* ═══ AGREGAR ÁREA ═══ */}
                        {!isReadOnly && (
                            <div className="relative" data-hide-pdf>
                                <button
                                    onClick={() => setShowAddAreaMenu(!showAddAreaMenu)}
                                    className="w-full py-4 border-2 border-dashed border-[#003DA5]/30 rounded-xl text-[#003DA5] font-bold hover:border-[#003DA5] hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Agregar Área
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showAddAreaMenu ? 'rotate-180' : ''}`} />
                                </button>
                                {showAddAreaMenu && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Seleccionar área para agregar</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 p-2 max-h-64 overflow-y-auto">
                                            {addableAreas.map(area => (
                                                <button
                                                    key={area.key}
                                                    onClick={() => addArea(area.key)}
                                                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-blue-50 text-left transition-colors group"
                                                >
                                                    <div className="w-8 h-8 bg-gray-100 group-hover:bg-[#003DA5]/10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                                                        {getSectionIcon(area.icon)}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700 group-hover:text-[#003DA5]">{area.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ OBSERVACIONES FINALES ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">{(formData.sections?.length || 0) + 3}</div>
                                <span className="text-lg font-bold text-[#003DA5]">Observaciones Finales</span>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Observaciones Adicionales</label>
                                    <textarea
                                        value={observations}
                                        onChange={e => setObservations(e.target.value)}
                                        disabled={isReadOnly}
                                        rows={4}
                                        placeholder="Ingrese observaciones adicionales..."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Recomendaciones</label>
                                    <textarea
                                        value={recommendations}
                                        onChange={e => setRecommendations(e.target.value)}
                                        disabled={isReadOnly}
                                        rows={4}
                                        placeholder="Ingrese recomendaciones..."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 resize-none"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* ═══ DECLARACIÓN ═══ */}
                        <section className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-base font-bold text-[#003DA5] mb-3 uppercase tracking-wider">Declaración</h3>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{DECLARACION_TEXT}</p>
                        </section>

                        {/* ═══ REGISTRO FOTOGRÁFICO ═══ */}
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-[#003DA5] uppercase tracking-wider">Registro Fotográfico</h3>
                                {!isReadOnly && (
                                    <div className="hidden md:flex items-center gap-2" data-hide-pdf>
                                        <button
                                            onClick={() => cameraInputRef.current?.click()}
                                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                                        >
                                            <Camera className="w-4 h-4" /> Tomar Foto
                                        </button>
                                        <button
                                            onClick={() => photoInputRef.current?.click()}
                                            className="px-4 py-2 bg-[#003DA5] text-white text-sm font-semibold rounded-lg hover:bg-[#002d7a] transition-colors flex items-center gap-1.5"
                                        >
                                            <ImagePlus className="w-4 h-4" /> Subir desde Galería
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Hidden file input for camera capture (single photo, opens camera on mobile) */}
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handlePhotoUpload}
                            />
                            {/* Hidden file input for gallery/file picker (multiple photos) */}
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handlePhotoUpload}
                            />
                            {photos.length === 0 ? (
                                <div
                                    className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center ${isReadOnly ? 'border-gray-200' : 'border-gray-300 cursor-pointer hover:border-[#003DA5]/40 hover:bg-blue-50/30 transition-colors'}`}
                                    onClick={() => !isReadOnly && photoInputRef.current?.click()}
                                >
                                    <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-400 text-sm">
                                        {isReadOnly ? 'Sin registro fotográfico' : (
                                            <>
                                                <span className="hidden md:inline">Toque aquí o use los botones de arriba para agregar fotos</span>
                                                <span className="md:hidden">Tomar fotografía o seleccionar de la galería</span>
                                            </>
                                        )}
                                    </p>
                                    {!isReadOnly && (
                                        <p className="text-gray-300 text-xs mt-1 hidden md:block">En dispositivos móviles puede usar la cámara directamente</p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {photos.map((photo, idx) => (
                                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                            <img 
                                                src={`https://wsrv.nl/?url=${encodeURIComponent(photo.url)}&output=jpg&w=800&fit=contain`} 
                                                alt={`Foto ${idx + 1}`} 
                                                className="w-full object-contain max-h-[600px] bg-gray-50 bg-black/5 rounded-lg" 
                                                loading="lazy"
                                                onError={(e) => {
                                                    // Fallback to original url if proxy fails
                                                    if (!e.target.dataset.failed) {
                                                        e.target.dataset.failed = true;
                                                        e.target.src = photo.url;
                                                    }
                                                }}
                                            />
                                            {!isReadOnly && (
                                                <button
                                                    data-hide-pdf
                                                    onClick={() => removePhoto(idx)}
                                                    className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {/* Mobile: button to add more photos (since header buttons are hidden) */}
                                    {!isReadOnly && (
                                        <button
                                            data-hide-pdf
                                            onClick={() => photoInputRef.current?.click()}
                                            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-semibold hover:border-[#003DA5]/40 hover:text-[#003DA5] hover:bg-blue-50/30 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Camera className="w-4 h-4" />
                                            Tomar fotografía o seleccionar de la galería
                                        </button>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* ═══ FOOTER ═══ */}
                    <footer className="px-8 py-6 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                        <div className="text-xs text-gray-500">
                            <p>© {new Date().getFullYear()} RE/MAX Exclusive</p>
                            <p className="mt-0.5">{formData.agente_nombre}</p>
                        </div>
                        <img src={LOGO_SRC} alt="RE/MAX" className="h-10 object-contain" />
                    </footer>
                </div>

                {/* Bottom action bar */}
                <div className="flex justify-end gap-3 mt-6 pb-12" data-hide-pdf>
                    {isReadOnly ? (
                        <button
                            onClick={handleDownloadPdf}
                            className="w-full sm:w-auto px-8 py-3 bg-[#003DA5] text-white rounded-xl font-bold hover:bg-[#002d7a] transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" /> Descargar Informe PDF
                        </button>
                    ) : (
                        <>
                            {/* PDF download - always visible */}
                            <button
                                onClick={handleDownloadPdf}
                                className="flex-1 sm:flex-none px-6 py-3 bg-white border-2 border-[#003DA5] text-[#003DA5] rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                                title="Descargar copia del borrador actual"
                            >
                                <Download className="w-4 h-4" /> <span className="sm:hidden">Descargar PDF</span><span className="hidden sm:inline">PDF</span>
                            </button>
                            {/* Guardar + Enviar: only on desktop (already in sticky header on mobile) */}
                            <button
                                onClick={handleManualSave}
                                disabled={saving}
                                className="hidden sm:flex px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm items-center gap-2"
                            >
                                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar Borrador</>}
                            </button>
                            <button
                                onClick={openSendPreview}
                                disabled={submitting}
                                className="hidden sm:flex px-8 py-3 bg-[#003DA5] text-white rounded-xl font-bold hover:bg-[#002d7a] transition-colors disabled:opacity-50 shadow-lg items-center gap-2"
                            >
                                <Send className="w-4 h-4" /> Enviar Informe
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ═══ SEND PREVIEW MODAL ═══ */}
            {showSendPreview && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex" onClick={() => !sending && setShowSendPreview(false)}>
                    <div className="flex w-full h-full" onClick={(e) => e.stopPropagation()}>
                        {/* Left: PDF Preview */}
                        <div className="flex-1 bg-gray-100 flex flex-col min-w-0">
                            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-[#003DA5]" />
                                    <h3 className="font-bold text-gray-900">Vista previa del Informe</h3>
                                </div>
                                <button
                                    onClick={handleDownloadPdf}
                                    className="p-2 text-gray-400 hover:text-[#003DA5] hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Descargar PDF"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4">
                                {preGeneratedPdf?.generating ? (
                                    <div className="w-full h-full flex items-center justify-center bg-white shadow-xl border border-gray-200 rounded-lg">
                                        <div className="text-center">
                                            <div className="w-10 h-10 border-4 border-[#003DA5] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                            <p className="text-gray-500 text-sm">Generando PDF...</p>
                                        </div>
                                    </div>
                                ) : preGeneratedPdf?.blobUrl ? (
                                    <iframe
                                        src={preGeneratedPdf.blobUrl}
                                        className="w-full h-full bg-white shadow-xl border border-gray-200 rounded-lg"
                                        style={{ minHeight: '100%' }}
                                        title="PDF Preview"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-white shadow-xl border border-gray-200 rounded-lg">
                                        <p className="text-gray-400 text-sm">No se pudo generar la vista previa</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Email Composer */}
                        <div className="w-[420px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gradient-to-r from-[#003DA5] to-[#002d7a]">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-white" />
                                    <h3 className="font-bold text-white">Enviar Informe</h3>
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
                                    <input
                                        value={emailDraft.subject}
                                        onChange={(e) => setEmailDraft(prev => ({ ...prev, subject: e.target.value }))}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>

                                {/* Body */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Cuerpo del correo</label>
                                    <textarea
                                        value={emailDraft.body}
                                        onChange={(e) => setEmailDraft(prev => ({ ...prev, body: e.target.value }))}
                                        rows={10}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1.5">La firma del agente se agrega automáticamente</p>
                                </div>

                                {/* Attachment */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Archivo adjunto</label>
                                    <div
                                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors cursor-pointer ${preGeneratedPdf.generating ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100 hover:bg-red-100'}`}
                                        onClick={() => {
                                            if (!preGeneratedPdf.generating && preGeneratedPdf.blobUrl) {
                                                window.open(preGeneratedPdf.blobUrl, '_blank')
                                            }
                                        }}
                                        title={preGeneratedPdf.generating ? 'Generando PDF...' : 'Click para abrir el PDF'}
                                    >
                                        {preGeneratedPdf.generating ? (
                                            <Loader2 className="w-4 h-4 text-orange-500 animate-spin flex-shrink-0" />
                                        ) : (
                                            <FileIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{preGeneratedPdf.filename || 'Informe_Inspeccion.pdf'}</p>
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
                                </div>
                            </div>

                            {/* Footer buttons */}
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setShowSendPreview(false)}
                                    disabled={sending}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmSend}
                                    disabled={sending || preGeneratedPdf.generating}
                                    className="flex-1 px-4 py-2.5 bg-[#003DA5] text-white rounded-lg font-bold hover:bg-[#002d7a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : preGeneratedPdf.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {sending ? 'Enviando...' : preGeneratedPdf.generating ? 'Preparando PDF...' : 'Enviar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
