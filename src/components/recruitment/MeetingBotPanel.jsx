import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
    sendBotToMeeting, fetchBotSessions, fetchBotSessionStatus, cancelBotSession
} from '../../services/meetingBotService'
import {
    Bot, Link2, Send, Loader2, CheckCircle2, XCircle, Clock, Video,
    AlertCircle, StopCircle, Eye, Radio, ExternalLink, Sparkles
} from 'lucide-react'

const PLATFORM_CONFIG = {
    google_meet: {
        label: 'Google Meet',
        color: 'emerald',
        icon: '🟢',
        bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    zoom: {
        label: 'Zoom',
        color: 'blue',
        icon: '🔵',
        bgClass: 'bg-blue-50 border-blue-200 text-blue-700',
    },
    teams: {
        label: 'Microsoft Teams',
        color: 'violet',
        icon: '🟣',
        bgClass: 'bg-violet-50 border-violet-200 text-violet-700',
    },
}

const STATUS_CONFIG = {
    pending: { label: 'En cola', color: 'slate', icon: Clock, pulse: false },
    joining: { label: 'Uniéndose...', color: 'amber', icon: Loader2, pulse: true },
    in_meeting: { label: 'En reunión', color: 'emerald', icon: Radio, pulse: true },
    recording: { label: 'Grabando', color: 'red', icon: Radio, pulse: true },
    processing: { label: 'Procesando...', color: 'blue', icon: Loader2, pulse: true },
    transcribing: { label: 'Transcribiendo...', color: 'violet', icon: Sparkles, pulse: true },
    extracting: { label: 'Extrayendo datos...', color: 'violet', icon: Sparkles, pulse: true },
    completed: { label: 'Completado', color: 'emerald', icon: CheckCircle2, pulse: false },
    failed: { label: 'Error', color: 'red', icon: XCircle, pulse: false },
    cancelled: { label: 'Cancelado', color: 'slate', icon: XCircle, pulse: false },
}

const ACTIVE_STATUSES = ['pending', 'joining', 'in_meeting', 'recording', 'processing', 'transcribing', 'extracting']

// ─── Platform Detection (client-side, instant) ───────────────────
function detectPlatformFromUrl(url) {
    if (!url) return null
    if (/meet\.google\.com\//i.test(url)) return 'google_meet'
    if (/zoom\.us\//i.test(url) || /app\.zoom\.us/i.test(url)) return 'zoom'
    if (/teams\.microsoft\.com/i.test(url) || /teams\.live\.com/i.test(url)) return 'teams'
    return null
}

export default function MeetingBotPanel({ candidateId, onMeetingCompleted }) {
    const [meetingUrl, setMeetingUrl] = useState('')
    const [detectedPlatform, setDetectedPlatform] = useState(null)
    const [sending, setSending] = useState(false)
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const pollRef = useRef(null)

    // ─── Load sessions on mount ──────────────────────────────────
    useEffect(() => {
        loadSessions()
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [candidateId])

    // ─── Start polling when there are active sessions ────────────
    useEffect(() => {
        const hasActive = sessions.some(s => ACTIVE_STATUSES.includes(s.status))
        if (hasActive && !pollRef.current) {
            pollRef.current = setInterval(pollActiveSessions, 5000)
        } else if (!hasActive && pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
        }
    }, [sessions])

    const loadSessions = async () => {
        try {
            const data = await fetchBotSessions(10)
            // Filter by candidate if provided
            const filtered = candidateId
                ? data.filter(s => s.candidate_id === candidateId || !s.candidate_id)
                : data
            setSessions(filtered)
        } catch (err) {
            console.error('Error loading bot sessions:', err)
        }
        setLoading(false)
    }

    const pollActiveSessions = useCallback(async () => {
        try {
            for (const session of sessions) {
                if (!ACTIVE_STATUSES.includes(session.status)) continue

                const updated = await fetchBotSessionStatus(session.id)
                setSessions(prev => prev.map(s =>
                    s.id === session.id ? { ...s, ...updated } : s
                ))

                // If just completed, reload full sessions and notify
                if (updated.status === 'completed' && session.status !== 'completed') {
                    toast.success('✅ Reunión procesada exitosamente')
                    loadSessions()
                    onMeetingCompleted?.()
                }

                if (updated.status === 'failed' && session.status !== 'failed') {
                    toast.error(`❌ Error: ${updated.error_message || 'Error desconocido'}`)
                    loadSessions()
                }
            }
        } catch (err) {
            console.error('Poll error:', err)
        }
    }, [sessions])

    // ─── Platform detection on URL change ────────────────────────
    useEffect(() => {
        setDetectedPlatform(detectPlatformFromUrl(meetingUrl))
    }, [meetingUrl])

    // ─── Send bot ────────────────────────────────────────────────
    const handleSendBot = async () => {
        if (!meetingUrl.trim()) return toast.error('Pega el link de la reunión')
        if (!detectedPlatform) return toast.error('URL no reconocida. Debe ser Google Meet, Zoom o Teams.')

        setSending(true)
        try {
            const result = await sendBotToMeeting(meetingUrl, candidateId)
            toast.success(result.message || 'Bot enviado exitosamente')
            setMeetingUrl('')
            setDetectedPlatform(null)
            loadSessions()
        } catch (err) {
            toast.error(err.message || 'Error al enviar el bot')
        }
        setSending(false)
    }

    // ─── Cancel session ──────────────────────────────────────────
    const handleCancel = async (sessionId) => {
        try {
            await cancelBotSession(sessionId)
            toast.info('Bot cancelado')
            loadSessions()
        } catch (err) {
            toast.error(err.message || 'No se pudo cancelar')
        }
    }

    const platformConfig = detectedPlatform ? PLATFORM_CONFIG[detectedPlatform] : null

    return (
        <div className="space-y-4">
            {/* ─── Send Bot Form ─────────────────────────────────── */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#003DA5] flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-700">Asistente de Reunión</h3>
                        <p className="text-[10px] text-slate-400">Envía un bot para grabar y transcribir automáticamente</p>
                    </div>
                </div>

                {/* URL Input */}
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <Link2 className="w-4 h-4" />
                    </div>
                    <input
                        type="url"
                        value={meetingUrl}
                        onChange={(e) => setMeetingUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendBot()}
                        placeholder="Pega el link de Google Meet, Zoom o Teams..."
                        className="w-full pl-10 pr-4 py-3 bg-white rounded-lg border border-slate-200 text-sm text-slate-700 
                                 placeholder:text-slate-300 focus:ring-2 focus:ring-[#003DA5]/20 focus:border-[#003DA5] outline-none transition-all"
                    />
                </div>

                {/* Platform Detection Badge */}
                <AnimatePresence>
                    {platformConfig && (
                        <motion.div
                            initial={{ opacity: 0, y: -5, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -5, height: 0 }}
                            className="mt-2"
                        >
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${platformConfig.bgClass}`}>
                                {platformConfig.icon} {platformConfig.label} detectado
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Send Button */}
                <button
                    onClick={handleSendBot}
                    disabled={sending || !meetingUrl.trim() || !detectedPlatform}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 
                             bg-[#003DA5] text-white text-sm font-semibold rounded-lg 
                             hover:bg-[#002D7A] active:scale-[0.98] transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                             shadow-md shadow-[#003DA5]/20"
                >
                    {sending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Enviando bot...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            Enviar Notetaker
                        </>
                    )}
                </button>

                <p className="text-[10px] text-slate-400 mt-2 text-center">
                    El bot aparecerá como <span className="font-semibold">"Remax Exclusive Notetaker"</span> — admítelo a la reunión
                </p>
            </div>

            {/* ─── Active / Recent Sessions ──────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
                </div>
            ) : sessions.length > 0 ? (
                <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                        Sesiones recientes
                    </p>
                    {sessions.map(session => (
                        <SessionCard
                            key={session.id}
                            session={session}
                            onCancel={handleCancel}
                            onViewTranscript={() => {
                                // TODO: navigate to meeting detail or open modal
                                if (session.meeting_id) {
                                    onMeetingCompleted?.()
                                }
                            }}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    )
}

// ─── Session Card ─────────────────────────────────────────────────
function SessionCard({ session, onCancel, onViewTranscript }) {
    const statusConfig = STATUS_CONFIG[session.status] || STATUS_CONFIG.pending
    const platformConfig = PLATFORM_CONFIG[session.meeting_platform]
    const isActive = ACTIVE_STATUSES.includes(session.status)
    const StatusIcon = statusConfig.icon

    const formatDuration = (secs) => {
        if (!secs) return null
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return `${m}:${String(s).padStart(2, '0')}`
    }

    // Calculate live duration for in_meeting status
    const liveDuration = session.status === 'in_meeting' && session.joined_at
        ? formatDuration(Math.round((Date.now() - new Date(session.joined_at).getTime()) / 1000))
        : formatDuration(session.recording_duration_seconds || session.live_duration_seconds)

    const shortUrl = (() => {
        try {
            const url = new URL(session.meeting_url)
            return url.hostname + url.pathname.substring(0, 20)
        } catch {
            return session.meeting_url?.substring(0, 30)
        }
    })()

    const colorMap = {
        slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', dot: 'bg-slate-400' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', dot: 'bg-amber-500' },
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-500' },
        red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-500', dot: 'bg-red-500' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', dot: 'bg-blue-500' },
        violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600', dot: 'bg-violet-500' },
    }
    const colors = colorMap[statusConfig.color] || colorMap.slate

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border ${isActive ? colors.border : 'border-slate-200'} bg-white overflow-hidden transition-all`}
        >
            <div className="flex items-center gap-3 p-3">
                {/* Status indicator */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.bg} border ${colors.border}`}>
                    <StatusIcon className={`w-4 h-4 ${colors.text} ${statusConfig.pulse ? 'animate-pulse' : ''}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors.bg} ${colors.border} ${colors.text}`}>
                            {statusConfig.label}
                        </span>
                        {platformConfig && (
                            <span className="text-[10px] text-slate-400">
                                {platformConfig.icon} {platformConfig.label}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 truncate">
                            {shortUrl}
                        </span>
                        {liveDuration && (
                            <>
                                <span className="text-[10px] text-slate-300">·</span>
                                <span className={`text-[10px] font-mono ${isActive && session.status === 'in_meeting' ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                    {isActive && session.status === 'in_meeting' && (
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />
                                    )}
                                    {liveDuration}
                                </span>
                            </>
                        )}
                        {session.candidate_first_name && (
                            <>
                                <span className="text-[10px] text-slate-300">·</span>
                                <span className="text-[10px] text-slate-400">
                                    {session.candidate_first_name} {session.candidate_last_name}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1">
                    {(session.status === 'pending' || session.status === 'joining') && (
                        <button
                            onClick={() => onCancel(session.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Cancelar"
                        >
                            <StopCircle className="w-4 h-4" />
                        </button>
                    )}
                    {session.status === 'completed' && (
                        <button
                            onClick={() => onViewTranscript(session)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-[#003DA5] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                        >
                            <Eye className="w-3 h-3" />
                            Ver
                        </button>
                    )}
                    {session.status === 'failed' && session.error_message && (
                        <button
                            onClick={() => toast.error(session.error_message)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Ver error"
                        >
                            <AlertCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Error message for failed sessions */}
            {session.status === 'failed' && session.error_message && (
                <div className="px-3 pb-3">
                    <p className="text-[10px] text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5 border border-red-100">
                        {session.error_message}
                    </p>
                </div>
            )}
        </motion.div>
    )
}
