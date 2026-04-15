import React, { useState, useEffect } from 'react';
import {
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@/components/ui';
import { Plus, Search, Filter, Eye, Trash2, Loader2, ChevronDown, Clock, User, Calendar, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import ActionModal from './ActionModal';
import { logActivity } from '../../services/activityService';




const ACTION_TYPES = [
    "Captación Nueva",
    "Café relacional",
    "Entrevista Venta (Pre-listing)",
    "Entrevista Compra (Pre-Buying)",
    "Evaluación Comercial",
    "Visita Propiedad",
    "Visita Comprador",
    "Carta Oferta",
    "Baja de Precio",
    "Facturación",
    "Contrato de arriendo firmado",
    "Promesa Firmada",
    "Llamada en frío (I.C)",
    "Llamada vendedor/arrendador (I.C)",
    "Llamada comprador/arrendatario (I.C)",
    "Llamada a base relacional (I.C)",
    "Vista a conserjes (I.C)",
    "Otra (I.C)"
];

// Maps action_type → kpi_records field to decrement by 1 when deleted
const ACTION_KPI_MAP = {
    // Gestión de Contactos — conversations_started
    'Llamada en frío (I.C)': 'conversations_started',
    'Llamada vendedor/arrendador (I.C)': 'conversations_started',
    'Llamada comprador/arrendatario (I.C)': 'conversations_started',
    'Llamada a base relacional (I.C)': 'conversations_started',
    'Visita a Conserjes (IC)': 'conversations_started',
    // Café & Entrevistas
    'Café relacional': 'relational_coffees',
    'Entrevista Venta (Pre-listing)': 'sales_interviews',
    'Entrevista Compra (Pre-Buying)': 'buying_interviews',
    'Evaluación Comercial': 'commercial_evaluations',
    // Visitas & Negociaciones
    'Visita Propiedad': 'portfolio_visits',
    'Visita comprador/arrendatario (Canje)': 'buyer_visits',
    'Carta Oferta': 'offers_in_negotiation',
    'Promesa Firmada': 'signed_promises',
    'Contrato de arriendo firmado': 'signed_promises',
    'Baja de Precio': 'price_reductions',
    // NOTE: 'Cierre de negocio' / 'Facturación' is handled separately with money amounts
};

const ActionList = () => {
    const { user, profile } = useAuth();
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedActionToView, setSelectedActionToView] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showFilters, setShowFilters] = useState(false);

    // Filters state
    const [filterType, setFilterType] = useState('all');
    const [filterContact, setFilterContact] = useState('');
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        if (user) fetchActions();
    }, [user]);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const fetchActions = async () => {
        setLoading(true);
        try {
            // Fetch actions with their contacts via the junction table
            const { data, error } = await supabase
                .from('crm_actions')
                .select(`
                    *,
                    crm_action_contacts (
                        contact_id,
                        contacts:contact_id ( id, first_name, last_name )
                    ),
                    crm_tasks!crm_tasks_action_id_fkey ( id, completed )
                `)
                .eq('agent_id', user.id)
                .order('action_date', { ascending: false });

            if (error) throw error;

            // Transform data to flatten contacts array
            const transformed = (data || []).map(action => ({
                ...action,
                contacts: (action.crm_action_contacts || []).map(ac => ac.contacts).filter(Boolean)
            }));

            setActions(transformed);
        } catch (err) {
            console.error('Error fetching actions:', err);
            toast.error('Error al cargar acciones');
        } finally {
            setLoading(false);
        }
    };

    // Formatear Fecha
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-CL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    };

    const formatDateShort = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return `Hoy, ${date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
        } else if (diffDays === 1) {
            return `Ayer, ${date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
        } else if (diffDays < 7) {
            return `Hace ${diffDays} días`;
        }
        return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    };

    // Filter Logic
    const filteredActions = actions.filter(action => {
        // Filter by Type
        if (filterType !== 'all') {
            const matchesType = action.action_type === filterType;
            if (!matchesType) return false;
        }

        // Filter by Contact Name (Case-insensitive)
        if (filterContact.trim()) {
            const searchTerms = filterContact.toLowerCase().split(' ');
            const matchedContacts = action.contacts.some(c => {
                const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
                return searchTerms.every(term => fullName.includes(term));
            });
            if (!matchedContacts) return false;
        }

        // Filter by Date (YYYY-MM-DD match, using local date)
        if (filterDate) {
            const localDate = new Date(action.action_date).toLocaleDateString('sv-SE'); // YYYY-MM-DD in local TZ
            if (localDate !== filterDate) return false;
        }

        return true;
    });

    const hasActiveFilters = filterType !== 'all' || filterContact || filterDate;

    const handleDeleteAction = async (action) => {
        // Block deletion of executed linked actions
        const hasCompletedTask = action.crm_tasks?.some(t => t.completed)
        if (!action.kpi_deferred && hasCompletedTask) {
            toast.error('Esta acción está vinculada a una tarea ya completada y no se puede eliminar.')
            return
        }
        toast('¿Eliminar esta acción?', {
            description: 'Esta acción se eliminará permanentemente y el KPI asociado se decrementará.',
            action: {
                label: 'Eliminar',
                onClick: async () => {
                    try {
                        // 1. Find associated tasks that have a Google Event ID
                        const { data: associatedTasks } = await supabase
                            .from('crm_tasks')
                            .select('id, google_event_id')
                            .eq('action_id', action.id);

                        // 2. Trigger deletion in Google for each task
                        if (associatedTasks && associatedTasks.length > 0) {
                            const syncResults = await Promise.all(associatedTasks.map(task => {
                                if (task.google_event_id && profile?.google_refresh_token) {
                                    return supabase.functions.invoke('google-calendar-sync', {
                                        body: {
                                            agentId: user.id,
                                            action: 'delete_from_google',
                                            googleEventId: task.google_event_id
                                        }
                                    });
                                }
                                return Promise.resolve({ data: { success: true } });
                            }));

                            const syncError = syncResults.find(r => r.error || (r.data && !r.data.success));
                            if (syncError) {
                                console.error('Action sync error:', syncError.error || syncError.data?.error);
                                toast.error('Error al sincronizar con Google. No se eliminó la acción.');
                                return;
                            }
                        }

                        // 3. Delete the action (cascades to junction tables)
                        await supabase.from('crm_tasks').delete().eq('action_id', action.id);

                        const { error } = await supabase
                            .from('crm_actions')
                            .delete()
                            .eq('id', action.id);
                        if (error) throw error;

                        // Special: Cierre de negocio - subtract actual billing amounts from kpi_records
                        if (action.action_type === 'Cierre de negocio' || action.action_type === 'Facturación') {
                            const feesToRemove = parseFloat(action.gross_fees) || 0;
                            const closingToRemove = parseFloat(action.closing_value) || 0;
                            const todayLocal = new Date().toLocaleDateString('sv-SE');
                            const actionDateStr = action.action_date ? new Date(action.action_date).toLocaleDateString('sv-SE') : null;
                            const datesToSearch = [...new Set([actionDateStr, todayLocal])].filter(Boolean);
                            const { data: kpiRowsB } = await supabase
                                .from('kpi_records')
                                .select('id, billing_primary, billing_secondary')
                                .eq('agent_id', user.id)
                                .eq('period_type', 'daily')
                                .in('date', datesToSearch);
                            if (kpiRowsB && kpiRowsB.length > 0) {
                                const billingRow = kpiRowsB.find(r =>
                                    parseFloat(r.billing_primary) >= feesToRemove ||
                                    parseFloat(r.billing_secondary) >= closingToRemove
                                ) || kpiRowsB[0];
                                await supabase
                                    .from('kpi_records')
                                    .update({
                                        billing_primary: Math.max(0, (parseFloat(billingRow.billing_primary) || 0) - feesToRemove),
                                        billing_secondary: Math.max(0, (parseFloat(billingRow.billing_secondary) || 0) - closingToRemove),
                                    })
                                    .eq('id', billingRow.id);
                            }
                        }

                        // Log deletion to timeline
                        const firstContact = action.contacts?.[0];
                        logActivity({
                            action: 'Eliminó',
                            entity_type: action.property_id ? 'Propiedad' : 'Contacto',
                            entity_id: action.property_id || firstContact?.id,
                            description: `Acción eliminada: ${action.action_type}`,
                            contact_id: firstContact?.id || null,
                            property_id: action.property_id || null,
                            details: { action_type: action.action_type }
                        }).catch(() => { });

                        setActions(prev => prev.filter(a => a.id !== action.id));
                        toast.success('Acción eliminada exitosamente');
                    } catch (err) {
                        console.error('Error deleting action:', err);
                        toast.error('Error al eliminar la acción');
                    }
                }
            },
            cancel: {
                label: 'Cancelar',
                onClick: () => { }
            },
            duration: 6000
        });
    };

    // ─── Mobile Card View ────────────────────────────────────────────────
    const renderMobileView = () => (
        <div className="space-y-3">
            {/* Search + Filter Toggle */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar contacto..."
                        className="pl-8 h-9 text-sm"
                        value={filterContact}
                        onChange={(e) => setFilterContact(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center justify-center h-9 w-9 rounded-lg border transition-colors ${
                        hasActiveFilters 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-700' 
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500'
                    }`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                </button>
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtros</span>
                        {hasActiveFilters && (
                            <button
                                onClick={() => { setFilterType('all'); setFilterContact(''); setFilterDate(''); }}
                                className="text-xs text-indigo-600 dark:text-indigo-400 font-medium"
                            >
                                Limpiar todo
                            </button>
                        )}
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue placeholder="Tipo de Acción" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los tipos</SelectItem>
                            {ACTION_TYPES.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        className="w-full h-9 text-sm"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                </div>
            )}

            {/* Results count */}
            <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                    {filteredActions.length} accion{filteredActions.length !== 1 ? 'es' : ''}
                </span>
                {hasActiveFilters && (
                    <button onClick={() => { setFilterType('all'); setFilterContact(''); setFilterDate(''); }} className="text-xs text-indigo-600 font-medium">
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* Action Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando acciones...</span>
                </div>
            ) : filteredActions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No hay acciones</p>
                    <p className="text-xs mt-1">Toca + para registrar una nueva</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredActions.map((action) => (
                        <div
                            key={action.id}
                            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3.5 active:scale-[0.99] transition-all"
                            onClick={() => {
                                setSelectedActionToView(action);
                                setIsActionModalOpen(true);
                            }}
                        >
                            {/* Top row: type + date */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
                                        {action.action_type}
                                    </h3>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {action.mandate_id && (
                                            <span className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1.5 py-0.5 rounded-full font-semibold border border-green-200 dark:border-green-800">
                                                🏠 Captación
                                            </span>
                                        )}
                                        {action.is_conversation_starter && (
                                            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-full font-semibold border border-amber-200 dark:border-amber-800">
                                                I.C.
                                            </span>
                                        )}
                                        {action.kpi_deferred && (
                                            <span className="text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-1.5 py-0.5 rounded-full font-semibold border border-orange-200 dark:border-orange-800">
                                                ⏳ Pendiente
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-none">
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDateShort(action.action_date)}
                                    </span>
                                </div>
                            </div>

                            {/* Contacts */}
                            {action.contacts.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                    {action.contacts.map((contact, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium rounded-full px-2 py-0.5"
                                        >
                                            <User className="w-2.5 h-2.5" />
                                            {contact.first_name} {contact.last_name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Note preview */}
                            {action.note && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-1 italic">
                                    "{action.note}"
                                </p>
                            )}

                            {/* Quick actions */}
                            <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-muted-foreground"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedActionToView(action);
                                        setIsActionModalOpen(true);
                                    }}
                                >
                                    <Eye className="w-3 h-3 mr-1" />
                                    Ver
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAction(action);
                                    }}
                                >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Eliminar
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* FAB */}
            <button
                onClick={() => { setSelectedActionToView(null); setIsActionModalOpen(true); }}
                className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center active:scale-95 transition-all"
            >
                <Plus className="w-6 h-6" />
            </button>
        </div>
    );

    // ─── Desktop Table View ──────────────────────────────────────────────
    const renderDesktopView = () => (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-1 items-center space-x-2 w-full max-w-sm">
                    <div className="relative w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por contacto..."
                            className="pl-8"
                            value={filterContact}
                            onChange={(e) => setFilterContact(e.target.value)}
                        />
                    </div>
                </div>

                <Button
                    onClick={() => {
                        setSelectedActionToView(null);
                        setIsActionModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                    <Plus className="w-4 h-4 mr-2" /> <span>Agregar Acción</span>
                </Button>
            </div>

            <Card>
                <CardHeader className="py-4 px-6 border-b bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg font-medium">Historial de Acciones</CardTitle>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Filtros:</span>
                            </div>

                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-[180px] h-8 text-xs">
                                    <SelectValue placeholder="Tipo de Acción" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los tipos</SelectItem>
                                    {ACTION_TYPES.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Input
                                type="date"
                                className="w-[150px] h-8 text-xs"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                            />

                            {(filterType !== 'all' || filterContact || filterDate) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFilterType('all');
                                        setFilterContact('');
                                        setFilterDate('');
                                    }}
                                    className="h-8 px-2 text-xs text-muted-foreground"
                                >
                                    Limpiar
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold px-6 py-3 w-[25%]">Tipo de Acción</TableHead>
                                    <TableHead className="font-semibold px-6 py-3 w-[20%]">Fecha</TableHead>
                                    <TableHead className="font-semibold px-6 py-3">Contacto(s) Asociados</TableHead>
                                    <TableHead className="font-semibold text-right px-6 py-3 w-[10%]">Nota</TableHead>
                                    <TableHead className="font-semibold text-right px-6 py-3 w-[100px]">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredActions.length > 0 ? (
                                    filteredActions.map((action) => (
                                        <TableRow key={action.id} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-medium px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {action.action_type}
                                                    {action.mandate_id && (
                                                        <span className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1.5 py-0.5 rounded-full font-semibold border border-green-200 dark:border-green-800">
                                                            <span>🏠 Captación</span>
                                                        </span>
                                                    )}
                                                    {action.is_conversation_starter && (
                                                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-full font-semibold border border-amber-200 dark:border-amber-800">
                                                            <span>I.C.</span>
                                                        </span>
                                                    )}
                                                    {action.kpi_deferred && (
                                                        <span className="text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-1.5 py-0.5 rounded-full font-semibold border border-orange-200 dark:border-orange-800">
                                                            <span>⏳ Pendiente</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm px-6 py-4">
                                                {formatDate(action.action_date)}
                                            </TableCell>
                                            <TableCell className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {action.contacts.map((contact, idx) => (
                                                        <span key={idx} className="bg-primary/10 text-primary text-xs flex items-center gap-1 rounded px-2 py-1">
                                                            {contact.first_name} {contact.last_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right px-6 py-4">
                                                {action.note ? (
                                                    <span className="text-xs text-muted-foreground truncate max-w-[150px] inline-block" title={action.note}>
                                                        {action.note.length > 50 ? action.note.substring(0, 50) + "..." : action.note}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/50">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => {
                                                            setSelectedActionToView(action);
                                                            setIsActionModalOpen(true);
                                                        }}
                                                        title="Ver Detalles"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                                        onClick={() => handleDeleteAction(action)}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            {loading ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Cargando acciones...</span>
                                                </div>
                                            ) : (
                                                <span>No se encontraron acciones.</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <>
            {isMobile ? renderMobileView() : renderDesktopView()}

            <ActionModal
                isOpen={isActionModalOpen}
                onClose={() => {
                    setIsActionModalOpen(false);
                    setSelectedActionToView(null);
                }}
                viewOnly={!!selectedActionToView}
                actionData={selectedActionToView}
                onActionSaved={fetchActions}
            />
        </>
    );
};

export default ActionList;
