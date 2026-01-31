import { useState, useEffect } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Button,
    Input,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui"
import { Plus, Search, MoreHorizontal, Phone, Mail, MapPin } from 'lucide-react'
import { supabase } from '../../services/supabase'
import ContactForm from './ContactForm'
import { useNavigate } from 'react-router-dom'

const ContactList = () => {
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [selectedContact, setSelectedContact] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        fetchContacts()
    }, [])

    const fetchContacts = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setContacts(data || [])
        } catch (error) {
            console.error('Error fetching contacts:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredContacts = contacts.filter(contact =>
        contact.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone?.includes(searchTerm)
    )

    const handleEdit = (contact) => {
        setSelectedContact(contact)
        setIsFormOpen(true)
    }

    const handleCreate = () => {
        setSelectedContact(null)
        setIsFormOpen(true)
    }

    const handleFormClose = (shouldRefresh) => {
        setIsFormOpen(false)
        setSelectedContact(null)
        if (shouldRefresh) {
            fetchContacts()
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar contactos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Contacto
                </Button>
            </div>

            <div className="rounded-md border bg-white dark:bg-gray-900">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fuente</TableHead>
                            <TableHead>Clasificación</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                    Cargando contactos...
                                </TableCell>
                            </TableRow>
                        ) : filteredContacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                    No se encontraron contactos.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredContacts.map((contact) => (
                                <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/contact/${contact.id}`)}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{contact.first_name} {contact.last_name}</span>
                                            {contact.profession && <span className="text-xs text-muted-foreground">{contact.profession}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 text-sm">
                                            {contact.email && (
                                                <div className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                                    <span>{contact.email}</span>
                                                </div>
                                            )}
                                            {contact.phone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                                    <span>{contact.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${contact.status === 'Activo'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                            {contact.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>{contact.source}</TableCell>
                                    <TableCell>
                                        {contact.rating && <span className="badge badge-outline mr-2">{contact.rating}</span>}
                                        {contact.rating_80_20 && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">{contact.rating_80_20}</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Abrir menú</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleEdit(contact)}>Ver Detalles</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {/* Add more actions like Delete */}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Contact Form Modal/Sheet will go here */}
            {isFormOpen && (
                <ContactForm
                    contact={selectedContact}
                    isOpen={isFormOpen}
                    onClose={handleFormClose}
                />
            )}
        </div>
    )
}

export default ContactList
