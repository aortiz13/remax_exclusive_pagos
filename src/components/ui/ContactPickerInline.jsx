import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Search, User } from 'lucide-react'

export default function ContactPickerInline({ onSelectContact, label = 'Pre-llenar desde CRM' }) {
    const { user } = useAuth()
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [selectedId, setSelectedId] = useState('')

    useEffect(() => {
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
        if (!contactId) {
            setSelectedId('')
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
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors ring-offset-background focus:outline-none"
                >
                    <span className={selectedContact ? 'text-foreground' : 'text-muted-foreground'}>
                        {loading
                            ? 'Cargando contactos...'
                            : selectedContact
                                ? `${selectedContact.first_name} ${selectedContact.last_name}${selectedContact.rut ? ` · ${selectedContact.rut}` : ''}`
                                : 'Seleccionar contacto del CRM...'
                        }
                    </span>
                    <Search className="h-4 w-4 opacity-50" />
                </div>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-border">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar por nombre, RUT o email..."
                                className="w-full h-8 px-2 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
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
        </div>
    )
}
