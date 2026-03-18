import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { getDefaultFormData, uploadInspectionPhoto } from '../services/inspectionService'
import {
    isNewFormat, convertLegacyFormData, getAddableAreas, createSection,
    renumberSections, getCategoryLabel
} from '../config/inspectionFormTemplates'
import { toast, Toaster } from 'sonner'
import {
    ClipboardCheck, MapPin, Save, Send, CheckCircle, AlertTriangle,
    Plus, Trash2, Loader2, Camera, ChevronDown
} from 'lucide-react'

const LOGO_SRC = '/primerolog.png'

const DECLARACION_TEXT = `Este informe corresponde a una inspección visual y presencial realizada por el agente en la fecha indicada. Su alcance se limita a las condiciones observables en ese momento y a la información que fue posible recabar durante la visita.

El presente documento no constituye una inspección técnica especializada, ni reemplaza evaluaciones de carácter estructural, eléctrico, sanitario u otras revisiones profesionales. Las observaciones, conclusiones y recomendaciones aquí contenidas reflejan únicamente lo constatado en la fecha de la inspección y pueden variar con el uso posterior de la propiedad. El registro fotográfico incluido es referencial y no sustituye una revisión técnica ni exhaustiva de los elementos de la propiedad. Este informe es de carácter informativo y no implica la validación, liberación o levantamiento de obligaciones o garantías más allá de lo estipulado en el contrato de arrendamiento vigente. Finalmente, el informe está destinado al uso exclusivo del propietario y no debe ser distribuido ni compartido con terceros sin autorización expresa del agente responsable.`

const ESTADO_OPTIONS = [
    { value: '', label: 'Seleccionar' },
    { value: 'Bueno', label: 'Bueno' },
    { value: 'Regular', label: 'Regular' },
    { value: 'Malo', label: 'Malo' },
    { value: 'N/A', label: 'N/A' },
]

/**
 * Public Inspection Page — accessible via token, no login required.
 * Route: /inspeccion-publica/:token
 * Uses the SAME layout & form structure as InspectionFormPage.
 */
export default function PublicInspectionPage() {
    const { token } = useParams()
    const [inspection, setInspection] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    // Form state — same structure as InspectionFormPage
    const [formData, setFormData] = useState(getDefaultFormData())
    const [observations, setObservations] = useState('')
    const [recommendations, setRecommendations] = useState('')
    const [inspectorName, setInspectorName] = useState('')
    const [photos, setPhotos] = useState([])
    const photoInputRef = useRef(null)

    useEffect(() => {
        loadInspection()
    }, [token])

    const loadInspection = async () => {
        try {
            const { data, error: err } = await supabase
                .from('property_inspections')
                .select('*, properties(address, commune, unit_number)')
                .eq('public_token', token)
                .single()

            if (err || !data) {
                setError('Enlace de inspección no válido o expirado')
                return
            }

            if (data.status === 'sent' || data.status === 'completed') {
                setSubmitted(true)
            }

            setInspection(data)

            // Compute property address
            let propertyAddress = ''
            if (data.properties) {
                const parts = (data.properties.address || '').split(',').map(s => s.trim())
                const streetParts = parts.slice(0, 2)
                const streetNum = streetParts.length >= 2
                    ? `${streetParts[1]} ${streetParts[0]}`
                    : streetParts.join(' ')
                const unit = data.properties.unit_number ? ` Depto ${data.properties.unit_number}` : ''
                propertyAddress = [streetNum + unit, data.properties.commune].filter(Boolean).join(', ')
            } else {
                propertyAddress = data.address || ''
            }

            // Load form data
            if (data.form_data && Object.keys(data.form_data).length > 0) {
                let saved = isNewFormat(data.form_data)
                    ? data.form_data
                    : convertLegacyFormData(data.form_data)
                if (!saved.direccion && propertyAddress) saved.direccion = propertyAddress
                setFormData(saved)
            } else {
                setFormData(prev => ({
                    ...prev,
                    direccion: propertyAddress,
                    fecha_inspeccion: new Date().toISOString().split('T')[0],
                }))
            }

            setPhotos(data.photos || [])
            setObservations(data.observations || data.form_data?.observaciones_adicionales || '')
            setRecommendations(data.recommendations || data.form_data?.recomendaciones || '')
            setInspectorName(data.form_data?.inspector_externo || '')
        } catch (err) {
            console.error(err)
            setError('Error al cargar la inspección')
        } finally {
            setLoading(false)
        }
    }

    // ── Section item handlers (new dynamic format) ──
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
        setFormData(prev => {
            const updated = { ...prev }
            const sections = [...(updated.sections || [])]
            const section = { ...sections[sectionIdx] }
            const items = [...section.items]
            items.splice(itemIdx, 1)
            let otroNum = 0
            items.forEach(item => {
                if (item.isCustom || item.label.startsWith('Otro')) {
                    otroNum++
                    item.label = `Otro ${otroNum}`
                    item.isCustom = true
                }
            })
            section.items = items
            sections[sectionIdx] = section
            updated.sections = sections
            return updated
        })
    }

    const [showAddAreaMenu, setShowAddAreaMenu] = useState(false)
    const addableAreas = getAddableAreas(formData.inspection_type || 'residential')

    // ── Photo handlers ──
    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return
        for (const file of files) {
            try {
                toast.loading(`Subiendo ${file.name}...`, { id: `upload-${file.name}` })
                const result = await uploadInspectionPhoto(file, inspection.id, 'registro_fotografico')
                setPhotos(prev => [...prev, result])
                toast.success(`${file.name} subida`, { id: `upload-${file.name}` })
            } catch (err) {
                console.error('Photo upload error:', err)
                toast.error(`Error subiendo ${file.name}`, { id: `upload-${file.name}` })
            }
        }
        e.target.value = ''
    }

    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index))
    }

    // ── Save / Submit ──
    const handleSave = async (andSubmit = false) => {
        if (!inspectorName.trim()) {
            toast.error('Ingrese su nombre')
            return
        }
        setSaving(true)
        try {
            const updatedFormData = {
                ...formData,
                observaciones_adicionales: observations,
                recomendaciones: recommendations,
                inspector_externo: inspectorName,
            }

            const updatePayload = {
                photos,
                form_data: updatedFormData,
                observations,
                recommendations,
                updated_at: new Date().toISOString(),
            }
            if (andSubmit) {
                updatePayload.status = 'sent'
            }

            const { error: err } = await supabase
                .from('property_inspections')
                .update(updatePayload)
                .eq('public_token', token)

            if (err) throw err

            if (andSubmit) {
                setSubmitted(true)
                toast.success('¡Inspección enviada correctamente!')

                // Notify office via n8n webhook with full form data for PDF generation
                try {
                    const propertyAddr = formData.direccion || inspection?.properties?.address || 'Sin dirección'
                    const inspDate = formData.fecha_inspeccion || new Date().toISOString().split('T')[0]
                    // Collect photo public URLs for the PDF
                    const photoUrls = photos.filter(p => p.url).map(p => p.url)
                    await fetch('https://workflow.remax-exclusive.cl/webhook/inspection-public-completed', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'public_inspection_completed',
                            inspection: {
                                id: inspection.id,
                                address: propertyAddr,
                                inspector_name: inspectorName,
                                inspection_date: inspDate,
                                propietario: formData.propietario || '',
                                arrendatario: formData.arrendatario || '',
                                metraje_informado: formData.metraje_informado || '',
                                metraje_terrazas: formData.metraje_terrazas || '',
                                metraje_total: formData.metraje_total || '',
                            },
                            form_data: {
                                sections: formData.sections || [],
                                inspection_type: formData.inspection_type || 'residential',
                            },
                            observations: observations || 'Sin observaciones',
                            recommendations: recommendations || 'Sin recomendaciones',
                            photo_urls: photoUrls,
                        })
                    })
                } catch (notifyErr) {
                    console.warn('Notification webhook failed (non-blocking):', notifyErr)
                }
            } else {
                toast.success('Inspección guardada')
            }
        } catch (err) {
            console.error(err)
            toast.error('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    // ── Render helpers (same style as InspectionFormPage) ──
    const renderEstadoSelect = (value, onChange) => (
        <select
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
            {ESTADO_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    )

    const renderSectionTable = (section, sectionIdx) => (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#003DA5] flex items-center gap-2">{section.title}</h3>
                {section.removable && (
                    <button
                        onClick={() => removeSection(sectionIdx)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
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
                                        {item.isCustom ? (
                                            <input
                                                type="text"
                                                value={item.label}
                                                onChange={e => {
                                                    const newLabel = e.target.value
                                                    setFormData(prev => {
                                                        const updated = { ...prev }
                                                        const sections = [...(updated.sections || [])]
                                                        const sec = { ...sections[sectionIdx] }
                                                        const items = [...sec.items]
                                                        items[idx] = { ...items[idx], label: newLabel }
                                                        sec.items = items
                                                        sections[sectionIdx] = sec
                                                        updated.sections = sections
                                                        return updated
                                                    })
                                                }}
                                                placeholder="Nombre del ítem..."
                                                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        ) : item.label}
                                        {item.isCustom && (
                                            <button
                                                type="button"
                                                onClick={() => removeOtroItem(sectionIdx, idx)}
                                                className="text-red-400 hover:text-red-600 flex-shrink-0"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    {renderEstadoSelect(item.estado, val => updateSectionItem(sectionIdx, idx, 'estado', val))}
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
                                        placeholder="Observaciones..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none overflow-hidden"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button
                type="button"
                onClick={() => addOtroItem(sectionIdx)}
                className="mt-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ml-auto"
            >
                <Plus className="w-3.5 h-3.5" />
                Agregar Otro Ítem
            </button>
        </div>
    )

    // ─── Loading / Error states ────────────────────────────────
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

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">{error}</h2>
                    <p className="text-sm text-gray-500">Si cree que esto es un error, contacte al administrador.</p>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Toaster position="top-center" richColors />
                <div className="text-center">
                    <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Inspección Enviada!</h2>
                    <p className="text-sm text-gray-500">Gracias por completar la inspección.<br />El equipo de administración la revisará.</p>
                    {inspection?.properties && (
                        <p className="text-sm text-gray-400 mt-4">
                            {formData.direccion}
                        </p>
                    )}
                </div>
            </div>
        )
    }

    // ─── Main form — matches InspectionFormPage layout ─────────
    return (
        <div className="min-h-screen bg-gray-100">
            <Toaster position="top-right" richColors />

            {/* Top bar */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                            <ClipboardCheck className="w-5 h-5 text-[#003DA5]" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">Formulario de Inspección</h1>
                            <p className="text-xs text-gray-500">{formData.direccion || 'Sin dirección'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleSave(false)}
                            disabled={saving}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            Guardar
                        </button>
                        <button
                            onClick={() => handleSave(true)}
                            disabled={saving}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Enviar Inspección
                        </button>
                    </div>
                </div>
            </div>

            {/* Form content */}
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">

                    {/* ═══ HEADER ═══ */}
                    <div className="border-b border-gray-200">
                        <div className="h-1.5 bg-gradient-to-r from-[#003DA5] via-[#0056D6] to-[#E11B22]"></div>
                        <div className="px-8 py-6 flex items-center justify-between">
                            <img src={LOGO_SRC} alt="RE/MAX Exclusive" className="h-16 object-contain" />
                            <div className="text-right">
                                <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">Formulario de Inspección</h2>
                                <p className="text-sm text-gray-400 mt-1">Inspector Externo</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-10">

                        {/* ═══ SECCIÓN 1: Datos del Inspector ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">1</div>
                                <h3 className="text-lg font-bold text-[#003DA5]">Datos del Inspector</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre del Inspector *</label>
                                    <input
                                        type="text"
                                        value={inspectorName}
                                        onChange={e => setInspectorName(e.target.value)}
                                        placeholder="Ingrese su nombre completo"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Fecha de Inspección</label>
                                    <input
                                        type="date"
                                        value={formData.fecha_inspeccion}
                                        onChange={e => setFormData(p => ({ ...p, fecha_inspeccion: e.target.value }))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Dirección</label>
                                    <input
                                        type="text" value={formData.direccion}
                                        onChange={e => setFormData(p => ({ ...p, direccion: e.target.value }))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Metraje Informado</label>
                                    <input
                                        type="text" value={formData.metraje_informado}
                                        onChange={e => setFormData(p => ({ ...p, metraje_informado: e.target.value }))}
                                        placeholder="m²"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Metraje Terrazas</label>
                                    <input
                                        type="text" value={formData.metraje_terrazas}
                                        onChange={e => setFormData(p => ({ ...p, metraje_terrazas: e.target.value }))}
                                        placeholder="m²"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Metraje Total</label>
                                    <input
                                        type="text" value={formData.metraje_total}
                                        onChange={e => setFormData(p => ({ ...p, metraje_total: e.target.value }))}
                                        placeholder="m²"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* ═══ DYNAMIC SECTIONS ═══ */}
                        {(formData.sections || []).map((section, sectionIdx) => (
                            <section key={section.key || sectionIdx}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">{sectionIdx + 3}</div>
                                    <span className="text-lg font-bold text-[#003DA5]">{section.title}</span>
                                </div>
                                {renderSectionTable(section, sectionIdx)}
                            </section>
                        ))}

                        {/* ═══ AGREGAR ÁREA ═══ */}
                        <div className="relative">
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
                                                <span className="text-sm font-medium text-gray-700 group-hover:text-[#003DA5]">{area.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

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
                                        rows={4}
                                        placeholder="Ingrese observaciones adicionales..."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Recomendaciones</label>
                                    <textarea
                                        value={recommendations}
                                        onChange={e => setRecommendations(e.target.value)}
                                        rows={4}
                                        placeholder="Ingrese recomendaciones..."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
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
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">8</div>
                                    <span className="text-lg font-bold text-[#003DA5]">Registro Fotográfico</span>
                                </div>
                                <button
                                    onClick={() => photoInputRef.current?.click()}
                                    className="px-4 py-2 bg-[#003DA5] text-white text-sm font-semibold rounded-lg hover:bg-[#002d7a] transition-colors flex items-center gap-1"
                                >
                                    <Camera className="w-4 h-4" /> Subir Fotos
                                </button>
                            </div>
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handlePhotoUpload}
                            />
                            {photos.length === 0 ? (
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                                    <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-400 text-sm">Haga click en "Subir Fotos" para agregar imágenes</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {photos.map((photo, idx) => (
                                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                            <img src={photo.url} alt={`Foto ${idx + 1}`} className="w-full object-contain max-h-[600px] bg-gray-50" />
                                            <button
                                                onClick={() => removePhoto(idx)}
                                                className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                    </div>

                    {/* ═══ FOOTER ═══ */}
                    <footer className="px-8 py-6 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                        <div className="text-xs text-gray-500">
                            <p>© {new Date().getFullYear()} RE/MAX Exclusive</p>
                            <p className="mt-0.5">{inspectorName || 'Inspector Externo'}</p>
                        </div>
                        <img src={LOGO_SRC} alt="RE/MAX" className="h-10 object-contain" />
                    </footer>
                </div>
            </div>
        </div>
    )
}
