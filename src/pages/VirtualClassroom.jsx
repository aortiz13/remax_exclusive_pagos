import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import VideoCard from '../components/classroom/VideoCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs' // Assuming standard shadcn/ui tabs
import { GraduationCap, PlayCircle, BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function VirtualClassroom() {
    const [videos, setVideos] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('viaje_exito')

    useEffect(() => {
        fetchVideos()
    }, [])

    const fetchVideos = async () => {
        try {
            const { data, error } = await supabase
                .from('virtual_classroom_videos')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setVideos(data || [])
        } catch (error) {
            console.error('Error fetching videos:', error)
        } finally {
            setLoading(false)
        }
    }

    const categories = [
        { id: 'viaje_exito', label: 'Viaje al Éxito', icon: GraduationCap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { id: 'capacitaciones', label: 'Capacitaciones', icon: PlayCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { id: 'tutoriales', label: 'Tutoriales', icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-500/10' }
    ]

    const filteredVideos = (category) => videos.filter(v => v.category === category)

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                    Aula Virtual
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Centro de capacitación y recursos educativos para agentes RE/MAX Exclusive.
                </p>
            </div>

            {/* Categories Navigation */}
            <div className="flex flex-wrap gap-4">
                {categories.map((cat) => {
                    const isActive = activeTab === cat.id
                    const Icon = cat.icon
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={cn(
                                "flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 border",
                                isActive
                                    ? "bg-white dark:bg-slate-800 border-primary shadow-lg scale-105"
                                    : "bg-white/50 dark:bg-slate-900/50 border-transparent hover:bg-white hover:shadow-md"
                            )}
                        >
                            <div className={cn("p-2 rounded-lg", cat.bg, cat.color)}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <p className={cn("font-bold text-sm", isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>
                                    {cat.label}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {videos.filter(v => v.category === cat.id).length} videos
                                </p>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Video Grid */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
                {filteredVideos(activeTab).length > 0 ? (
                    filteredVideos(activeTab).map((video, idx) => (
                        <div key={video.id} style={{ animationDelay: `${idx * 0.1}s` }} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
                            <VideoCard video={video} />
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No hay videos disponibles en esta categoría aún.</p>
                    </div>
                )}
            </motion.div>
        </div>
    )
}
