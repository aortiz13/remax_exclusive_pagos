import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCandidates, createCandidate, deleteCandidate, PIPELINE_STAGES, CANDIDATE_SOURCES } from '../../services/recruitmentService'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Users, Mail, Phone, MapPin, ChevronDown, ChevronUp,
    Filter, RotateCcw, Trash2, Eye, Download, UserPlus, Calendar,
    X, Save, Plus
} from 'lucide-react'

const STAGE_BADGE = {
    'Nuevo':                'bg-blue-50 text-blue-700 border-blue-200',
    'Reunión Agendada':     'bg-sky-50 text-sky-700 border-sky-200',
    'Reunión Confirmada':   'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Aprobado':             'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Desaprobado':          'bg-red-50 text-red-700 border-red-200',
    'Ganado':               'bg-green-50 text-green-700 border-green-200',
    'Perdido':              'bg-slate-100 text-slate-600 border-slate-200',
    'Seguimiento':          'bg-amber-50 text-amber-700 border-amber-200',
}

export default function RecruitmentCandidateList() {
    const navigate = useNavigate()
    const [candidates, setCandidates] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStage, setFilterStage] = useState('all')
    const [filterSource, setFilterSource] = useState('all')
    const [sortField, setSortField] = useState('created_at')
    const [sortDir, setSortDir] = useState('desc')
    const [showFilters, setShowFilters] = useState(false)
    const [showNewModal, setShowNewModal] = useState(false)

    useEffect(() => { loadCandidates() }, [])

    const loadCandidates = async () => {
        setLoading(true)
        try { setCandidates(await fetchCandidates()) } catch (err) { console.error(err); toast.error('Error al cargar candidatos') }
        setLoading(false)
    }

    const hasFilters = searchTerm || filterStage !== 'all' || filterSource !== 'all'

    const filtered = useMemo(() => {
        let result = candidates.filter(c => {
            const t = searchTerm.toLowerCase()
            const ms = !searchTerm ||
                c.first_name?.toLowerCase().includes(t) ||
                c.last_name?.toLowerCase().includes(t) ||
                c.email?.toLowerCase().includes(t) ||
                c.phone?.includes(searchTerm) ||
                c.rut?.includes(searchTerm)
            const mSt = filterStage === 'all' || c.pipeline_stage === filterStage
            const mSo = filterSource === 'all' || c.source === filterSource
            return ms && mSt && mSo
        })
        result.sort((a, b) => {
            const va = a[sortField] || ''; const vb = b[sortField] || ''
            return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
        })
        return result
    }, [candidates, searchTerm, filterStage, filterSource, sortField, sortDir])

    const handleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(field); setSortDir('asc') }
    }

    const handleDelete = async (id, name) => {
        if (!window.confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return
        try {
            await deleteCandidate(id)
            setCandidates(prev => prev.filter(c => c.id !== id))
            toast.success('Candidato eliminado')
        } catch { toast.error('Error al eliminar') }
    }

    const handleCreateCandidate = async (formData) => {
        try {
            const created = await createCandidate(formData)
            setCandidates(prev => [created, ...prev])
            setShowNewModal(false)
            toast.success('Candidato creado exitosamente')
        } catch (err) {
            console.error(err)
            toast.error('Error al crear candidato')
        }
    }

    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

    const SortIcon = ({ field }) => {
        if (sortField !== field) return null
        return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    }

    const exportCSV = () => {
        const headers = ['Nombre', 'Email', 'Teléfono', 'Fuente', 'Estado', 'Ciudad', 'Fecha']
        const rows = filtered.map(c => [
            `${c.first_name || ''} ${c.last_name || ''}`.trim(),
            c.email || '', c.phone || '', c.source || '',
            c.pipeline_stage || '', c.city || '', fmt(c.created_at)
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `candidatos_${new Date().toISOString().split('T')[0]}.csv`
        a.click(); URL.revokeObjectURL(url)
        toast.success('CSV exportado')
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-[#003DA5] to-[#002D7A] rounded-xl shadow-lg shadow-blue-900/20">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        Candidatos
                    </h1>
                    <p className="text-muted-foreground mt-1">{filtered.length} candidatos en total</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={exportCSV}
                        className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
                        <Download className="w-4 h-4" /> Exportar
                    </button>
                    <button onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#003DA5] hover:bg-[#002D7A] text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-900/25 transition-all">
                        <Plus className="w-4 h-4" /> Nuevo Candidato
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="relative w-full sm:w-64 lg:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <button onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <Filter className="w-4 h-4" /> Filtros
                    {hasFilters && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                </button>
                {hasFilters && (
                    <button onClick={() => { setSearchTerm(''); setFilterStage('all'); setFilterSource('all') }}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-200">
                        <RotateCcw className="w-3.5 h-3.5" /> Limpiar
                    </button>
                )}
            </div>

            <AnimatePresence>
                {showFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="p-4 bg-white rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Estado</label>
                                <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary outline-none">
                                    <option value="all">Todos</option>
                                    {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Fuente</label>
                                <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary outline-none">
                                    <option value="all">Todos</option>
                                    {CANDIDATE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-10 h-10 border-[3px] border-slate-200 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    {[
                                        { key: 'first_name', label: 'Nombre' },
                                        { key: 'email', label: 'Email' },
                                        { key: 'phone', label: 'Teléfono' },
                                        { key: 'source', label: 'Fuente' },
                                        { key: 'pipeline_stage', label: 'Estado' },
                                        { key: 'city', label: 'Ciudad' },
                                        { key: 'created_at', label: 'Fecha' },
                                    ].map(col => (
                                        <th key={col.key} onClick={() => handleSort(col.key)}
                                            className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none">
                                            <span className="flex items-center gap-1">{col.label}<SortIcon field={col.key} /></span>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                                            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            <p className="font-medium">No se encontraron candidatos</p>
                                        </td>
                                    </tr>
                                ) : filtered.map(c => {
                                    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
                                    const initials = `${(c.first_name || '?')[0]}${(c.last_name || '')[0] || ''}`.toUpperCase()
                                    const hue = name.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360
                                    const stageCls = STAGE_BADGE[c.pipeline_stage] || 'bg-slate-50 text-slate-600 border-slate-200'

                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                            onClick={() => navigate(`/recruitment/candidate/${c.id}`)}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                        style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 52%), hsl(${hue + 25}, 65%, 42%))` }}>
                                                        {initials}
                                                    </div>
                                                    <span className="font-medium text-slate-900">{name || 'Sin nombre'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{c.email || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-[10px] font-medium px-1.5 py-[2px] rounded border bg-slate-50 text-slate-600 border-slate-200">
                                                    {c.source}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-semibold px-2 py-[2px] rounded border ${stageCls}`}>
                                                    {c.pipeline_stage}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{c.city || '—'}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{fmt(c.created_at)}</td>
                                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => navigate(`/recruitment/candidate/${c.id}`)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Ver">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(c.id, name)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Eliminar">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* New Candidate Modal */}
            <AnimatePresence>
                {showNewModal && (
                    <NewCandidateModal
                        onClose={() => setShowNewModal(false)}
                        onSave={handleCreateCandidate}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── New Candidate Modal ──────────────────────────────────────────────────────

function NewCandidateModal({ onClose, onSave }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        first_name: '', last_name: '', email: '', phone: '', whatsapp: '',
        city: '', rut: '', age: '', job_title: '', source: 'Manual',
        pipeline_stage: 'Nuevo', linkedin_url: '', notes: '',
    })

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.first_name.trim()) { toast.error('El nombre es obligatorio'); return }
        if (!form.last_name.trim()) { toast.error('El apellido es obligatorio'); return }
        setSaving(true)
        await onSave({
            ...form,
            age: form.age ? parseInt(form.age) : null,
        })
        setSaving(false)
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-[#003DA5] rounded-lg">
                            <UserPlus className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm">Nuevo Candidato</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200/50"><X className="w-4 h-4 text-slate-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
                    {/* Row 1: Name */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Nombre *</label>
                            <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Juan" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Apellido *</label>
                            <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Pérez" />
                        </div>
                    </div>

                    {/* Row 2: Contact */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Email</label>
                            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="email@ejemplo.cl" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">WhatsApp</label>
                            <input type="text" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="+56 9 1234 5678" />
                        </div>
                    </div>

                    {/* Row 3: Source + Stage */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Fuente</label>
                            <select value={form.source} onChange={e => set('source', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none">
                                {CANDIDATE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Estado inicial</label>
                            <select value={form.pipeline_stage} onChange={e => set('pipeline_stage', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary outline-none">
                                {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Row 4: City + RUT + Age */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Ciudad</label>
                            <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Santiago" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">RUT</label>
                            <input type="text" value={form.rut} onChange={e => set('rut', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="12.345.678-9" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Edad</label>
                            <input type="number" value={form.age} onChange={e => set('age', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="30" />
                        </div>
                    </div>

                    {/* Row 5: Job + LinkedIn */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Cargo actual</label>
                            <input type="text" value={form.job_title} onChange={e => set('job_title', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Agente inmobiliario" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">LinkedIn</label>
                            <input type="text" value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)}
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none"
                                placeholder="https://linkedin.com/in/..." />
                        </div>
                    </div>

                    {/* Row 6: Notes */}
                    <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Notas</label>
                        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                            placeholder="Notas sobre el candidato..." />
                    </div>
                </form>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100">
                        Cancelar
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-5 py-2 rounded-xl bg-[#003DA5] hover:bg-[#002D7A] text-white text-sm font-semibold shadow-lg shadow-blue-900/25 disabled:opacity-50 transition-all">
                        <Save className="w-3.5 h-3.5 inline mr-1" />
                        {saving ? 'Guardando...' : 'Crear Candidato'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}
