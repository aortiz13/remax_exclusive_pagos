import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
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
    DropdownMenuCheckboxItem,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Label,
} from "@/components/ui"
import { Plus, Search, MoreHorizontal, Phone, Mail, MapPin, GripHorizontal, Columns, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../services/supabase'
import ContactForm from './ContactForm'
import ContactImporter from './ContactImporter'
import ExcelJS from 'exceljs'
import { useNavigate } from 'react-router-dom'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableHeader = ({ id, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'grab',
    };

    return (
        <TableHead ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <div className="flex items-center justify-start gap-2">
                <GripHorizontal className="w-4 h-4 text-gray-400" />
                {children}
            </div>
        </TableHead>
    );
};


const PRIVILEGED_ROLES = ['superadministrador', 'comercial', 'legal', 'tecnico']
const PAGE_SIZE = 20

const ContactList = () => {
    const { user, profile } = useAuth()
    const isPrivileged = PRIVILEGED_ROLES.includes(profile?.role)

    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [selectedContact, setSelectedContact] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const navigate = useNavigate()

    // Agent filter (privileged roles only)
    const [agents, setAgents] = useState([])
    const [agentFilter, setAgentFilter] = useState('all')

    // Column State
    const [columns, setColumns] = useState([
        { id: 'name', label: 'Nombre', visible: true },
        { id: 'phone', label: 'Teléfono', visible: false },
        { id: 'email', label: 'Correo', visible: false },
        { id: 'need', label: 'Necesidad', visible: false },
        { id: 'contact', label: 'Contacto (Resumen)', visible: true },
        { id: 'status', label: 'Estado', visible: true },
        { id: 'source', label: 'Fuente', visible: true },
        { id: 'rating', label: 'Clasificación', visible: true },
        { id: 'actions', label: 'Acciones', visible: true, locked: true }, // Locked column
    ])

    // Advanced Filters & Sort
    const [isImporterOpen, setIsImporterOpen] = useState(false)
    const [sortOrder, setSortOrder] = useState('newest') // newest, oldest
    const [filters, setFilters] = useState({
        profession: '',
        rating: '',
        need: '',
        comuna: '',
        address: ''
    })

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchContacts()
        // Load columns from localStorage if implementation desired
    }, [])

    // Fetch agents list for privileged roles
    useEffect(() => {
        if (!isPrivileged) return
        const fetchAgents = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name')
                .eq('role', 'agent')
                .order('first_name')
            setAgents(data || [])
        }
        fetchAgents()
    }, [isPrivileged])

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

    // Deep search helper: searches all fields and returns matched field labels
    const CONTACT_FIELD_LABELS = {
        first_name: 'Nombre',
        last_name: 'Apellido',
        email: 'Correo',
        phone: 'Teléfono',
        profession: 'Profesión',
        occupation: 'Ocupación',
        sex: 'Sexo',
        source: 'Fuente',
        source_detail: 'Detalle Fuente',
        neighborhood: 'Barrio',
        address: 'Dirección',
        barrio_comuna: 'Comuna',
        need: 'Necesidad',
        need_other: 'Otra Necesidad',
        rating: 'Clasificación',

        status: 'Estado',
        about: 'Acerca de',
        current_action: 'Acción Actual',
        observations: 'Observaciones',
        rut: 'RUT',
        religion: 'Religión',
        family_group: 'Grupo Familiar',
        parent_status: 'Estado Parental',
        parent_notes: 'Notas Parentales',
        bank_name: 'Banco',
        bank_account_type: 'Tipo Cuenta',
        bank_account_number: 'N° Cuenta',
    }

    const searchContactFields = (contact, term) => {
        const matches = []
        for (const [field, label] of Object.entries(CONTACT_FIELD_LABELS)) {
            const value = contact[field]
            if (value == null) continue
            const strValue = String(value).toLowerCase()
            if (strValue.includes(term)) {
                matches.push(label)
            }
        }
        // Search full name combo
        const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase()
        if (fullName.includes(term) && !matches.includes('Nombre') && !matches.includes('Apellido')) {
            matches.push('Nombre Completo')
        }
        return matches
    }

    const filteredContacts = contacts.filter(contact => {
        // Agent filter
        if (agentFilter !== 'all' && contact.agent_id !== agentFilter) return false
        // Text search
        if (!searchTerm) return true
        const term = searchTerm.toLowerCase()
        return searchContactFields(contact, term).length > 0
    }).filter(contact => {
        if (filters.profession && !contact.profession?.toLowerCase().includes(filters.profession.toLowerCase())) return false
        if (filters.rating && !contact.rating?.toLowerCase().includes(filters.rating.toLowerCase())) return false
        if (filters.need && !contact.need?.toLowerCase().includes(filters.need.toLowerCase())) return false
        if (filters.comuna && !(contact.barrio_comuna || contact.comuna)?.toLowerCase().includes(filters.comuna.toLowerCase())) return false
        if (filters.address && !contact.address?.toLowerCase().includes(filters.address.toLowerCase())) return false
        return true
    }).sort((a, b) => {
        const dateA = new Date(a.created_at)
        const dateB = new Date(b.created_at)
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE))
    const safePage = Math.min(currentPage, totalPages)
    const paginatedContacts = filteredContacts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

    // Reset page when filters/search change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, agentFilter, sortOrder, filters])

    // Memoize match results for rendering
    const getContactMatches = (contact) => {
        if (!searchTerm) return []
        return searchContactFields(contact, searchTerm.toLowerCase())
    }

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

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Contactos')

        worksheet.columns = [
            { header: 'Nombre', key: 'first_name', width: 15 },
            { header: 'Apellido', key: 'last_name', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Teléfono', key: 'phone', width: 15 },
            { header: 'Profesión', key: 'profession', width: 20 },
            { header: 'Necesidad', key: 'need', width: 15 },
            { header: 'Comuna', key: 'barrio_comuna', width: 20 },
            { header: 'Dirección', key: 'address', width: 30 },
            { header: 'Fuente', key: 'source', width: 15 },
            { header: 'Estado', key: 'status', width: 10 },
        ]

        filteredContacts.forEach(contact => {
            worksheet.addRow(contact)
        })

        const buffer = await workbook.xlsx.writeBuffer()
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `contactos_remax_${new Date().toISOString().split('T')[0]}.xlsx`
        a.click()
    }

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setColumns((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const toggleColumn = (id) => {
        setColumns(cols => cols.map(col =>
            col.id === id ? { ...col, visible: !col.visible } : col
        ))
    }

    const visibleColumns = columns.filter(col => col.visible)

    // Helper to render cell content based on column ID
    const renderCellContent = (colId, contact) => {
        switch (colId) {
            case 'name':
                return (
                    <div className="flex flex-col items-start">
                        <span>{contact.first_name} {contact.last_name}</span>
                        {contact.profession && <span className="text-xs text-muted-foreground">{contact.profession}</span>}
                    </div>
                )
            case 'phone':
                return contact.phone || '-'
            case 'email':
                return contact.email || '-'
            case 'need':
                return contact.need || '-'
            case 'contact':
                return (
                    <div className="flex flex-col gap-1 text-sm items-start">
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
                )
            case 'status':
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${contact.status === 'Activo'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        {contact.status}
                    </span>
                )
            case 'source':
                return contact.source
            case 'rating':
                return (
                    <>
                        {contact.rating && <span className="badge badge-outline mr-2">{contact.rating}</span>}
                    </>
                )
            case 'actions':
                return (
                    <div className="text-left">
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
                        {/* Quick Call Action */}
                        {
                            contact.phone && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={(e) => {
                                    e.stopPropagation()
                                    window.location.href = `tel:${contact.phone}`
                                }}>
                                    <Phone className="h-4 w-4" />
                                </Button>
                            )
                        }
                    </div >
                )
            default:
                return null
        }
    }


    return (
        <div className="space-y-4">
            {/* Unified Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative w-full sm:w-64 lg:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar contactos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white dark:bg-slate-950"
                        />
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="border-dashed bg-white dark:bg-slate-950">
                                <Plus className="mr-2 h-4 w-4" /> Filtros Avanzados
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Filtros</h4>
                                    <p className="text-sm text-muted-foreground">Filtra tu lista de contactos.</p>
                                </div>
                                <div className="grid gap-2">
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="profession">Profesión</Label>
                                        <Input
                                            id="profession"
                                            value={filters.profession}
                                            onChange={(e) => setFilters({ ...filters, profession: e.target.value })}
                                            className="col-span-2 h-8"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="rating">Calificación (A+)</Label>
                                        <Input
                                            id="rating"
                                            value={filters.rating}
                                            onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
                                            className="col-span-2 h-8"
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="need">Necesidad</Label>
                                        <Input
                                            id="need"
                                            value={filters.need}
                                            onChange={(e) => setFilters({ ...filters, need: e.target.value })}
                                            className="col-span-2 h-8"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="comuna">Comuna</Label>
                                        <Input
                                            id="comuna"
                                            value={filters.comuna}
                                            onChange={(e) => setFilters({ ...filters, comuna: e.target.value })}
                                            className="col-span-2 h-8"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="address">Dirección</Label>
                                        <Input
                                            id="address"
                                            value={filters.address}
                                            onChange={(e) => setFilters({ ...filters, address: e.target.value })}
                                            className="col-span-2 h-8"
                                        />
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => setFilters({ profession: '', rating: '', need: '', comuna: '', address: '' })} className="w-full">
                                        Limpiar Filtros
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Select value={sortOrder} onValueChange={setSortOrder}>
                        <SelectTrigger className="w-[140px] bg-white dark:bg-slate-950">
                            <SelectValue placeholder="Orden" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Más Nuevos</SelectItem>
                            <SelectItem value="oldest">Más Antiguos</SelectItem>
                        </SelectContent>
                    </Select>

                    {isPrivileged && agents.length > 0 && (
                        <Select value={agentFilter} onValueChange={setAgentFilter}>
                            <SelectTrigger className="w-[180px] bg-white dark:bg-slate-950">
                                <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Agente" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Agentes</SelectItem>
                                {agents.map(agent => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                        {agent.first_name} {agent.last_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Column Selector */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2 bg-white dark:bg-slate-950">
                                <Columns className="w-4 h-4" /> Columnas
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Columnas Visibles</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {columns.map((col) => {
                                if (col.locked) return null
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={col.id}
                                        checked={col.visible}
                                        onCheckedChange={() => toggleColumn(col.id)}
                                    >
                                        {col.label}
                                    </DropdownMenuCheckboxItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsImporterOpen(true)} className="bg-white dark:bg-slate-950">
                        Importar Contactos
                    </Button>
                    <Button variant="outline" onClick={handleExport} className="bg-white dark:bg-slate-950">
                        Exportar
                    </Button>
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Contacto
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-white dark:bg-gray-900 overflow-hidden">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableContext
                                    items={visibleColumns.map(c => c.id)}
                                    strategy={horizontalListSortingStrategy}
                                >
                                    {visibleColumns.map((col) => (
                                        <SortableHeader key={col.id} id={col.id}>
                                            {col.label}
                                        </SortableHeader>
                                    ))}
                                </SortableContext>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={visibleColumns.length} className="text-center h-24 text-center">
                                        Cargando contactos...
                                    </TableCell>
                                </TableRow>
                            ) : filteredContacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={visibleColumns.length} className="text-center h-24 text-center">
                                        No se encontraron contactos.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedContacts.map((contact) => {
                                    const matches = getContactMatches(contact)
                                    return (
                                        <React.Fragment key={contact.id}>
                                            <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/contact/${contact.id}`)}>
                                                {visibleColumns.map((col) => (
                                                    <TableCell key={col.id} className="text-left">
                                                        {renderCellContent(col.id, contact)}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                            {searchTerm && matches.length > 0 && (
                                                <TableRow className="border-0 hover:bg-transparent">
                                                    <TableCell colSpan={visibleColumns.length} className="py-1 px-4 border-0 border-b">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[11px] text-muted-foreground italic">Encontrado en:</span>
                                                            {matches.map((match, i) => (
                                                                <span key={i} className="text-[11px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                                                                    {match}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </DndContext>
            </div>

            {/* Pagination */}
            {!loading && filteredContacts.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-sm text-muted-foreground">
                        Mostrando <span className="font-medium">{(safePage - 1) * PAGE_SIZE + 1}</span> - <span className="font-medium">{Math.min(safePage * PAGE_SIZE, filteredContacts.length)}</span> de <span className="font-medium">{filteredContacts.length}</span> contactos
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={safePage <= 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                            .reduce((acc, p, i, arr) => {
                                if (i > 0 && p - arr[i - 1] > 1) acc.push('...')
                                acc.push(p)
                                return acc
                            }, [])
                            .map((p, i) =>
                                p === '...' ? (
                                    <span key={`dots-${i}`} className="text-sm text-muted-foreground px-1">…</span>
                                ) : (
                                    <Button
                                        key={p}
                                        variant={safePage === p ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setCurrentPage(p)}
                                        className="h-8 w-8 p-0 text-xs"
                                    >
                                        {p}
                                    </Button>
                                )
                            )
                        }
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={safePage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Contact Form Modal/Sheet will go here */}
            {isFormOpen && (
                <ContactForm
                    contact={selectedContact}
                    isOpen={isFormOpen}
                    onClose={handleFormClose}
                />
            )}

            <ContactImporter
                isOpen={isImporterOpen}
                onClose={() => setIsImporterOpen(false)}
                onSuccess={() => {
                    setIsImporterOpen(false)
                    fetchContacts()
                }}
            />
        </div>
    )
}

export default ContactList
