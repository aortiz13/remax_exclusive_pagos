import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge, Separator } from '@/components/ui'
import { ArrowLeft, User, MapPin, Building, Ruler, BedDouble, Bath, Link as LinkIcon, FileText, Briefcase, Plus, Filter, Trash2 } from 'lucide-react'
import { supabase } from '../../services/supabase'
import PropertyForm from './PropertyForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TaskModal from './TaskModal'

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

    useEffect(() => {
        fetchProperty()
        fetchTasks()
        fetchParticipants()
    }, [id])

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
    }

    // Placeholder for deleting participant
    const handleDeleteParticipant = async (participantId) => {
        if (!confirm('¿Estás seguro?')) return;
        await supabase.from('property_contacts').delete().eq('id', participantId)
        fetchParticipants()
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
                    <h1 className="text-2xl font-bold">{property.address}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Badge variant="outline">{property.property_type}</Badge>
                        <span>{property.commune}</span>
                        {property.unit_number && <span>• Unidad {property.unit_number}</span>}
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
                </div>
            </div>

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
                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Detalles</TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Notas</TabsTrigger>
                            <TabsTrigger value="links" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Enlaces</TabsTrigger>
                        </TabsList>

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
                                <p className="whitespace-pre-wrap text-sm">{property.notes || 'Sin notas.'}</p>
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
                                    <div key={task.id} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={task.completed}
                                            onChange={() => handleTaskToggle(task.id, task.completed)}
                                            className="mt-1 rounded border-gray-300"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className={`truncate ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.action}</div>
                                            <div className="text-xs text-muted-foreground">{new Date(task.execution_date).toLocaleDateString()}</div>
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
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Próximamente">
                                <Plus className="w-3 h-3" />
                            </Button>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                            {participants.length === 0 ? (
                                <div className="text-center py-4 text-sm text-muted-foreground">No hay contactos vinculados.</div>
                            ) : (
                                participants.map(part => (
                                    <div key={part.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm group">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                            {part.contacts?.first_name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{part.contacts?.first_name} {part.contacts?.last_name}</div>
                                            <div className="text-xs text-muted-foreground">{part.role}</div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteParticipant(part.id)}>
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
                onClose={(refresh) => {
                    setIsTaskModalOpen(false)
                    setSelectedTask(null)
                    if (refresh) fetchTasks()
                }}
            />
        </div>
    )
}

export default PropertyDetail
