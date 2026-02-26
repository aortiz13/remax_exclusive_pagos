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
import { Plus, Search, Filter, Eye, Trash2, Loader2 } from 'lucide-react';
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
    "Cierre de negocio",
    "Promesa Firmada",
    "Llamada en frío (I.C)",
    "Llamada de vendedor activo (I.C)",
    "Llamada de comprador activo (I.C)",
    "Llamada a base relacional (I.C)",
    "Vista a conserjes (I.C)",
    "Otra (I.C)"
];

// Maps action_type → kpi_records field to decrement by 1 when deleted
const ACTION_KPI_MAP = {
    'Carta Oferta': 'offers_in_negotiation',
    'Baja de Precio': 'price_reductions',
    // NOTE: 'Cierre de negocio' is handled separately with money amounts, not a -1 counter
};

const ActionList = () => {
    const { user, profile } = useAuth();
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedActionToView, setSelectedActionToView] = useState(null);

    // Filters state
    const [filterType, setFilterType] = useState('all');
    const [filterContact, setFilterContact] = useState('');
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        if (user) fetchActions();
    }, [user]);

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
                    )
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

    // Filter Logic
    const filteredActions = actions.filter(action => {
        // Filter by Type
        if (filterType !== 'all') {
            const matchesType = action.action_type === filterType || (filterType === 'Other' && !ACTION_TYPES.includes(action.action_type));
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

        // Filter by Date (YYYY-MM-DD match)
        if (filterDate) {
            const actionDateOnly = (action.action_date || '').split('T')[0];
            if (actionDateOnly !== filterDate) return false;
        }

        return true;
    });

    return (
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
                    <Plus className="w-4 h-4 mr-2" /> Agregar Acción
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
                                    <SelectItem value="Other">Otra</SelectItem>
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
                                                            🏠 Captación
                                                        </span>
                                                    )}
                                                    {action.is_conversation_starter && (
                                                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-full font-semibold border border-amber-200 dark:border-amber-800">
                                                            I.C.
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
                                                        onClick={async () => {
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
                                                                            // Note: crm_tasks with action_id will NOT be automatically deleted if FK is SET NULL.
                                                                            // Let's explicitly delete associated tasks too if they were follow-ups.
                                                                            await supabase.from('crm_tasks').delete().eq('action_id', action.id);

                                                                            const { error } = await supabase
                                                                                .from('crm_actions')
                                                                                .delete()
                                                                                .eq('id', action.id);
                                                                            if (error) throw error;

                                                                            // Decrement KPI for Captación Nueva (mandate_id) or other mapped types
                                                                            const actionDateStr = (action.action_date || '').split('T')[0];
                                                                            const kpiField = action.mandate_id
                                                                                ? 'new_listings'
                                                                                : ACTION_KPI_MAP[action.action_type];
                                                                            if (kpiField && actionDateStr) {
                                                                                const { data: kpiRow } = await supabase
                                                                                    .from('kpi_records')
                                                                                    .select(`id, ${kpiField}`)
                                                                                    .eq('agent_id', user.id)
                                                                                    .eq('period_type', 'daily')
                                                                                    .eq('date', actionDateStr)
                                                                                    .single();
                                                                                if (kpiRow && kpiRow[kpiField] > 0) {
                                                                                    await supabase
                                                                                        .from('kpi_records')
                                                                                        .update({ [kpiField]: kpiRow[kpiField] - 1 })
                                                                                        .eq('id', kpiRow.id);
                                                                                }
                                                                            }

                                                                            // Special: Cierre de negocio - subtract actual billing amounts from kpi_records
                                                                            if (action.action_type === 'Cierre de negocio') {
                                                                                const feesToRemove = parseFloat(action.gross_fees) || 0;
                                                                                const closingToRemove = parseFloat(action.closing_value) || 0;
                                                                                const todayLocal = new Date().toLocaleDateString('sv-SE');
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
                                                        }}
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
                                                    Cargando acciones...
                                                </div>
                                            ) : (
                                                'No se encontraron acciones.'
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

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
        </div>
    );
};

export default ActionList;
