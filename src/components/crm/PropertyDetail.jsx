import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge, Separator, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui'
import { ArrowLeft, User, MapPin, Building, Ruler, BedDouble, Bath, Link as LinkIcon, FileText, Briefcase, Plus, Filter, Trash2 } from 'lucide-react'
import { supabase } from '../../services/supabase'
import PropertyForm from './PropertyForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TaskModal from './TaskModal'
import AddParticipantModal from './AddParticipantModal'
import Storyline from './Storyline'
import { logActivity } from '../../services/activityService'
import { toast } from 'sonner'

const PropertyDetail = () => {
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

    useEffect(() => {
        fetchProperty()
        fetchTasks()
        fetchParticipants()
    }, [id])

    const handleDeleteProperty = async () => {
        setIsDeleting(true)
        try {
            // 1. Delete associated tasks manually (NO ACTION constraint)
            const { error: tasksError } = await supabase
                .from('crm_tasks')
                .delete()
                .eq('property_id', id)

            if (tasksError) throw tasksError

            // 2. Delete the property (Contacts/Logs will CASCADE)
            const { error: propertyError } = await supabase
                .from('properties')
                .delete()
                .eq('id', id)

            if (propertyError) throw propertyError

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


    const handleTaskToggle = async (taskId, currentStatus) => {
        // Optimistic
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t))
        await supabase.from('crm_tasks').update({ completed: !currentStatus }).eq('id', taskId)

        if (!currentStatus) {
            const task = tasks.find(t => t.id === taskId)
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
            if (participantToDelete.role === 'Dueño') {
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
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        {property.price && (
                            <span className="font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                                {property.currency === 'CLP' ? '$' : property.currency} {new Intl.NumberFormat('es-CL').format(property.price)}
                            </span>
                        )}
                        {property.unit_number && <span>• Depto {property.unit_number}</span>}
                        {property.commune && <span>• {property.commune}</span>}
                    </div>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditOpen(true)}>Editar</Button>
                    <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                        setSelectedTask({ property_id: property.id, contact_id: property.owner_id }) // Pre-fill
                        setIsTaskModalOpen(true)
                    }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Tarea
                    </Button>
                    <Button
                        variant="destructive"
                        size="icon"
                        className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border-0"
                        onClick={() => setIsDeleteDialogOpen(true)}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Image Banner */}
            {property.image_url && (
                <div className="w-full h-48 md:h-80 rounded-xl overflow-hidden bg-gray-100 border relative shadow-sm">
                    <img
                        src={property.image_url}
                        alt={property.address}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

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
                                <div className="flex items-center gap-1 col-span-2" title="Superficie">
                                    <Ruler className="w-4 h-4 text-gray-400" />
                                    <span>{property.m2_built || '-'} / {property.m2_total || '-'} m²</span>
                                </div>
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

                            <Storyline propertyId={id} />
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
                                    <div className="col-span-2">
                                        <span className="block text-muted-foreground">Dirección Completa</span>
                                        <span>{property.address}, {property.unit_number}, {property.commune}</span>
                                    </div>
                                </div>
                            </div>
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
                            {!property.listing_link && !property.documentation_link && (
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
                                            <div className="text-xs text-muted-foreground mt-0.5">{new Date(task.execution_date).toLocaleString()}</div>
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
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                title="Agregar Participante"
                                onClick={() => setIsAddParticipantOpen(true)}
                            >
                                <Plus className="w-3 h-3" />
                            </Button>
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
                                                <div className="text-xs text-muted-foreground">{part.role}</div>
                                            </div>
                                        </div>
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
                    if (refresh) fetchProperty()
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

            {/* Delete Property Warning Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta propiedad?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción es permanente. Se eliminará la propiedad y todas sus tareas asociadas.
                            <br /><br />
                            <strong className="text-red-500 font-semibold">Nota Importante:</strong> Los contactos vinculados a esta propiedad
                            <strong> NO SE BORRARÁN</strong> de tu base de datos, simplemente se desvincularán de aquí.
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
        </div >
    )
}

export default PropertyDetail
