import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Button,
    Label,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
    Checkbox
} from "@/components/ui";
import { supabase } from '../../services/supabase';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import ContactForm from './ContactForm'; // To create a new contact
import PropertyForm from './PropertyForm'; // To create a new property

const ACTION_TYPES = [
    "Café relacional",
    "Entrevista Venta (Pre-listing)",
    "Entrevista Compra (Pre-Buying)",
    "Evaluación Comercial",
    "Visita Propiedad",
    "Visita Comprador",
    "Promesa Firmada",
    "Llamada en frío (I.C)",
    "Llamada de vendedor activo (I.C)",
    "Llamada de comprador activo (I.C)",
    "Llamada a base relacional (I.C)",
    "Vista a conserjes (I.C)",
    "Otra (I.C)"
];

const CALL_RESULTS = [
    "Ocupado",
    "Conectado",
    "Dejó mensaje de voz",
    "Sin respuesta",
    "Número Incorrecto",
    "Otra"
];

const FOLLOW_UP_DELAYS = [
    { label: "En 2 días laborables", value: "2_business_days" },
    { label: "En 3 días laborables", value: "3_business_days" },
    { label: "En 2 semanas", value: "2_weeks" },
    { label: "En 1 mes", value: "1_month" },
    { label: "En 3 meses", value: "3_months" },
    { label: "Fecha personalizada", value: "custom" }
];

const ActionModal = ({ isOpen, onClose, defaultContactId = null, defaultPropertyId = null, viewOnly = false, actionData = null, onActionSaved = null }) => {
    const { user } = useAuth();
    // Form state
    const [actionType, setActionType] = useState('');
    const [otherActionType, setOtherActionType] = useState('');
    const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId || 'none');
    const [selectedContactIds, setSelectedContactIds] = useState(defaultContactId ? [defaultContactId] : []);
    const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
    const [note, setNote] = useState('');

    // New state for call result
    const [callResult, setCallResult] = useState('');
    const [otherCallResult, setOtherCallResult] = useState('');

    // New state for follow-up task
    const [createFollowUp, setCreateFollowUp] = useState(false);
    const [followUpDelay, setFollowUpDelay] = useState('2_business_days');
    const [customFollowUpDate, setCustomFollowUpDate] = useState(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));

    // Data state
    const [properties, setProperties] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [propertyContactsRoles, setPropertyContactsRoles] = useState({}); // { contactId: role }
    const [loadingData, setLoadingData] = useState(false);

    // UI state for creation modals
    const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
    const [isCreatePropertyOpen, setIsCreatePropertyOpen] = useState(false);

    // Combobox state
    const [openContactCombo, setOpenContactCombo] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchOptionsData();

            if (actionData) {
                // Populate from actionData
                const isStandardType = ACTION_TYPES.includes(actionData.action_type);
                setActionType(isStandardType ? actionData.action_type : 'Otra (I.C)');
                setOtherActionType(isStandardType ? '' : actionData.action_type);
                setSelectedPropertyId(actionData.property_id || 'none');
                setSelectedContactIds(actionData.contacts?.map(c => c.id || c) || (defaultContactId ? [defaultContactId] : []));

                if (actionData.action_date) {
                    try {
                        let dateStr = actionData.action_date;
                        if (!dateStr.includes('T')) dateStr += 'T00:00';
                        setActionDate(dateStr.slice(0, 16));
                    } catch (e) {
                        setActionDate(new Date().toISOString().slice(0, 16));
                    }
                }
                setNote(actionData.note || '');
            } else {
                setActionType('');
                setOtherActionType('');
                setSelectedPropertyId(defaultPropertyId || 'none');
                setSelectedContactIds(defaultContactId ? [defaultContactId] : []);
                setActionDate(new Date().toISOString().slice(0, 16));
                setNote('');
                setCallResult('');
                setOtherCallResult('');
                setCreateFollowUp(false);
                setFollowUpDelay('2_business_days');
            }
        }
    }, [isOpen, defaultContactId, defaultPropertyId, actionData]);

    useEffect(() => {
        if (selectedPropertyId && selectedPropertyId !== 'none' && selectedPropertyId !== 'new') {
            fetchPropertyRoles(selectedPropertyId);
        } else {
            setPropertyContactsRoles({});
        }
    }, [selectedPropertyId]);

    const fetchOptionsData = async () => {
        setLoadingData(true);
        try {
            const [propsRes, contactsRes] = await Promise.all([
                supabase.from('properties').select('id, address').order('created_at', { ascending: false }),
                supabase.from('contacts').select('id, first_name, last_name, email').order('first_name', { ascending: true })
            ]);

            if (propsRes.error) throw propsRes.error;
            if (contactsRes.error) throw contactsRes.error;

            setProperties(propsRes.data || []);
            setContacts(contactsRes.data || []);
        } catch (error) {
            console.error('Error fetching options:', error);
            toast.error('Error cargando opciones');
        } finally {
            setLoadingData(false);
        }
    };

    const fetchPropertyRoles = async (propId) => {
        try {
            const { data, error } = await supabase
                .from('property_contacts')
                .select('contact_id, role')
                .eq('property_id', propId);

            if (error) throw error;

            const rolesMap = {};
            data.forEach(item => {
                rolesMap[item.contact_id] = item.role;
            });
            setPropertyContactsRoles(rolesMap);
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const addBusinessDays = (date, days) => {
        let added = 0;
        const result = new Date(date);
        while (added < days) {
            result.setDate(result.getDate() + 1);
            const dayOfWeek = result.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
                added++;
            }
        }
        return result;
    };

    const getFollowUpLabel = (delayValue) => {
        const delay = FOLLOW_UP_DELAYS.find(d => d.value === delayValue);
        if (!delay || delayValue === 'custom') return delay?.label || '';

        const baseDate = actionDate ? new Date(actionDate) : new Date();
        const targetDate = calculateFollowUpDate(delayValue, baseDate);

        const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(targetDate);
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        return `${delay.label} (${capitalizedDay})`;
    };

    const calculateFollowUpDate = (delay, baseDate = new Date()) => {
        const date = new Date(baseDate);
        switch (delay) {
            case '2_business_days':
                return addBusinessDays(date, 2);
            case '3_business_days':
                return addBusinessDays(date, 3);
            case '2_weeks':
                date.setDate(date.getDate() + 14);
                break;
            case '1_month':
                date.setMonth(date.getMonth() + 1);
                break;
            case '3_months':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'custom':
                return new Date(customFollowUpDate);
            default:
                break;
        }
        return date;
    };

    const handleSave = () => {
        if (!actionType) {
            toast.error('Debe seleccionar el tipo de acción.');
            return;
        }
        if (actionType === 'Otra (I.C)' && !otherActionType.trim()) {
            toast.error('Debe especificar la otra acción.');
            return;
        }
        if (selectedContactIds.length === 0) {
            toast.error('Debe asociar al menos un contacto.');
            return;
        }

        const requiresProperty = ['Visita Propiedad', 'Visita Comprador', 'Evaluación Comercial'].includes(actionType);
        if (requiresProperty && (!selectedPropertyId || selectedPropertyId === 'none')) {
            toast.error(`Para la acción "${actionType}", seleccionar una propiedad es obligatorio.`);
            return;
        }

        if (!actionDate) {
            toast.error('Debe indicar la fecha y hora.');
            return;
        }

        if (actionType.startsWith('Llamada') && !callResult) {
            toast.error('Debe seleccionar el resultado de la llamada.');
            return;
        }

        toast('⚠️ Aviso de Seguridad', {
            description: 'Una vez registrada esta acción NO se podrá editar posteriormente, únicamente eliminar. ¿Está seguro?',
            action: {
                label: 'Guardar Acción',
                onClick: async () => {
                    try {
                        const resolvedType = actionType === 'Otra (I.C)' ? otherActionType : actionType;
                        const { data: actionRow, error: actionError } = await supabase
                            .from('crm_actions')
                            .insert({
                                agent_id: user.id,
                                action_type: resolvedType,
                                action_date: actionDate,
                                property_id: selectedPropertyId === 'none' ? null : selectedPropertyId,
                                note: note || null,
                                is_conversation_starter: actionType.includes('(I.C)'),
                                call_result: actionType.startsWith('Llamada') ? (callResult === 'Otra' ? otherCallResult : callResult) : null
                            })
                            .select()
                            .single();

                        if (actionError) throw actionError;

                        // Create follow-up task if requested
                        let followUpTaskRow = null;
                        if (createFollowUp && selectedContactIds.length > 0) {
                            const followUpDate = calculateFollowUpDate(followUpDelay);
                            const { data: taskRow, error: taskError } = await supabase
                                .from('crm_tasks')
                                .insert({
                                    agent_id: user.id,
                                    contact_id: selectedContactIds[0],
                                    property_id: selectedPropertyId === 'none' ? null : selectedPropertyId,
                                    action: `Seguimiento: ${resolvedType}`,
                                    execution_date: followUpDate.toISOString(),
                                    action_id: actionRow.id
                                })
                                .select()
                                .single();

                            if (taskError) {
                                console.error('Error creating follow-up task:', taskError);
                            } else {
                                followUpTaskRow = taskRow;
                            }
                        }

                        // Insert junction rows for contacts
                        if (selectedContactIds.length > 0) {
                            const contactRows = selectedContactIds.map(cid => ({
                                action_id: actionRow.id,
                                contact_id: cid
                            }));
                            const { error: contactsError } = await supabase
                                .from('crm_action_contacts')
                                .insert(contactRows);
                            if (contactsError) throw contactsError;
                        }

                        toast.success('Acción registrada exitosamente');

                        // Trigger Google Sync for the new task if created
                        if (followUpTaskRow && user.id) {
                            try {
                                const { data: profile } = await supabase.from('profiles').select('google_refresh_token').eq('id', user.id).single();
                                if (profile?.google_refresh_token) {
                                    supabase.functions.invoke('google-calendar-sync', {
                                        body: { agentId: user.id, action: 'push_to_google', taskId: followUpTaskRow.id }
                                    });
                                }
                            } catch (error) {
                                console.error('Error triggering google sync:', error);
                            }
                        }

                        if (onActionSaved) onActionSaved();
                        onClose();
                    } catch (err) {
                        console.error('Error saving action:', err);
                        toast.error('Error al guardar la acción. Intente nuevamente.');
                    }
                }
            },
            cancel: {
                label: 'Cancelar',
                onClick: () => { }
            },
            duration: 8000
        });
    };

    const toggleContactSelect = (contactId) => {
        setSelectedContactIds(prev =>
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        );
    };

    const removeContact = (contactId, e) => {
        e.stopPropagation();
        setSelectedContactIds(prev => prev.filter(id => id !== contactId));
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={!isCreateContactOpen && !isCreatePropertyOpen}>
                <DialogContent
                    className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
                    onInteractOutside={(e) => {
                        if (isCreateContactOpen || isCreatePropertyOpen) {
                            e.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{viewOnly ? 'Detalles de Acción' : 'Agregar Acción'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Action Type */}
                        <div className="space-y-2">
                            <Label htmlFor="actionType">Tipo de Acción {viewOnly ? '' : <span className="text-red-500">*</span>}</Label>
                            <Select value={actionType} onValueChange={setActionType} disabled={viewOnly}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione una acción" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACTION_TYPES.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {actionType === 'Otra (I.C)' && (
                                <Input
                                    placeholder="Especifique qué otra acción"
                                    value={otherActionType}
                                    onChange={(e) => setOtherActionType(e.target.value)}
                                    className="mt-2"
                                    disabled={viewOnly}
                                />
                            )}
                        </div>

                        {/* Call Result selector - conditionally visible */}
                        {actionType.startsWith('Llamada') && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Label htmlFor="callResult">Resultado de la llamada {viewOnly ? '' : <span className="text-red-500">*</span>}</Label>
                                <Select value={callResult} onValueChange={setCallResult} disabled={viewOnly}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione un resultado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CALL_RESULTS.map(res => (
                                            <SelectItem key={res} value={res}>{res}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {callResult === 'Otra' && (
                                    <Input
                                        placeholder="Especifique otro resultado"
                                        value={otherCallResult}
                                        onChange={(e) => setOtherCallResult(e.target.value)}
                                        className="mt-2"
                                        disabled={viewOnly}
                                    />
                                )}
                            </div>
                        )}

                        {/* Property Selector */}
                        <div className="space-y-2">
                            <Label htmlFor="property">Propiedad Asociada (Opcional)</Label>
                            <Select
                                disabled={viewOnly}
                                value={selectedPropertyId}
                                onValueChange={(val) => {
                                    if (val === 'new') {
                                        setIsCreatePropertyOpen(true);
                                        setSelectedPropertyId('none');
                                    } else {
                                        setSelectedPropertyId(val);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione propiedad" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new" className="text-primary font-medium">
                                        + Crear nueva propiedad
                                    </SelectItem>
                                    <div className="h-px bg-muted my-1" />
                                    <SelectItem value="none">Ninguna</SelectItem>
                                    {properties.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Contact Selector (Multi) */}
                        <div className="space-y-2">
                            <Label>Contactos Asociados {viewOnly ? '' : <span className="text-red-500">*</span>}</Label>
                            <Popover open={openContactCombo} onOpenChange={(open) => {
                                if (!viewOnly) setOpenContactCombo(open);
                            }} modal={false}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openContactCombo}
                                        className={cn("w-full justify-between min-h-[40px] h-auto p-2", viewOnly && "opacity-70 cursor-not-allowed hidden-caret")}
                                        disabled={viewOnly}
                                    >
                                        <div className="flex flex-wrap gap-1 items-center">
                                            {selectedContactIds.length === 0 ? "Seleccionar contactos..." : null}
                                            {selectedContactIds.map(id => {
                                                const contact = contacts.find(c => c.id === id);
                                                const role = propertyContactsRoles[id];
                                                if (!contact) return null;
                                                return (
                                                    <span key={contact.id} className="bg-primary/10 text-primary text-xs flex items-center gap-1 rounded px-2 py-1">
                                                        {contact.first_name} {contact.last_name}
                                                        {role && <span className="text-[10px] text-muted-foreground ml-1">({role})</span>}
                                                        {!viewOnly && (
                                                            <span
                                                                className="hover:bg-primary/20 rounded-full cursor-pointer p-0.5 ml-1"
                                                                onClick={(e) => removeContact(contact.id, e)}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </span>
                                                        )}
                                                    </span>
                                                )
                                            })}
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start" onWheel={(e) => e.stopPropagation()}>
                                    <Command>
                                        <CommandInput placeholder="Buscar contacto..." />
                                        <CommandList className="max-h-[200px]" onWheel={(e) => e.stopPropagation()}>
                                            <CommandEmpty>No se encontraron contactos.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="new_contact"
                                                    onSelect={() => {
                                                        setIsCreateContactOpen(true);
                                                        setOpenContactCombo(false);
                                                    }}
                                                    className="text-primary font-medium cursor-pointer"
                                                >
                                                    + Crear nuevo contacto
                                                </CommandItem>
                                                {contacts.map((contact) => (
                                                    <CommandItem
                                                        key={contact.id}
                                                        value={`${contact.first_name} ${contact.last_name} ${contact.email}`}
                                                        onSelect={() => {
                                                            toggleContactSelect(contact.id);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedContactIds.includes(contact.id) ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {contact.first_name} {contact.last_name}
                                                        <span className="text-muted-foreground ml-2 text-xs">{contact.email}</span>
                                                        {propertyContactsRoles[contact.id] && (
                                                            <span className="ml-auto text-[10px] bg-secondary px-1.5 py-0.5 rounded capitalize">
                                                                {propertyContactsRoles[contact.id]}
                                                            </span>
                                                        )}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Date and Time */}
                        <div className="space-y-2">
                            <Label htmlFor="datetime">Fecha y Hora {viewOnly ? '' : <span className="text-red-500">*</span>}</Label>
                            <Input
                                id="datetime"
                                type="datetime-local"
                                value={actionDate}
                                onChange={(e) => setActionDate(e.target.value)}
                                disabled={viewOnly}
                            />
                        </div>

                        {/* Note */}
                        <div className="space-y-2">
                            <Label htmlFor="note">Nota (Opcional)</Label>
                            <Textarea
                                id="note"
                                placeholder="Detalles de la acción..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="min-h-[100px]"
                                disabled={viewOnly}
                            />
                        </div>

                        {/* Follow-up Task Option */}
                        {!viewOnly && (
                            <div className="pt-2 pb-4 space-y-3 border-t mt-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="followup"
                                        checked={createFollowUp}
                                        onCheckedChange={setCreateFollowUp}
                                    />
                                    <div
                                        className="text-sm font-medium leading-none flex items-center gap-1"
                                    >
                                        <Label htmlFor="followup" className="cursor-pointer">
                                            Crea una tarea por hacer para hacer seguimiento en
                                        </Label>{" "}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <span
                                                    className="text-primary hover:underline underline-offset-4 font-bold decoration-primary/30 cursor-pointer"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {getFollowUpLabel(followUpDelay).toLowerCase()}
                                                </span>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-0" align="start">
                                                <div className="flex flex-col">
                                                    {FOLLOW_UP_DELAYS.map((delay) => (
                                                        <Button
                                                            key={delay.value}
                                                            variant="ghost"
                                                            className="justify-start font-normal h-9 px-4 rounded-none border-b last:border-0"
                                                            onClick={() => setFollowUpDelay(delay.value)}
                                                        >
                                                            {getFollowUpLabel(delay.value)}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                {createFollowUp && followUpDelay === 'custom' && (
                                    <div className="ml-6 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <Input
                                            type="datetime-local"
                                            value={customFollowUpDate}
                                            onChange={(e) => setCustomFollowUpDate(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant={viewOnly ? "default" : "outline"} onClick={onClose}>
                            {viewOnly ? 'Cerrar' : 'Cancelar'}
                        </Button>
                        {!viewOnly && (
                            <Button onClick={handleSave}>Guardar Acción</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Support Creation Modals */}
            {isCreateContactOpen && (
                <ContactForm
                    isOpen={isCreateContactOpen}
                    onClose={(newContact) => {
                        setIsCreateContactOpen(false);
                        if (newContact && newContact.id) {
                            fetchOptionsData(); // Refresh list to get new contact
                            setSelectedContactIds(prev => [...prev, newContact.id]);
                        }
                    }}
                />
            )}

            {isCreatePropertyOpen && (
                <PropertyForm
                    isOpen={isCreatePropertyOpen}
                    onClose={(newProperty) => {
                        setIsCreatePropertyOpen(false);
                        if (newProperty && newProperty.id) {
                            fetchOptionsData(); // Refresh list to get new property
                            setSelectedPropertyId(newProperty.id);
                        }
                    }}
                />
            )}
        </>
    );
};

export default ActionModal;
