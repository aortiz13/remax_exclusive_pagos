import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Textarea, Select, Label, Switch, Checkbox, Badge } from '@/components/ui'
import { X, Save, Search, Plus, Check, ChevronsUpDown, Trash2, UserPlus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import AddressAutocomplete from "@/components/ui/AddressAutocomplete"
import ContactForm from './ContactForm'
import TransactionCompletionModal from './TransactionCompletionModal'
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

const PropertyForm = ({ property, isOpen, onClose, isSimplified = false }) => {
    const { user, profile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [contacts, setContacts] = useState([])
    const [isContactFormOpen, setIsContactFormOpen] = useState(false)
    const [showTransactionModal, setShowTransactionModal] = useState(false)
    const [savedPropertyForTxn, setSavedPropertyForTxn] = useState(null)

    // Contact links management
    const [existingLinks, setExistingLinks] = useState([])
    const [pendingLinks, setPendingLinks] = useState([])
    const [removedLinkIds, setRemovedLinkIds] = useState([])
    const [newLinkRole, setNewLinkRole] = useState('propietario')
    const [newLinkContactId, setNewLinkContactId] = useState(null)
    const [openContactSelect, setOpenContactSelect] = useState(false)

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
        image_url: '',
        latitude: null,
        longitude: null
    })

    const PROPERTY_TYPES = ['Departamento', 'Casa', 'Oficina', 'Terreno', 'Bodega', 'Estacionamiento', 'Comercial', 'Otro']
    const STATUS_OPTIONS = ['Administrada', 'Vendida', 'Arrendada', 'En Negociación', 'Visitas', 'Publicada', 'Por Captar', 'En Venta', 'En Arriendo']

    useEffect(() => {
        if (isOpen) {
            fetchContacts()
        }
        if (property) {
            setFormData({
                ...property,
                image_url: property.image_url || '',
                m2_total: property.m2_total || '',
                m2_built: property.m2_built || '',
                bedrooms: property.bedrooms || '',
                bathrooms: property.bathrooms || '',
                status: property.status || []
            })
            if (property.id) {
                fetchExistingLinks(property.id)
            }
        } else {
            setExistingLinks([])
            setPendingLinks([])
            setRemovedLinkIds([])
        }
    }, [property, isOpen])

    const fetchContacts = async () => {
        const { data } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, email')
            .limit(1000)
            .order('first_name')
        if (data) setContacts(data)
    }

    const fetchExistingLinks = async (propertyId) => {
        try {
            const { data } = await supabase
                .from('property_contacts')
                .select('id, contact_id, role, contact:contact_id(id, first_name, last_name, email)')
                .eq('property_id', propertyId)

            setExistingLinks(data || [])
            setRemovedLinkIds([])
            setPendingLinks([])
        } catch (error) {
            console.error('Error fetching contact links', error)
        }
    }

    const handleAddPendingLink = () => {
        if (!newLinkContactId) {
            toast.error('Selecciona un contacto')
            return
        }
        const isDuplicate = [...existingLinks, ...pendingLinks].some(
            l => (l.contact_id === newLinkContactId) && (l.role === newLinkRole)
        )
        if (isDuplicate) {
            toast.error('Este contacto ya tiene ese rol asignado')
            return
        }
        const c = contacts.find(c => c.id === newLinkContactId)
        setPendingLinks(prev => [...prev, {
            _tempId: Date.now(),
            contact_id: newLinkContactId,
            role: newLinkRole,
            contact: c
        }])
        setNewLinkContactId(null)
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
                agent_id: property?.id ? property.agent_id : user?.id,
                m2_total: formData.m2_total || null,
                m2_built: formData.m2_built || null,
                bedrooms: formData.bedrooms || null,
                bathrooms: formData.bathrooms || null,
                updated_at: new Date().toISOString()
            }

            let savedProperty = null;
            let queryError = null;

            if (property?.id) {
                const { data, error: updateError } = await supabase
                    .from('properties')
                    .update(dataToSave)
                    .eq('id', property.id)
                    .select()
                    .single()
                savedProperty = data;
                queryError = updateError;
            } else {
                const { data, error: insertError } = await supabase
                    .from('properties')
                    .insert([dataToSave])
                    .select()
                    .single()
                savedProperty = data;
                queryError = insertError;
            }

            if (queryError) throw queryError

            // Detect if status changed to Vendida or Arrendada (completion)
            const COMPLETION_STATUSES = ['Vendida', 'Arrendada']
            const oldStatuses = property?.status || []
            const newStatuses = savedProperty?.status || []
            const isNewCompletion = newStatuses.some(s => COMPLETION_STATUSES.includes(s)) && !oldStatuses.some(s => COMPLETION_STATUSES.includes(s))

            // Auto-increment active_portfolio KPI when a NEW property is saved with an active status
            const INACTIVE_STATUSES = ['Vendida', 'Arrendada', 'Por Captar']
            const isNewProperty = !property?.id
            const hasActiveStatus = (savedProperty?.status || []).some(s => !INACTIVE_STATUSES.includes(s))

            if (isNewProperty && hasActiveStatus && user?.id) {
                const todayStr = new Date().toISOString().split('T')[0]
                const { data: existingKpi } = await supabase
                    .from('kpi_records')
                    .select('id, active_portfolio')
                    .eq('agent_id', user.id)
                    .eq('period_type', 'daily')
                    .eq('date', todayStr)
                    .single()
                if (existingKpi) {
                    await supabase
                        .from('kpi_records')
                        .update({ active_portfolio: (existingKpi.active_portfolio || 0) + 1 })
                        .eq('id', existingKpi.id)
                } else {
                    await supabase
                        .from('kpi_records')
                        .insert({
                            agent_id: user.id,
                            period_type: 'daily',
                            date: todayStr,
                            active_portfolio: 1,
                            new_listings: 0, conversations_started: 0, relational_coffees: 0,
                            sales_interviews: 0, buying_interviews: 0, commercial_evaluations: 0,
                            price_reductions: 0, portfolio_visits: 0, buyer_visits: 0,
                            offers_in_negotiation: 0, signed_promises: 0,
                            billing_primary: 0, referrals_count: 0, billing_secondary: 0,
                        })
                }
            }

            // Log activity and save contact links
            if (savedProperty) {
                await logActivity({
                    action: property?.id ? 'Editó' : 'Creó',
                    entity_type: 'Propiedad',
                    entity_id: savedProperty.id,
                    description: property?.id ? 'Editó la propiedad' : 'Creó una nueva propiedad',
                    property_id: savedProperty.id,
                    details: { address: savedProperty.address }
                })

                // Save contact links (add pending + remove deleted)
                await saveContactLinks(savedProperty.id)
            }

            toast.success(property ? 'Propiedad actualizada' : 'Propiedad creada')

            // If property was just marked as sold/rented, show transaction completion modal
            if (isNewCompletion && savedProperty) {
                setSavedPropertyForTxn(savedProperty)
                setShowTransactionModal(true)
                return // Don't close form yet, wait for modal
            }

            onClose(savedProperty)
        } catch (error) {
            console.error('Error saving property:', error)
            toast.error('Error al guardar propiedad')
        } finally {
            setLoading(false)
        }
    }

    const saveContactLinks = async (propertyId) => {
        const userId = user?.id

        // 1. Delete removed links
        for (const linkId of removedLinkIds) {
            const removedLink = existingLinks.find(l => l.id === linkId)
            await supabase.from('property_contacts').delete().eq('id', linkId)
            if (removedLink?.role === 'propietario') {
                await supabase.from('properties').update({ owner_id: null }).eq('id', propertyId)
            }
            // Log the removal
            if (removedLink) {
                await logActivity({
                    action: 'Desvinculó',
                    entity_type: 'Contacto',
                    entity_id: removedLink.contact_id,
                    description: `Se desvinculó contacto ${removedLink.contact?.first_name || ''} ${removedLink.contact?.last_name || ''} (${removedLink.role}) de la propiedad`,
                    contact_id: removedLink.contact_id,
                    property_id: propertyId,
                    details: { role: removedLink.role }
                })
            }
        }

        // 2. Insert pending links
        for (const link of pendingLinks) {
            const { error } = await supabase.from('property_contacts').insert({
                property_id: propertyId,
                contact_id: link.contact_id,
                role: link.role,
                agent_id: userId
            })
            if (error && error.code !== '23505') {
                console.error('Error inserting contact link', error)
            }
            if (link.role === 'propietario') {
                await supabase.from('properties').update({ owner_id: link.contact_id }).eq('id', propertyId)
            }
            await logActivity({
                action: 'Vinculó',
                entity_type: 'Contacto',
                entity_id: link.contact_id,
                description: `Vinculado como ${link.role} de la propiedad`,
                contact_id: link.contact_id,
                property_id: propertyId
            })
        }
    }

    if (!isOpen) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    style={{ pointerEvents: 'auto' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose(false)
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                            "bg-white dark:bg-slate-900 rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 relative z-50",
                            isSimplified ? "max-w-md max-h-[70vh]" : "max-w-4xl max-h-[90vh]"
                        )}
                    >
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h2 className="text-xl font-bold">{property ? 'Editar Propiedad' : 'Nueva Propiedad'}</h2>
                            <Button variant="ghost" size="icon" onClick={() => onClose(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div
                            className="flex-1 overflow-y-auto p-6 custom-scrollbar"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <form id="property-form" onSubmit={handleSubmit} className="space-y-6">
                                {formData.image_url && (
                                    <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 relative bg-gray-100 dark:bg-gray-800 h-48 md:h-64">
                                        <img
                                            src={formData.image_url}
                                            alt="Propiedad"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                                            <p className="text-white font-medium text-lg drop-shadow-sm">{formData.address}</p>
                                        </div>
                                    </div>
                                )}

                                <Section title="Información Primaria">
                                    <div className="grid grid-cols-2 gap-4 mb-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Moneda</label>
                                            <select
                                                name="currency"
                                                value={formData.currency}
                                                onChange={handleChange}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="CLP">CLP (Pesos)</option>
                                                <option value="UF">UF</option>
                                                <option value="USD">USD</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Precio</label>
                                            <Input
                                                type="number"
                                                name="price"
                                                value={formData.price}
                                                onChange={handleChange}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

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
                                </Section>

                                {/* Contactos Section — replaces old single Dueño picker */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <UserPlus className="w-4 h-4" /> Contactos Vinculados
                                    </h4>

                                    <div className="space-y-2 mb-3">
                                        {existingLinks
                                            .filter(l => !removedLinkIds.includes(l.id))
                                            .map(link => (
                                                <div key={link.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-gray-50 dark:bg-gray-800/50 group">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate">{link.contact?.first_name} {link.contact?.last_name}</div>
                                                        <div className="text-xs text-muted-foreground">{link.contact?.email}</div>
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

                                        {pendingLinks.map(link => (
                                            <div key={link._tempId} className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 group">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{link.contact?.first_name} {link.contact?.last_name}</div>
                                                    <div className="text-xs text-muted-foreground">{link.contact?.email}</div>
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
                                            <p className="text-sm text-muted-foreground text-center py-3">Sin contactos vinculados</p>
                                        )}
                                    </div>

                                    {/* Add new link row */}
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <Label className="text-xs mb-1 block">Contacto</Label>
                                            <Popover open={openContactSelect} onOpenChange={setOpenContactSelect}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        role="combobox"
                                                        className="w-full justify-between text-left h-9 text-sm"
                                                    >
                                                        <span className="truncate">
                                                            {newLinkContactId
                                                                ? (() => {
                                                                    const c = contacts.find(c => c.id === newLinkContactId)
                                                                    return c ? `${c.first_name} ${c.last_name}` : 'Seleccionar...'
                                                                })()
                                                                : "Seleccionar..."}
                                                        </span>
                                                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[320px] p-0 z-[300]">
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
                                                                            setNewLinkContactId(contact.id)
                                                                            setOpenContactSelect(false)
                                                                        }}
                                                                    >
                                                                        <Check className={cn("mr-2 h-4 w-4", newLinkContactId === contact.id ? "opacity-100" : "opacity-0")} />
                                                                        {contact.first_name} {contact.last_name}
                                                                        {contact.email && <span className="ml-2 text-xs text-muted-foreground truncate">({contact.email})</span>}
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

                                <Section title="Estado Comercial">
                                    <div className="space-y-2 col-span-2">
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
                        </div>

                        <div className="p-4 border-t bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
                            <Button type="submit" form="property-form" disabled={loading} className="gap-2">
                                <Save className="w-4 h-4" />
                                {loading ? 'Guardando...' : 'Guardar Propiedad'}
                            </Button>
                        </div>
                    </motion.div>
                    {showTransactionModal && savedPropertyForTxn && (
                        <TransactionCompletionModal
                            isOpen={showTransactionModal}
                            property={savedPropertyForTxn}
                            agentProfile={profile}
                            existingLinks={existingLinks.filter(l => !removedLinkIds.includes(l.id))}
                            pendingLinks={pendingLinks}
                            onClose={() => {
                                setShowTransactionModal(false)
                                setSavedPropertyForTxn(null)
                                onClose(savedPropertyForTxn)
                            }}
                        />
                    )}
                    {isContactFormOpen && (
                        <ContactForm
                            isOpen={isContactFormOpen}
                            isSimplified={true}
                            onClose={(newContact) => {
                                setIsContactFormOpen(false)
                                if (newContact) {
                                    setContacts(prev => [...prev, newContact])
                                    // Auto-select the new contact in the picker
                                    setNewLinkContactId(newContact.id)
                                }
                            }}
                        />
                    )}
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}

export default PropertyForm
