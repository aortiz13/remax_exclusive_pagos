
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Label } from '@/components/ui'
import { X, Plus, Check, ChevronsUpDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { toast } from 'sonner'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { logActivity } from '../../services/activityService'

const ROLES = ['Dueño', 'Arrendador', 'Arrendatario', 'Abogado', 'Familiar', 'Captador', 'Otro']

const AddParticipantModal = ({ isOpen, onClose, propertyId }) => {
    const [loading, setLoading] = useState(false)
    const [contacts, setContacts] = useState([])
    const [selectedContactId, setSelectedContactId] = useState(null)
    const [role, setRole] = useState('Dueño')
    const [openCombobox, setOpenCombobox] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchContacts()
            setRole('Dueño')
            setSelectedContactId(null)
        }
    }, [isOpen])

    const fetchContacts = async () => {
        const { data } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, email')
            .order('first_name')
            .limit(100)

        if (data) setContacts(data)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!selectedContactId) {
            toast.error('Debes seleccionar un contacto')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase
                .from('property_contacts')
                .insert({
                    property_id: propertyId,
                    contact_id: selectedContactId,
                    role: role
                })

            if (error) throw error

            // Sync with property owner_id if role is Dueño
            if (role === 'Dueño') {
                await supabase
                    .from('properties')
                    .update({ owner_id: selectedContactId })
                    .eq('id', propertyId)
            }

            const contactName = contacts.find(c => c.id === selectedContactId)?.first_name + " " + contacts.find(c => c.id === selectedContactId)?.last_name

            await logActivity({
                action: 'Vinculó',
                entity_type: 'Propiedad',
                entity_id: propertyId,
                description: `Participante vinculado: ${contactName} como ${role}`,
                property_id: propertyId,
                contact_id: selectedContactId
            })

            toast.success('Participante agregado correctamente')
            onClose(true) // Trigger refresh
        } catch (error) {
            console.error('Error adding participant:', error)
            toast.error('Error al agregar participante')
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
                className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative z-50 border border-gray-200 dark:border-gray-800"
            >
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-bold">Vincular Contacto</h2>
                    <Button variant="ghost" size="icon" onClick={() => onClose(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                                        ? contacts.find((c) => c.id === selectedContactId)?.first_name + " " + contacts.find((c) => c.id === selectedContactId)?.last_name
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
                                            {contacts.map((contact) => (
                                                <CommandItem
                                                    key={contact.id}
                                                    value={contact.first_name + " " + contact.last_name}
                                                    onSelect={() => {
                                                        setSelectedContactId(contact.id)
                                                        setOpenCombobox(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${selectedContactId === contact.id ? "opacity-100" : "opacity-0"}`}
                                                    />
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

                    <div className="space-y-2">
                        <Label>Rol en la Propiedad</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => onClose(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : 'Vincular Confirmado'}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>,
        document.body
    )
}

export default AddParticipantModal
