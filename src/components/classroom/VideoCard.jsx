import { Play, Trash2, Edit, Heart, CheckCircle, Clock } from 'lucide-react'
import { Card, Button, Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui'
import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'
import ReactPlayer from 'react-player'
import { cn } from '@/lib/utils'

export default function VideoCard({ video, isAdmin = false, onDelete, onEdit, isFavorite = false, isCompleted = false, onToggleFavorite, onComplete, onDebugLog }) {
    const [showModal, setShowModal] = useState(false)
    const [isReady, setIsReady] = useState(false)

    const playerConfig = useMemo(() => ({
        youtube: {
            playerVars: {
                rel: 0,
                modestbranding: 1,
                show_related: 0,
                origin: typeof window !== 'undefined' ? window.location.origin : ''
            }
        }
    }), [])

    return (
        <>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 dark:border-slate-800 flex flex-col h-full"
            >
                {/* Video Container (Thumbnail) */}
                <div
                    className="aspect-video bg-slate-100 dark:bg-slate-800 relative overflow-hidden cursor-pointer"
                    onClick={() => {
                        setShowModal(true)
                        if (onDebugLog) {
                            onDebugLog(`Opening modal: ${video.title}`)
                            onDebugLog(`URL: ${video.video_url}`)
                            onDebugLog(`CanPlay: ${ReactPlayer.canPlay(video.video_url)}`)
                        }
                    }}
                >
                    <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-300">
                        <div className="w-12 h-12 bg-white/90 dark:bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-primary shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                    </div>

                    {/* Duration Badge */}
                    {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {video.duration}
                        </div>
                    )}

                    {/* Favorite Button (User only) */}
                    {!isAdmin && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                            className="absolute top-2 right-2 p-2 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm text-white transition-colors z-10"
                        >
                            <Heart className={cn("w-4 h-4", isFavorite ? "fill-red-500 text-red-500" : "text-white")} />
                        </button>
                    )}
                </div>

                {/* Content info */}
                <div className="p-4 flex flex-col flex-grow justify-between">
                    <div>
                        <div className="flex justify-between items-start gap-2">
                            <h3
                                onClick={() => setShowModal(true)}
                                className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                            >
                                {video.title}
                            </h3>

                            {isAdmin && (
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(video.id) }}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer: Category & Status */}
                    <div className="mt-3 flex items-center justify-between">
                        <span className={cn(
                            "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full",
                            video.category === 'viaje_exito' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                            video.category === 'capacitaciones' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                            video.category === 'tutoriales' && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                        )}>
                            {video.category.replace('_', ' ')}
                        </span>

                        {isCompleted && (
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Visto</span>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Cinema Mode Modal */}
            <Dialog open={showModal} onOpenChange={(open) => {
                if (!open) setIsReady(false)
                setShowModal(open)
            }}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-slate-800 aspect-video ring-0 outline-none">
                    <DialogTitle className="sr-only">{video.title}</DialogTitle>
                    <DialogDescription className="sr-only">Reproduciendo video: {video.title}</DialogDescription>

                    {/* Only mount player when modal is open to ensure autoplay and proper cleanup */}
                    {showModal && (
                        <ReactPlayer
                            url={video.video_url}
                            width="100%"
                            height="100%"
                            playing={showModal && isReady}
                            controls={true}
                            muted={true}
                            onReady={() => {
                                setIsReady(true)
                                if (onDebugLog) onDebugLog(`[Player] Ready: ${video.video_url}`, 'success')
                            }}
                            onStart={() => {
                                if (onDebugLog) onDebugLog('[Player] Started', 'success')
                            }}
                            onBuffer={() => {
                                if (onDebugLog) onDebugLog('[Player] Buffering...')
                            }}
                            config={playerConfig}
                            onEnded={() => {
                                if (onDebugLog) onDebugLog('[Player] Ended', 'success')
                                if (onComplete) onComplete()
                            }}
                            onError={(e) => {
                                console.error('Video Error:', e)
                                if (onDebugLog) onDebugLog(`[Player] Error: ${JSON.stringify(e)}`, 'error')
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
