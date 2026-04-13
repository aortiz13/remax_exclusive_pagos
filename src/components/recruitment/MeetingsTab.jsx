import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    fetchMeetingsByCandidate, extractFormFromMeeting, applyFormToCandidate
} from '../../services/meetingService'
import {
    Video, Play, Pause, Clock, Mic, FileText, ChevronDown, ChevronUp,
    Sparkles, CheckCircle2, AlertCircle, User, Briefcase, Calendar,
    Loader2, Download, Volume2, XCircle, RotateCcw
} from 'lucide-react'
import MeetingBotPanel from './MeetingBotPanel'

const PLATFORM_LABELS = {
    google_meet: 'Google Meet',
    zoom: 'Zoom',
    teams: 'Microsoft Teams',
    other: 'Otra plataforma',
}

export default function MeetingsTab({ candidateId, onCandidateUpdated }) {
    const [meetings, setMeetings] = useState([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState(null)

    useEffect(() => { loadMeetings() }, [candidateId])

    const loadMeetings = async () => {
        setLoading(true)
        try {
            const data = await fetchMeetingsByCandidate(candidateId)
            setMeetings(data)
        } catch (err) {
            console.error('Error loading meetings:', err)
            toast.error('Error al cargar reuniones')
        }
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
            </div>
        )
    }

    if (meetings.length === 0) {
        return (
            <div className="space-y-6">
                <MeetingBotPanel candidateId={candidateId} onMeetingCompleted={loadMeetings} />
                <div className="text-center py-12">
                    <Video className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">Sin reuniones grabadas</p>
                    <p className="text-xs text-slate-300 mt-1">
                        Envía el bot a una reunión o usa la extensión de Chrome para grabar
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <MeetingBotPanel candidateId={candidateId} onMeetingCompleted={loadMeetings} />

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-medium">
                        {meetings.length} reunión{meetings.length !== 1 ? 'es' : ''} grabada{meetings.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {meetings.map(meeting => (
                    <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        isExpanded={expandedId === meeting.id}
                        onToggle={() => setExpandedId(expandedId === meeting.id ? null : meeting.id)}
                        onMeetingUpdated={loadMeetings}
                        onCandidateUpdated={onCandidateUpdated}
                    />
                ))}
            </div>
        </div>
    )
}

function MeetingCard({ meeting, isExpanded, onToggle, onMeetingUpdated, onCandidateUpdated }) {
    const [extracting, setExtracting] = useState(false)
    const [applying, setApplying] = useState(false)
    const [editForm, setEditForm] = useState(null)
    const [activeSubTab, setActiveSubTab] = useState('transcript')

    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CL', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—'

    const formatDuration = (secs) => {
        if (!secs) return '—'
        const mins = Math.floor(secs / 60)
        const s = secs % 60
        return `${mins}:${String(s).padStart(2, '0')}`
    }

    const handleExtract = async () => {
        setExtracting(true)
        try {
            const result = await extractFormFromMeeting(meeting.id)
            setEditForm(result.extracted_form)
            setActiveSubTab('form')
            toast.success('Formulario extraído exitosamente')
            onMeetingUpdated()
        } catch (err) {
            console.error(err)
            toast.error('Error al extraer formulario: ' + err.message)
        }
        setExtracting(false)
    }

    const handleApply = async () => {
        setApplying(true)
        try {
            const overrides = editForm || {}
            await applyFormToCandidate(meeting.id, overrides)
            toast.success('Datos aplicados al perfil del candidato')
            onMeetingUpdated()
            if (onCandidateUpdated) onCandidateUpdated()
        } catch (err) {
            console.error(err)
            toast.error('Error al aplicar formulario')
        }
        setApplying(false)
    }

    // Init editForm from meeting data if available
    useEffect(() => {
        if (meeting.extracted_form && !editForm) {
            setEditForm(meeting.extracted_form)
        }
    }, [meeting.extracted_form])

    const hasForm = meeting.extracted_form || editForm
    const formApplied = meeting.form_applied

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-slate-50/80 transition-colors"
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    formApplied
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'bg-blue-50 border border-blue-200'
                }`}>
                    {formApplied
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        : <Video className="w-5 h-5 text-[#003DA5]" />
                    }
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">
                            Reunión · {PLATFORM_LABELS[meeting.meeting_platform] || 'Video'}
                        </span>
                        {formApplied && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                                DATOS APLICADOS
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmt(meeting.created_at)}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(meeting.recording_duration_seconds)}
                        </span>
                        {meeting.recorder_name && (
                            <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {meeting.recorder_name}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-slate-300 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                }
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-slate-100">
                            {/* Sub-tabs */}
                            <div className="flex border-b border-slate-100 px-3">
                                {[
                                    { id: 'transcript', label: 'Transcripción', icon: FileText },
                                    { id: 'audio', label: 'Audio', icon: Volume2 },
                                    { id: 'form', label: 'Formulario IA', icon: Sparkles, badge: hasForm },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveSubTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                                            activeSubTab === tab.id
                                                ? 'border-[#003DA5] text-[#003DA5]'
                                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <tab.icon className="w-3.5 h-3.5" />
                                        {tab.label}
                                        {tab.badge && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="p-4">
                                {activeSubTab === 'transcript' && (
                                    <TranscriptView
                                        transcript={meeting.transcript_text}
                                        segments={meeting.transcript_json}
                                    />
                                )}
                                {activeSubTab === 'audio' && (
                                    <AudioPlayer url={meeting.recording_url} />
                                )}
                                {activeSubTab === 'form' && (
                                    <FormExtraction
                                        form={editForm}
                                        formApplied={formApplied}
                                        extracting={extracting}
                                        applying={applying}
                                        onExtract={handleExtract}
                                        onApply={handleApply}
                                        onEditForm={setEditForm}
                                    />
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Transcript Viewer ────────────────────────────────────────────
function TranscriptView({ transcript, segments }) {
    if (!transcript || transcript.startsWith('[Error')) {
        return (
            <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                    {transcript || 'Transcripción no disponible'}
                </p>
            </div>
        )
    }

    // If we have segments with timestamps, show them
    const segs = Array.isArray(segments) ? segments : null

    return (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {segs && segs.length > 0 ? (
                segs.map((seg, i) => {
                    const start = seg.start ? formatTime(seg.start) : ''
                    return (
                        <div key={i} className="flex gap-2 group">
                            {start && (
                                <span className="text-[9px] font-mono text-slate-300 pt-1 w-10 shrink-0 text-right">
                                    {start}
                                </span>
                            )}
                            <p className="text-sm text-slate-600 leading-relaxed flex-1">
                                {seg.text}
                            </p>
                        </div>
                    )
                })
            ) : (
                <div className="prose prose-sm max-w-none">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {transcript}
                    </p>
                </div>
            )}
        </div>
    )
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Audio Player ──────────────────────────────────────────────────
function AudioPlayer({ url }) {
    const audioRef = useRef(null)
    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [speed, setSpeed] = useState(1)

    if (!url) {
        return (
            <div className="text-center py-6">
                <Volume2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Audio no disponible</p>
            </div>
        )
    }

    const togglePlay = () => {
        if (!audioRef.current) return
        if (playing) {
            audioRef.current.pause()
        } else {
            audioRef.current.play()
        }
        setPlaying(!playing)
    }

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
    }

    const handleLoaded = () => {
        if (audioRef.current) setDuration(audioRef.current.duration)
    }

    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const ratio = (e.clientX - rect.left) / rect.width
        if (audioRef.current) {
            audioRef.current.currentTime = ratio * duration
        }
    }

    const changeSpeed = () => {
        const speeds = [0.75, 1, 1.25, 1.5, 2]
        const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length]
        setSpeed(next)
        if (audioRef.current) audioRef.current.playbackRate = next
    }

    const progress = duration ? (currentTime / duration) * 100 : 0

    return (
        <div className="space-y-3">
            <audio
                ref={audioRef}
                src={url}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoaded}
                onEnded={() => setPlaying(false)}
                preload="metadata"
            />

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-[#003DA5] text-white flex items-center justify-center hover:bg-[#002D7A] transition-colors shrink-0"
                >
                    {playing
                        ? <Pause className="w-4 h-4" />
                        : <Play className="w-4 h-4 ml-0.5" />
                    }
                </button>

                <div className="flex-1 space-y-1">
                    {/* Progress bar */}
                    <div
                        className="h-1.5 bg-slate-200 rounded-full cursor-pointer"
                        onClick={handleSeek}
                    >
                        <div
                            className="h-full bg-[#003DA5] rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                <button
                    onClick={changeSpeed}
                    className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
                >
                    {speed}x
                </button>
            </div>

            {/* Download link */}
            <a
                href={url}
                download
                className="flex items-center gap-1.5 text-xs text-[#003DA5] hover:underline font-medium"
            >
                <Download className="w-3 h-3" />
                Descargar grabación
            </a>
        </div>
    )
}

// ─── Form Extraction ──────────────────────────────────────────────
function FormExtraction({ form, formApplied, extracting, applying, onExtract, onApply, onEditForm }) {
    if (!form && !extracting) {
        return (
            <div className="text-center py-6 space-y-3">
                <Sparkles className="w-10 h-10 text-slate-200 mx-auto" />
                <div>
                    <p className="text-sm text-slate-500 font-medium">
                        Extracción automática con IA
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        GPT-4o analizará la transcripción y extraerá los datos del candidato
                    </p>
                </div>
                <button
                    onClick={onExtract}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all shadow-md"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    Extraer datos con IA
                </button>
            </div>
        )
    }

    if (extracting) {
        return (
            <div className="text-center py-8 space-y-3">
                <div className="relative mx-auto w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-violet-500 animate-spin" />
                    <Sparkles className="w-5 h-5 text-violet-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Analizando transcripción...</p>
                <p className="text-xs text-slate-400">GPT-4o está extrayendo los datos del candidato</p>
            </div>
        )
    }

    const updateField = (key, value) => {
        onEditForm({ ...form, [key]: value })
    }

    const FIELD_CONFIG = [
        { key: 'first_name', label: 'Nombre', icon: User, type: 'text' },
        { key: 'last_name', label: 'Apellido', icon: User, type: 'text' },
        { key: 'age', label: 'Edad', icon: Calendar, type: 'number' },
        { key: 'current_occupation', label: 'Ocupación actual', icon: Briefcase, type: 'text' },
    ]

    return (
        <div className="space-y-4">
            {/* Form fields */}
            <div className="space-y-3">
                {FIELD_CONFIG.map(field => (
                    <div key={field.key} className="flex items-center gap-2">
                        <field.icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <label className="text-xs text-slate-500 font-medium w-24 shrink-0">
                            {field.label}
                        </label>
                        <input
                            type={field.type}
                            value={form[field.key] ?? ''}
                            onChange={(e) => updateField(field.key, e.target.value)}
                            disabled={formApplied}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 
                                     focus:ring-2 focus:ring-violet-200 focus:border-violet-300 outline-none
                                     disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                            placeholder="No detectado"
                        />
                    </div>
                ))}

                {/* Full-time toggle */}
                <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                    <label className="text-xs text-slate-500 font-medium w-24 shrink-0">Full-time</label>
                    <div className="flex items-center gap-2">
                        {[
                            { value: true, label: 'Sí', color: 'emerald' },
                            { value: false, label: 'No', color: 'red' },
                            { value: null, label: 'N/A', color: 'slate' },
                        ].map(opt => (
                            <button
                                key={String(opt.value)}
                                onClick={() => !formApplied && updateField('is_available_full_time', opt.value)}
                                disabled={formApplied}
                                className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                                    form.is_available_full_time === opt.value
                                        ? opt.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : opt.color === 'red' ? 'bg-red-50 text-red-600 border-red-300'
                                        : 'bg-slate-100 text-slate-600 border-slate-300'
                                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Confidence notes */}
            {form.confidence_notes && (
                <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                    <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-1">
                        Notas del análisis IA
                    </p>
                    <p className="text-xs text-violet-700 leading-relaxed">{form.confidence_notes}</p>
                </div>
            )}

            {/* Additional insights */}
            {form.additional_insights && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">
                        Datos adicionales detectados
                    </p>
                    <p className="text-xs text-amber-700 leading-relaxed">{form.additional_insights}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                {formApplied ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-semibold">Datos aplicados al perfil</span>
                        {meeting?.form_applied_at && (
                            <span className="text-[10px] text-slate-400 ml-2">
                                {new Date(meeting.form_applied_at).toLocaleDateString('es-CL')}
                            </span>
                        )}
                    </div>
                ) : (
                    <>
                        <button
                            onClick={onExtract}
                            disabled={extracting}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Re-analizar
                        </button>
                        <button
                            onClick={onApply}
                            disabled={applying}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#003DA5] rounded-lg hover:bg-[#002D7A] transition-all disabled:opacity-50 ml-auto shadow-sm"
                        >
                            {applying ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            {applying ? 'Aplicando...' : 'Aplicar al perfil'}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
