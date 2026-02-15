import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { fetchVideoMetadata } from '../services/youtube' // Import the service
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Video } from 'lucide-react'
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
            const { error } = await supabase.from('virtual_classroom_videos').insert({
                title: metadata.title,
                video_url: metadata.video_url,
                thumbnail_url: metadata.thumbnail_url,
                description: metadata.description,
                category: category
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
                <h2 className="text-lg font-semibold">Videos Existentes</h2>
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
