import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Textarea, Select, Label, Switch, Checkbox, Badge } from '@/components/ui'
import { X, Save, Search, Plus, Check, ChevronsUpDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import AddressAutocomplete from "@/components/ui/AddressAutocomplete"
import ContactForm from './ContactForm'
import { cn } from "@/lib/utils"



const Section = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children}
        </div>
    </div>
)

const PropertyForm = ({ property, isOpen, onClose }) => {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [contacts, setContacts] = useState([])
    const [openOwnerSelect, setOpenOwnerSelect] = useState(false)
    const [isContactFormOpen, setIsContactFormOpen] = useState(false)

    const [formData, setFormData] = useState({
        property_type: 'Departamento',
        address: '',
        unit_number: '',
        commune: '',
        owner_id: null,
        status: ['En Venta'],
        listing_link: '',
        notes: '',
        m2_total: '',
        m2_built: '',
        bedrooms: '',
        bathrooms: '',
        documentation_link: '',
        latitude: null,
        longitude: null
    })

    const PROPERTY_TYPES = ['Departamento', 'Casa', 'Oficina', 'Terreno', 'Bodega', 'Estacionamiento', 'Comercial', 'Otro']
    const STATUS_OPTIONS = ['Administrada', 'Vendida', 'En Negociación', 'Visitas', 'Publicada', 'Por Captar', 'En Venta']

    useEffect(() => {
        if (isOpen) {
            fetchContacts()
        }
        if (property) {
            setFormData({
                ...property,
                m2_total: property.m2_total || '',
                m2_built: property.m2_built || '',
                bedrooms: property.bedrooms || '',
                bathrooms: property.bathrooms || '',
                status: property.status || []
            })
        }
    }, [property, isOpen])

    const fetchContacts = async () => {
        const { data } = await supabase
            .from('contacts')
            .select('id, first_name, last_name')
            .limit(1000) // Reasonable limit
            .order('first_name')
        if (data) setContacts(data)
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleStatusChange = (status) => {
        setFormData(prev => {
            const current = prev.status || []
            if (current.includes(status)) {
                return { ...prev, status: current.filter(s => s !== status) }
            } else {
                return { ...prev, status: [...current, status] }
            }
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Create a clean copy of the data, excluding joined relations or UI-only fields
            const { contacts, id, ...cleanData } = formData;

            const dataToSave = {
                ...cleanData,
                agent_id: user?.id, // Ensure agent_id is set
                m2_total: formData.m2_total || null,
                m2_built: formData.m2_built || null,
                bedrooms: formData.bedrooms || null,
                bathrooms: formData.bathrooms || null,
                updated_at: new Date().toISOString()
            }

            let error;
            if (property?.id) {
                const { error: updateError } = await supabase
                    .from('properties')
                    .update(dataToSave)
                    .eq('id', property.id)
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('properties')
                    .insert([dataToSave])
                error = insertError;
            }

            if (error) throw error

            toast.success(property ? 'Propiedad actualizada' : 'Propiedad creada')
            onClose(true)
        } catch (error) {
            console.error('Error saving property:', error)
            toast.error('Error al guardar propiedad')
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
                    <h2 className="text-xl font-bold">{property ? 'Editar Propiedad' : 'Nueva Propiedad'}</h2>
                    <Button variant="ghost" size="icon" onClick={() => onClose(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <Section title="Información Primaria">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo de Propiedad</label>
                            <select
                                name="property_type"
                                value={formData.property_type}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-sm font-medium">Dirección</label>
                            <AddressAutocomplete
                                value={formData.address}
                                onChange={(val) => setFormData(prev => ({ ...prev, address: val }))}
                                onSelectAddress={(data) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        address: data.address,
                                        commune: data.commune || prev.commune, // Auto-fill commune
                                        latitude: data.lat,
                                        longitude: data.lng
                                    }))
                                }}
                            />
                            <p className="text-xs text-muted-foreground hidden">La dirección se guardará tal cual.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Comuna</label>
                            <Input name="commune" value={formData.commune} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Número de Unidad (Opcional)</label>
                            <Input name="unit_number" value={formData.unit_number} onChange={handleChange} placeholder="Depto 101, etc." />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dueño (Contacto)</label>
                            <Popover open={openOwnerSelect} onOpenChange={setOpenOwnerSelect}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openOwnerSelect}
                                        className="w-full justify-between"
                                    >
                                        {formData.owner_id
                                            ? contacts.find((contact) => contact.id === formData.owner_id)?.first_name + " " + contacts.find((contact) => contact.id === formData.owner_id)?.last_name
                                            : "Seleccionar dueño..."}
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
                                                        setOpenOwnerSelect(false)
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
                                                        onSelect={(currentValue) => {
                                                            setFormData(prev => ({ ...prev, owner_id: contact.id }))
                                                            setOpenOwnerSelect(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn("mr-2 h-4 w-4", formData.owner_id === contact.id ? "opacity-100" : "opacity-0")}
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

                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-sm font-medium block mb-2">Estado Comercial (Selección Múltiple)</label>
                            <div className="flex flex-wrap gap-2">
                                {STATUS_OPTIONS.map(status => (
                                    <Badge
                                        key={status}
                                        variant={formData.status?.includes(status) ? "default" : "outline"}
                                        className="cursor-pointer select-none px-3 py-1"
                                        onClick={() => handleStatusChange(status)}
                                    >
                                        {status}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </Section>

                    <Section title="Información Secundaria & Metrajes">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">M² Totales</label>
                                <Input type="number" name="m2_total" value={formData.m2_total} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">M² Construidos</label>
                                <Input type="number" name="m2_built" value={formData.m2_built} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Dormitorios</label>
                                <Input type="number" name="bedrooms" value={formData.bedrooms} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Baños</label>
                                <Input type="number" name="bathrooms" value={formData.bathrooms} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Link Publicación</label>
                            <Input name="listing_link" value={formData.listing_link} onChange={handleChange} placeholder="https://..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Link Documentación</label>
                            <Input name="documentation_link" value={formData.documentation_link} onChange={handleChange} placeholder="Folder URL..." />
                        </div>
                    </Section>

                    <Section title="Notas & Observaciones">
                        <div className="space-y-2 md:col-span-2">
                            <Textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                placeholder="Información de contexto, acuerdos, hitos..."
                                className="min-h-[100px]"
                            />
                        </div>
                    </Section>
                </form>

                <div className="p-4 border-t bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                        <Save className="w-4 h-4" />
                        {loading ? 'Guardando...' : 'Guardar Propiedad'}
                    </Button>
                </div>
            </motion.div>
        </div>,
        document.body
    )
}

export default PropertyForm
