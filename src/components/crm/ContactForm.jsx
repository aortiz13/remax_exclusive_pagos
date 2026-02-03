import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Textarea, Select, Label, Switch, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, Badge } from '@/components/ui'
import { X, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'

const Section = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children}
        </div>
    </div>
)

const ContactForm = ({ contact, isOpen, onClose }) => {
    const { profile, user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        sex: '',
        dob: '',
        religion: '',
        profession: '',
        occupation: '',
        parent_status: 'No',
        parent_notes: '',
        family_group: '',
        source: '',
        source_detail: '',
        neighborhood: '',
        address: '',
        barrio_comuna: '',
        phone: '',
        email: '',
        rating: '',
        rating_80_20: '',
        status: 'Activo',
        about: '',
        need: 'Comprar',
        need_other: '',
        last_contact_date: '',
        next_contact_date: '',
        current_action: '',
        observations: ''
    })

    useEffect(() => {
        if (contact) {
            setFormData({
                ...contact,
                dob: contact.dob || '',
                last_contact_date: contact.last_contact_date ? contact.last_contact_date.split('T')[0] : '', // simple date handling
                next_contact_date: contact.next_contact_date ? contact.next_contact_date.split('T')[0] : ''
            })
        }
    }, [contact])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const dataToSave = {
                ...formData,
                agent_id: profile?.id || user?.id,
                updated_at: new Date().toISOString()
            }

            // Clean up empty dates
            if (!dataToSave.dob) dataToSave.dob = null;
            if (!dataToSave.last_contact_date) dataToSave.last_contact_date = null;
            if (!dataToSave.next_contact_date) dataToSave.next_contact_date = null;

            let error;
            if (contact?.id) {
                const { error: updateError } = await supabase
                    .from('contacts')
                    .update(dataToSave)
                    .eq('id', contact.id)
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('contacts')
                    .insert([dataToSave])
                error = insertError;
            }

            if (error) throw error

            toast.success(contact ? 'Contacto actualizado' : 'Contacto creado')
            onClose(true) // refresh
        } catch (error) {
            console.error('Error saving contact:', error)
            toast.error('Error al guardar contacto')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose(false)} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative z-50 border border-gray-200 dark:border-gray-800"
            >
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h2 className="text-xl font-bold">{contact ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
                    <Button variant="ghost" size="icon" onClick={() => onClose(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <Section title="Información Personal">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre</label>
                            <Input name="first_name" value={formData.first_name} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Apellido</label>
                            <Input name="last_name" value={formData.last_name} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Sexo</label>
                            <select
                                name="sex"
                                value={formData.sex}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Seleccionar</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fecha de Nacimiento</label>
                            <Input type="date" name="dob" value={formData.dob} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Religión</label>
                            <Input name="religion" value={formData.religion} onChange={handleChange} />
                        </div>
                    </Section>

                    <Section title="Información Laboral & Familiar">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Profesión</label>
                            <Input name="profession" value={formData.profession} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ocupación</label>
                            <Input name="occupation" value={formData.occupation} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Padre/Madre</label>
                            <select
                                name="parent_status"
                                value={formData.parent_status}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="No">No</option>
                                <option value="Si">Si</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        {formData.parent_status !== 'No' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Detalle Padre/Madre</label>
                                <Input name="parent_notes" value={formData.parent_notes} onChange={handleChange} placeholder="Detalles..." />
                            </div>
                        )}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Grupo Familiar</label>
                            <Textarea name="family_group" value={formData.family_group} onChange={handleChange} placeholder="Información sobre la familia..." />
                        </div>
                    </Section>

                    <Section title="Contacto & Ubicación">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Teléfono</label>
                            <Input name="phone" value={formData.phone} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Correo</label>
                            <Input type="email" name="email" value={formData.email} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Barrio/Comuna</label>
                            <Input name="barrio_comuna" value={formData.barrio_comuna || formData.comuna} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Domicilio</label>
                            <Input name="address" value={formData.address} onChange={handleChange} />
                        </div>
                    </Section>

                    <Section title="Detalles & Clasificación">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fuente</label>
                            <Input name="source" value={formData.source} onChange={handleChange} placeholder="Ej: Portales, Referido..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Detalle Fuente</label>
                            <Input name="source_detail" value={formData.source_detail} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Calificación (A+)</label>
                            <Input name="rating" value={formData.rating} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Calificación 80/20</label>
                            <Input name="rating_80_20" value={formData.rating_80_20} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Estado</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="Activo">Activo</option>
                                <option value="Inactivo">Inactivo</option>
                            </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Sobre la persona</label>
                            <Textarea name="about" value={formData.about} onChange={handleChange} placeholder="Hobbies, gustos, club, etc..." className="min-h-[100px]" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Necesidad</label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start font-normal">
                                        {formData.need ? (
                                            <div className="flex flex-wrap gap-1">
                                                {formData.need.split(',').map((n, i) => (
                                                    <span key={i} className="bg-slate-100 text-slate-800 text-xs px-2 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-300">
                                                        {n.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Seleccionar necesidades...</span>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="start">
                                    {['Comprar', 'Arrendar', 'Invertir', 'Vender', 'Otro'].map((option) => {
                                        const currentNeeds = formData.need ? formData.need.split(',').map(s => s.trim()) : []
                                        const isChecked = currentNeeds.includes(option)

                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={option}
                                                checked={isChecked}
                                                onSelect={(e) => {
                                                    e.preventDefault()
                                                    let newNeeds = [...currentNeeds]
                                                    if (!isChecked) {
                                                        newNeeds.push(option)
                                                    } else {
                                                        newNeeds = newNeeds.filter(n => n !== option)
                                                    }
                                                    setFormData(prev => ({ ...prev, need: newNeeds.join(', ') }))
                                                }}
                                            >
                                                {option}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        {formData.need?.includes('Otro') && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Otra Necesidad (Detalle)</label>
                                <Input name="need_other" value={formData.need_other} onChange={handleChange} />
                            </div>
                        )}
                    </Section>

                    <Section title="Planificación & Seguimiento">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fecha Ultimo Contacto</label>
                            <Input type="date" name="last_contact_date" value={formData.last_contact_date} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Próxima Fecha Contacto</label>
                            <Input type="date" name="next_contact_date" value={formData.next_contact_date} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Acción</label>
                            <Input name="current_action" value={formData.current_action} onChange={handleChange} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Observaciones</label>
                            <Textarea name="observations" value={formData.observations} onChange={handleChange} />
                        </div>
                    </Section>

                </form>

                <div className="p-4 border-t bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                        <Save className="w-4 h-4" />
                        {loading ? 'Guardando...' : 'Guardar Contacto'}
                    </Button>
                </div>
            </motion.div>
        </div>,
        document.body
    )
}

export default ContactForm
