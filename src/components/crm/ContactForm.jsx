import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Textarea, Select, Label, Switch, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, Badge } from '@/components/ui'
import { X, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Check, ChevronsUpDown } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { cn } from "@/lib/utils"

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
    const [properties, setProperties] = useState([])
    const [openPropertySelect, setOpenPropertySelect] = useState(false)
    const [selectedPropertyId, setSelectedPropertyId] = useState(null)

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
        need: 'Comprar', // Initial default as string, but we'll parse it
        need_other: '',
        last_contact_date: '',
        next_contact_date: '',
        current_action: '',
        observations: ''
    })

    // Internal state for multi-select need
    const [selectedNeeds, setSelectedNeeds] = useState(['Comprar'])

    useEffect(() => {
        if (contact) {
            setFormData({
                ...contact,
                dob: contact.dob || '',
                last_contact_date: contact.last_contact_date ? contact.last_contact_date.split('T')[0] : '',
                next_contact_date: contact.next_contact_date ? contact.next_contact_date.split('T')[0] : ''
            })
            // Parse existing needs (comma separated)
            if (contact.need) {
                const needsArray = contact.need.split(',').map(s => s.trim())
                setSelectedNeeds(needsArray)
            } else {
                setSelectedNeeds([])
            }
        } else {
            // Default for new contact
            setSelectedNeeds(['Comprar'])
        }
        fetchProperties()
    }, [contact])

    const fetchProperties = async () => {
        try {
            const { data } = await supabase.from('properties').select('id, address, commune')
            setProperties(data || [])

            // Try to find if this contact is already an owner of a property (just taking the first found for now)
            if (contact?.id) {
                const { data: ownedProps } = await supabase
                    .from('properties')
                    .select('id')
                    .eq('owner_id', contact.id)
                    .limit(1)

                if (ownedProps && ownedProps.length > 0) {
                    setSelectedPropertyId(ownedProps[0].id)
                }
            }
        } catch (error) {
            console.error('Error fetching properties', error)
        }
    }

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
                need: selectedNeeds.join(', '), // Save as comma separated string
                agent_id: profile?.id || user?.id,
                updated_at: new Date().toISOString()
            }

            // Clean up empty dates
            if (!dataToSave.dob) dataToSave.dob = null;
            if (!dataToSave.last_contact_date) dataToSave.last_contact_date = null;
            if (!dataToSave.next_contact_date) dataToSave.next_contact_date = null;

            if (!contact?.id) {
                // Create
                const { data: newContactData, error: insertError } = await supabase
                    .from('contacts')
                    .insert([dataToSave])
                    .select()
                    .single()

                if (insertError) throw insertError

                // If property selected, update property owner
                // Log Creation Activity
                await supabase.from('contact_activities').insert([{
                    contact_id: newContactData.id,
                    type: 'creation',
                    description: 'Contacto creado en el sistema'
                }])

                if (selectedPropertyId && newContactData) {
                    await supabase
                        .from('properties')
                        .update({ owner_id: newContactData.id })
                        .eq('id', selectedPropertyId)

                    // Log Property Link Activity
                    const propAddress = properties.find(p => p.id === selectedPropertyId)?.address || 'Propiedad'
                    await supabase.from('contact_activities').insert([{
                        contact_id: newContactData.id,
                        type: 'property_link',
                        description: `Se vinculó como dueño de la propiedad: ${propAddress}`
                    }])
                }

                toast.success('Contacto creado')
                onClose(newContactData)
            } else {
                // Update
                const { error: updateError } = await supabase
                    .from('contacts')
                    .update(dataToSave)
                    .eq('id', contact.id)
                if (updateError) throw updateError

                // If property selected, update property owner
                // Log Update Activity
                await supabase.from('contact_activities').insert([{
                    contact_id: contact.id,
                    type: 'update',
                    description: 'Se actualizó la información del contacto'
                }])

                if (selectedPropertyId) {
                    await supabase
                        .from('properties')
                        .update({ owner_id: contact.id })
                        .eq('id', selectedPropertyId)

                    // Log Property Link Activity
                    const propAddress = properties.find(p => p.id === selectedPropertyId)?.address || 'Propiedad'
                    await supabase.from('contact_activities').insert([{
                        contact_id: contact.id,
                        type: 'property_link',
                        description: `Se vinculó como dueño de la propiedad: ${propAddress}`
                    }])
                }

                toast.success('Contacto actualizado')
                onClose({ ...dataToSave, id: contact.id })
            }

        } catch (error) {
            console.error('Error saving contact:', error)
            toast.error('Error al guardar contacto')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
                    >
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {contact ? 'Editar Contacto' : 'Nuevo Contacto'}
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => onClose()} className="rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                                <X className="h-5 w-5 text-gray-500" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <form id="contact-form" onSubmit={handleSubmit} className="space-y-6">

                                {/* Section: Información Principal */}
                                <Section title="Información General">
                                    <div className="space-y-2">
                                        <Label>Nombre <span className="text-red-500">*</span></Label>
                                        <Input name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Juan" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Apellido <span className="text-red-500">*</span></Label>
                                        <Input name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Pérez" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fuente (Origen)</Label>
                                        <select
                                            name="source"
                                            value={formData.source}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="Referido">Referido</option>
                                            <option value="Portal">Portal Inmobiliario</option>
                                            <option value="Redes Sociales">Redes Sociales</option>
                                            <option value="Web">Web</option>
                                            <option value="Llamado">Llamado Directo</option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estado</Label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="Activo">Activo</option>
                                            <option value="Inactivo">Inactivo</option>
                                            <option value="Archivado">Archivado</option>
                                            <option value="En Seguimiento">En Seguimiento</option>
                                            <option value="Cliente">Cliente (Cerrado)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Necesidad</Label>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {['Comprar', 'Vender', 'Arrendar', 'Invertir'].map((option) => (
                                                <Badge
                                                    key={option}
                                                    variant={selectedNeeds.includes(option) ? "default" : "outline"}
                                                    className="cursor-pointer hover:opacity-80 px-4 py-1.5 text-sm"
                                                    onClick={() => {
                                                        if (selectedNeeds.includes(option)) {
                                                            setSelectedNeeds(prev => prev.filter(p => p !== option))
                                                        } else {
                                                            setSelectedNeeds(prev => [...prev, option])
                                                        }
                                                    }}
                                                >
                                                    {option}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="juan@ejemplo.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono</Label>
                                        <Input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+56 9 1234 5678" />
                                    </div>
                                </Section>

                                {/* Section: Ubicación */}
                                <Section title="Ubicación y Propiedad">
                                    <div className="space-y-2">
                                        <Label>Barrio / Comuna</Label>
                                        <Input name="barrio_comuna" value={formData.barrio_comuna || formData.comuna} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Dirección Particular</Label>
                                        <Input name="address" value={formData.address} onChange={handleChange} placeholder="Calle 123, Depto 4" />
                                    </div>

                                    {/* Propiedad Asignada (Dueño) */}
                                    <div className="space-y-2">
                                        <Label>Propiedad (Dueño)</Label>
                                        <Popover open={openPropertySelect} onOpenChange={setOpenPropertySelect}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openPropertySelect}
                                                    className="w-full justify-between"
                                                >
                                                    {selectedPropertyId
                                                        ? properties.find((p) => p.id === selectedPropertyId)?.address
                                                        : "Asignar propiedad..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0 z-[200]">
                                                <Command>
                                                    <CommandInput placeholder="Buscar propiedad..." />
                                                    <CommandList>
                                                        <CommandEmpty>No encontrada.</CommandEmpty>
                                                        <CommandGroup>
                                                            {properties.map((prop) => (
                                                                <CommandItem
                                                                    key={prop.id}
                                                                    value={prop.address} // Filter by address
                                                                    onSelect={() => {
                                                                        setSelectedPropertyId(prop.id)
                                                                        setOpenPropertySelect(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn("mr-2 h-4 w-4", selectedPropertyId === prop.id ? "opacity-100" : "opacity-0")}
                                                                    />
                                                                    {prop.address}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <p className="text-[10px] text-muted-foreground">Este contacto quedará registrado como dueño de la propiedad seleccionada.</p>
                                    </div>
                                </Section>

                                {/* Section: Detalles Personales */}
                                <Section title="Detalles Personales">
                                    <div className="space-y-2">
                                        <Label>Fecha Nacimiento</Label>
                                        <Input type="date" name="dob" value={formData.dob} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Profesión</Label>
                                        <Input name="profession" value={formData.profession} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ocupación</Label>
                                        <Input name="occupation" value={formData.occupation} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sexo</Label>
                                        <select
                                            name="sex"
                                            value={formData.sex}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="Masculino">Masculino</option>
                                            <option value="Femenino">Femenino</option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                </Section>

                                {/* Section: Clasificación y Seguimiento */}
                                <Section title="Clasificación">
                                    <div className="space-y-2">
                                        <Label>Rating (Calidad)</Label>
                                        <select
                                            name="rating"
                                            value={formData.rating}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="A+">A+ (Listo para comprar/vender)</option>
                                            <option value="A">A (30-60 días)</option>
                                            <option value="B">B (60-90 días)</option>
                                            <option value="C">C (Largo plazo)</option>
                                            <option value="D">D (Descartado/Frío)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pareto (80/20)</Label>
                                        <select
                                            name="rating_80_20"
                                            value={formData.rating_80_20}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="20%">20% (Mejores Clientes)</option>
                                            <option value="80%">80% (Resto)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Último Contacto</Label>
                                        <Input type="date" name="last_contact_date" value={formData.last_contact_date} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Próximo Contacto</Label>
                                        <Input type="date" name="next_contact_date" value={formData.next_contact_date} onChange={handleChange} />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>Observaciones</Label>
                                        <Textarea name="observations" value={formData.observations} onChange={handleChange} rows={3} />
                                    </div>
                                </Section>

                            </form>
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
                            <Button type="submit" form="contact-form" disabled={loading} className="bg-primary text-white hover:bg-primary/90">
                                {loading ? 'Guardando...' : <><Save className="w-4 h-4 mr-2" /> Guardar</>}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}

export default ContactForm
