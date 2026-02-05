import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { X, Save, Calendar, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
// import {
//     Command,
//     CommandEmpty,
//     CommandGroup,
//     CommandInput,
//     CommandItem,
// } from "@/components/ui/command" // If available, otherwise simple select
// Since I don't know if command is available, I'll use a simple select with search logic

const TaskModal = ({ task, contactId, isOpen, onClose }) => {
    const { profile, user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [contacts, setContacts] = useState([])
    const [properties, setProperties] = useState([])
    const [formData, setFormData] = useState({
        contact_id: contactId || '',
        property_id: '',
        action: '',
        description: '',
        execution_date: '',
        execution_time: '',
    })

    useEffect(() => {
        if (isOpen) {
            if (!contactId) fetchContacts()
            fetchProperties()
        }
        if (task) {
            const dateObj = task.execution_date ? new Date(task.execution_date) : new Date()
            setFormData({
                contact_id: task.contact_id || contactId || '',
                property_id: task.property_id || '',
                action: task.action || '',
                description: task.description || '',
                execution_date: task.execution_date ? task.execution_date.split('T')[0] : '',
                execution_time: task.execution_date ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            })
        }
    }, [isOpen, contactId, task])

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
            const dateTime = new Date(`${formData.execution_date}T${formData.execution_time || '00:00'}`)

            const dataToSave = {
                contact_id: formData.contact_id || contactId,
                property_id: formData.property_id || null,
                agent_id: profile?.id || user?.id,
                action: formData.action,
                description: formData.description,
                execution_date: dateTime.toISOString(),
            }

            let error;
            if (task?.id) {
                const { error: updateError } = await supabase
                    .from('crm_tasks')
                    .update(dataToSave)
                    .eq('id', task.id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('crm_tasks')
                    .insert([dataToSave])
                error = insertError

                // Also add activity log if new task
                if (!error) {
                    await supabase.from('contact_activities').insert([{
                        contact_id: dataToSave.contact_id,
                        agent_id: dataToSave.agent_id,
                        type: 'task_created',
                        description: `Tarea creada: ${dataToSave.action} para ${dateTime.toLocaleString()}`
                    }])
                }
            }

            if (error) throw error

            toast.success(task ? 'Tarea actualizada' : 'Tarea creada')
            onClose(true)
        } catch (error) {
            console.error('Error saving task:', error)
            toast.error('Error al guardar tarea')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {!contactId && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Contacto</label>
                            <select
                                name="contact_id"
                                value={formData.contact_id}
                                onChange={handleChange}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="">Seleccionar Contacto</option>
                                {contacts.map(c => (
                                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Propiedad (Opcional)</Label>
                        <select
                            name="property_id"
                            value={formData.property_id}
                            onChange={handleChange}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Seleccionar propiedad...</option>
                            {properties.map(property => (
                                <option key={property.id} value={property.id}>
                                    {property.address}
                                </option>
                            ))}
                        </select>
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
                </form>

                <div className="p-4 border-t bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                        <Save className="w-4 h-4" />
                        {loading ? 'Guardando...' : 'Guardar Tarea'}
                    </Button>
                </div>
            </motion.div>
        </div>,
        document.body
    )
}

export default TaskModal
