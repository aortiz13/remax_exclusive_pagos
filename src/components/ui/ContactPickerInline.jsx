import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Search, User, Plus } from 'lucide-react'
import ContactForm from '../crm/ContactForm'

const CONTACT_FIELDS = 'id, first_name, last_name, rut, email, phone, address, barrio_comuna, bank_name, bank_account_type, bank_account_number'
const RESULTS_LIMIT = 30

export default function ContactPickerInline({ onSelectContact, label = 'Pre-llenar desde CRM', value, disabled = false, showNoneOption = false }) {
    const { user } = useAuth()
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [searching, setSearching] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [selectedId, setSelectedId] = useState(value || '')
    const [selectedContact, setSelectedContactState] = useState(null)
    const [isAddingNew, setIsAddingNew] = useState(false)
    const debounceRef = useRef(null)

    useEffect(() => {
        if (value) setSelectedId(value)
    }, [value])

    // Load initial recent contacts (small set)
    const fetchInitialContacts = async () => {
        if (!user?.id) return
        const { data, error } = await supabase
            .from('contacts')
            .select(CONTACT_FIELDS)
            .order('created_at', { ascending: false })
            .limit(RESULTS_LIMIT)

        if (error) {
            console.error('Error fetching contacts from CRM:', error)
        } else if (data) {
            setContacts(data)
        }
        setLoading(false)
    }

    // Fetch selected contact by ID so it always shows correctly
    const fetchSelectedContact = async (contactId) => {
        if (!contactId || contactId === 'none') return
        const { data } = await supabase
            .from('contacts')
            .select(CONTACT_FIELDS)
            .eq('id', contactId)
            .single()
        if (data) setSelectedContactState(data)
    }

    useEffect(() => {
        fetchInitialContacts()
    }, [user])

    // If we have a value prop, fetch that specific contact
    useEffect(() => {
        if (value && value !== 'none') fetchSelectedContact(value)
    }, [value])

    // Server-side search with debounce
    const searchContacts = useCallback(async (term) => {
        if (!term || term.length < 2) {
            fetchInitialContacts()
            return
        }
        setSearching(true)

        try {
            const words = term.trim().split(/\s+/).filter(w => w.length >= 2)

            // Build query - each word must match at least one of first_name or last_name
            let query = supabase
                .from('contacts')
                .select(CONTACT_FIELDS)

            if (words.length > 1) {
                // Multi-word: each word must match first_name or last_name
                for (const word of words) {
                    query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`)
                }
            } else {
                // Single word: search across all fields
                const w = words[0] || term.trim()
                query = query.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%,rut.ilike.%${w}%,email.ilike.%${w}%`)
            }

            const { data, error } = await query
                .order('first_name')
                .limit(RESULTS_LIMIT)

            if (error) {
                console.error('Error searching contacts:', error)
            } else if (data) {
                setContacts(data)
            }
        } catch (err) {
            console.error('Search error:', err)
        }
        setSearching(false)
    }, [])

    const handleSearchChange = (e) => {
        const term = e.target.value
        setSearchTerm(term)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            searchContacts(term)
        }, 300)
    }

    // Clean up debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    const filtered = contacts

    const handleSelect = (contactId) => {
        if (!contactId || contactId === 'none') {
            setSelectedId(contactId === 'none' ? 'none' : '')
            setSelectedContactState(null)
            onSelectContact(null)
            setIsOpen(false)
            return
        }
        const contact = contacts.find(c => c.id === contactId)
        if (contact) {
            setSelectedId(contactId)
            setSelectedContactState(contact)
            onSelectContact(contact)
            setIsOpen(false)
            setSearchTerm('')
            // Reset to initial contacts for next open
            fetchInitialContacts()
        }
    }

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
                    <div className="absolute z-[300] w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-border flex flex-col gap-1">
                            <div className="flex items-center gap-2 px-2 bg-muted/50 rounded-md">
                                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    placeholder="Buscar por nombre, RUT o email..."
                                    className="w-full h-8 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
                                    autoFocus
                                />
                                {searching && (
                                    <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                                )}
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

                            {!searchTerm && (
                                <div className="px-3 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider bg-muted/30">
                                    Contactos recientes
                                </div>
                            )}

                            {filtered.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                    {searching ? 'Buscando...' : 'No se encontraron contactos'}
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
                <div className="fixed inset-0 z-[250]" onClick={() => { setIsOpen(false); setSearchTerm(''); fetchInitialContacts() }} />
            )}

            {isAddingNew && (
                <ContactForm
                    isOpen={isAddingNew}
                    isSimplified={false}
                    onClose={async (newContact) => {
                        setIsAddingNew(false)
                        if (newContact) {
                            // If it was a successful creation, refresh the list and select it
                            await fetchInitialContacts()
                            setSelectedId(newContact.id)
                            setSelectedContactState(newContact)
                            onSelectContact(newContact)
                        }
                    }}
                />
            )}
        </div>
    )
}

