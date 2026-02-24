import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import VideoCard from '../components/classroom/VideoCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs' // Assuming standard shadcn/ui tabs
import { GraduationCap, PlayCircle, BookOpen, Search, Heart, Laptop, Rocket, Users, Cpu, ArrowLeft } from 'lucide-react'
import ViajeExitoRoadmap from '../components/classroom/ViajeExitoRoadmap'
import { Input, Button } from '@/components/ui'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function VirtualClassroom() {
    const [videos, setVideos] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [favorites, setFavorites] = useState(new Set())
    const [progress, setProgress] = useState({})

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
                .order('video_date', { ascending: false })

            if (error) throw error
            setVideos(data || [])
        } catch (error) {
            console.error('Error fetching videos:', error)
        } finally {
            setLoading(false)
        }
    }

    const categories = [
        {
            id: 'viaje_exito',
            label: 'Viaje al Éxito',
            description: 'Descubre el camino hacia tus metas profesionales.',
            icon: Rocket,
            color: 'text-blue-500',
            bg: 'bg-blue-50',
            border: 'border-blue-100',
            countLabel: 'lecciones'
        },
        {
            id: 'capacitaciones',
            label: 'Capacitaciones',
            description: 'Entrenamientos especializados para equipos de alto impacto.',
            icon: Users,
            color: 'text-green-500',
            bg: 'bg-green-50',
            border: 'border-green-100',
            countLabel: 'cursos'
        },
        {
            id: 'tutoriales',
            label: 'Tutoriales',
            description: 'Guías paso a paso para dominar cualquier herramienta.',
            icon: PlayCircle,
            color: 'text-amber-500',
            bg: 'bg-amber-50',
            border: 'border-amber-100',
            countLabel: 'guías'
        },
        {
            id: 'aprendamos_tecnologia',
            label: 'Aprendamos Tecnología',
            description: 'Explora las últimas tendencias e innovaciones digitales.',
            icon: Cpu,
            color: 'text-indigo-500',
            bg: 'bg-indigo-50',
            border: 'border-indigo-100',
            countLabel: 'módulos'
        },
        {
            id: 'favoritos',
            label: 'Mis Favoritos',
            description: 'Accede rápidamente a tus contenidos guardados.',
            icon: Heart,
            color: 'text-red-500',
            bg: 'bg-red-50',
            border: 'border-red-100',
            countLabel: 'guardados'
        }
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

    // Landing View Component
    const CategoryLanding = () => (
        <div className="space-y-8 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {categories.map((cat) => {
                    const Icon = cat.icon
                    const count = cat.id === 'favoritos'
                        ? favorites.size
                        : videos.filter(v => v.category === cat.id).length

                    return (
                        <motion.button
                            key={cat.id}
                            whileHover={{ y: -5 }}
                            onClick={() => setActiveTab(cat.id)}
                            className={cn(
                                "flex flex-col items-center text-center p-8 rounded-2xl bg-white dark:bg-slate-900 border transition-all h-full",
                                cat.border,
                                "hover:shadow-xl hover:border-primary/20"
                            )}
                        >
                            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center mb-6 shadow-sm", cat.bg)}>
                                <Icon className={cn("w-8 h-8", cat.color)} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{cat.label}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                {cat.description}
                            </p>
                            <span className="mt-auto inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                                {count} {cat.countLabel}
                            </span>
                        </motion.button>
                    )
                })}
            </div>
        </div>
    )

    return (
        <div className="space-y-8 pb-10 relative">
            {/* Header and Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    {activeTab ? (
                        <Button
                            variant="ghost"
                            className="pl-0 hover:bg-transparent hover:text-primary mb-1 group"
                            onClick={() => setActiveTab(null)}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                            Volver a Categorías
                        </Button>
                    ) : (
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                            Aula Virtual
                        </h1>
                    )}
                    {!activeTab && (
                        <p className="text-slate-500 dark:text-slate-400">
                            Centro de capacitación y recursos educativos.
                        </p>
                    )}
                </div>
                {activeTab !== 'viaje_exito' && (
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar videos..."
                            className="pl-9 bg-white dark:bg-slate-900"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Main Content */}
            <AnimatePresence mode="wait">
                {!activeTab && !searchQuery ? (
                    <motion.div
                        key="landing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <CategoryLanding />
                    </motion.div>
                ) : (
                    <motion.div
                        key="content"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex flex-grow flex-col w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            {/* Category Header */}
                            {activeTab && activeTab !== 'viaje_exito' && !searchQuery && (
                                <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 py-6 mb-0">
                                    {categories.map(cat => {
                                        if (cat.id !== activeTab) return null
                                        const Icon = cat.icon
                                        const count = cat.id === 'favoritos'
                                            ? favorites.size
                                            : videos.filter(v => v.category === cat.id).length
                                        return (
                                            <div key={cat.id} className="flex flex-col md:flex-row items-center justify-between gap-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("p-3 rounded-xl", cat.bg)}>
                                                        <Icon className={cn("w-8 h-8", cat.color)} />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{cat.label}</h2>
                                                        <p className="text-slate-500 text-sm">{cat.description}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-6 py-3 border border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total {cat.countLabel}</p>
                                                        <p className="text-2xl font-extrabold text-primary leading-none text-center">{count}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Search Header inside card */}
                            {searchQuery && (
                                <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 py-6">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Resultados de búsqueda</h2>
                                    <p className="text-slate-500 text-sm italic">Mostrando resultados para "{searchQuery}"</p>
                                </div>
                            )}

                            {/* Grid Content */}
                            <div className="p-6 md:p-10">
                                {activeTab === 'viaje_exito' && !searchQuery ? (
                                    <ViajeExitoRoadmap
                                        videos={videos.filter(v => v.category === 'viaje_exito')}
                                        progress={progress}
                                        markCompleted={markCompleted}
                                        onVideoSelect={(video) => console.log('Select video', video)}
                                    />
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {filteredVideos().length > 0 ? (
                                            filteredVideos().map((video, idx) => (
                                                <div key={video.id} style={{ animationDelay: `${idx * 0.1}s` }} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
                                                    <VideoCard
                                                        video={video}
                                                        variant="list"
                                                        isFavorite={favorites.has(video.id)}
                                                        isCompleted={progress[video.id]}
                                                        onToggleFavorite={() => toggleFavorite(video.id)}
                                                        onComplete={() => markCompleted(video.id)}
                                                    />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full py-20 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                                <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Search className="w-8 h-8 opacity-20" />
                                                </div>
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                                                    No se encontraron videos
                                                </h3>
                                                <p className="max-w-xs mx-auto text-sm">
                                                    Intenta ajustar tu búsqueda o explora otras categorías.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
