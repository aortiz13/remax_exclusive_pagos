import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Search, User, Plus } from 'lucide-react'
import ContactForm from '../crm/ContactForm'

export default function ContactPickerInline({ onSelectContact, label = 'Pre-llenar desde CRM', value, disabled = false, showNoneOption = false }) {
    const { user } = useAuth()
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [selectedId, setSelectedId] = useState(value || '')
    const [isAddingNew, setIsAddingNew] = useState(false)

    useEffect(() => {
        if (value) setSelectedId(value)
    }, [value])

    const fetchContacts = async () => {
        if (!user?.id) return
        const { data, error } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, rut, email, phone, address, barrio_comuna, bank_name, bank_account_type, bank_account_number')
            .order('first_name')
            .limit(500)

        if (error) {
            console.error('Error fetching contacts from CRM:', error)
        } else if (data) {
            setContacts(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchContacts()
    }, [user])

    const filtered = searchTerm
        ? contacts.filter(c => {
            const fullName = `${c.first_name} ${c.last_name}`.toLowerCase()
            return fullName.includes(searchTerm.toLowerCase()) ||
                (c.rut && c.rut.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
        })
        : contacts

    const handleSelect = (contactId) => {
        if (!contactId || contactId === 'none') {
            setSelectedId(contactId === 'none' ? 'none' : '')
            onSelectContact(null)
            setIsOpen(false)
            return
        }
        const contact = contacts.find(c => c.id === contactId)
        if (contact) {
            setSelectedId(contactId)
            onSelectContact(contact)
            setIsOpen(false)
            setSearchTerm('')
        }
    }

    const selectedContact = contacts.find(c => c.id === selectedId)

    return (
        <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <User className="w-3.5 h-3.5" />
                {label}
            </label>
            <div className="relative">
                <div
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/50 hover:border-accent'}`}
                >
                    <span className={`truncate flex-1 min-w-0 ${selectedContact || selectedId === 'none' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {loading
                            ? 'Cargando contactos...'
                            : selectedContact
                                ? `${selectedContact.first_name} ${selectedContact.last_name}${selectedContact.rut ? ` · ${selectedContact.rut}` : ''}`
                                : selectedId === 'none'
                                    ? 'Ningún contacto seleccionado'
                                    : 'Seleccionar contactos...'
                        }
                    </span>
                    <Search className="h-4 w-4 opacity-50" />
                </div>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-border flex flex-col gap-1">
                            <div className="flex items-center gap-2 px-2 bg-muted/50 rounded-md">
                                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full h-8 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddingNew(true)
                                    setIsOpen(false)
                                }}
                                className="w-full text-left px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/5 transition-colors flex items-center gap-2 border-b border-border/50 sticky top-0 bg-popover z-10"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar nuevo contacto
                            </button>

                            {showNoneOption && (
                                <button
                                    type="button"
                                    onClick={() => handleSelect('none')}
                                    className="w-full text-left px-3 py-2.5 text-sm text-muted-foreground italic hover:bg-accent transition-colors border-b border-border/50"
                                >
                                    Ningún contacto
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => handleSelect('')}
                                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
                            >
                                — Ingresar manualmente —
                            </button>

                            {filtered.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                    No se encontraron contactos
                                </div>
                            ) : (
                                filtered.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleSelect(c.id)}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2 ${selectedId === c.id ? 'bg-accent/70 font-medium' : ''}`}
                                    >
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">{c.first_name} {c.last_name}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {[c.rut, c.email].filter(Boolean).join(' · ')}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Backdrop to close */}
            {isOpen && (
                <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setSearchTerm('') }} />
            )}

            {isAddingNew && (
                <ContactForm
                    isOpen={isAddingNew}
                    isSimplified={false}
                    onClose={async (newContact) => {
                        setIsAddingNew(false)
                        if (newContact) {
                            // If it was a successful creation, refresh the list and select it
                            await fetchContacts()
                            setSelectedId(newContact.id)
                            onSelectContact(newContact)
                        }
                    }}
                />
            )}
        </div>
    )
}
