import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { Button, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Input, Label } from "@/components/ui"
import { ArrowLeft, Edit, Calendar, CheckCircle2, Circle, Trash2, AlertTriangle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs' // Our custom tabs
import ContactForm from './ContactForm'
import TaskModal from './TaskModal'
import { toast } from 'sonner'
import Storyline from './Storyline'
import { logActivity } from '../../services/activityService'

const ContactDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [contact, setContact] = useState(null)
    // const [activities, setActivities] = useState([]) // Removed legacy local state
    const [tasks, setTasks] = useState([])
    const [ownedProperties, setOwnedProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [note, setNote] = useState('')
    const [noteLoading, setNoteLoading] = useState(false)

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        fetchData()
    }, [id])

    const fetchData = async () => {
        try {
            setLoading(true)

            // 1. Fetch Contact
            const { data: contactData, error: contactError } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', id)
                .single()

            if (contactError) throw contactError
            setContact(contactData)

            // 2. Activities handled by Storyline component now

            // 3. Fetch Tasks
            const { data: taskData, error: taskError } = await supabase
                .from('crm_tasks')
                .select('*')
                .eq('contact_id', id)
                .order('execution_date', { ascending: true })

            if (taskError) throw taskError
            setTasks(taskData || [])

            // 4. Fetch Owned Properties
            const { data: propData, error: propError } = await supabase
                .from('properties')
                .select('*')
                .eq('owner_id', id)

            if (propError) throw propError
            setOwnedProperties(propData || [])

        } catch (error) {
            console.error('Error fetching details:', error)
            toast.error('Error al cargar datos del contacto')
        } finally {
            setLoading(false)
        }
    }

    const handleEditClose = (shouldRefresh) => {
        setIsEditOpen(false)
        if (shouldRefresh) fetchData()
    }

    const handleAddNote = async () => {
        if (!note.trim()) return
        try {
            setNoteLoading(true)

            await logActivity({
                contact_id: id,
                action: 'Nota',
                entity_type: 'Contacto',
                entity_id: id,
                description: note
            })

            toast.success('Nota agregada')
            setNote('')
            // fetchData() // Storyline subscribes automatically, but we might trigger refresh if needed
        } catch (error) {
            console.error('Error adding note:', error)
            toast.error('Error al agregar nota')
        } finally {
            setNoteLoading(false)
        }
    }

    const toggleTask = async (taskId, currentStatus) => {
        // Prevent undoing completed tasks
        if (currentStatus) return

        try {
            const { error } = await supabase
                .from('crm_tasks')
                .update({ completed: !currentStatus })
                .eq('id', taskId)

            if (error) throw error

            // Log activity for completion
            if (!currentStatus) {
                await logActivity({
                    contact_id: id,
                    action: 'Tarea',
                    entity_type: 'Contacto',
                    entity_id: id,
                    description: `Tarea completada: ${tasks.find(t => t.id === taskId)?.action}`
                })
            }

            toast.success('Tarea actualizada')
            fetchData() // Refresh tasks
        } catch (error) {
            console.error('Error updating task:', error)
            toast.error('Error al actualizar tarea')
        }
    }

    const handleDeleteContact = async () => {
        if (deleteConfirmation !== 'ELIMINAR') return

        try {
            setIsDeleting(true)
            const { error, count } = await supabase
                .from('contacts')
                .delete({ count: 'exact' })
                .eq('id', id)

            if (error) throw error
            if (count === 0) throw new Error('No se pudo eliminar (verifique permisos)')

            toast.success('Contacto eliminado correctamente')
            navigate('/crm')
        } catch (error) {
            console.error('Error deleting contact:', error)
            toast.error('Error al eliminar contacto: ' + (error.message || 'Error desconocido'))
            setIsDeleting(false)
        }
    }

    if (loading) return <div className="p-8 text-center">Cargando detalles...</div>
    if (!contact) return <div className="p-8 text-center">Contacto no encontrado</div>

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/crm')} className="gap-2 pl-0">
                    <ArrowLeft className="w-4 h-4" /> Volver
                </Button>
                <div className="flex items-center gap-2">
                    <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)} className="gap-2">
                        <Trash2 className="w-4 h-4" /> Eliminar
                    </Button>
                    <Button onClick={() => setIsEditOpen(true)} className="gap-2">
                        <Edit className="w-4 h-4" /> Editar Contacto
                    </Button>
                </div>
            </div>

            {/* Main Info Card */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            {contact.first_name} {contact.last_name}
                        </h1>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium dark:bg-blue-900 dark:text-blue-300">
                                {contact.status}
                            </span>
                            {contact.rating && <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium dark:bg-yellow-900 dark:text-yellow-300">
                                {contact.rating}
                            </span>}
                            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium dark:bg-gray-800 dark:text-gray-300">
                                {contact.need}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                            <p><span className="font-medium text-gray-900 dark:text-gray-200">Email:</span> {contact.email || '-'}</p>
                            <p><span className="font-medium text-gray-900 dark:text-gray-200">Teléfono:</span> {contact.phone || '-'}</p>
                            <p><span className="font-medium text-gray-900 dark:text-gray-200">Profesión:</span> {contact.profession || '-'}</p>
                            <p><span className="font-medium text-gray-900 dark:text-gray-200">Fuente:</span> {contact.source || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs for Storyline / Tasks / Detailed Info */}
            <Tabs defaultValue="storyline" className="w-full">
                <TabsList className="grid w-full max-w-[600px] grid-cols-3">
                    <TabsTrigger value="storyline">Storyline</TabsTrigger>
                    <TabsTrigger value="tasks">Tareas ({tasks.length})</TabsTrigger>
                    <TabsTrigger value="details">Detalles Completos</TabsTrigger>
                </TabsList>

                <TabsContent value="storyline" className="mt-6">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-6">

                        {/* Add Note Section */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border space-y-3">
                            <label className="text-sm font-medium">Agregar Nota / Observación</label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Escribe aquí detalles de una llamada o nota importante..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <Button size="sm" onClick={handleAddNote} disabled={noteLoading || !note.trim()}>
                                    {noteLoading ? 'Guardando...' : 'Guardar Nota'}
                                </Button>
                            </div>
                        </div>

                        <h2 className="text-xl font-semibold mb-6">Actividad Reciente</h2>
                        <Storyline contactId={id} />
                    </div>
                </TabsContent>

                <TabsContent value="tasks" className="mt-6">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold">Tareas Pendientes</h2>
                            <Button variant="outline" size="sm" onClick={() => setIsTaskModalOpen(true)}>+ Nueva Tarea</Button>
                        </div>
                        {/* Task List */}
                        {tasks.length === 0 ? (
                            <p className="text-gray-500">No hay tareas pendientes.</p>
                        ) : (
                            <ul className="space-y-3">
                                {tasks.map(task => (
                                    <li
                                        key={task.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/50 transition-colors ${task.completed ? 'opacity-60 cursor-default' : 'hover:bg-gray-100 cursor-pointer'}`}
                                        onClick={() => !task.completed && toggleTask(task.id, task.completed)}
                                    >
                                        <div className={`flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-gray-400'}`}>
                                            {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>{task.action}</p>
                                            {task.description && (
                                                <p className="text-sm text-gray-500">{task.description}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(task.execution_date).toLocaleString()}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="details" className="mt-6">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-6">
                        <h2 className="text-xl font-semibold mb-4">Información Completa</h2>
                        {/* Recursive display of all fields or categorized */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white border-b pb-2 mb-3">Personal</h3>
                                <dl className="space-y-2 text-sm">
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Sexo:</dt><dd>{contact.sex || '-'}</dd></div>
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Fecha Nac:</dt><dd>{contact.dob || '-'}</dd></div>
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Religión:</dt><dd>{contact.religion || '-'}</dd></div>
                                </dl>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white border-b pb-2 mb-3">Familiar</h3>
                                <dl className="space-y-2 text-sm">
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Padre/Madre:</dt><dd>{contact.parent_status} {contact.parent_notes ? `(${contact.parent_notes})` : ''}</dd></div>
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Grupo Familiar:</dt><dd>{contact.family_group || '-'}</dd></div>
                                </dl>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white border-b pb-2 mb-3">Ubicación</h3>
                                <dl className="space-y-2 text-sm">
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Dirección:</dt><dd>{contact.address || '-'}</dd></div>
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Comuna:</dt><dd>{contact.barrio_comuna || '-'}</dd></div>
                                </dl>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white border-b pb-2 mb-3">Otros</h3>
                                <dl className="space-y-2 text-sm">
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Fuente Detalle:</dt><dd>{contact.source_detail || '-'}</dd></div>
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Sobre la persona:</dt><dd>{contact.about || '-'}</dd></div>
                                    <div className="grid grid-cols-2"><dt className="text-gray-500">Observaciones:</dt><dd>{contact.observations || '-'}</dd></div>
                                </dl>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {ownedProperties.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mt-6">
                        <h2 className="text-xl font-semibold mb-4">Propiedades (Dueño)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {ownedProperties.map(prop => (
                                <div
                                    key={prop.id}
                                    className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-2 cursor-pointer hover:border-primary/50 transition-colors group"
                                    onClick={() => navigate(`/crm/property/${prop.id}`)}
                                >
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{prop.address}</h3>
                                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
                                            {prop.property_type}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {prop.commune}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Tabs>

            <ContactForm
                contact={contact}
                isOpen={isEditOpen}
                onClose={handleEditClose}
            />

            <TaskModal
                contactId={id}
                isOpen={isTaskModalOpen}
                onClose={(refresh) => {
                    setIsTaskModalOpen(false)
                    if (refresh) fetchData()
                }}
            />

            {/* Delete Confirmation Alert */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" /> Eliminar Contacto
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción es <strong>irrevocable</strong>. El contacto y todos sus datos asociados (historial, tareas, notas) serán eliminados permanentemente.
                            <br /><br />
                            Para confirmar, escribe la palabra <strong>ELIMINAR</strong> en el siguiente campo:
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-2">
                        <Label htmlFor="confirm-delete" className="sr-only">Confirmar eliminación</Label>
                        <Input
                            id="confirm-delete"
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder="ELIMINAR"
                            className="border-red-300 focus-visible:ring-red-500"
                            autoComplete="off"
                        />
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteContact}
                            disabled={deleteConfirmation !== 'ELIMINAR' || isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar Definitivamente'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}

export default ContactDetail
