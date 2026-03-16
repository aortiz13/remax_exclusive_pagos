import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { getDefaultFormData, uploadInspectionPhoto } from '../services/inspectionService'
import { toast, Toaster } from 'sonner'
import {
    ClipboardCheck, MapPin, Save, Send, CheckCircle, AlertTriangle,
    Plus, Trash2, Loader2, Camera
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
                const saved = { ...getDefaultFormData(), ...data.form_data }
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

    // ── Section item handlers (same as InspectionFormPage) ──
    const updateSectionItem = (section, index, field, value) => {
        setFormData(prev => {
            const updated = { ...prev }
            const items = [...(updated[section] || [])]
            items[index] = { ...items[index], [field]: value }
            updated[section] = items
            return updated
        })
    }

    const updateDynamicSection = (section, roomIndex, itemIndex, field, value) => {
        setFormData(prev => {
            const updated = { ...prev }
            const rooms = [...(updated[section] || [])]
            const room = { ...rooms[roomIndex] }
            const items = [...room.items]
            items[itemIndex] = { ...items[itemIndex], [field]: value }
            room.items = items
            rooms[roomIndex] = room
            updated[section] = rooms
            return updated
        })
    }

    const addRoom = (section, baseName) => {
        setFormData(prev => {
            const updated = { ...prev }
            const rooms = [...(updated[section] || [])]
            const num = rooms.length + 1
            const makeItems = (items) => items.map(label => ({ label, estado: '', observacion: '' }))
            let items
            if (section === 'dormitorios') {
                items = makeItems([
                    'Estado de paredes y cielos', 'Estado de pisos', 'Estado de ventanas',
                    'Estado de puertas', 'Closet (puertas, repisas, etc.)',
                    'Estado de enchufes e interruptores (indicar cantidad)',
                ])
            } else {
                items = makeItems([
                    'Estado de paredes y techos', 'Estado de pisos', 'Estado de ventanas',
                    'Estado de puertas', 'Estado de grifos y llaves', 'Estado de inodoro',
                    'Estado de tina / ducha',
                ])
            }
            rooms.push({ nombre: `${baseName} ${num}`, items })
            updated[section] = rooms
            return updated
        })
    }

    const removeRoom = (section, index) => {
        setFormData(prev => {
            const updated = { ...prev }
            const rooms = [...(updated[section] || [])]
            rooms.splice(index, 1)
            rooms.forEach((r, i) => {
                const base = section === 'dormitorios' ? 'Dormitorio' : 'Baño'
                r.nombre = `${base} ${i + 1}`
            })
            updated[section] = rooms
            return updated
        })
    }

    const addOtroItem = (sectionKey) => {
        setFormData(prev => {
            const updated = { ...prev }
            const items = [...(updated[sectionKey] || [])]
            const otrosCount = items.filter(i => i.label.startsWith('Otro')).length
            items.push({ label: `Otro ${otrosCount + 1}`, estado: '', observacion: '', isCustom: true })
            updated[sectionKey] = items
            return updated
        })
    }

    const removeOtroItem = (sectionKey, idx) => {
        setFormData(prev => {
            const updated = { ...prev }
            const items = [...(updated[sectionKey] || [])]
            items.splice(idx, 1)
            let otroNum = 0
            items.forEach(item => {
                if (item.isCustom || item.label.startsWith('Otro')) {
                    otroNum++
                    item.label = `Otro ${otroNum}`
                    item.isCustom = true
                }
            })
            updated[sectionKey] = items
            return updated
        })
    }

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
                                cocina: formData.cocina || [],
                                sala_estar: formData.sala_estar || [],
                                comedor: formData.comedor || [],
                                dormitorios: formData.dormitorios || [],
                                banos: formData.banos || [],
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

    const renderSectionTable = (title, items, sectionKey, onUpdate) => (
        <div className="mb-8">
            {title && (
                <h3 className="text-lg font-bold text-[#003DA5] flex items-center gap-2 mb-4">{title}</h3>
            )}
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
                        {items.map((item, idx) => (
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
                                                        const arr = [...(updated[sectionKey] || [])]
                                                        arr[idx] = { ...arr[idx], label: newLabel }
                                                        updated[sectionKey] = arr
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
                                                onClick={() => removeOtroItem(sectionKey, idx)}
                                                className="text-red-400 hover:text-red-600 flex-shrink-0"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    {renderEstadoSelect(item.estado, val => onUpdate(idx, 'estado', val))}
                                </td>
                                <td className="py-3 px-4">
                                    <textarea
                                        rows={1}
                                        value={item.observacion || ''}
                                        onChange={e => {
                                            onUpdate(idx, 'observacion', e.target.value)
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
                onClick={() => addOtroItem(sectionKey)}
                className="mt-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ml-auto"
            >
                <Plus className="w-3.5 h-3.5" />
                Agregar Otro Ítem
            </button>
        </div>
    )

    const renderDynamicSectionTable = (title, section, baseName) => {
        const rooms = formData[section] || []
        return (
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    {title && (
                        <h3 className="text-lg font-bold text-[#003DA5] flex items-center gap-2">{title}</h3>
                    )}
                    <button
                        onClick={() => addRoom(section, baseName)}
                        className="px-4 py-2 bg-[#003DA5] text-white text-sm font-semibold rounded-lg hover:bg-[#002d7a] transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> Agregar {baseName}
                    </button>
                </div>
                {rooms.map((room, roomIdx) => (
                    <div key={roomIdx} className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-base font-bold text-gray-700">{room.nombre}</h4>
                            {rooms.length > 1 && (
                                <button
                                    onClick={() => removeRoom(section, roomIdx)}
                                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                                >
                                    Eliminar
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
                                    {room.items.map((item, itemIdx) => (
                                        <tr key={itemIdx} className={`border-b border-gray-100 ${itemIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                            <td className="py-3 px-4 text-sm text-gray-700 font-medium">{item.label}</td>
                                            <td className="py-3 px-4">
                                                {renderEstadoSelect(item.estado, val => updateDynamicSection(section, roomIdx, itemIdx, 'estado', val))}
                                            </td>
                                            <td className="py-3 px-4">
                                                <textarea
                                                    rows={1}
                                                    value={item.observacion || ''}
                                                    onChange={e => {
                                                        updateDynamicSection(section, roomIdx, itemIdx, 'observacion', e.target.value)
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
                    </div>
                ))}
            </div>
        )
    }

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

                        {/* ═══ SECCIÓN 3: Cocina ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">3</div>
                                <span className="text-lg font-bold text-[#003DA5]">Cocina</span>
                            </div>
                            {renderSectionTable(
                                "",
                                formData.cocina,
                                "cocina",
                                (idx, field, val) => updateSectionItem('cocina', idx, field, val)
                            )}
                        </section>

                        {/* ═══ SECCIÓN 4: Sala de Estar / Living / Comedor ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">4</div>
                                <span className="text-lg font-bold text-[#003DA5]">Sala de Estar / Living / Comedor</span>
                            </div>
                            {renderSectionTable(
                                "",
                                formData.sala_estar,
                                "sala_estar",
                                (idx, field, val) => updateSectionItem('sala_estar', idx, field, val)
                            )}
                        </section>

                        {/* ═══ SECCIÓN 5: Dormitorios ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">5</div>
                                <span className="text-lg font-bold text-[#003DA5]">Dormitorios</span>
                            </div>
                            {renderDynamicSectionTable("", "dormitorios", "Dormitorio")}
                        </section>

                        {/* ═══ SECCIÓN 6: Baños ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">6</div>
                                <span className="text-lg font-bold text-[#003DA5]">Baño(s)</span>
                            </div>
                            {renderDynamicSectionTable("", "banos", "Baño")}
                        </section>

                        {/* ═══ SECCIÓN 7: Observaciones Finales ═══ */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-[#003DA5] text-white rounded-lg flex items-center justify-center text-sm font-bold">7</div>
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
