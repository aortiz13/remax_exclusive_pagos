import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import {
    fetchTemplates, createTemplate, updateTemplate, deleteTemplate,
    renderTemplate, TEMPLATE_VARIABLES, TEMPLATE_CATEGORIES
} from '../../services/recruitmentTemplateService'
import {
    Plus, Edit3, Trash2, X, Save, Eye, Mail, Send, Copy,
    FileText, Tag, Search, ChevronRight, AlertCircle, Code2, Sparkles
} from 'lucide-react'

const SAMPLE_CANDIDATE = {
    first_name: 'Juan', last_name: 'Pérez', email: 'juan.perez@email.com',
    phone: '+56 9 1234 5678', city: 'Santiago',
    meeting_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    meeting_location: 'Oficina RE/MAX Exclusive, Av. Providencia 1234',
}

const CATEGORY_COLORS = {
    'General': 'bg-slate-50 text-slate-600 border-slate-200',
    'Invitación': 'bg-blue-50 text-blue-600 border-blue-200',
    'Confirmación': 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'Aprobación': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'Rechazo': 'bg-red-50 text-red-600 border-red-200',
    'Bienvenida': 'bg-green-50 text-green-600 border-green-200',
    'Seguimiento': 'bg-amber-50 text-amber-600 border-amber-200',
}

export default function RecruitmentEmailTemplates() {
    const { profile } = useAuth()
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState('')

    // Modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', subject: '', body_html: '', category: 'General' })
    const [saving, setSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    useEffect(() => { load() }, [])

    const load = async () => {
        setLoading(true)
        try {
            const data = await fetchTemplates()
            setTemplates(data)
        } catch (err) { console.error(err); toast.error('Error al cargar plantillas') }
        setLoading(false)
    }

    const openNew = () => {
        setEditing(null)
        setForm({ name: '', subject: '', body_html: '', category: 'General' })
        setShowPreview(false)
        setModalOpen(true)
    }

    const openEdit = (t) => {
        setEditing(t)
        setForm({ name: t.name, subject: t.subject, body_html: t.body_html, category: t.category || 'General' })
        setShowPreview(false)
        setModalOpen(true)
    }

    const handleSave = async () => {
        if (!form.name.trim() || !form.subject.trim()) { toast.error('Nombre y asunto son obligatorios'); return }
        setSaving(true)
        try {
            if (editing) {
                await updateTemplate(editing.id, form)
                toast.success('Plantilla actualizada')
            } else {
                await createTemplate({ ...form, created_by: profile?.id })
                toast.success('Plantilla creada')
            }
            setModalOpen(false)
            load()
        } catch (err) { console.error(err); toast.error('Error al guardar') }
        setSaving(false)
    }

    const handleDelete = async (id) => {
        try {
            await deleteTemplate(id)
            toast.success('Plantilla eliminada')
            setDeleteConfirm(null)
            load()
        } catch (err) { console.error(err); toast.error('Error al eliminar') }
    }

    const insertVariable = (variable) => {
        setForm(prev => ({ ...prev, body_html: prev.body_html + variable }))
    }

    const insertVariableSubject = (variable) => {
        setForm(prev => ({ ...prev, subject: prev.subject + variable }))
    }

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
    const preview = renderTemplate(form, SAMPLE_CANDIDATE)

    // Filtered templates
    const filtered = templates.filter(t => {
        if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false
        if (filterCategory && t.category !== filterCategory) return false
        return true
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-[#003DA5] rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-5 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Plantillas de Email</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Gestiona plantillas con variables dinámicas para emails a candidatos</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#003DA5] to-[#002D7A] text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
                    <Plus className="w-4 h-4" /> Nueva Plantilla
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar plantilla..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setFilterCategory('')}
                        className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${!filterCategory ? 'bg-[#003DA5] text-white border-[#003DA5]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                        Todas
                    </button>
                    {TEMPLATE_CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setFilterCategory(cat === filterCategory ? '' : cat)}
                            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${filterCategory === cat ? 'bg-[#003DA5] text-white border-[#003DA5]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Template Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-12">
                    <Mail className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">{search || filterCategory ? 'Sin resultados' : 'No hay plantillas. Crea la primera.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((t, i) => {
                        const catColor = CATEGORY_COLORS[t.category] || CATEGORY_COLORS['General']
                        return (
                            <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                                {/* Card header */}
                                <div className="p-4 border-b border-slate-100">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-sm text-slate-800 truncate">{t.name}</h3>
                                                {t.is_default && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#003DA5] border border-blue-200 shrink-0">
                                                        DEFAULT
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded border ${catColor}`}>{t.category || 'General'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Subject preview */}
                                <div className="px-4 py-3">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Asunto</p>
                                    <p className="text-xs text-slate-600 truncate">{t.subject}</p>
                                </div>

                                {/* Body preview */}
                                <div className="px-4 pb-3">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Contenido</p>
                                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{t.body_html?.substring(0, 150)}...</p>
                                </div>

                                {/* Actions */}
                                <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex gap-1.5">
                                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-[#003DA5] transition-colors">
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        {!t.is_default && (
                                            <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <button onClick={() => openEdit(t)} className="text-[10px] font-semibold text-[#003DA5] hover:underline flex items-center gap-0.5">
                                        Editar <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Delete Confirm */}
            <AnimatePresence>
                {deleteConfirm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pl-[200px]" onClick={() => setDeleteConfirm(null)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold text-slate-800 mb-2">¿Eliminar plantilla?</h3>
                            <p className="text-sm text-slate-500 mb-4">Esta acción no se puede deshacer.</p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700">Cancelar</button>
                                <button onClick={() => handleDelete(deleteConfirm)} className="px-3 py-2 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600">Eliminar</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ Create / Edit Modal ═══ */}
            <AnimatePresence>
                {modalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-8 pl-[200px] overflow-y-auto"
                        onClick={() => setModalOpen(false)}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-[#003DA5] to-[#002D7A] px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <Mail className="w-5 h-5" />
                                    <h2 className="font-bold text-lg">{editing ? 'Editar Plantilla' : 'Nueva Plantilla'}</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setShowPreview(!showPreview)}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${showPreview ? 'bg-white text-[#003DA5]' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                                        <Eye className="w-3.5 h-3.5" /> {showPreview ? 'Editor' : 'Preview'}
                                    </button>
                                    <button onClick={() => setModalOpen(false)} className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-colors">
                                        <X className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex divide-x divide-slate-200 max-h-[70vh]">
                                {/* Left: Editor / Preview */}
                                <div className="flex-1 p-5 overflow-y-auto">
                                    {showPreview ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                                <Sparkles className="w-3.5 h-3.5" /> Vista previa con datos de ejemplo
                                            </div>
                                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                                    <Send className="w-3.5 h-3.5" /> Para: <strong className="text-slate-700">{SAMPLE_CANDIDATE.email}</strong>
                                                </div>
                                                <p className="text-sm font-semibold text-slate-800 mb-3 pb-3 border-b border-slate-200">{preview.subject}</p>
                                                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{preview.body}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Name + Category */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Nombre de la Plantilla</label>
                                                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                                        placeholder="Ej: Invitación a reunión" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Categoría</label>
                                                    <select value={form.category} onChange={e => set('category', e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none">
                                                        {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Subject */}
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Asunto</label>
                                                <input type="text" value={form.subject} onChange={e => set('subject', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                                    placeholder="Asunto del email con {{variables}}" />
                                            </div>

                                            {/* Body */}
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Cuerpo del Email</label>
                                                <textarea value={form.body_html} onChange={e => set('body_html', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none resize-none font-mono"
                                                    rows={12}
                                                    placeholder="Escribe el cuerpo del email. Usa {{nombre}}, {{apellido}}, etc." />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Variables sidebar */}
                                <div className="w-56 p-4 bg-slate-50/50 overflow-y-auto shrink-0">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                                        <Code2 className="w-3 h-3" /> Variables
                                    </p>
                                    <div className="space-y-1.5">
                                        {TEMPLATE_VARIABLES.map(v => (
                                            <button key={v.key} onClick={() => insertVariable(v.key)}
                                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white text-xs transition-colors border border-transparent hover:border-slate-200 group">
                                                <span className="font-mono text-[#003DA5] text-[10px] block">{v.key}</span>
                                                <span className="text-slate-500 text-[10px]">{v.label}</span>
                                                <span className="text-slate-300 text-[10px] ml-1 group-hover:text-slate-400">→ {v.example}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                                        Haz clic en una variable para insertarla en el cuerpo del email.
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700">
                                    Cancelar
                                </button>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-1.5 px-5 py-2 bg-[#003DA5] text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-[#002D7A] transition-all">
                                    <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plantilla'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
