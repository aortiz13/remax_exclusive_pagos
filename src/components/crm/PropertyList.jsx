import { useState, useEffect } from 'react'
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Badge,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui"
import { Plus, Search, MoreHorizontal, Home, MapPin, GripHorizontal, Columns, ExternalLink, Trash2, Users } from 'lucide-react'
import { supabase } from '../../services/supabase'
import PropertyQuickView from './PropertyQuickView'
import PropertyForm from './PropertyForm'
import { toast } from 'sonner'
import { logActivity } from '../../services/activityService'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
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


const PRIVILEGED_ROLES = ['superadministrador', 'comercial', 'legal']

const PropertyList = () => {
    const { user, profile } = useAuth()
    const isPrivileged = PRIVILEGED_ROLES.includes(profile?.role)

    const [properties, setProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isQuickViewOpen, setIsQuickViewOpen] = useState(false)
    const [selectedProperty, setSelectedProperty] = useState(null)

    // Agent filter (privileged roles only)
    const [agents, setAgents] = useState([])
    const [agentFilter, setAgentFilter] = useState('all')

    // Delete State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [propertyToDelete, setPropertyToDelete] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Column State
    const [columns, setColumns] = useState([
        { id: 'image', label: '', visible: true },
        { id: 'type', label: 'Tipo', visible: true },
        { id: 'address', label: 'Dirección', visible: true },
        { id: 'commune', label: 'Comuna', visible: true },
        { id: 'price', label: 'Precio', visible: true },
        { id: 'status', label: 'Estado', visible: true },
        { id: 'operation', label: 'Operación', visible: false },
        { id: 'published', label: 'Publicada', visible: false },
        { id: 'owner', label: 'Dueño', visible: true },
        { id: 'metrics', label: 'Metrajes', visible: false },
        { id: 'actions', label: 'Acciones', visible: true, locked: true },
    ])

    const [sortOrder, setSortOrder] = useState('newest')

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchProperties()
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

    const fetchProperties = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('properties')
                .select(`
                    *,
                    contacts (first_name, last_name)
                `)
                .order('created_at', { ascending: false })

            if (error) throw error
            setProperties(data || [])
        } catch (error) {
            console.error('Error fetching properties:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredProperties = properties.filter(property => {
        // Agent filter
        if (agentFilter !== 'all' && property.agent_id !== agentFilter) return false
        // Text search
        const term = searchTerm.toLowerCase()
        if (!searchTerm) return true
        return (
            (property.address?.toLowerCase().includes(term) || false) ||
            (property.commune?.toLowerCase().includes(term) || false) ||
            (property.contacts?.first_name?.toLowerCase().includes(term) || false) ||
            (property.contacts?.last_name?.toLowerCase().includes(term) || false)
        )
    }).sort((a, b) => {
        const dateA = new Date(a.created_at)
        const dateB = new Date(b.created_at)
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

    const handleRowClick = (property) => {
        setSelectedProperty(property)
        setIsQuickViewOpen(true)
    }

    const handleCreate = () => {
        setSelectedProperty(null)
        setIsFormOpen(true)
    }

    const handleFormClose = (shouldRefresh) => {
        setIsFormOpen(false)
        setSelectedProperty(null)
        if (shouldRefresh) {
            fetchProperties()
        }
    }

    const handleQuickViewClose = (action) => {
        setIsQuickViewOpen(false)
        setSelectedProperty(null)
        if (action === 'refresh') {
            fetchProperties()
        }
    }

    const confirmDelete = (property) => {
        setPropertyToDelete(property)
        setIsDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!propertyToDelete) return

        setIsDeleting(true)
        try {
            // 1. Delete associated tasks manually (NO ACTION constraint)
            const { error: tasksError } = await supabase
                .from('crm_tasks')
                .delete()
                .eq('property_id', propertyToDelete.id)

            if (tasksError) throw tasksError

            // 2. Delete the property (Contacts/Logs will CASCADE)
            const { error: propertyError } = await supabase
                .from('properties')
                .delete()
                .eq('id', propertyToDelete.id)

            if (propertyError) throw propertyError

            // Log property deletion to timeline
            logActivity({
                action: 'Eliminó',
                entity_type: 'Propiedad',
                entity_id: propertyToDelete.id,
                description: `Propiedad eliminada: ${propertyToDelete.address || 'Sin dirección'}`,
                property_id: propertyToDelete.id
            }).catch(() => { })

            toast.success('Propiedad eliminada correctamente')

            // Remove from local state
            setProperties(prev => prev.filter(p => p.id !== propertyToDelete.id))

        } catch (error) {
            console.error('Error deleting property:', error)
            toast.error('Error al eliminar la propiedad')
        } finally {
            setIsDeleting(false)
            setIsDeleteDialogOpen(false)
            setPropertyToDelete(null)
        }
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

    const renderCellContent = (colId, property) => {
        switch (colId) {
            case 'image':
                return (
                    <div className="flex justify-center">
                        {property.image_url ? (
                            <img
                                src={property.image_url}
                                alt="Propiedad"
                                className="w-12 h-10 object-cover rounded-md border border-gray-100" // Small thumbnail
                            />
                        ) : (
                            <div className="w-12 h-10 bg-gray-100 rounded-md flex items-center justify-center text-gray-400">
                                <Home className="w-5 h-5" />
                            </div>
                        )}
                    </div>
                )
            case 'type':
                return (
                    <div className="flex flex-col items-center">
                        <Badge variant="outline">{property.property_type || 'Sin tipo'}</Badge>
                    </div>
                )
            case 'address':
                return (
                    <div className="flex flex-col items-center max-w-[200px] truncate">
                        <span>{property.address}</span>
                        {property.unit_number && <span className="text-xs text-muted-foreground">Unidad: {property.unit_number}</span>}
                    </div>
                )
            case 'commune':
                return property.commune || '-'
            case 'price':
                return (
                    <div className="font-medium whitespace-nowrap">
                        {property.price ? (
                            <span>
                                {property.currency === 'CLP' ? '$' : property.currency} {new Intl.NumberFormat('es-CL').format(property.price)}
                            </span>
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                    </div>
                )
            case 'status':
                return (
                    <div className="flex flex-wrap gap-1 justify-center">
                        {property.status && property.status.map((s, i) => (
                            <span key={i} className="bg-slate-100 text-slate-800 text-xs px-2 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-300">
                                {s}
                            </span>
                        ))}
                    </div>
                )
            case 'owner':
                return property.contacts ? `${property.contacts.first_name} ${property.contacts.last_name}` : '-'
            case 'metrics':
                return (
                    <div className="text-xs text-muted-foreground">
                        {property.m2_built ? `${property.m2_built}m² const.` : ''}
                        {property.m2_total ? ` / ${property.m2_total}m² tot.` : ''}
                    </div>
                )
            case 'operation':
                return property.operation_type ? (
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${property.operation_type === 'arriendo' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
                        {property.operation_type}
                    </span>
                ) : '-'
            case 'published':
                return property.published_at
                    ? new Date(property.published_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '-'
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
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation()
                                    handleRowClick(property)
                                }}>Ver Detalles (Quick)</DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedProperty(property)
                                    setIsFormOpen(true)
                                }}>Editar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/50"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        confirmDelete(property)
                                    }}
                                >
                                    Eliminar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            default:
                return null
        }
    }


    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative w-full sm:w-64 lg:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar propiedades..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white dark:bg-slate-950"
                        />
                    </div>

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
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Nueva Propiedad
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
                                        Cargando propiedades...
                                    </TableCell>
                                </TableRow>
                            ) : filteredProperties.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={visibleColumns.length} className="text-center h-24 text-center">
                                        No se encontraron propiedades.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProperties.map((property) => (
                                    <TableRow key={property.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(property)}>
                                        {visibleColumns.map((col) => (
                                            <TableCell key={col.id} className="text-center">
                                                {renderCellContent(col.id, property)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </DndContext>
            </div>

            {isFormOpen && (
                <PropertyForm
                    property={selectedProperty}
                    isOpen={isFormOpen}
                    onClose={handleFormClose}
                />
            )}

            {isQuickViewOpen && (
                <PropertyQuickView
                    property={selectedProperty}
                    isOpen={isQuickViewOpen}
                    onClose={handleQuickViewClose}
                    onEdit={() => {
                        setIsQuickViewOpen(false)
                        setIsFormOpen(true)
                    }}
                />
            )}

            {/* Delete Warning Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta propiedad?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción es permanente. Se eliminará la propiedad <strong>{propertyToDelete?.address}</strong> y todas sus tareas asociadas.
                            <br /><br />
                            <strong className="text-red-500 font-semibold">Nota Importante:</strong> Los contactos vinculados a esta propiedad
                            <strong> NO SE BORRARÁN</strong> de tu base de datos, simplemente se desvincularán de aquí.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default PropertyList
