
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Label } from '@/components/ui'
import { X, Plus, Check, ChevronsUpDown, Home, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { toast } from 'sonner'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { logActivity } from '../../services/activityService'
import ContactForm from './ContactForm'
import PropertyForm from './PropertyForm'

const ROLES = [
    { value: 'propietario', label: 'Propietario' },
    { value: 'arrendatario', label: 'Arrendatario' },
    { value: 'comprador', label: 'Comprador' },
    { value: 'vendedor', label: 'Vendedor' },
]

const ROLE_COLORS = {
    propietario: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    arrendatario: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    comprador: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    vendedor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
}

/**
 * Dual-mode modal:
 * - mode='from-property': select a contact to link to a property (used from PropertyDetail)
 * - mode='from-contact': select a property to link to a contact (used from ContactDetail)
 */
const AddParticipantModal = ({ isOpen, onClose, propertyId, contactId, mode = 'from-property' }) => {
    const [loading, setLoading] = useState(false)
    const [contacts, setContacts] = useState([])
    const [properties, setProperties] = useState([])
    const [selectedContactId, setSelectedContactId] = useState(null)
    const [selectedPropertyId, setSelectedPropertyId] = useState(null)
    const [role, setRole] = useState('propietario')
    const [openCombobox, setOpenCombobox] = useState(false)

    // Inline creation
    const [isCreatingContact, setIsCreatingContact] = useState(false)
    const [isCreatingProperty, setIsCreatingProperty] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setRole('propietario')
            setSelectedContactId(contactId || null)
            setSelectedPropertyId(propertyId || null)

            if (mode === 'from-property') {
                fetchContacts()
            } else {
                fetchProperties()
            }
        }
    }, [isOpen])

    const fetchContacts = async () => {
        const { data } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, email')
            .order('first_name')
            .limit(200)

        if (data) setContacts(data)
    }

    const fetchProperties = async () => {
        const { data } = await supabase
            .from('properties')
            .select('id, address, commune, property_type')
            .order('address')
            .limit(200)

        if (data) setProperties(data)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        const finalContactId = mode === 'from-property' ? selectedContactId : contactId
        const finalPropertyId = mode === 'from-property' ? propertyId : selectedPropertyId

        if (!finalContactId) {
            toast.error('Debes seleccionar un contacto')
            return
        }
        if (!finalPropertyId) {
            toast.error('Debes seleccionar una propiedad')
            return
        }

        setLoading(true)
        try {
            // Get current user for agent_id
            const { data: { user } } = await supabase.auth.getUser()

            const { error } = await supabase
                .from('property_contacts')
                .insert({
                    property_id: finalPropertyId,
                    contact_id: finalContactId,
                    role: role,
                    agent_id: user?.id
                })

            if (error) {
                if (error.code === '23505') {
                    toast.error('Este contacto ya tiene este rol en esta propiedad')
                    return
                }
                throw error
            }

            // Sync with property owner_id if role is propietario
            if (role === 'propietario') {
                await supabase
                    .from('properties')
                    .update({ owner_id: finalContactId })
                    .eq('id', finalPropertyId)
            }

            // Build names for activity log
            let contactName = ''
            let propertyAddress = ''

            if (mode === 'from-property') {
                const c = contacts.find(c => c.id === finalContactId)
                contactName = c ? `${c.first_name} ${c.last_name}` : ''
                propertyAddress = 'esta propiedad'
            } else {
                const p = properties.find(p => p.id === finalPropertyId)
                propertyAddress = p?.address || ''
                contactName = 'este contacto'
            }

            await logActivity({
                action: 'Vinculó',
                entity_type: mode === 'from-property' ? 'Propiedad' : 'Contacto',
                entity_id: mode === 'from-property' ? finalPropertyId : finalContactId,
                description: `Vinculación: ${contactName} como ${ROLES.find(r => r.value === role)?.label} de ${propertyAddress}`,
                property_id: finalPropertyId,
                contact_id: finalContactId
            })

            toast.success('Vinculación creada correctamente')
            onClose(true)
        } catch (error) {
            console.error('Error adding participant:', error)
            toast.error('Error al agregar vinculación')
        } finally {
            setLoading(false)
        }
    }

    const handleContactCreated = (shouldRefresh) => {
        setIsCreatingContact(false)
        if (shouldRefresh) {
            fetchContacts()
        }
    }

    const handlePropertyCreated = (shouldRefresh) => {
        setIsCreatingProperty(false)
        if (shouldRefresh) {
            fetchProperties()
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
                className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative z-50 border border-gray-200 dark:border-gray-800"
            >
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        {mode === 'from-property' ? (
                            <><UserPlus className="w-5 h-5" /> Vincular Contacto</>
                        ) : (
                            <><Home className="w-5 h-5" /> Vincular Propiedad</>
                        )}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={() => onClose(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Role Selector — always first */}
                    <div className="space-y-2">
                        <Label>Rol</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                            {ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Entity Selector */}
                    {mode === 'from-property' ? (
                        /* Contact combobox (when adding from property) */
                        <div className="space-y-2">
                            <Label>Contacto</Label>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between"
                                    >
                                        {selectedContactId
                                            ? (() => {
                                                const c = contacts.find(c => c.id === selectedContactId)
                                                return c ? `${c.first_name} ${c.last_name}` : 'Seleccionar...'
                                            })()
                                            : "Seleccionar contacto..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0 z-[200]">
                                    <Command>
                                        <CommandInput placeholder="Buscar contacto..." />
                                        <CommandList>
                                            <CommandEmpty>No encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {contacts.map((contact) => (
                                                    <CommandItem
                                                        key={contact.id}
                                                        value={contact.first_name + " " + contact.last_name}
                                                        onSelect={() => {
                                                            setSelectedContactId(contact.id)
                                                            setOpenCombobox(false)
                                                        }}
                                                    >
                                                        <Check className={`mr-2 h-4 w-4 ${selectedContactId === contact.id ? "opacity-100" : "opacity-0"}`} />
                                                        {contact.first_name} {contact.last_name}
                                                        {contact.email && <span className="ml-2 text-xs text-muted-foreground truncate">({contact.email})</span>}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            <CommandGroup>
                                                <CommandItem
                                                    onSelect={() => {
                                                        setOpenCombobox(false)
                                                        setIsCreatingContact(true)
                                                    }}
                                                    className="text-primary font-medium"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Crear nuevo contacto
                                                </CommandItem>
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    ) : (
                        /* Property combobox (when adding from contact) */
                        <div className="space-y-2">
                            <Label>Propiedad</Label>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between text-left"
                                    >
                                        <span className="truncate">
                                            {selectedPropertyId
                                                ? (() => {
                                                    const p = properties.find(p => p.id === selectedPropertyId)
                                                    return p ? `${p.address}` : 'Seleccionar...'
                                                })()
                                                : "Seleccionar propiedad..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0 z-[200]">
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
                                                            setSelectedPropertyId(prop.id)
                                                            setOpenCombobox(false)
                                                        }}
                                                    >
                                                        <Check className={`mr-2 h-4 w-4 ${selectedPropertyId === prop.id ? "opacity-100" : "opacity-0"}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="truncate text-sm">{prop.address}</div>
                                                            <div className="text-xs text-muted-foreground">{prop.commune} • {prop.property_type}</div>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            <CommandGroup>
                                                <CommandItem
                                                    onSelect={() => {
                                                        setOpenCombobox(false)
                                                        setIsCreatingProperty(true)
                                                    }}
                                                    className="text-primary font-medium"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Crear nueva propiedad
                                                </CommandItem>
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => onClose(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : 'Vincular'}
                        </Button>
                    </div>
                </form>
            </motion.div>

            {/* Inline Contact Creation */}
            <ContactForm
                isOpen={isCreatingContact}
                onClose={handleContactCreated}
                isSimplified={true}
            />

            {/* Inline Property Creation */}
            <PropertyForm
                isOpen={isCreatingProperty}
                onClose={handlePropertyCreated}
            />
        </div>,
        document.body
    )
}

export { ROLES, ROLE_COLORS }
export default AddParticipantModal
