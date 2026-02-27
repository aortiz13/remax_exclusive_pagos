import { useState, useEffect, useCallback } from 'react'
import { supabase, getCustomPublicUrl } from '../services/supabase'
import { getTargetsGrouped, getTargetByKey, getAllTargets } from '../services/tutorialTargets'
import { generateTutorialAudio, generateRemotionProps, publishToAulaVirtual, deleteTutorial } from '../services/tutorialPipeline'
import { generateAutoScript } from '../services/autoScriptGenerator'
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui'
import { toast } from 'sonner'
import {
    Loader2, Plus, Trash2, Video, Play, Upload, ChevronDown, ChevronRight,
    FileText, Wand2, Eye, GripVertical, Clock, BookOpen, Check, AlertCircle,
    Download, Sparkles, X, Search, Film, Mic, Settings2, Zap, RotateCcw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'

const STATUS_CONFIG = {
    draft: { label: 'Borrador', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: FileText },
    generating_audio: { label: 'Generando Audio', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Mic },
    rendering: { label: 'Renderizando', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Film },
    completed: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Check },
    error: { label: 'Error', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
}

function StatusBadge({ status }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
    const Icon = config.icon
    return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', config.color)}>
            <Icon className="w-3 h-3" />
            {config.label}
        </span>
    )
}

// ─── Target Selector ─────────────────────────────────────────────────────────

function TargetSelector({ value, onChange }) {
    const [search, setSearch] = useState('')
    const [expandedGroups, setExpandedGroups] = useState({})
    const groups = getTargetsGrouped()

    const toggleGroup = (type) => {
        setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] }))
    }

    const filteredGroups = groups.map(group => ({
        ...group,
        items: group.items.filter(item =>
            item.label.toLowerCase().includes(search.toLowerCase()) ||
            item.description?.toLowerCase().includes(search.toLowerCase())
        )
    })).filter(group => group.items.length > 0)

    const selected = value ? getTargetByKey(value) : null

    return (
        <div className="space-y-3">
            <Label className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Sección / Módulo / Modal del Tutorial
            </Label>

            {selected && (
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{selected.label}</p>
                        <p className="text-xs text-slate-500">{selected.description}</p>
                    </div>
                    <button onClick={() => onChange('')} className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Buscar sección, modal, formulario..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredGroups.map(group => (
                    <div key={group.type}>
                        <button
                            onClick={() => toggleGroup(group.type)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            {expandedGroups[group.type] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{group.label}</span>
                            <span className="ml-auto text-xs text-slate-400">{group.items.length}</span>
                        </button>
                        <AnimatePresence>
                            {expandedGroups[group.type] && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    {group.items.map(item => (
                                        <button
                                            key={item.key}
                                            onClick={() => { onChange(item.key); setSearch('') }}
                                            className={cn(
                                                'w-full text-left px-6 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors',
                                                value === item.key && 'bg-primary/10 border-l-2 border-primary'
                                            )}
                                        >
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
                                            <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Segment Editor ──────────────────────────────────────────────────────────

function SegmentEditor({ segments, onChange }) {
    const addSegment = () => {
        const newOrder = segments.length + 1
        onChange([...segments, {
            id: crypto.randomUUID(),
            segment_order: newOrder,
            label: `Segmento ${newOrder}`,
            narration_text: '',
            start_time: 0,
            end_time: null,
            isNew: true
        }])
    }

    const updateSegment = (index, field, value) => {
        const updated = [...segments]
        updated[index] = { ...updated[index], [field]: value }
        onChange(updated)
    }

    const removeSegment = (index) => {
        const updated = segments.filter((_, i) => i !== index)
            .map((s, i) => ({ ...s, segment_order: i + 1 }))
        onChange(updated)
    }

    const totalChars = segments.reduce((acc, s) => acc + (s.narration_text?.length || 0), 0)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Segmentos de Narración
                </Label>
                <span className="text-xs text-slate-400">
                    {totalChars.toLocaleString()} caracteres (~{Math.ceil(totalChars / 150)} seg de audio)
                </span>
            </div>

            <div className="space-y-3">
                {segments.map((segment, i) => (
                    <motion.div
                        key={segment.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 group"
                    >
                        <div className="flex items-center gap-3">
                            <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                #{segment.segment_order}
                            </span>
                            <Input
                                value={segment.label}
                                onChange={e => updateSegment(i, 'label', e.target.value)}
                                className="flex-1 h-8 text-sm font-medium"
                                placeholder="Nombre del segmento"
                            />
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Clock className="w-3 h-3" />
                                <Input
                                    type="number"
                                    value={segment.start_time || 0}
                                    onChange={e => updateSegment(i, 'start_time', parseFloat(e.target.value) || 0)}
                                    className="w-16 h-8 text-xs text-center"
                                    placeholder="0"
                                    step="0.5"
                                    min="0"
                                />
                                <span>→</span>
                                <Input
                                    type="number"
                                    value={segment.end_time || ''}
                                    onChange={e => updateSegment(i, 'end_time', parseFloat(e.target.value) || null)}
                                    className="w-16 h-8 text-xs text-center"
                                    placeholder="∞"
                                    step="0.5"
                                    min="0"
                                />
                                <span>seg</span>
                            </div>
                            <button
                                onClick={() => removeSegment(i)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <textarea
                            value={segment.narration_text}
                            onChange={e => updateSegment(i, 'narration_text', e.target.value)}
                            placeholder="Escribe aquí el texto de narración para este segmento... Ejemplo: 'En esta sección vamos a ver cómo crear una nueva acción comercial en el CRM. Hacemos clic en el botón Agregar Acción...'"
                            className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm resize-y focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                            rows={3}
                        />

                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{segment.narration_text?.length || 0} caracteres</span>
                            {segment.audio_url && (
                                <span className="flex items-center gap-1 text-emerald-500">
                                    <Check className="w-3 h-3" /> Audio generado
                                </span>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            <Button variant="outline" onClick={addSegment} className="w-full border-dashed">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Segmento
            </Button>
        </div>
    )
}

// ─── Create / Edit Tutorial Form ─────────────────────────────────────────────

function TutorialForm({ tutorial, onSave, onCancel }) {
    const { profile } = useAuth()
    const [title, setTitle] = useState(tutorial?.title || '')
    const [description, setDescription] = useState(tutorial?.description || '')
    const [targetKey, setTargetKey] = useState(tutorial?.target_key || '')
    const [segments, setSegments] = useState(tutorial?.segments || [])
    const [recordingFile, setRecordingFile] = useState(null)
    const [saving, setSaving] = useState(false)

    const target = targetKey ? getTargetByKey(targetKey) : null

    // Auto-fill title, description, and segments when target changes
    const handleTargetChange = (newKey) => {
        setTargetKey(newKey)
        if (newKey && !tutorial?.id) {
            const t = getTargetByKey(newKey)
            const autoScript = generateAutoScript(newKey)
            if (t) {
                setTitle(`Cómo usar: ${t.label}`)
                setDescription(t.description || '')
            }
            if (autoScript?.segments?.length) {
                setSegments(autoScript.segments.map((s, i) => ({
                    id: crypto.randomUUID(),
                    segment_order: i + 1,
                    ...s,
                    isNew: true
                })))
            }
        }
    }

    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (file) setRecordingFile(file)
    }

    const handleSave = async () => {
        if (!title.trim()) return toast.error('Ingresa un título')
        if (!targetKey) return toast.error('Selecciona una sección/módulo')
        if (segments.length === 0) return toast.error('Agrega al menos un segmento')
        if (segments.some(s => !s.narration_text.trim())) return toast.error('Todos los segmentos necesitan texto de narración')

        setSaving(true)
        try {
            let recordingUrl = tutorial?.recording_url || null

            // Upload recording if provided
            if (recordingFile) {
                const ext = recordingFile.name.split('.').pop()
                const path = `tutorials/recordings/${crypto.randomUUID()}.${ext}`
                const { error: upError } = await supabase.storage
                    .from('tutorial-assets')
                    .upload(path, recordingFile, { upsert: true })
                if (upError) throw upError
                recordingUrl = getCustomPublicUrl('tutorial-assets', path)
            }

            if (tutorial?.id) {
                // Update existing
                const { error } = await supabase
                    .from('video_tutorials')
                    .update({
                        title, description, target_key: targetKey,
                        target_type: target?.type || 'page',
                        target_label: target?.label || targetKey,
                        recording_url: recordingUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', tutorial.id)
                if (error) throw error

                // Upsert segments
                // Delete removed segments
                const existingIds = segments.filter(s => !s.isNew).map(s => s.id)
                if (tutorial.segments?.length) {
                    const toDelete = tutorial.segments.filter(s => !existingIds.includes(s.id)).map(s => s.id)
                    if (toDelete.length) {
                        await supabase.from('tutorial_segments').delete().in('id', toDelete)
                    }
                }

                // Insert/update segments
                for (const seg of segments) {
                    const segData = {
                        tutorial_id: tutorial.id,
                        segment_order: seg.segment_order,
                        label: seg.label,
                        narration_text: seg.narration_text,
                        start_time: seg.start_time || 0,
                        end_time: seg.end_time
                    }

                    if (seg.isNew) {
                        await supabase.from('tutorial_segments').insert(segData)
                    } else {
                        await supabase.from('tutorial_segments').update(segData).eq('id', seg.id)
                    }
                }
            } else {
                // Create new tutorial
                const { data: newTutorial, error } = await supabase
                    .from('video_tutorials')
                    .insert({
                        title, description, target_key: targetKey,
                        target_type: target?.type || 'page',
                        target_label: target?.label || targetKey,
                        recording_url: recordingUrl,
                        created_by: profile?.id,
                        status: 'draft'
                    })
                    .select()
                    .single()
                if (error) throw error

                // Insert segments
                if (segments.length) {
                    const segData = segments.map(seg => ({
                        tutorial_id: newTutorial.id,
                        segment_order: seg.segment_order,
                        label: seg.label,
                        narration_text: seg.narration_text,
                        start_time: seg.start_time || 0,
                        end_time: seg.end_time
                    }))
                    const { error: segError } = await supabase.from('tutorial_segments').insert(segData)
                    if (segError) throw segError
                }
            }

            toast.success(tutorial?.id ? 'Tutorial actualizado' : 'Tutorial creado')
            onSave()
        } catch (err) {
            console.error('Save error:', err)
            toast.error('Error al guardar: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Sparkles className="w-5 h-5 text-primary" />
                    {tutorial?.id ? 'Editar Tutorial' : 'Nuevo Tutorial'}
                </h2>
                <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel: Metadata */}
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label>Título del Tutorial</Label>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ej: Cómo registrar una nueva acción en el CRM"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Descripción</Label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Breve descripción del contenido del tutorial..."
                            className="w-full min-h-[60px] p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm resize-y focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                            rows={2}
                        />
                    </div>

                    <TargetSelector value={targetKey} onChange={handleTargetChange} />

                    {/* Auto-fill hint */}
                    {!tutorial?.id && targetKey && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <Zap className="w-4 h-4 text-emerald-500" />
                            <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                <strong>Guión auto-generado.</strong> Título, descripción y segmentos de narración se rellenaron automáticamente. Puedes editarlos antes de guardar.
                            </p>
                            <button onClick={() => handleTargetChange(targetKey)} className="text-xs text-emerald-600 hover:underline flex items-center gap-1 shrink-0">
                                <RotateCcw className="w-3 h-3" /> Regenerar
                            </button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Upload className="w-4 h-4 text-primary" />
                            Grabación de Pantalla
                        </Label>
                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:border-primary/50 transition-colors">
                            {tutorial?.recording_url && !recordingFile ? (
                                <div className="space-y-2">
                                    <p className="text-sm text-emerald-600 font-medium flex items-center justify-center gap-2">
                                        <Check className="w-4 h-4" /> Grabación subida
                                    </p>
                                    <video src={tutorial.recording_url} controls className="w-full max-h-40 rounded-lg mx-auto" />
                                </div>
                            ) : recordingFile ? (
                                <div className="space-y-2">
                                    <p className="text-sm text-emerald-600 font-medium flex items-center justify-center gap-2">
                                        <Check className="w-4 h-4" /> {recordingFile.name}
                                    </p>
                                    <p className="text-xs text-slate-400">{(recordingFile.size / 1024 / 1024).toFixed(1)} MB</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Video className="w-8 h-8 mx-auto text-slate-300" />
                                    <p className="text-sm text-slate-500">Arrastra o selecciona un video (.webp, .mp4)</p>
                                </div>
                            )}
                            <input
                                type="file"
                                accept=".webp,.mp4,.webm,.mov"
                                onChange={handleFileChange}
                                className="mt-2 text-xs w-full file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Panel: Segments */}
                <div>
                    <SegmentEditor segments={segments} onChange={setSegments} />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                    {tutorial?.id ? 'Actualizar' : 'Crear Tutorial'}
                </Button>
            </div>
        </div>
    )
}

// ─── Auto Generate Button ────────────────────────────────────────────────────

function AutoGenerateButton({ onCreated }) {
    const { profile } = useAuth()
    const [open, setOpen] = useState(false)
    const [selectedTarget, setSelectedTarget] = useState('')
    const [creating, setCreating] = useState(false)
    const groups = getTargetsGrouped()

    const handleAutoGenerate = async () => {
        if (!selectedTarget) return toast.error('Selecciona una sección')
        setCreating(true)
        const toastId = toast.loading('Generando tutorial automático...')

        try {
            const target = getTargetByKey(selectedTarget)
            const autoScript = generateAutoScript(selectedTarget)

            // 1. Create tutorial
            const { data: tutorial, error } = await supabase
                .from('video_tutorials')
                .insert({
                    title: `Cómo usar: ${target.label}`,
                    description: target.description,
                    target_key: selectedTarget,
                    target_type: target.type,
                    target_label: target.label,
                    created_by: profile?.id,
                    status: 'draft'
                })
                .select()
                .single()
            if (error) throw error

            // 2. Insert auto-generated segments
            if (autoScript?.segments?.length) {
                const segData = autoScript.segments.map((s, i) => ({
                    tutorial_id: tutorial.id,
                    segment_order: i + 1,
                    label: s.label,
                    narration_text: s.narration_text,
                    start_time: s.start_time || 0,
                    end_time: s.end_time
                }))
                const { error: segError } = await supabase.from('tutorial_segments').insert(segData)
                if (segError) throw segError
            }

            toast.success(
                `Tutorial "${target.label}" creado con ${autoScript?.segments?.length || 0} segmentos. Usa /generate-tutorial para grabar y generar el video completo.`,
                { id: toastId, duration: 6000 }
            )

            setOpen(false)
            setSelectedTarget('')
            onCreated()
        } catch (err) {
            toast.error('Error: ' + err.message, { id: toastId })
        } finally {
            setCreating(false)
        }
    }

    if (!open) {
        return (
            <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25">
                <Zap className="w-4 h-4 mr-2" />
                Generar Automático
            </Button>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        <Zap className="w-5 h-5 text-blue-500" />
                        Generación Automática
                    </h3>
                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <p className="text-sm text-slate-500">
                    Selecciona una sección y el sistema generará automáticamente el guión de narración, la grabación de pantalla y el audio TTS.
                </p>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                    {groups.map(group => (
                        <div key={group.type}>
                            <p className="text-xs font-bold uppercase text-slate-400 mb-1">{group.label}</p>
                            <div className="grid grid-cols-1 gap-1">
                                {group.items.map(item => (
                                    <button
                                        key={item.key}
                                        onClick={() => setSelectedTarget(item.key)}
                                        className={cn(
                                            'text-left px-3 py-2 rounded-lg text-sm transition-colors',
                                            selectedTarget === item.key
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                                        )}
                                    >
                                        <span className="font-medium">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button
                        onClick={handleAutoGenerate}
                        disabled={!selectedTarget || creating}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                        Generar Tutorial
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminVideoGenerator() {
    const [tutorials, setTutorials] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingTutorial, setEditingTutorial] = useState(null) // null = list, {} = new, {id:...} = edit
    const [generating, setGenerating] = useState(null) // tutorial id being generated
    const [confirmAction, setConfirmAction] = useState(null) // { type: 'publish'|'delete', tutorial }

    const fetchTutorials = useCallback(async () => {
        const { data, error } = await supabase
            .from('video_tutorials')
            .select('*')
            .order('created_at', { ascending: false })
        if (!error) setTutorials(data || [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchTutorials() }, [fetchTutorials])

    const handleEdit = async (tutorial) => {
        // Fetch segments for editing
        const { data: segments } = await supabase
            .from('tutorial_segments')
            .select('*')
            .eq('tutorial_id', tutorial.id)
            .order('segment_order', { ascending: true })
        setEditingTutorial({ ...tutorial, segments: segments || [] })
    }

    const handleGenerateAudio = async (tutorial) => {
        setGenerating(tutorial.id)
        const toastId = toast.loading('Generando audio con Google Cloud TTS...')
        try {
            const result = await generateTutorialAudio(tutorial.id)
            toast.success(`Audio generado: ${result.segmentsProcessed} segmentos procesados`, { id: toastId })
            fetchTutorials()
        } catch (err) {
            toast.error('Error: ' + err.message, { id: toastId })
        } finally {
            setGenerating(null)
        }
    }

    const handlePublish = async (tutorial) => {
        try {
            await publishToAulaVirtual(tutorial.id)
            toast.success('Tutorial publicado en Aula Virtual')
        } catch (err) {
            toast.error('Error: ' + err.message)
        }
    }

    const handleDelete = async (tutorial) => {
        try {
            await deleteTutorial(tutorial.id)
            toast.success('Tutorial eliminado')
            fetchTutorials()
        } catch (err) {
            toast.error('Error: ' + err.message)
        }
    }

    const handleConfirmAction = async () => {
        if (!confirmAction) return
        const { type, tutorial } = confirmAction
        setConfirmAction(null)
        if (type === 'publish') {
            await handlePublish(tutorial)
        } else if (type === 'delete') {
            await handleDelete(tutorial)
        }
    }

    const handleDownloadProps = async (tutorial) => {
        try {
            const props = await generateRemotionProps(tutorial.id)
            const blob = new Blob([JSON.stringify(props, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `remotion-props-${tutorial.id.slice(0, 8)}.json`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('Props de Remotion descargados')
        } catch (err) {
            toast.error('Error: ' + err.message)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )

    // ── Edit / Create Mode ──
    if (editingTutorial !== null) {
        return (
            <div className="space-y-6 pb-20">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Video Tutoriales
                    </h1>
                    <p className="text-slate-500">Generación automática de tutoriales narrados.</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border shadow-sm">
                    <TutorialForm
                        tutorial={editingTutorial.id ? editingTutorial : undefined}
                        onSave={() => { setEditingTutorial(null); fetchTutorials() }}
                        onCancel={() => setEditingTutorial(null)}
                    />
                </div>
            </div>
        )
    }

    // ── List Mode ──
    return (
        <div className="space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Video Tutoriales
                    </h1>
                    <p className="text-slate-500">Genera tutoriales narrados con IA para cada sección del CRM.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setEditingTutorial({})}>
                        <Plus className="w-4 h-4 mr-2" />
                        Manual
                    </Button>
                    <AutoGenerateButton onCreated={fetchTutorials} />
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-5 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                        <Wand2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Pipeline de Generación 100% Automático</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            <strong>⚡ Generar Automático:</strong> selecciona la sección → el sistema crea el guión y segmentos automáticamente.
                            Luego usa <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded text-xs">/generate-tutorial</code> para
                            que yo grabe la pantalla, genere el audio TTS y renderice el video final.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tutorial List */}
            {tutorials.length === 0 ? (
                <div className="text-center py-16">
                    <Film className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-700 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">No hay tutoriales</h3>
                    <p className="text-sm text-slate-400 mb-4">Crea tu primer tutorial seleccionando una sección del CRM.</p>
                    <Button onClick={() => setEditingTutorial({})}>
                        <Plus className="w-4 h-4 mr-2" /> Crear Tutorial
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {tutorials.map(tutorial => (
                        <motion.div
                            key={tutorial.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group hover:shadow-lg transition-shadow"
                        >
                            {/* Thumbnail / Preview */}
                            <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                                {tutorial.thumbnail_url ? (
                                    <img src={tutorial.thumbnail_url} alt={tutorial.title} className="w-full h-full object-cover" />
                                ) : tutorial.recording_url ? (
                                    <video src={tutorial.recording_url} className="w-full h-full object-cover" />
                                ) : (
                                    <Film className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                                )}
                                <div className="absolute top-3 right-3">
                                    <StatusBadge status={tutorial.status} />
                                </div>
                                {tutorial.output_video_url && (
                                    <a
                                        href={tutorial.output_video_url}
                                        target="_blank"
                                        rel="noopener"
                                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Play className="w-12 h-12 text-white drop-shadow-lg" />
                                    </a>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-3">
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-1">{tutorial.title}</h3>
                                    <p className="text-xs text-primary font-medium">{tutorial.target_label || tutorial.target_key}</p>
                                    {tutorial.description && (
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tutorial.description}</p>
                                    )}
                                </div>

                                {tutorial.error_message && (
                                    <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">{tutorial.error_message}</p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        onClick={() => handleEdit(tutorial)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                    >
                                        <Eye className="w-3.5 h-3.5" /> Editar
                                    </button>

                                    {tutorial.status === 'draft' && (
                                        <button
                                            onClick={() => handleGenerateAudio(tutorial)}
                                            disabled={generating === tutorial.id}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {generating === tutorial.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Mic className="w-3.5 h-3.5" />}
                                            Generar Audio
                                        </button>
                                    )}

                                    {(tutorial.status === 'rendering' || tutorial.status === 'completed') && (
                                        <button
                                            onClick={() => handleDownloadProps(tutorial)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Props Remotion
                                        </button>
                                    )}

                                    {tutorial.status === 'completed' && (
                                        <button
                                            onClick={() => setConfirmAction({ type: 'publish', tutorial })}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                        >
                                            <BookOpen className="w-3.5 h-3.5" /> Publicar
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setConfirmAction({ type: 'delete', tutorial })}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-auto"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ── Confirmation Modal ── */}
            <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmAction?.type === 'delete' ? '¿Estás seguro?' : '¿Publicar tutorial?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmAction?.type === 'delete'
                                ? `Esta acción eliminará "${confirmAction?.tutorial?.title}" permanentemente.`
                                : `Esta acción publicará "${confirmAction?.tutorial?.title}" en el Aula Virtual.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAction}
                            className={confirmAction?.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                            {confirmAction?.type === 'delete' ? 'Eliminar' : 'Publicar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
