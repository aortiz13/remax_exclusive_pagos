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
import { Plus, Search, MoreHorizontal, Phone, Mail, MapPin, GripHorizontal, Columns } from 'lucide-react'
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
            <div className="flex items-center justify-center gap-2">
                <GripHorizontal className="w-4 h-4 text-gray-400" />
                {children}
            </div>
        </TableHead>
    );
};


const ContactList = () => {
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [selectedContact, setSelectedContact] = useState(null)
    const navigate = useNavigate()

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
    ).filter(contact => {
        if (filters.profession && !contact.profession?.toLowerCase().includes(filters.profession.toLowerCase())) return false
        if (filters.rating && !contact.rating?.toLowerCase().includes(filters.rating.toLowerCase())) return false
        if (filters.rating_80_20 && !contact.rating_80_20?.toLowerCase().includes(filters.rating_80_20.toLowerCase())) return false
        if (filters.need && !contact.need?.toLowerCase().includes(filters.need.toLowerCase())) return false
        if (filters.comuna && !(contact.barrio_comuna || contact.comuna)?.toLowerCase().includes(filters.comuna.toLowerCase())) return false
        if (filters.address && !contact.address?.toLowerCase().includes(filters.address.toLowerCase())) return false
        return true
    }).sort((a, b) => {
        const dateA = new Date(a.created_at)
        const dateB = new Date(b.created_at)
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

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
                    <div className="flex flex-col items-center">
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
                    <div className="flex flex-col gap-1 text-sm items-center">
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
                        {contact.rating_80_20 && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">{contact.rating_80_20}</span>}
                    </>
                )
            case 'actions':
                return (
                    <div className="text-center">
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
                                        <Label htmlFor="rating_80_20">Calificación 80/20</Label>
                                        <Input
                                            id="rating_80_20"
                                            value={filters.rating_80_20}
                                            onChange={(e) => setFilters({ ...filters, rating_80_20: e.target.value })}
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
                                    <Button size="sm" variant="ghost" onClick={() => setFilters({ profession: '', rating: '', rating_80_20: '', need: '', comuna: '', address: '' })} className="w-full">
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
                                filteredContacts.map((contact) => (
                                    <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/contact/${contact.id}`)}>
                                        {visibleColumns.map((col) => (
                                            <TableCell key={col.id} className="text-center">
                                                {renderCellContent(col.id, contact)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </DndContext>
            </div>

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
