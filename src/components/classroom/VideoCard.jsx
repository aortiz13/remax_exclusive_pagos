import { Play, Trash2, Edit } from 'lucide-react'
import { Card } from '@/components/ui/card' // Assuming we have a card component or use standard div
import { Button } from '@/components/ui/button' // Assuming we have a button component
import { motion } from 'framer-motion'
import { useState } from 'react'
import ReactPlayer from 'react-player/lazy'
import { cn } from '@/lib/utils'

export default function VideoCard({ video, isAdmin = false, onDelete, onEdit }) {
    const [isPlaying, setIsPlaying] = useState(false)

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-800"
        >
            {/* Video Container */}
            <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                {isPlaying ? (
                    <ReactPlayer
                        url={video.video_url}
                        width="100%"
                        height="100%"
                        playing={true}
                        controls={true}
                        light={false}
                    />
                ) : (
                    <>
                        <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <button
                                onClick={() => setIsPlaying(true)}
                                className="w-14 h-14 bg-white/90 dark:bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-red-600 transition-transform duration-300 group-hover:scale-110 shadow-lg"
                            >
                                <Play className="w-6 h-6 fill-current ml-1" />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Content info */}
            <div className="p-4">
                <div className="flex justify-between items-start gap-4">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 text-sm leading-snug min-h-[2.5rem]">
                        {video.title}
                    </h3>

                    {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                            {/* 
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => onEdit(video)}>
                                <Edit className="w-4 h-4" />
                            </Button>
                            */}
                            <button
                                onClick={() => onDelete(video.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Category badge */}
                <div className="mt-3 flex items-center gap-2">
                    <span className={cn(
                        "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full",
                        video.category === 'viaje_exito' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                        video.category === 'capacitaciones' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                        video.category === 'tutoriales' && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                    )}>
                        {video.category.replace('_', ' ')}
                    </span>
                </div>
            </div>
        </motion.div>
    )
}
