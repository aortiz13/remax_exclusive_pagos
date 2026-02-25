import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { X, Save, Calendar, Clock, Check, ChevronsUpDown, Plus, Activity, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { logActivity } from '../../services/activityService'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn, toISOLocal } from "../../lib/utils"
import ContactForm from './ContactForm'
import PropertyForm from './PropertyForm'
import { useNavigate } from 'react-router-dom'

const TaskModal = ({ task, contactId, propertyId, isOpen, onClose }) => {
    const { profile, user } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [linkedEmails, setLinkedEmails] = useState([])
    const [contacts, setContacts] = useState([])
    const [properties, setProperties] = useState([])
    const [openContactSelect, setOpenContactSelect] = useState(false)
    const [openPropertySelect, setOpenPropertySelect] = useState(false)
    const [isContactFormOpen, setIsContactFormOpen] = useState(false)
    const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false)
    const [formData, setFormData] = useState({
        contact_id: contactId || '',
        property_id: propertyId || '',
        action: '',
        description: '',
        execution_date: '',
        execution_time: '',
        reminder_minutes: 'none',
        is_all_day: false
    })

    useEffect(() => {
        if (isOpen) {
            if (!contactId) fetchContacts()
            fetchProperties()
        }
        if (task) {
            let executionDateStr = '';
            let executionTimeStr = '';

            if (task.execution_date) {
                if (task.is_all_day) {
                    executionDateStr = task.execution_date.split('T')[0];
                } else {
                    const dateObj = new Date(task.execution_date);
                    executionDateStr = task.execution_date.split('T')[0];
                    executionTimeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                }
            }

            setFormData({
                contact_id: task.contact_id || contactId || '',
                property_id: task.property_id || propertyId || '',
                action: task.action || '',
                description: task.description || '',
                execution_date: executionDateStr,
                execution_time: executionTimeStr,
                reminder_minutes: task.reminder_minutes ? task.reminder_minutes.toString() : 'none',
                is_all_day: !!task.is_all_day
            })

            // Fetch linked emails for existing tasks
            fetchLinkedEmails(task.id);
        }
    }, [isOpen, contactId, propertyId, task])

    const fetchLinkedEmails = async (taskId) => {
        if (!taskId) return;
        const { data } = await supabase
            .from('email_thread_links')
            .select('id, thread_id, email_threads(id, subject, gmail_thread_id)')
            .eq('task_id', taskId);
        setLinkedEmails(data || []);
    };

    const fetchContacts = async () => {
        const { data } = await supabase.from('contacts').select('id, first_name, last_name').order('first_name')
        setContacts(data || [])
    }

    const fetchProperties = async () => {
        const { data } = await supabase.from('properties').select('id, address').order('address')
        setProperties(data || [])
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Combine date and time
            let dateTime;
            if (formData.is_all_day) {
                // Force 12:00:00 UTC to ensure same local day across timezones
                dateTime = new Date(`${formData.execution_date}T12:00:00Z`);
            } else {
                dateTime = new Date(`${formData.execution_date}T${formData.execution_time || '00:00'}`);
            }

            const dataToSave = {
                contact_id: formData.contact_id || contactId,
                property_id: formData.property_id || null,
                agent_id: profile?.id || user?.id,
                action: formData.action,
                description: formData.description,
                execution_date: dateTime.toISOString(),
                reminder_minutes: formData.reminder_minutes === 'none' ? null : parseInt(formData.reminder_minutes),
                task_type: 'task',
                is_all_day: !!formData.is_all_day
            }

            let error;
            let savedTask = null;
            if (task?.id) {
                const { data, error: updateError } = await supabase
                    .from('crm_tasks')
                    .update(dataToSave)
                    .eq('id', task.id)
                    .select()
                    .single()
                error = updateError
                savedTask = data
            } else {
                const { data, error: insertError } = await supabase
                    .from('crm_tasks')
                    .insert([dataToSave])
                    .select()
                    .single()
                error = insertError
                savedTask = data

                // Also add activity log if new task
                if (!error) {
                    await logActivity({
                        action: 'Tarea',
                        entity_type: 'Tarea', // Or link to contact/prop
                        entity_id: dataToSave.contact_id || dataToSave.property_id,
                        description: `Tarea creada: ${dataToSave.action}`,
                        details: { date: dateTime.toISOString() },
                        contact_id: dataToSave.contact_id,
                        property_id: dataToSave.property_id
                    })
                }
            }

            if (error) throw error

            // Trigger Google Sync
            if (profile?.google_refresh_token && savedTask) {
                await supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'push_to_google', taskId: savedTask.id }
                })
            }

            toast.success(task ? 'Tarea actualizada' : 'Tarea creada')
            onClose(savedTask)
        } catch (error) {
            console.error('Error saving task:', error)
            toast.error('Error al guardar tarea')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose(false)} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative z-50 border border-gray-200 dark:border-gray-800"
            >
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h2 className="text-xl font-bold">{task ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
                    <Button variant="ghost" size="icon" onClick={() => onClose(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar" onWheel={(e) => e.stopPropagation()}>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {task?.crm_actions && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-2">
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                                    <Activity className="w-4 h-4" />
                                    Acción Relacionada: {task.crm_actions.action_type}
                                </div>
                                {task.crm_actions.note && (
                                    <p className="text-sm text-blue-600 dark:text-blue-300 italic">
                                        "{task.crm_actions.note}"
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Linked Emails */}
                        {linkedEmails.length > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-xl border border-green-100 dark:border-green-900/50 space-y-1.5">
                                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-xs uppercase tracking-wider">
                                    <Mail className="w-4 h-4" />
                                    Correos vinculados
                                </div>
                                {linkedEmails.map(link => (
                                    <button
                                        key={link.id}
                                        type="button"
                                        onClick={() => { onClose(false); navigate('/casilla', { state: { openThreadId: link.email_threads?.gmail_thread_id } }); }}
                                        className="w-full text-left flex items-center gap-2 text-sm text-green-700 hover:text-green-900 hover:bg-green-100 px-2 py-1 rounded transition-colors"
                                    >
                                        <Mail className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">{link.email_threads?.subject || '(Sin asunto)'}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!contactId && (
                            <div className="space-y-2">
                                <Label>Contacto <span className="text-red-500">*</span></Label>
                                <Popover open={openContactSelect} onOpenChange={setOpenContactSelect}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openContactSelect}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formData.contact_id
                                                ? contacts.find((c) => c.id === formData.contact_id)?.first_name + " " + contacts.find((c) => c.id === formData.contact_id)?.last_name
                                                : "Seleccionar contacto..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 z-[200]">
                                        <Command>
                                            <CommandInput placeholder="Buscar contacto..." />
                                            <CommandList>
                                                <CommandEmpty>No encontrado.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => {
                                                            setOpenContactSelect(false)
                                                            setIsContactFormOpen(true)
                                                        }}
                                                        className="font-medium text-primary cursor-pointer border-b mb-1 pb-1"
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Crear nuevo contacto
                                                    </CommandItem>
                                                    {contacts.map((contact) => (
                                                        <CommandItem
                                                            key={contact.id}
                                                            value={contact.first_name + " " + contact.last_name}
                                                            onSelect={() => {
                                                                setFormData(prev => ({ ...prev, contact_id: contact.id }))
                                                                setOpenContactSelect(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn("mr-2 h-4 w-4", formData.contact_id === contact.id ? "opacity-100" : "opacity-0")}
                                                            />
                                                            {contact.first_name} {contact.last_name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Propiedad (Opcional)</Label>
                            <Popover open={openPropertySelect} onOpenChange={setOpenPropertySelect}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openPropertySelect}
                                        className="w-full justify-between font-normal"
                                    >
                                        <span className="truncate">
                                            {formData.property_id
                                                ? properties.find((p) => p.id === formData.property_id)?.address
                                                : "Seleccionar propiedad..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0 z-[200]">
                                    <Command>
                                        <CommandInput placeholder="Buscar propiedad..." />
                                        <CommandList>
                                            <CommandEmpty>No encontrada.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    onSelect={() => {
                                                        setOpenPropertySelect(false)
                                                        setIsPropertyFormOpen(true)
                                                    }}
                                                    className="font-medium text-primary cursor-pointer border-b mb-1 pb-1"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Crear nueva propiedad
                                                </CommandItem>
                                                {properties.map((prop) => (
                                                    <CommandItem
                                                        key={prop.id}
                                                        value={prop.address}
                                                        onSelect={() => {
                                                            setFormData(prev => ({ ...prev, property_id: prop.id }))
                                                            setOpenPropertySelect(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn("mr-2 h-4 w-4", formData.property_id === prop.id ? "opacity-100" : "opacity-0")}
                                                        />
                                                        {prop.address}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Título tarea <span className="text-red-500">*</span></label>
                            <Input
                                name="action"
                                value={formData.action}
                                onChange={handleChange}
                                placeholder="Ej: Llamar para seguimiento"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descripción de tarea <span className="text-gray-500 font-normal">(opcional)</span></label>
                            <Textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Detalles adicionales..."
                                className="resize-none h-20"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Fecha</label>
                                <div className="relative">
                                    <Input
                                        type="date"
                                        name="execution_date"
                                        value={formData.execution_date}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Hora</label>
                                <div className="relative">
                                    <Input
                                        type="time"
                                        name="execution_time"
                                        value={formData.execution_time}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Recordatorio</label>
                            <select
                                name="reminder_minutes"
                                value={formData.reminder_minutes}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <option value="none">Sin recordatorio</option>
                                <option value="10">10 min antes</option>
                                <option value="20">20 min antes</option>
                                <option value="30">30 min antes</option>
                                <option value="40">40 min antes</option>
                                <option value="50">50 min antes</option>
                                <option value="60">1 hora antes</option>
                            </select>
                        </div>
                    </form>
                </div>

                <div className="p-4 border-t bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                        <Save className="w-4 h-4" />
                        {loading ? 'Guardando...' : 'Guardar Tarea'}
                    </Button>
                </div>
            </motion.div>

            {isContactFormOpen && (
                <ContactForm
                    isOpen={isContactFormOpen}
                    isSimplified={true}
                    onClose={(newContact) => {
                        setIsContactFormOpen(false)
                        if (newContact) {
                            setContacts(prev => [...prev, newContact])
                            setFormData(prev => ({ ...prev, contact_id: newContact.id }))
                        }
                    }}
                />
            )}

            {isPropertyFormOpen && (
                <PropertyForm
                    isOpen={isPropertyFormOpen}
                    onClose={(didSave) => {
                        setIsPropertyFormOpen(false)
                        if (didSave) {
                            fetchProperties().then(newProps => {
                                // Since fetchProperties doesn't return data, we need to find the latest
                                // This is a bit tricky without the direct object, but PropertyForm usually closes on success
                            })
                            // Refresh properties list
                            fetchProperties()
                        }
                    }}
                />
            )}
        </div>,
        document.body
    )
}

export default TaskModal
