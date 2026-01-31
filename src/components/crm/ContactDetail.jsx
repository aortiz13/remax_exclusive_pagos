import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { Button } from "@/components/ui"
import { ArrowLeft, Edit, Calendar, CheckCircle2, Circle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs' // Our custom tabs
import ContactForm from './ContactForm'
import TaskModal from './TaskModal'
import { toast } from 'sonner'

const ContactDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [contact, setContact] = useState(null)
    const [activities, setActivities] = useState([])
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [note, setNote] = useState('')
    const [noteLoading, setNoteLoading] = useState(false)

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

            // 2. Fetch Activities (Storyline)
            const { data: activityData, error: activityError } = await supabase
                .from('contact_activities')
                .select('*')
                .eq('contact_id', id)
                .order('created_at', { ascending: false })

            if (activityError) throw activityError
            setActivities(activityData || [])

            // 3. Fetch Tasks
            const { data: taskData, error: taskError } = await supabase
                .from('crm_tasks')
                .select('*')
                .eq('contact_id', id)
                .order('execution_date', { ascending: true })

            if (taskError) throw taskError
            setTasks(taskData || [])

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
            const { error } = await supabase
                .from('contact_activities')
                .insert([{
                    contact_id: id,
                    type: 'note',
                    description: note
                }])

            if (error) throw error
            toast.success('Nota agregada')
            setNote('')
            fetchData() // Refresh activities
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
                await supabase.from('contact_activities').insert([{
                    contact_id: id,
                    type: 'task_completed',
                    description: `Tarea completada: ${tasks.find(t => t.id === taskId)?.action}`
                }])
            }

            toast.success('Tarea actualizada')
            fetchData() // Refresh tasks
        } catch (error) {
            console.error('Error updating task:', error)
            toast.error('Error al actualizar tarea')
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
                <Button onClick={() => setIsEditOpen(true)} className="gap-2">
                    <Edit className="w-4 h-4" /> Editar Contacto
                </Button>
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
                        <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3 space-y-8">
                            {activities.length === 0 ? (
                                <p className="ml-6 text-gray-500">No hay actividad registrada.</p>
                            ) : activities.map((activity, idx) => (
                                <div key={activity.id} className="relative ml-6">
                                    <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-8 ring-white dark:ring-gray-900 ${activity.type === 'note' ? 'bg-yellow-100 dark:bg-yellow-900' :
                                        activity.type === 'task_completed' ? 'bg-green-100 dark:bg-green-900' :
                                            'bg-blue-100 dark:bg-blue-900'
                                        }`}>
                                        <div className={`h-2 w-2 rounded-full ${activity.type === 'note' ? 'bg-yellow-600 dark:bg-yellow-400' :
                                            activity.type === 'task_completed' ? 'bg-green-600 dark:bg-green-400' :
                                                'bg-blue-600 dark:bg-blue-400'
                                            }`} />
                                    </span>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {activity.type === 'creation' && 'Contacto Creado'}
                                            {activity.type === 'update' && 'Información Actualizada'}
                                            {activity.type === 'task_created' && 'Tarea Creada'}
                                            {activity.type === 'task_completed' && 'Tarea Completada'}
                                            {activity.type === 'note' && 'Nota Agregada'}
                                            {!['creation', 'update', 'task_created', 'task_completed', 'note'].includes(activity.type) && activity.type}
                                        </p>
                                        <span className="text-xs text-gray-500 whitespace-nowrap">
                                            {new Date(activity.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                        {activity.description}
                                    </p>
                                </div>
                            ))}
                        </div>
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
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
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
        </div>
    )
}

export default ContactDetail
