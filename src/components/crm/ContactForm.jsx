import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Textarea, Select, Label, Switch, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, Badge } from '@/components/ui'
import { X, Save, Home, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Check, ChevronsUpDown } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { cn } from "@/lib/utils"
import { logActivity } from '../../services/activityService'
import { ROLES, ROLE_COLORS } from './AddParticipantModal'

const Section = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children}
        </div>
    </div>
)

const ContactForm = ({ contact, isOpen, onClose, isSimplified = false }) => {
    const { profile, user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [properties, setProperties] = useState([])

    // Property links management
    const [existingLinks, setExistingLinks] = useState([])
    const [pendingLinks, setPendingLinks] = useState([])
    const [removedLinkIds, setRemovedLinkIds] = useState([])
    const [newLinkRole, setNewLinkRole] = useState('propietario')
    const [newLinkPropertyId, setNewLinkPropertyId] = useState(null)
    const [openPropertySelect, setOpenPropertySelect] = useState(false)

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        rut: '',
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
        observations: '',
        bank_name: '',
        bank_account_type: '',
        bank_account_number: ''
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
        if (contact?.id) {
            fetchExistingLinks(contact.id)
        } else {
            setExistingLinks([])
            setPendingLinks([])
            setRemovedLinkIds([])
        }
    }, [contact])

    const fetchProperties = async () => {
        try {
            const { data } = await supabase.from('properties').select('id, address, commune, property_type')
            setProperties(data || [])
        } catch (error) {
            console.error('Error fetching properties', error)
        }
    }

    const fetchExistingLinks = async (contactId) => {
        try {
            const { data } = await supabase
                .from('property_contacts')
                .select('id, property_id, role, property:property_id(id, address, commune, property_type)')
                .eq('contact_id', contactId)

            setExistingLinks(data || [])
            setRemovedLinkIds([])
            setPendingLinks([])
        } catch (error) {
            console.error('Error fetching property links', error)
        }
    }

    const handleAddPendingLink = () => {
        if (!newLinkPropertyId) {
            toast.error('Selecciona una propiedad')
            return
        }
        // Check for duplicates in existing + pending
        const isDuplicate = [...existingLinks, ...pendingLinks].some(
            l => (l.property_id === newLinkPropertyId) && (l.role === newLinkRole)
        )
        if (isDuplicate) {
            toast.error('Esta propiedad ya tiene ese rol asignado')
            return
        }
        const prop = properties.find(p => p.id === newLinkPropertyId)
        setPendingLinks(prev => [...prev, {
            _tempId: Date.now(),
            property_id: newLinkPropertyId,
            role: newLinkRole,
            property: prop
        }])
        setNewLinkPropertyId(null)
        setNewLinkRole('propietario')
    }

    const handleRemoveExistingLink = (linkId) => {
        setRemovedLinkIds(prev => [...prev, linkId])
    }

    const handleRemovePendingLink = (tempId) => {
        setPendingLinks(prev => prev.filter(l => l._tempId !== tempId))
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Resolve custom bank name if 'Otro' was selected
            const resolvedBankName = formData.bank_name === 'Otro'
                ? (formData.bank_name_custom || 'Otro')
                : formData.bank_name

            const { bank_name_custom, ...restFormData } = formData

            const dataToSave = {
                ...restFormData,
                bank_name: resolvedBankName,
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

                await logActivity({
                    action: 'Creó',
                    entity_type: 'Contacto',
                    entity_id: newContactData.id,
                    description: 'Contacto creado en el sistema',
                    contact_id: newContactData.id
                })

                // Save pending property links
                await savePropertyLinks(newContactData.id)

                toast.success('Contacto creado')
                onClose(newContactData)
            } else {
                // Update
                const { error: updateError } = await supabase
                    .from('contacts')
                    .update(dataToSave)
                    .eq('id', contact.id)
                if (updateError) throw updateError

                await logActivity({
                    action: 'Editó',
                    entity_type: 'Contacto',
                    entity_id: contact.id,
                    description: 'Se actualizó la información del contacto',
                    contact_id: contact.id
                })

                // Save pending property links and remove deleted ones
                await savePropertyLinks(contact.id)

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

    const savePropertyLinks = async (contactId) => {
        const userId = profile?.id || user?.id

        // 1. Delete removed links
        for (const linkId of removedLinkIds) {
            const removedLink = existingLinks.find(l => l.id === linkId)
            await supabase.from('property_contacts').delete().eq('id', linkId)
            // If it was propietario, clear owner_id
            if (removedLink?.role === 'propietario') {
                await supabase.from('properties').update({ owner_id: null }).eq('id', removedLink.property_id)
            }
        }

        // 2. Insert pending links
        for (const link of pendingLinks) {
            const { error } = await supabase.from('property_contacts').insert({
                property_id: link.property_id,
                contact_id: contactId,
                role: link.role,
                agent_id: userId
            })
            if (error && error.code !== '23505') {
                console.error('Error inserting property link', error)
            }
            // If propietario, sync owner_id
            if (link.role === 'propietario') {
                await supabase.from('properties').update({ owner_id: contactId }).eq('id', link.property_id)
            }
            // Log activity
            await logActivity({
                action: 'Vinculó',
                entity_type: 'Propiedad',
                entity_id: link.property_id,
                description: `Vinculado como ${link.role} de: ${link.property?.address || 'Propiedad'}`,
                contact_id: contactId,
                property_id: link.property_id
            })
        }
    }

    if (!isOpen) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ pointerEvents: 'auto' }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                            "bg-white dark:bg-slate-900 rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden",
                            isSimplified ? "max-w-md max-h-[60vh]" : "max-w-4xl max-h-[90vh]"
                        )}
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
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Nombre <span className="text-red-500">*</span></Label>
                                            <Input name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Juan" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Apellido <span className="text-red-500">*</span></Label>
                                            <Input name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Pérez" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="juan@ejemplo.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Teléfono</Label>
                                            <Input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+56 9 1234 5678" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>RUT</Label>
                                            <Input name="rut" value={formData.rut || ''} onChange={handleChange} placeholder="12.345.678-9" />
                                        </div>
                                    </div>
                                </div>

                                {!isSimplified && (
                                    <>
                                        <Section title="Información Detallada">
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
                                                    <option value="Guardia">Guardia</option>
                                                    <option value="Turno">Turno</option>
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
                                            <div className="space-y-2 col-span-2">
                                                <Label>Necesidad</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {['Comprar', 'Vender', 'Arrendar', 'Invertir', 'Otra'].map((option) => (
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
                                                {selectedNeeds.includes('Otra') && (
                                                    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                                        <Label>Especifique otra necesidad</Label>
                                                        <Input
                                                            name="need_other"
                                                            value={formData.need_other}
                                                            onChange={handleChange}
                                                            placeholder="Ej: Inversión en terreno, Local comercial..."
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </Section>

                                        {/* Section: Ubicación */}
                                        <Section title="Ubicación">
                                            <div className="space-y-2">
                                                <Label>Barrio / Comuna</Label>
                                                <Input name="barrio_comuna" value={formData.barrio_comuna || formData.comuna} onChange={handleChange} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Dirección Particular</Label>
                                                <Input name="address" value={formData.address} onChange={handleChange} placeholder="Calle 123, Depto 4" />
                                            </div>
                                        </Section>

                                        {/* Section: Propiedades Vinculadas */}
                                        <div className="mb-6">
                                            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2 flex items-center gap-2">
                                                <Home className="w-5 h-5" /> Propiedades
                                            </h3>

                                            {/* Existing links (minus removed) */}
                                            <div className="space-y-2 mb-4">
                                                {existingLinks
                                                    .filter(l => !removedLinkIds.includes(l.id))
                                                    .map(link => (
                                                        <div key={link.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-gray-50 dark:bg-gray-800/50 group">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium truncate">{link.property?.address}</div>
                                                                <div className="text-xs text-muted-foreground">{link.property?.commune}</div>
                                                            </div>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize whitespace-nowrap ${ROLE_COLORS[link.role] || 'bg-gray-100 text-gray-800'}`}>
                                                                {link.role}
                                                            </span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => handleRemoveExistingLink(link.id)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    ))}

                                                {/* Pending links (not yet saved) */}
                                                {pendingLinks.map(link => (
                                                    <div key={link._tempId} className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 group">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium truncate">{link.property?.address}</div>
                                                            <div className="text-xs text-muted-foreground">{link.property?.commune}</div>
                                                        </div>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize whitespace-nowrap ${ROLE_COLORS[link.role] || 'bg-gray-100 text-gray-800'}`}>
                                                            {link.role}
                                                        </span>
                                                        <span className="text-[9px] text-primary font-medium">nuevo</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-red-500 hover:text-red-600"
                                                            onClick={() => handleRemovePendingLink(link._tempId)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}

                                                {existingLinks.filter(l => !removedLinkIds.includes(l.id)).length === 0 && pendingLinks.length === 0 && (
                                                    <p className="text-sm text-muted-foreground text-center py-3">Sin propiedades vinculadas</p>
                                                )}
                                            </div>

                                            {/* Add new link row */}
                                            <div className="flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <Label className="text-xs mb-1 block">Propiedad</Label>
                                                    <Popover open={openPropertySelect} onOpenChange={setOpenPropertySelect}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                role="combobox"
                                                                className="w-full justify-between text-left h-9 text-sm"
                                                            >
                                                                <span className="truncate">
                                                                    {newLinkPropertyId
                                                                        ? properties.find(p => p.id === newLinkPropertyId)?.address
                                                                        : "Seleccionar..."}
                                                                </span>
                                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[320px] p-0 z-[300]">
                                                            <Command>
                                                                <CommandInput placeholder="Buscar propiedad..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No encontrada.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {properties.map((prop) => (
                                                                            <CommandItem
                                                                                key={prop.id}
                                                                                value={prop.address}
                                                                                onSelect={() => {
                                                                                    setNewLinkPropertyId(prop.id)
                                                                                    setOpenPropertySelect(false)
                                                                                }}
                                                                            >
                                                                                <Check className={cn("mr-2 h-4 w-4", newLinkPropertyId === prop.id ? "opacity-100" : "opacity-0")} />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="truncate text-sm">{prop.address}</div>
                                                                                    <div className="text-xs text-muted-foreground">{prop.commune}</div>
                                                                                </div>
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="w-36">
                                                    <Label className="text-xs mb-1 block">Rol</Label>
                                                    <select
                                                        value={newLinkRole}
                                                        onChange={(e) => setNewLinkRole(e.target.value)}
                                                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                                                    >
                                                        {ROLES.map(r => (
                                                            <option key={r.value} value={r.value}>{r.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 gap-1"
                                                    onClick={handleAddPendingLink}
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Agregar
                                                </Button>
                                            </div>
                                        </div>

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

                                        {/* Section: Datos Bancarios */}
                                        <Section title="Datos Bancarios">
                                            <div className="space-y-2">
                                                <Label>Banco</Label>
                                                <select
                                                    name="bank_name"
                                                    value={formData.bank_name}
                                                    onChange={handleChange}
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <option value="">Seleccionar banco...</option>
                                                    <option value="Banco de Chile">Banco de Chile</option>
                                                    <option value="Banco Estado">Banco Estado</option>
                                                    <option value="Banco Santander">Banco Santander</option>
                                                    <option value="Banco BCI">Banco BCI</option>
                                                    <option value="Banco Scotiabank">Banco Scotiabank</option>
                                                    <option value="Banco Itaú">Banco Itaú</option>
                                                    <option value="Banco Falabella">Banco Falabella</option>
                                                    <option value="Banco Ripley">Banco Ripley</option>
                                                    <option value="Banco Security">Banco Security</option>
                                                    <option value="Banco BICE">Banco BICE</option>
                                                    <option value="Banco Internacional">Banco Internacional</option>
                                                    <option value="Banco Consorcio">Banco Consorcio</option>
                                                    <option value="HSBC Bank">HSBC Bank</option>
                                                    <option value="Banco BTG Pactual">Banco BTG Pactual</option>
                                                    <option value="Coopeuch">Coopeuch</option>
                                                    <option value="Tenpo">Tenpo</option>
                                                    <option value="Mercado Pago">Mercado Pago</option>
                                                    <option value="MACH">MACH</option>
                                                    <option value="Otro">Otro</option>
                                                </select>
                                                {formData.bank_name === 'Otro' && (
                                                    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                                        <Input
                                                            name="bank_name_custom"
                                                            placeholder="Escribe el nombre del banco..."
                                                            value={formData.bank_name_custom || ''}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, bank_name_custom: e.target.value }))}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Tipo de Cuenta</Label>
                                                <select
                                                    name="bank_account_type"
                                                    value={formData.bank_account_type}
                                                    onChange={handleChange}
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    <option value="Cuenta Corriente">Cuenta Corriente</option>
                                                    <option value="Cuenta Vista">Cuenta Vista</option>
                                                    <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                                                    <option value="Cuenta RUT">Cuenta RUT</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Número de Cuenta</Label>
                                                <Input
                                                    name="bank_account_number"
                                                    value={formData.bank_account_number || ''}
                                                    onChange={handleChange}
                                                    placeholder="Ej: 000123456789"
                                                />
                                            </div>
                                        </Section>
                                    </>
                                )}
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
