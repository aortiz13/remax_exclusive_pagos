import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge, Separator, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui'
import { ArrowLeft, User, MapPin, Building, Ruler, BedDouble, Bath, Link as LinkIcon, FileText, Briefcase, Plus, Filter, Trash2, History, Star, ChevronLeft, ChevronRight, Upload, X, Camera, Image as ImageIcon, Car, Layers, Calendar, DollarSign, Video, Globe, Landmark, GripVertical } from 'lucide-react'
import { supabase, getCustomPublicUrl } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import PropertyForm from './PropertyForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TaskModal from './TaskModal'
import AddParticipantModal, { ROLE_COLORS } from './AddParticipantModal'
import UnifiedTimeline from './UnifiedTimeline'
import PropertyTimeline from './PropertyTimeline'
import { logActivity } from '../../services/activityService'
import { toast } from 'sonner'
import ActionModal from './ActionModal'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Sortable photo card component for drag-and-drop reorder
const SortablePhotoCard = ({ photo, idx, isOwner, onClickPhoto, onDeletePhoto, property, photos }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : 'auto',
    }

    // Calculate correct slide index accounting for deduplication
    const mainUrlInPhotos = property.image_url && photos.some(p => p.url === property.image_url)
    const offset = (property.image_url && !mainUrlInPhotos) ? idx + 1 : idx

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-[4/3] cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all ${
                isDragging ? 'shadow-2xl ring-2 ring-blue-400' : ''
            }`}
            onClick={() => onClickPhoto(offset)}
        >
            <img src={photo.url} alt={photo.caption || 'Foto'} className="w-full h-full object-cover" />
            {photo.source === 'remax' && (
                <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    RE/MAX
                </div>
            )}
            {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                    <p className="text-white text-xs truncate">{photo.caption}</p>
                </div>
            )}
            {/* Position badge */}
            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ left: photo.source === 'remax' ? 'auto' : '0.5rem', right: photo.source === 'remax' ? undefined : undefined }}>
                {idx + 1}
            </div>
            {isOwner && (
                <>
                    {/* Drag handle */}
                    <button
                        {...attributes}
                        {...listeners}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 right-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg cursor-grab active:cursor-grabbing"
                        title="Arrastrar para reordenar"
                    >
                        <GripVertical className="w-3 h-3" />
                    </button>
                    {/* Delete button — works for ALL photos */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onDeletePhoto(photo)
                        }}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </>
            )}
        </div>
    )
}

const PropertyDetail = () => {
    const { profile, user } = useAuth()
    const { id } = useParams()
    const navigate = useNavigate()
    const [property, setProperty] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [tasks, setTasks] = useState([])
    const [participants, setParticipants] = useState([])

    // Task States
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState(null)
    const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false)
    const [note, setNote] = useState('')
    const [noteLoading, setNoteLoading] = useState(false)

    // Delete Participant State
    const [isDeleteParticipantOpen, setIsDeleteParticipantOpen] = useState(false)
    const [participantToDelete, setParticipantToDelete] = useState(null)
    const [isDeletingParticipant, setIsDeletingParticipant] = useState(false)

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [mandateCount, setMandateCount] = useState(0)

    // Action Modal State
    const [isActionModalOpen, setIsActionModalOpen] = useState(false)

    // Photo Gallery State
    const [photos, setPhotos] = useState([])
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
    const [photoUploading, setPhotoUploading] = useState(false)
    const [photoToDelete, setPhotoToDelete] = useState(null)
    const [isDeletePhotoOpen, setIsDeletePhotoOpen] = useState(false)
    const [isDeletingPhoto, setIsDeletingPhoto] = useState(false)
    const photoInputRef = useRef(null)

    useEffect(() => {
        fetchProperty()
        fetchTasks()
        fetchParticipants()
        fetchPhotos()
    }, [id])

    const handleDeleteProperty = async () => {
        setIsDeleting(true)
        try {
            // 1. Unlink mandates (SET NULL to avoid FK violation)
            await supabase
                .from('mandates')
                .update({ property_id: null })
                .eq('property_id', id)

            // 2. Delete associated tasks manually (NO ACTION constraint)
            const { error: tasksError } = await supabase
                .from('crm_tasks')
                .delete()
                .eq('property_id', id)

            if (tasksError) throw tasksError

            // 3. Delete the property (Contacts/Logs will CASCADE)
            const { error: propertyError } = await supabase
                .from('properties')
                .delete()
                .eq('id', id)

            if (propertyError) throw propertyError

            // Log deletion to timeline
            logActivity({
                action: 'Eliminó',
                entity_type: 'Propiedad',
                entity_id: id,
                description: `Propiedad eliminada: ${property?.address || 'Sin dirección'}`,
                property_id: id
            }).catch(() => { })

            toast.success('Propiedad eliminada correctamente')
            navigate('/properties')
        } catch (error) {
            console.error('Error deleting property:', error)
            toast.error('Error al eliminar la propiedad')
        } finally {
            setIsDeleting(false)
            setIsDeleteDialogOpen(false)
        }
    }

    const fetchProperty = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('properties')
                .select(`
                    *,
                    contacts (id, first_name, last_name, phone, email)
                `)
                .eq('id', id)
                .single()

            if (error) throw error
            setProperty(data)
        } catch (error) {
            console.error('Error fetching property:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchTasks = async () => {
        const { data } = await supabase
            .from('crm_tasks')
            .select('*, contacts(first_name, last_name)')
            .eq('property_id', id)
            .order('execution_date', { ascending: true })

        if (data) setTasks(data)
    }

    const fetchParticipants = async () => {
        const { data } = await supabase
            .from('property_contacts')
            .select(`
                *,
                contacts (first_name, last_name, email, phone)
            `)
            .eq('property_id', id)

        if (data) setParticipants(data)
    }

    const fetchPhotos = async () => {
        const { data } = await supabase
            .from('property_photos')
            .select('*, source')
            .eq('property_id', id)
            .order('position', { ascending: true })
            .order('created_at', { ascending: true })

        if (data) setPhotos(data)
    }

    const handlePhotoUpload = async (files) => {
        if (!files || files.length === 0) return
        setPhotoUploading(true)
        try {
            for (const file of files) {
                if (file.size > 5 * 1024 * 1024) {
                    toast.error(`${file.name} supera 5MB, omitido`)
                    continue
                }
                const ext = file.name.split('.').pop()
                const filePath = `property-photos/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                const { error: uploadError } = await supabase.storage
                    .from('mandates')
                    .upload(filePath, file, { cacheControl: '3600', upsert: true })

                if (uploadError) {
                    console.error('Upload error:', uploadError)
                    toast.error(`Error subiendo ${file.name}`)
                    continue
                }

                const publicUrl = getCustomPublicUrl('mandates', filePath)
                await supabase.from('property_photos').insert({
                    property_id: id,
                    agent_id: user.id,
                    url: publicUrl,
                    caption: file.name.replace(/\.[^.]+$/, ''),
                    position: photos.length
                })
            }
            toast.success('Fotos subidas correctamente')
            fetchPhotos()
        } catch (err) {
            console.error('Photo upload error:', err)
            toast.error('Error al subir fotos')
        } finally {
            setPhotoUploading(false)
            if (photoInputRef.current) photoInputRef.current.value = ''
        }
    }

    const handleDeletePhoto = async () => {
        if (!photoToDelete) return
        setIsDeletingPhoto(true)
        try {
            // Try to delete the file from storage too
            try {
                const url = photoToDelete.url || ''
                const storageMatch = url.match(/\/storage\/v1\/object\/public\/mandates\/(.+)/)
                if (storageMatch) {
                    await supabase.storage.from('mandates').remove([decodeURIComponent(storageMatch[1])])
                }
            } catch (storageErr) {
                console.warn('Could not delete photo from storage (may be external URL):', storageErr)
            }

            const { error } = await supabase
                .from('property_photos')
                .delete()
                .eq('id', photoToDelete.id)
            if (error) throw error
            toast.success('Foto eliminada')
            fetchPhotos()
            // Adjust slideshow index if needed
            setCurrentPhotoIndex(prev => Math.max(0, prev - 1))
        } catch (err) {
            console.error('Error deleting photo:', err)
            toast.error('Error al eliminar foto')
        } finally {
            setIsDeletingPhoto(false)
            setIsDeletePhotoOpen(false)
            setPhotoToDelete(null)
        }
    }

    // DnD sensors with activation constraint to avoid accidental drags
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    )

    const handleDragEnd = useCallback(async (event) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = photos.findIndex(p => p.id === active.id)
        const newIndex = photos.findIndex(p => p.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        const reordered = arrayMove(photos, oldIndex, newIndex)
        setPhotos(reordered) // Optimistic update

        // Persist new positions to DB
        try {
            const updates = reordered.map((photo, i) => ({
                id: photo.id,
                property_id: photo.property_id,
                agent_id: photo.agent_id,
                url: photo.url,
                position: i
            }))
            const { error } = await supabase
                .from('property_photos')
                .upsert(updates, { onConflict: 'id' })
            if (error) throw error
            toast.success('Orden de fotos actualizado')
        } catch (err) {
            console.error('Error saving photo order:', err)
            toast.error('Error al guardar el orden')
            fetchPhotos() // Revert on error
        }
    }, [photos])


    const handleTaskToggle = async (taskId, currentStatus) => {
        // Optimistic
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t))
        await supabase.from('crm_tasks').update({ completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : null }).eq('id', taskId)

        const task = tasks.find(t => t.id === taskId)

        // Google Sync
        if (profile?.google_refresh_token && task?.google_event_id) {
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: user.id, action: 'push_to_google', taskId: taskId }
            })
        }

        if (!currentStatus) {
            await logActivity({
                action: 'Tarea',
                entity_type: 'Propiedad',
                entity_id: id,
                description: `Tarea completada: ${task?.action}`,
                property_id: id,
                contact_id: task?.contact_id
            })
        }
    }

    // Placeholder for deleting participant
    const handleDeleteParticipant = async () => {
        if (!participantToDelete) return;

        try {
            setIsDeletingParticipant(true)
            const { error } = await supabase
                .from('property_contacts')
                .delete()
                .eq('id', participantToDelete.id)

            if (error) throw error

            // Log activity for both property and contact Storylines
            await logActivity({
                action: 'Desvinculó',
                entity_type: 'Propiedad',
                entity_id: id,
                description: `Desvinculó a ${participantToDelete.contacts?.first_name} ${participantToDelete.contacts?.last_name} (${participantToDelete.role})`,
                property_id: id,
                contact_id: participantToDelete.contact_id
            })

            // If the deleted participant was the Owner, clear owner_id in the properties table
            if (participantToDelete.role === 'propietario') {
                await supabase
                    .from('properties')
                    .update({ owner_id: null })
                    .eq('id', id)
                fetchProperty()
            }

            toast.success('Relacionado eliminado correctamente')
            fetchParticipants()
        } catch (error) {
            console.error('Error deleting participant:', error)
            toast.error('Error al eliminar relacionado')
        } finally {
            setIsDeletingParticipant(false)
            setIsDeleteParticipantOpen(false)
            setParticipantToDelete(null)
        }
    }

    const handleAddNote = async () => {
        if (!note.trim()) return
        try {
            setNoteLoading(true)

            await logActivity({
                property_id: id,
                action: 'Nota',
                entity_type: 'Propiedad',
                entity_id: id,
                description: note
            })

            toast.success('Nota agregada')
            setNote('')
        } catch (error) {
            console.error('Error adding note:', error)
            toast.error('Error al agregar nota')
        } finally {
            setNoteLoading(false)
        }
    }


    if (loading) return <div className="p-8 text-center">Cargando propiedad...</div>
    if (!property) return <div className="p-8 text-center">Propiedad no encontrada.</div>

    const isOwner = user?.id === property?.agent_id

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/crm')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold truncate max-w-md" title={property.address}>
                        {property.address}
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                        {property.price && (
                            <span className="font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                                {property.currency === 'CLP' ? '$' : property.currency} {new Intl.NumberFormat('es-CL').format(property.price)}
                            </span>
                        )}
                        {property.sold_price > 0 && (
                            <span className="font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded text-xs">
                                Vendida: {property.currency === 'CLP' ? '$' : property.currency} {new Intl.NumberFormat('es-CL').format(property.sold_price)}
                            </span>
                        )}
                        {property.maintenance_fee > 0 && (
                            <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded">
                                GC: ${new Intl.NumberFormat('es-CL').format(property.maintenance_fee)}
                            </span>
                        )}
                        {property.is_exclusive && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-semibold rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900">
                                <Star className="w-2.5 h-2.5" /> Exclusiva
                            </span>
                        )}
                        {property.operation_type && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${property.operation_type === 'arriendo' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
                                {property.operation_type}
                            </span>
                        )}
                        {property.unit_number && <span>• Depto {property.unit_number}</span>}
                        {property.rol_number && <span>• ROL {property.rol_number}</span>}
                        {property.commune && <span>• {property.commune}</span>}
                    </div>
                </div>
                <div className="ml-auto flex gap-2">
                    {isOwner && (
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsActionModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Agregar Acción
                        </Button>
                    )}
                    {isOwner && (
                        <Button variant="outline" onClick={() => setIsEditOpen(true)}>Editar</Button>
                    )}
                    {isOwner && (
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                            setSelectedTask({ property_id: property.id, contact_id: property.owner_id }) // Pre-fill
                            setIsTaskModalOpen(true)
                        }}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nueva Tarea
                        </Button>
                    )}
                    {isOwner && (
                        <Button
                            variant="destructive"
                            size="icon"
                            className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border-0"
                            onClick={async () => {
                                const { count } = await supabase
                                    .from('mandates')
                                    .select('id', { count: 'exact', head: true })
                                    .eq('property_id', id)
                                setMandateCount(count || 0)
                                setIsDeleteDialogOpen(true)
                            }}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Photo Slideshow */}
            {(() => {
                const allSlides = []
                // Check if property.image_url is already covered by property_photos (RE/MAX import)
                const mainUrlInPhotos = property.image_url && photos.some(p => p.url === property.image_url)
                if (property.image_url && !mainUrlInPhotos) {
                    allSlides.push({ url: property.image_url, caption: 'Foto principal', isMain: true })
                }
                photos.forEach(p => allSlides.push({ url: p.url, caption: p.caption, id: p.id, source: p.source }))
                if (allSlides.length === 0) return null
                const safeIndex = Math.min(currentPhotoIndex, allSlides.length - 1)
                return (
                    <div className="w-full h-48 md:h-80 rounded-xl overflow-hidden bg-gray-100 border relative shadow-sm group">
                        <img
                            src={allSlides[safeIndex]?.url}
                            alt={allSlides[safeIndex]?.caption || property.address}
                            className="w-full h-full object-cover transition-opacity duration-300"
                        />
                        {/* Navigation arrows */}
                        {allSlides.length > 1 && (
                            <>
                                <button
                                    onClick={() => setCurrentPhotoIndex(prev => prev <= 0 ? allSlides.length - 1 : prev - 1)}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all"
                                    aria-label="Anterior"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setCurrentPhotoIndex(prev => prev >= allSlides.length - 1 ? 0 : prev + 1)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all"
                                    aria-label="Siguiente"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </>
                        )}
                        {/* Dot indicators — scrollable for many photos */}
                        {allSlides.length > 1 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[80%] overflow-x-auto scrollbar-hide">
                                {allSlides.length <= 20 ? allSlides.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPhotoIndex(i)}
                                        className={`w-2 h-2 rounded-full transition-all flex-shrink-0 ${i === safeIndex ? 'bg-white scale-125 shadow-md' : 'bg-white/50 hover:bg-white/75'}`}
                                    />
                                )) : (
                                    <span className="text-white text-xs font-medium drop-shadow-lg">
                                        {safeIndex + 1} / {allSlides.length}
                                    </span>
                                )}
                            </div>
                        )}
                        {/* Photo counter badge */}
                        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                            <Camera className="w-3 h-3" />
                            {safeIndex + 1} / {allSlides.length}
                        </div>
                    </div>
                )
            })()}

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Info */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Status & Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Estado</h3>
                            <div className="flex flex-wrap gap-1">
                                {property.status?.map((s, i) => (
                                    <Badge key={i} className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">{s}</Badge>
                                ))}
                                {!property.status?.length && <span className="text-sm">-</span>}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Características</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-1" title="Dormitorios">
                                    <BedDouble className="w-4 h-4 text-gray-400" />
                                    <span>{property.bedrooms || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1" title="Baños">
                                    <Bath className="w-4 h-4 text-gray-400" />
                                    <span>{property.bathrooms || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1" title="Superficie">
                                    <Ruler className="w-4 h-4 text-gray-400" />
                                    <span>{property.m2_built || '-'} / {property.m2_total || '-'} m²</span>
                                </div>
                                <div className="flex items-center gap-1" title="Estacionamientos">
                                    <Car className="w-4 h-4 text-gray-400" />
                                    <span>{property.parking_spaces || '-'}</span>
                                </div>
                                {property.floor_number && (
                                    <div className="flex items-center gap-1" title="Piso">
                                        <Layers className="w-4 h-4 text-gray-400" />
                                        <span>Piso {property.floor_number}</span>
                                    </div>
                                )}
                                {property.year_built && (
                                    <div className="flex items-center gap-1" title="Año de Construcción">
                                        <Landmark className="w-4 h-4 text-gray-400" />
                                        <span>{property.year_built}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Dueño</h3>
                            {property.contacts ? (
                                <div className="flex flex-col">
                                    <span className="font-medium cursor-pointer hover:underline text-blue-600" onClick={() => navigate(`/crm/contact/${property.contacts.id}`)}>
                                        {property.contacts.first_name} {property.contacts.last_name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{property.contacts.phone}</span>
                                    <span className="text-xs text-muted-foreground truncate">{property.contacts.email}</span>
                                </div>
                            ) : <span className="text-sm italic">No asignado</span>}
                        </div>
                    </div>

                    {/* Tabs for Details, Docs, Notes */}
                    <Tabs defaultValue="activity" className="w-full">
                        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                            <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Actividad</TabsTrigger>
                            {property.source === 'remax' && (
                                <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent px-4 py-2">
                                    <History className="w-3.5 h-3.5 mr-1.5" /> RE/MAX Timeline
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="photos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-4 py-2">
                                <Camera className="w-3.5 h-3.5 mr-1.5" /> Fotos {photos.length > 0 && <Badge className="ml-1.5 bg-emerald-100 text-emerald-700 text-[10px] px-1.5">{photos.length}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Detalles</TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Notas</TabsTrigger>
                            <TabsTrigger value="links" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Enlaces</TabsTrigger>
                        </TabsList>

                        <TabsContent value="activity" className="py-4 space-y-6">
                            {/* Add Note Section */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border space-y-3">
                                <label className="text-sm font-medium">Agregar Nota / Observación</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Escribe aquí detalles de una visita o nota importante sobre la propiedad..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                                <div className="flex justify-end">
                                    <Button size="sm" onClick={handleAddNote} disabled={noteLoading || !note.trim()}>
                                        {noteLoading ? 'Guardando...' : 'Guardar Nota'}
                                    </Button>
                                </div>
                            </div>

                            <UnifiedTimeline propertyId={id} />
                        </TabsContent>

                        {property.source === 'remax' && (
                            <TabsContent value="timeline" className="py-4">
                                <PropertyTimeline propertyId={id} property={property} />
                            </TabsContent>
                        )}

                        <TabsContent value="photos" className="py-4 space-y-4">
                            {/* Upload area */}
                            {isOwner && (
                                <div className="flex items-center gap-3">
                                    <Button
                                        onClick={() => photoInputRef.current?.click()}
                                        disabled={photoUploading}
                                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        {photoUploading ? (
                                            <><span className="animate-spin">⏳</span> Subiendo...</>
                                        ) : (
                                            <><Upload className="w-4 h-4" /> Subir Fotos</>
                                        )}
                                    </Button>
                                    <span className="text-xs text-muted-foreground">JPG, PNG, WebP · Máx 5MB por foto</span>
                                    <input
                                        ref={photoInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => handlePhotoUpload(Array.from(e.target.files))}
                                    />
                                </div>
                            )}

                            {/* Photo Grid with Drag & Drop Reorder */}
                            {photos.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No hay fotos cargadas para esta propiedad.</p>
                                    {isOwner && <p className="text-xs mt-1">Haz clic en "Subir Fotos" para agregar.</p>}
                                </div>
                            ) : (
                                <>
                                    {isOwner && photos.length > 1 && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                                            <GripVertical className="w-3 h-3" />
                                            Arrastra las fotos para cambiar el orden
                                        </p>
                                    )}
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                        <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {photos.map((photo, idx) => (
                                                    <SortablePhotoCard
                                                        key={photo.id}
                                                        photo={photo}
                                                        idx={idx}
                                                        isOwner={isOwner}
                                                        property={property}
                                                        photos={photos}
                                                        onClickPhoto={(offset) => {
                                                            setCurrentPhotoIndex(offset)
                                                            window.scrollTo({ top: 0, behavior: 'smooth' })
                                                        }}
                                                        onDeletePhoto={(p) => {
                                                            setPhotoToDelete(p)
                                                            setIsDeletePhotoOpen(true)
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="details" className="py-4 space-y-4">
                            <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                                <h3 className="font-medium mb-3">Información General</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="block text-muted-foreground">ID Propiedad</span>
                                        <span>{property.id.slice(0, 8)}...</span>
                                    </div>
                                    <div>
                                        <span className="block text-muted-foreground">Fecha Creación</span>
                                        <span>{new Date(property.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="block text-muted-foreground">Tipo</span>
                                        <span>{property.property_type}</span>
                                    </div>
                                    <div>
                                        <span className="block text-muted-foreground">Operación</span>
                                        <span className="capitalize">{property.operation_type || '-'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-muted-foreground">Dirección Completa</span>
                                        <span>{property.address}{property.unit_number ? `, ${property.unit_number}` : ''}{property.commune ? `, ${property.commune}` : ''}</span>
                                    </div>
                                    <div>
                                        <span className="block text-muted-foreground">ROL</span>
                                        <span>{property.rol_number || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-muted-foreground">Fuente</span>
                                        <span className="capitalize">{property.source || 'manual'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Fechas Importantes */}
                            {(property.published_at || property.expires_at || property.sold_at || property.contract_start_date) && (
                                <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                                    <h3 className="font-medium mb-3 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-indigo-500" /> Fechas
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        {property.published_at && (
                                            <div>
                                                <span className="block text-muted-foreground">Publicada</span>
                                                <span>{new Date(property.published_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {property.last_updated_at && (
                                            <div>
                                                <span className="block text-muted-foreground">Última Actualización</span>
                                                <span>{new Date(property.last_updated_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {property.expires_at && (
                                            <div>
                                                <span className="block text-muted-foreground">Expiración</span>
                                                <span>{new Date(property.expires_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {property.sold_at && (
                                            <div>
                                                <span className="block text-muted-foreground">Fecha Venta/Cierre</span>
                                                <span>{new Date(property.sold_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {property.contract_start_date && (
                                            <div>
                                                <span className="block text-muted-foreground">Inicio Contrato</span>
                                                <span>{new Date(property.contract_start_date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {property.contract_end_date && (
                                            <div>
                                                <span className="block text-muted-foreground">Término Contrato</span>
                                                <span>{new Date(property.contract_end_date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Precio de Venta y Gastos Comunes */}
                            {(property.sold_price > 0 || property.maintenance_fee > 0) && (
                                <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                                    <h3 className="font-medium mb-3 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-green-500" /> Valores Adicionales
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        {property.sold_price > 0 && (
                                            <div>
                                                <span className="block text-muted-foreground">Precio de Venta Real</span>
                                                <span className="font-semibold text-purple-600 dark:text-purple-400">
                                                    {property.currency === 'CLP' ? '$' : property.currency} {new Intl.NumberFormat('es-CL').format(property.sold_price)}
                                                </span>
                                            </div>
                                        )}
                                        {property.maintenance_fee > 0 && (
                                            <div>
                                                <span className="block text-muted-foreground">Gastos Comunes</span>
                                                <span className="font-semibold text-orange-600 dark:text-orange-400">
                                                    ${new Intl.NumberFormat('es-CL').format(property.maintenance_fee)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="notes" className="py-4">
                            <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/20 p-4 min-h-[150px]">
                                <h3 className="font-medium mb-2 text-yellow-800 dark:text-yellow-200">Observaciones</h3>
                                <p className="whitespace-pre-wrap text-sm">
                                    {property.notes ? property.notes.replace(/<br\s*\/?>/gi, '\n') : 'Sin notas.'}
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="links" className="py-4 space-y-4">
                            {property.listing_link && (
                                <a href={property.listing_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <LinkIcon className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <div className="font-medium text-blue-600">Ver Publicación</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-sm">{property.listing_link}</div>
                                    </div>
                                </a>
                            )}
                            {property.documentation_link && (
                                <a href={property.documentation_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <FileText className="w-5 h-5 text-orange-500" />
                                    <div>
                                        <div className="font-medium">Carpeta Documentación</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-sm">{property.documentation_link}</div>
                                    </div>
                                </a>
                            )}
                            {property.virtual_tour_url && (
                                <a href={property.virtual_tour_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <Globe className="w-5 h-5 text-teal-500" />
                                    <div>
                                        <div className="font-medium text-teal-600">Tour Virtual 360°</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-sm">{property.virtual_tour_url}</div>
                                    </div>
                                </a>
                            )}
                            {property.video_url && (
                                <a href={property.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <Video className="w-5 h-5 text-red-500" />
                                    <div>
                                        <div className="font-medium text-red-600">Video</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-sm">{property.video_url}</div>
                                    </div>
                                </a>
                            )}
                            {!property.listing_link && !property.documentation_link && !property.virtual_tour_url && !property.video_url && (
                                <div className="text-sm text-muted-foreground italic">No hay enlaces registrados.</div>
                            )}
                        </TabsContent>
                    </Tabs>

                </div>

                {/* Right Column: Sidebar (Tasks & Participants) */}
                <div className="space-y-6">

                    {/* Tasks Widget */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-hidden">
                        <div className="p-3 border-b bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                            <h3 className="font-medium flex items-center gap-2">
                                <Briefcase className="w-4 h-4" /> Tareas
                            </h3>
                            {/* Simple add task button could go here or main header */}
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                            {tasks.length === 0 ? (
                                <div className="text-center py-4 text-sm text-muted-foreground">Sin tareas pendientes.</div>
                            ) : (
                                tasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm cursor-pointer group"
                                        onClick={() => {
                                            setSelectedTask(task)
                                            setIsTaskModalOpen(true)
                                        }}
                                    >
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={task.completed}
                                                onChange={() => handleTaskToggle(task.id, task.completed)}
                                                className="mt-1 rounded border-gray-300 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`truncate font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.action}</div>
                                            {task.description && (
                                                <div className="text-xs text-muted-foreground truncate">{task.description}</div>
                                            )}
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {task.is_all_day ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="font-bold uppercase tracking-tighter text-[9px] bg-blue-100 text-blue-700 px-1 rounded">Todo el día</span>
                                                        <span>{new Date(task.execution_date.split('T')[0] + 'T00:00:00').toLocaleDateString()}</span>
                                                    </span>
                                                ) : (
                                                    new Date(task.execution_date).toLocaleString()
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Participants Widget */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-hidden">
                        <div className="p-3 border-b bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                            <h3 className="font-medium flex items-center gap-2">
                                <User className="w-4 h-4" /> Relacionados
                            </h3>
                            {isOwner && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    title="Agregar Participante"
                                    onClick={() => setIsAddParticipantOpen(true)}
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                            {participants.length === 0 ? (
                                <div className="text-center py-4 text-sm text-muted-foreground">No hay contactos vinculados.</div>
                            ) : (
                                participants.map(part => (
                                    <div key={part.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm group">
                                        <div
                                            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                                            onClick={() => navigate(`/crm/contact/${part.contact_id}`)}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                                {part.contacts?.first_name[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate hover:text-primary transition-colors">
                                                    {part.contacts?.first_name} {part.contacts?.last_name}
                                                </div>
                                                <div className="text-xs"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${ROLE_COLORS[part.role] || 'bg-gray-100 text-gray-800'}`}>{part.role}</span></div>
                                            </div>
                                        </div>
                                        {isOwner && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                                onClick={() => {
                                                    setParticipantToDelete(part)
                                                    setIsDeleteParticipantOpen(true)
                                                }}
                                            >
                                                <Trash2 className="w-3 h-3 text-red-500" />
                                            </Button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>

            <PropertyForm
                isOpen={isEditOpen}
                onClose={(refresh) => {
                    setIsEditOpen(false)
                    if (refresh) {
                        fetchProperty()
                        fetchParticipants()
                    }
                }}
                property={property}
            />

            <TaskModal
                task={selectedTask}
                isOpen={isTaskModalOpen}
                propertyId={id}
                onClose={(refresh) => {
                    setIsTaskModalOpen(false)
                    setSelectedTask(null)
                    if (refresh) fetchTasks()
                }}
            />

            <AddParticipantModal
                isOpen={isAddParticipantOpen}
                propertyId={id}
                onClose={(refresh) => {
                    setIsAddParticipantOpen(false)
                    if (refresh) {
                        fetchParticipants()
                        fetchProperty()
                    }
                }}
            />

            <ActionModal
                isOpen={isActionModalOpen}
                onClose={(refresh) => {
                    setIsActionModalOpen(false)
                    // You could fetch data again if needed when true saving is implemented
                }}
                defaultPropertyId={id}
            />

            {/* Delete Property Warning Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta propiedad?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                {mandateCount > 0 && (
                                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                                        <span className="text-red-500 text-lg">⚠️</span>
                                        <div className="text-sm text-red-700 dark:text-red-300">
                                            Esta propiedad tiene <strong>{mandateCount} mandato{mandateCount > 1 ? 's' : ''}</strong> asociado{mandateCount > 1 ? 's' : ''}.
                                            Si la eliminas, toda la información de la propiedad se perderá para siempre y los mandatos quedarán sin propiedad vinculada.
                                        </div>
                                    </div>
                                )}
                                <p>
                                    Se eliminará la propiedad <strong>{property?.address}</strong> y todas sus tareas asociadas.
                                </p>
                                <p>
                                    <strong className="text-red-500 font-semibold">Nota Importante:</strong> Los contactos vinculados a esta propiedad
                                    <strong> NO SE BORRARÁN</strong> de tu base de datos, simplemente se desvincularán de aquí.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDeleteProperty()
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDeleteParticipantOpen} onOpenChange={setIsDeleteParticipantOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará la vinculación de <strong>{participantToDelete?.contacts?.first_name} {participantToDelete?.contacts?.last_name}</strong> con esta propiedad. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteParticipant}
                            disabled={isDeletingParticipant}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground focus:ring-destructive"
                        >
                            {isDeletingParticipant ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Photo Confirmation */}
            <AlertDialog open={isDeletePhotoOpen} onOpenChange={setIsDeletePhotoOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta foto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            La foto "{photoToDelete?.caption || 'Sin título'}" será eliminada permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeletePhoto}
                            disabled={isDeletingPhoto}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeletingPhoto ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}

export default PropertyDetail
