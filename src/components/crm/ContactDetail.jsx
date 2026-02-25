import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Input, Label } from "@/components/ui"
import { ArrowLeft, Edit, Calendar, CheckCircle2, Circle, Trash2, AlertTriangle, Plus, Home } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ContactForm from './ContactForm'
import TaskModal from './TaskModal'
import AddParticipantModal, { ROLE_COLORS } from './AddParticipantModal'
import { toast } from 'sonner'
import Storyline from './Storyline'
import { logActivity } from '../../services/activityService'
import ActionModal from './ActionModal'

const ContactDetail = () => {
    const { profile, user } = useAuth()
    const { id } = useParams()
    const navigate = useNavigate()
    const [contact, setContact] = useState(null)
    // const [activities, setActivities] = useState([]) // Removed legacy local state
    const [tasks, setTasks] = useState([])
    const [relatedProperties, setRelatedProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState(null)
    const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false)
    const [note, setNote] = useState('')
    const [noteLoading, setNoteLoading] = useState(false)

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    // Delete Link State
    const [isDeleteLinkOpen, setIsDeleteLinkOpen] = useState(false)
    const [linkToDelete, setLinkToDelete] = useState(null)
    const [isDeletingLink, setIsDeletingLink] = useState(false)

    // Action Modal State
    const [isActionModalOpen, setIsActionModalOpen] = useState(false)

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

            // 4. Fetch Related Properties via property_contacts (single source of truth)
            const { data: linkedData } = await supabase
                .from('property_contacts')
                .select(`
                    id, 
                    role,
                    property:property_id ( * )
                `)
                .eq('contact_id', id)

            const combined = []
            if (linkedData) {
                linkedData.forEach(link => {
                    const prop = link.property
                    if (prop) {
                        combined.push({ ...prop, role: link.role, linkId: link.id })
                    }
                })
            }

            setRelatedProperties(combined)

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

            const task = tasks.find(t => t.id === taskId)

            // Google Sync
            if (profile?.google_refresh_token && task?.google_event_id) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'push_to_google', taskId: taskId }
                })
            }

            // Log activity for completion
            if (!currentStatus) {
                await logActivity({
                    contact_id: id,
                    action: 'Tarea',
                    entity_type: 'Contacto',
                    entity_id: id,
                    description: `Tarea completada: ${task?.action}`
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

    const handleDeleteLink = async () => {
        if (!linkToDelete) return

        try {
            setIsDeletingLink(true)

            // Delete from property_contacts
            const { error } = await supabase
                .from('property_contacts')
                .delete()
                .eq('id', linkToDelete.linkId)

            if (error) throw error

            // If role was propietario, clear owner_id in properties table
            if (linkToDelete.role === 'propietario') {
                await supabase
                    .from('properties')
                    .update({ owner_id: null })
                    .eq('id', linkToDelete.id)
            }

            // Log activity
            await logActivity({
                action: 'Desvinculó',
                entity_type: 'Contacto',
                entity_id: id,
                description: `Desvinculó propiedad: ${linkToDelete.address} (${linkToDelete.role})`,
                contact_id: id,
                property_id: linkToDelete.id
            })

            toast.success('Vinculación eliminada')
            fetchData()
        } catch (error) {
            console.error('Error deleting link:', error)
            toast.error('Error al eliminar vinculación')
        } finally {
            setIsDeletingLink(false)
            setIsDeleteLinkOpen(false)
            setLinkToDelete(null)
        }
    }

    if (loading) return <div className="p-8 text-center">Cargando detalles...</div>
    if (!contact) return <div className="p-8 text-center">Contacto no encontrado</div>

    const isOwner = user?.id === contact?.agent_id

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/crm')} className="gap-2 pl-0">
                    <ArrowLeft className="w-4 h-4" /> Volver
                </Button>
                <div className="flex items-center gap-2">
                    {isOwner && (
                        <Button onClick={() => setIsActionModalOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="w-4 h-4" /> Agregar Acción
                        </Button>
                    )}
                    {isOwner && (
                        <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)} className="gap-2">
                            <Trash2 className="w-4 h-4" /> Eliminar
                        </Button>
                    )}
                    {isOwner && (
                        <Button onClick={() => setIsEditOpen(true)} className="gap-2">
                            <Edit className="w-4 h-4" /> Editar Contacto
                        </Button>
                    )}
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
                            <p><span className="font-medium text-gray-900 dark:text-gray-200">RUT:</span> {contact.rut || '-'}</p>
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
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSelectedTask(null)
                                    setIsTaskModalOpen(true)
                                }}
                            >+ Nueva Tarea</Button>
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
                                        onClick={() => {
                                            setSelectedTask(task)
                                            setIsTaskModalOpen(true)
                                        }}
                                    >
                                        <div
                                            className={`flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-gray-400 cursor-pointer hover:text-green-500'}`}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                toggleTask(task.id, task.completed)
                                            }}
                                        >
                                            {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>{task.action}</p>
                                            {task.description && (
                                                <p className="text-sm text-gray-500">{task.description}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                {task.is_all_day ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="font-bold uppercase tracking-tighter text-[9px] bg-blue-100 text-blue-700 px-1 rounded">Todo el día</span>
                                                        <span>{new Date(task.execution_date.split('T')[0] + 'T00:00:00').toLocaleDateString()}</span>
                                                    </span>
                                                ) : (
                                                    new Date(task.execution_date).toLocaleString()
                                                )}
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
                            {(contact.bank_name || contact.bank_account_type || contact.bank_account_number) && (
                                <div className="md:col-span-2">
                                    <h3 className="font-medium text-gray-900 dark:text-white border-b pb-2 mb-3">Datos Bancarios</h3>
                                    <dl className="space-y-2 text-sm">
                                        <div className="grid grid-cols-2"><dt className="text-gray-500">Banco:</dt><dd>{contact.bank_name || '-'}</dd></div>
                                        <div className="grid grid-cols-2"><dt className="text-gray-500">Tipo de Cuenta:</dt><dd>{contact.bank_account_type || '-'}</dd></div>
                                        <div className="grid grid-cols-2"><dt className="text-gray-500">Número de Cuenta:</dt><dd>{contact.bank_account_number || '-'}</dd></div>
                                    </dl>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Propiedades Asociadas — always shown */}
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Home className="w-5 h-5" /> Propiedades ({relatedProperties.length})
                        </h2>
                        {isOwner && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAddPropertyOpen(true)}
                                className="gap-1"
                            >
                                <Plus className="w-4 h-4" /> Agregar Propiedad
                            </Button>
                        )}
                    </div>
                    {relatedProperties.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No hay propiedades vinculadas a este contacto.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {relatedProperties.map(prop => (
                                <div
                                    key={prop.linkId || prop.id}
                                    className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-2 cursor-pointer hover:border-primary/50 transition-colors group"
                                    onClick={() => navigate(`/crm/property/${prop.id}`)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{prop.address}</h3>
                                            <div className="text-xs text-muted-foreground">
                                                {prop.commune}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLORS[prop.role] || 'bg-gray-100 text-gray-800'}`}>
                                                    {prop.role}
                                                </span>
                                                {isOwner && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setLinkToDelete(prop)
                                                            setIsDeleteLinkOpen(true)
                                                        }}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-500">
                                                {prop.property_type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Tabs>

            <ContactForm
                contact={contact}
                isOpen={isEditOpen}
                onClose={handleEditClose}
            />

            <TaskModal
                isOpen={isTaskModalOpen}
                onClose={(refresh) => {
                    setIsTaskModalOpen(false)
                    setSelectedTask(null)
                    if (refresh) fetchData()
                }}
                contactId={id}
                task={selectedTask}
            />

            <AddParticipantModal
                isOpen={isAddPropertyOpen}
                mode="from-contact"
                contactId={id}
                onClose={(refresh) => {
                    setIsAddPropertyOpen(false)
                    if (refresh) fetchData()
                }}
            />

            <ActionModal
                isOpen={isActionModalOpen}
                onClose={(refresh) => {
                    setIsActionModalOpen(false)
                    if (refresh) fetchData()
                }}
                defaultContactId={id}
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

            {/* Delete Link Confirmation */}
            <AlertDialog open={isDeleteLinkOpen} onOpenChange={setIsDeleteLinkOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar vinculación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará la relación entre este contacto y la propiedad <strong>{linkToDelete?.address}</strong>.
                            La propiedad y el contacto NO serán eliminados, solo su vinculación.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteLink}
                            disabled={isDeletingLink}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeletingLink ? 'Eliminando...' : 'Eliminar Vinculación'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default ContactDetail
