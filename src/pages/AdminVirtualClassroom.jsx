import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { fetchVideoMetadata } from '../services/youtube' // Import the service
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Video, RefreshCw } from 'lucide-react'
import VideoCard from '../components/classroom/VideoCard'

export default function AdminVirtualClassroom() {
    const [videos, setVideos] = useState([])
    const [loading, setLoading] = useState(true)
    const [url, setUrl] = useState('')
    const [metadata, setMetadata] = useState(null)
    const [category, setCategory] = useState('capacitaciones')
    const [fetchingMetadata, setFetchingMetadata] = useState(false)
    const [saving, setSaving] = useState(false)

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
            toast.error('Error al cargar videos')
        } finally {
            setLoading(false)
        }
    }

    const handleUrlBlur = async () => {
        if (!url) return
        setFetchingMetadata(true)
        try {
            const data = await fetchVideoMetadata(url)
            setMetadata(data)
            toast.success('Video encontrado: ' + data.title)
        } catch (error) {
            toast.error(error.message || 'Error al obtener datos del video')
            setMetadata(null)
        } finally {
            setFetchingMetadata(false)
        }
    }

    const handleSave = async () => {
        if (!metadata) return
        setSaving(true)
        try {
            // Extract YouTube ID
            const youtubeId = metadata.video_url.includes('v=')
                ? metadata.video_url.split('v=')[1].split('&')[0]
                : metadata.video_url.split('/').pop().split('?')[0];

            const { error } = await supabase.from('virtual_classroom_videos').insert({
                title: metadata.title,
                video_url: metadata.video_url,
                thumbnail_url: metadata.thumbnail_url,
                description: metadata.description,
                category: category,
                duration: metadata.duration,
                youtube_id: youtubeId,
                video_date: metadata.video_date
            })

            if (error) throw error

            toast.success('Video agregado correctamente')
            setUrl('')
            setMetadata(null)
            fetchVideos()
        } catch (error) {
            console.error('Error saving video:', error)
            toast.error('Error al guardar el video')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este video?')) return

        try {
            const { error } = await supabase
                .from('virtual_classroom_videos')
                .delete()
                .eq('id', id)

            if (error) throw error

            toast.success('Video eliminado')
            fetchVideos()
        } catch (error) {
            console.error('Error deleting video:', error)
            toast.error('Error al eliminar video')
        }
    }

    const handleSyncPlaylists = async () => {
        setSaving(true)
        const toastId = toast.loading('Sincronizando con YouTube...')
        try {
            const playlists = [
                { id: 'PLd3VhBafUdLqaetc6gyid5PQ7c90yOAkZ', category: 'capacitaciones' },
                { id: 'PLd3VhBafUdLpMneYpy2hoJA7PbS_zqBwJ', category: 'tutoriales' },
                { id: 'PLpeYfCtXoij-ZMyQux4zYo8YTLw_kqZHD', category: 'aprendamos_tecnologia' }
            ]

            let addedCount = 0
            let updatedCount = 0
            let removedCount = 0
            let errorCount = 0

            // 1. Fetch ALL current videos from DB for these categories
            const { data: dbVideos, error: fetchError } = await supabase
                .from('virtual_classroom_videos')
                .select('id, youtube_id, category')
                .in('category', playlists.map(p => p.category))

            if (fetchError) throw fetchError

            const dbVideosMap = {}
            dbVideos?.forEach(v => {
                if (v.youtube_id) dbVideosMap[v.youtube_id] = v
            })

            for (const playlist of playlists) {
                toast.loading(`Sincronizando ${playlist.category}...`, { id: toastId })
                const ytVideos = await import('../services/youtube').then(m => m.fetchPlaylistItems(playlist.id))
                const ytIds = new Set(ytVideos.map(v => v.youtube_id))

                console.log(`[Sync] Playlist ${playlist.category}: ${ytVideos.length} videos from YouTube`)

                // 2. Upsert all videos from YouTube (insert new, update existing)
                for (const video of ytVideos) {
                    const videoData = {
                        title: video.title,
                        video_url: video.video_url,
                        thumbnail_url: video.thumbnail_url,
                        description: video.description,
                        category: playlist.category,
                        duration: video.duration,
                        youtube_id: video.youtube_id,
                        video_date: video.video_date
                    }

                    const isNew = !dbVideosMap[video.youtube_id]

                    const { error: upsertError } = await supabase
                        .from('virtual_classroom_videos')
                        .upsert(videoData, { onConflict: 'youtube_id' })

                    if (upsertError) {
                        console.error(`[Sync] Error upserting video "${video.title}" (${video.youtube_id}):`, upsertError)
                        errorCount++
                    } else if (isNew) {
                        addedCount++
                    } else {
                        updatedCount++
                    }
                }

                // 3. Deletion logic (Remove from DB if NOT in YouTube playlist anymore)
                const videosToRemove = dbVideos?.filter(v => v.category === playlist.category && !ytIds.has(v.youtube_id))
                if (videosToRemove?.length > 0) {
                    const idsToRemove = videosToRemove.map(v => v.id)
                    const { error: deleteError } = await supabase.from('virtual_classroom_videos').delete().in('id', idsToRemove)
                    if (deleteError) {
                        console.error(`[Sync] Error removing old videos:`, deleteError)
                    } else {
                        removedCount += idsToRemove.length
                    }
                }
            }

            toast.dismiss(toastId)
            const summary = `+${addedCount} nuevos, ${updatedCount} actualizados, -${removedCount} eliminados`
            if (errorCount > 0) {
                toast.warning(`Sincronización con ${errorCount} error(es): ${summary}`)
            } else if (addedCount > 0 || removedCount > 0) {
                toast.success(`Sincronización completa: ${summary}`)
            } else {
                toast.success(`Todo actualizado. ${updatedCount} videos verificados.`)
            }
            fetchVideos()

        } catch (error) {
            console.error('Sync error:', error)
            toast.error('Error en la sincronización: ' + error.message, { id: toastId })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Cargando...</div>

    return (
        <div className="space-y-8 pb-20">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Administrar Aula Virtual
                </h1>
                <p className="text-slate-500">Gestiona los videos y capacitaciones.</p>
            </div>

            {/* Add Video Form */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border shadow-sm space-y-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    Agregar Nuevo Video
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>URL de YouTube</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    onBlur={handleUrlBlur}
                                />
                            </div>
                            <p className="text-xs text-slate-400">Pega el link y haz click fuera para buscar metadatos.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="viaje_exito">Viaje al Éxito (Obligatorio)</SelectItem>
                                    <SelectItem value="capacitaciones">Capacitaciones y Reuniones</SelectItem>
                                    <SelectItem value="tutoriales">Tutoriales</SelectItem>
                                    <SelectItem value="aprendamos_tecnologia">Aprendamos Tecnología</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={!metadata || saving}
                            className="w-full"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Guardar Video
                        </Button>
                    </div>

                    {/* Preview */}
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center p-4">
                        {fetchingMetadata ? (
                            <div className="text-center space-y-2">
                                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                                <p className="text-sm text-slate-500">Buscando video...</p>
                            </div>
                        ) : metadata ? (
                            <div className="w-full">
                                <p className="text-xs font-bold uppercase text-slate-400 mb-2">Vista Previa</p>
                                <VideoCard video={{ ...metadata, category }} />
                            </div>
                        ) : (
                            <div className="text-center text-slate-400">
                                <Video className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">La vista previa aparecerá aquí</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Video List */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Videos Existentes</h2>
                    <Button variant="outline" onClick={handleSyncPlaylists} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Sincronizar Listas de YouTube
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {videos.map(video => (
                        <div key={video.id} className="relative group">
                            <VideoCard video={video} isAdmin={true} onDelete={handleDelete} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
