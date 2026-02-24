import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui'
import { Check, Play, Lock, RotateCcw, PlayCircle, GraduationCap, ArrowLeft, ChevronRight, Laptop } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

export default function ViajeExitoRoadmap({ videos, progress = {}, markCompleted, onVideoSelect, onBack }) {
    const [showModal, setShowModal] = useState(false)
    const [activeVideo, setActiveVideo] = useState(null)

    // Sort videos by position or video_date
    const sortedVideos = useMemo(() => {
        return [...videos].sort((a, b) => (a.position || 0) - (b.position || 0) || new Date(a.video_date) - new Date(b.video_date))
    }, [videos])

    // Determine status for each video
    const videosWithStatus = useMemo(() => {
        let foundCurrent = false
        return sortedVideos.map((video, index) => {
            const isCompleted = progress[video.id] || false

            let status = 'locked'
            if (isCompleted) {
                status = 'completed'
            } else if (!foundCurrent) {
                status = 'current'
                foundCurrent = true
            }

            return { ...video, status }
        })
    }, [sortedVideos, progress])

    const currentProgressPercent = useMemo(() => {
        if (videosWithStatus.length === 0) return 0
        const completedCount = videosWithStatus.filter(v => v.status === 'completed').length
        return Math.round((completedCount / videosWithStatus.length) * 100)
    }, [videosWithStatus])

    const handlePlay = (video) => {
        if (video.status === 'locked') return
        setActiveVideo(video)
        setShowModal(true)
    }

    const getYouTubeId = (url) => {
        if (!url) return null
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
        const match = url.match(regExp)
        return (match && match[2].length === 11) ? match[2] : null
    }

    const currentModule = videosWithStatus.find(v => v.status === 'current')

    return (
        <div className="flex flex-col w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header / Progress Bar - Fixed at top */}
            <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 py-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600">
                            <GraduationCap className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                <span>Classroom</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className="text-slate-900 dark:text-white">Viaje al Éxito</span>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Course Roadmap</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-6 py-3 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progreso General</p>
                            <p className="text-2xl font-extrabold text-primary leading-none">{currentProgressPercent}%</p>
                        </div>
                        <div className="h-12 w-12 relative flex-shrink-0">
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-200 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                <motion.path
                                    className="text-primary"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeDasharray={`${currentProgressPercent}, 100`}
                                    strokeLinecap="round"
                                    initial={{ strokeDasharray: "0, 100" }}
                                    animate={{ strokeDasharray: `${currentProgressPercent}, 100` }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 relative p-6 md:p-10">
                <div className="max-w-4xl mx-auto relative">
                    {/* Vertical Connecting Line */}
                    <div className="absolute left-6 md:left-8 top-12 bottom-12 w-[3px] bg-slate-200 dark:bg-slate-800 rounded-full z-0" />
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${currentProgressPercent}%` }}
                        transition={{ duration: 1.5, delay: 0.8 }}
                        className="absolute left-6 md:left-8 top-12 w-[3px] bg-primary z-0 shadow-[0_0_15px_rgba(220,38,38,0.3)] rounded-full"
                    />

                    {/* Featured Current Module */}
                    {currentModule && (
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-16 relative z-10"
                        >
                            <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 p-1 shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                                <div className="relative bg-white/5 backdrop-blur-sm p-6 md:p-10 flex flex-col md:flex-row items-center gap-8">
                                    <div className="w-full md:w-80 flex-shrink-0 group-hover:scale-[1.02] transition-transform duration-500">
                                        <div className="relative h-48 w-full overflow-hidden rounded-xl bg-slate-900 border border-white/10 shadow-xl">
                                            <img
                                                src={currentModule.thumbnail_url}
                                                alt={currentModule.title}
                                                className="h-full w-full object-cover opacity-80"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <button
                                                    onClick={() => handlePlay(currentModule)}
                                                    className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/50 shadow-lg hover:bg-white/30 transition-all"
                                                >
                                                    <Play className="text-white w-9 h-9 ml-1 fill-current" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                                            <span className="bg-blue-500/20 text-blue-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-blue-400/30 rounded-full backdrop-blur-sm">Módulo Actual</span>
                                            <span className="bg-green-500/20 text-green-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-green-400/30 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                                Continuar
                                            </span>
                                        </div>
                                        <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-4 tracking-tight leading-tight">{currentModule.title}</h2>
                                        <p className="text-lg text-blue-100/90 mb-8 line-clamp-2 font-medium">{currentModule.description || "Comienza tu transformación profesional con RE/MAX Exclusive."}</p>
                                        <button
                                            onClick={() => handlePlay(currentModule)}
                                            className="inline-flex items-center gap-3 bg-white text-blue-700 px-10 py-4 rounded-full font-bold shadow-2xl hover:scale-105 transition-all"
                                        >
                                            <PlayCircle className="w-6 h-6" />
                                            Reanudar Video
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Timeline List */}
                    <div className="space-y-16">
                        {videosWithStatus.map((video, idx) => (
                            <motion.div
                                key={video.id}
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: idx * 0.1 }}
                                className="relative flex gap-6 md:gap-11"
                            >
                                {/* Indicator Node */}
                                <div className="flex flex-col items-center flex-shrink-0">
                                    <div className={cn(
                                        "h-12 w-12 md:h-16 md:w-16 rounded-full border-[6px] border-slate-50 dark:border-slate-950 flex items-center justify-center shadow-2xl z-20 transition-all duration-700",
                                        video.status === 'completed' ? "bg-green-500 text-white" :
                                            video.status === 'current' ? "bg-primary text-white ring-8 ring-primary/20 scale-110 shadow-primary/40" :
                                                "bg-slate-200 dark:bg-slate-800 text-slate-400"
                                    )}>
                                        {video.status === 'completed' ? <Check className="w-6 h-6 md:w-8 md:h-8 stroke-[3]" /> :
                                            video.status === 'current' ? <Play className="w-6 h-6 md:w-8 md:h-8 fill-current ml-1" /> :
                                                <Lock className="w-5 h-5 md:w-7 md:h-7 opacity-50" />}
                                    </div>
                                </div>

                                {/* Content Card */}
                                <div className={cn(
                                    "flex-1 rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden transition-all duration-500 group/card",
                                    video.status === 'locked' ? "opacity-60 border-slate-100 border-dashed" : "shadow-lg hover:shadow-2xl hover:border-primary/30 border-slate-100 dark:border-slate-800 hover:-translate-y-1"
                                )}>
                                    <div className="flex flex-col lg:flex-row gap-6 p-6">
                                        <div className="relative w-full lg:w-72 h-44 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-inner">
                                            <img src={video.thumbnail_url} alt={video.title} className={cn("w-full h-full object-cover transition-transform duration-700", video.status !== 'locked' && "group-hover/card:scale-110", video.status === 'locked' && "grayscale blur-[2px] opacity-40")} />
                                            {video.status === 'locked' && (
                                                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                                    <div className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                                                        <Lock className="text-white w-6 h-6 opacity-70" />
                                                    </div>
                                                </div>
                                            )}
                                            {video.status !== 'locked' && (
                                                <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/30 transition-all flex items-center justify-center z-10">
                                                    <button onClick={() => handlePlay(video)} className="h-12 w-12 bg-primary text-white rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transform scale-75 group-hover/card:scale-100 transition-all shadow-xl">
                                                        <Play className="w-6 h-6 fill-current ml-1" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="absolute top-3 left-3 z-10">
                                                <span className={cn(
                                                    "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-sm",
                                                    video.status === 'completed' ? "bg-green-500 text-white" : "bg-slate-800/80 text-white backdrop-blur-md"
                                                )}>MOD {idx + 1}</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col justify-between py-1">
                                            <div>
                                                <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                                                    <h3 className={cn(
                                                        "text-xl font-black tracking-tight transition-colors",
                                                        video.status === 'locked' ? "text-slate-400 font-bold" : "text-slate-900 dark:text-white group-hover/card:text-primary"
                                                    )}>{video.title}</h3>

                                                    {video.status === 'completed' && (
                                                        <span className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ring-1 ring-green-600/20 flex items-center gap-1.5">
                                                            <Check className="w-3.5 h-3.5" /> Completado
                                                        </span>
                                                    )}
                                                    {video.status === 'current' && (
                                                        <span className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ring-1 ring-amber-600/20">En Progreso</span>
                                                    )}
                                                    {video.status === 'locked' && (
                                                        <span className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1.5">
                                                            <Lock className="w-3.5 h-3.5" /> Bloqueado
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={cn(
                                                    "text-base leading-relaxed line-clamp-2 mb-6",
                                                    video.status === 'locked' ? "text-slate-400" : "text-slate-600 dark:text-slate-400"
                                                )}>{video.description}</p>
                                            </div>

                                            <div className="mt-auto pt-6 border-t border-slate-50 dark:border-slate-800/50 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">RE</div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RE/MAX Exclusive</span>
                                                </div>

                                                {video.status !== 'locked' ? (
                                                    <button
                                                        onClick={() => handlePlay(video)}
                                                        className={cn(
                                                            "text-sm font-black transition-all flex items-center gap-2 px-6 py-2.5 rounded-lg border",
                                                            video.status === 'completed' ? "text-slate-500 border-slate-200 hover:text-primary hover:border-primary/30" : "bg-primary text-white border-transparent hover:bg-primary-dark shadow-lg shadow-primary/20"
                                                        )}
                                                    >
                                                        {video.status === 'completed' ? <><RotateCcw className="w-4 h-4" /> Repetir</> : <><PlayCircle className="w-4 h-4" /> Comenzar</>}
                                                    </button>
                                                ) : (
                                                    <div className="relative group/lock">
                                                        <span className="text-sm font-bold text-slate-300 pointer-events-none">Bloqueado</span>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 transition-opacity group-hover/lock:opacity-100 pointer-events-none whitespace-nowrap">
                                                            Completa el anterior para desbloquear
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Final Badge */}
                    <div className="mt-20 flex flex-col items-center">
                        <div className="h-20 w-1 bg-slate-200 dark:bg-slate-800 rounded-full mb-6" />
                        <div className="h-24 w-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-4 border-slate-200 dark:border-slate-700 shadow-xl opacity-50">
                            <Check className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="mt-4 text-slate-400 font-black uppercase tracking-widest text-xs">Fin del Recorrido</p>
                    </div>
                </div>
            </main>

            {/* Video Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-slate-800 aspect-video ring-0 outline-none">
                    <DialogTitle className="sr-only">{activeVideo?.title}</DialogTitle>
                    <DialogDescription className="sr-only">Reproduciendo video: {activeVideo?.title}</DialogDescription>

                    {showModal && activeVideo && (
                        <div className="flex flex-col h-full bg-slate-900">
                            <iframe
                                className="w-full flex-grow"
                                src={`https://www.youtube.com/embed/${getYouTubeId(activeVideo.video_url)}?autoplay=1&rel=0&modestbranding=1`}
                                title={activeVideo.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            ></iframe>
                            <div className="p-4 bg-slate-900 flex justify-between items-center border-t border-slate-800">
                                <p className="text-white font-medium truncate max-w-md">{activeVideo.title}</p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
                                    >
                                        Cerrar
                                    </button>
                                    {!progress[activeVideo.id] && (
                                        <button
                                            onClick={async () => {
                                                await markCompleted(activeVideo.id);
                                                setShowModal(false);
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all"
                                        >
                                            Finalizar Módulo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
