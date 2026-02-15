import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import VideoCard from '../components/classroom/VideoCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs' // Assuming standard shadcn/ui tabs
import { GraduationCap, PlayCircle, BookOpen, Search, Heart } from 'lucide-react'
import { Input } from '@/components/ui'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function VirtualClassroom() {
    const [videos, setVideos] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('viaje_exito')
    const [searchQuery, setSearchQuery] = useState('')
    const [favorites, setFavorites] = useState(new Set())
    const [progress, setProgress] = useState({})

    // Debug State
    const [debugLogs, setDebugLogs] = useState([])
    const addLog = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString()
        setDebugLogs(prev => [`[${timestamp}] [${type}] ${msg}`, ...prev].slice(0, 5))
    }

    // Capture global errors
    useEffect(() => {
        const handleError = (event) => {
            addLog(`Global Error: ${event.message}`, 'error')
        }
        const handleRejection = (event) => {
            addLog(`Unhandled Rejection: ${event.reason}`, 'error')
        }
        window.addEventListener('error', handleError)
        window.addEventListener('unhandledrejection', handleRejection)
        return () => {
            window.removeEventListener('error', handleError)
            window.removeEventListener('unhandledrejection', handleRejection)
        }
    }, [])

    useEffect(() => {
        fetchVideos()
        fetchUserData()
    }, [])

    const fetchUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [favs, progs] = await Promise.all([
            supabase.from('virtual_classroom_favorites').select('video_id').eq('user_id', user.id),
            supabase.from('virtual_classroom_progress').select('video_id, is_completed').eq('user_id', user.id)
        ])

        if (favs.data) setFavorites(new Set(favs.data.map(f => f.video_id)))
        if (progs.data) {
            const progMap = {}
            progs.data.forEach(p => progMap[p.video_id] = p.is_completed)
            setProgress(progMap)
        }
    }

    const toggleFavorite = async (videoId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const isFav = favorites.has(videoId)
        const newFavs = new Set(favorites)

        if (isFav) {
            newFavs.delete(videoId)
            await supabase.from('virtual_classroom_favorites').delete().match({ user_id: user.id, video_id: videoId })
        } else {
            newFavs.add(videoId)
            await supabase.from('virtual_classroom_favorites').insert({ user_id: user.id, video_id: videoId })
        }
        setFavorites(newFavs)
    }

    const markCompleted = async (videoId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('virtual_classroom_progress').upsert({
            user_id: user.id,
            video_id: videoId,
            is_completed: true,
            updated_at: new Date()
        })

        setProgress(prev => ({ ...prev, [videoId]: true }))
    }

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
        { id: 'viaje_exito', label: 'Viaje al Éxito', icon: GraduationCap, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-200 dark:border-amber-800' },
        { id: 'capacitaciones', label: 'Capacitaciones', icon: PlayCircle, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-200 dark:border-blue-800' },
        { id: 'tutoriales', label: 'Tutoriales', icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-200 dark:border-purple-800' },
        { id: 'favoritos', label: 'Mis Favoritos', icon: Heart, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-200 dark:border-red-800' }
    ]

    const filteredVideos = () => {
        if (searchQuery) {
            return videos.filter(v =>
                v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.description?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }
        if (activeTab === 'favoritos') {
            return videos.filter(v => favorites.has(v.id))
        }
        return videos.filter(v => v.category === activeTab)
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-10 relative">
            {/* Debug Banner */}
            <div className="fixed top-0 left-0 right-0 z-[100] bg-black/80 text-white p-2 text-xs font-mono max-h-32 overflow-y-auto pointer-events-none">
                <div className="font-bold text-yellow-400 mb-1">DEBUG MONITOR (Últimos 5 eventos)</div>
                {debugLogs.length === 0 && <div className="text-gray-500">Esperando eventos...</div>}
                {debugLogs.map((log, i) => (
                    <div key={i} className={cn(
                        "border-b border-white/10 py-0.5",
                        log.includes('[error]') ? "text-red-400 font-bold" :
                            log.includes('[success]') ? "text-green-400" : "text-gray-300"
                    )}>
                        {log}
                    </div>
                ))}
            </div>

            {/* Header and Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                        Aula Virtual
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Centro de capacitación y recursos educativos.
                    </p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar videos..."
                        className="pl-9 bg-white dark:bg-slate-900"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Categories Navigation (Hidden if searching) */}
            {!searchQuery && (
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
                                        ? cn("shadow-lg scale-105", cat.bg, cat.border)
                                        : "bg-white/50 dark:bg-slate-900/50 border-transparent hover:bg-white hover:shadow-md"
                                )}
                            >
                                <div className={cn("p-2 rounded-lg bg-white/50 dark:bg-slate-900/50", cat.color)}>
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
            )}

            {/* Video Grid */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
                {filteredVideos().length > 0 ? (
                    filteredVideos().map((video, idx) => (
                        <div key={video.id} style={{ animationDelay: `${idx * 0.1}s` }} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
                            <VideoCard
                                video={video}
                                isFavorite={favorites.has(video.id)}
                                isCompleted={progress[video.id]}
                                onToggleFavorite={() => toggleFavorite(video.id)}
                                onComplete={() => markCompleted(video.id)}
                                onDebugLog={addLog}
                            />
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
