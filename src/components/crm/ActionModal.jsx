import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
import { Check, ChevronsUpDown, X, Plus, Trash2, Clock, Mail } from "lucide-react";
import { cn, toISOLocal } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();
    // Form state
    const [actionType, setActionType] = useState('');
    const [otherActionType, setOtherActionType] = useState('');
    const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId || 'none');
    const [selectedContactIds, setSelectedContactIds] = useState(defaultContactId ? [defaultContactId] : []);
    const [actionDate, setActionDate] = useState(toISOLocal()); // YYYY-MM-DDTHH:mm
    const [note, setNote] = useState('');
    const [hasSelectedNone, setHasSelectedNone] = useState(false);

    // New state for call result
    const [callResult, setCallResult] = useState('');
    const [otherCallResult, setOtherCallResult] = useState('');
    const [associatedTasks, setAssociatedTasks] = useState([]);
    const [linkedEmails, setLinkedEmails] = useState([]);

    // Data state for follow-up tasks
    const [createFollowUp, setCreateFollowUp] = useState(false);
    const [followUpTasks, setFollowUpTasks] = useState([
        {
            id: Date.now(),
            delay: '2_business_days',
            customDate: toISOLocal(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
            useSpecificTime: false,
            specificTime: '09:00'
        }
    ]);

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
                        setActionDate(toISOLocal());
                    }
                }
                setNote(actionData.note || '');

                // Load call result
                if (actionData.call_result) {
                    const isStandardResult = CALL_RESULTS.includes(actionData.call_result);
                    setCallResult(isStandardResult ? actionData.call_result : 'Otra');
                    setOtherCallResult(isStandardResult ? '' : actionData.call_result);
                } else {
                    setCallResult('');
                    setOtherCallResult('');
                }

                if (viewOnly) {
                    fetchAssociatedTasks(actionData.id);
                    fetchLinkedEmails(actionData.id);
                }
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
                setFollowUpTasks([{
                    id: Date.now(),
                    delay: '2_business_days',
                    customDate: toISOLocal(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
                    useSpecificTime: false,
                    specificTime: '09:00'
                }]);
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

    const fetchAssociatedTasks = async (actionId) => {
        try {
            const { data, error } = await supabase
                .from('crm_tasks')
                .select('*')
                .eq('action_id', actionId)
                .order('execution_date', { ascending: true });

            if (error) throw error;
            setAssociatedTasks(data || []);
        } catch (error) {
            console.error('Error fetching associated tasks:', error);
        }
    };

    const fetchLinkedEmails = async (actionId) => {
        try {
            const { data } = await supabase
                .from('email_thread_links')
                .select('id, thread_id, email_threads(id, subject, gmail_thread_id)')
                .eq('action_id', actionId);
            setLinkedEmails(data || []);
        } catch (error) {
            console.error('Error fetching linked emails:', error);
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

    const getFollowUpLabel = (delayValue, customDateValue = null) => {
        const delay = FOLLOW_UP_DELAYS.find(d => d.value === delayValue);
        if (!delay) return '';

        const baseDate = actionDate ? new Date(actionDate) : new Date();
        const targetDate = delayValue === 'custom' && customDateValue
            ? new Date(customDateValue)
            : calculateFollowUpDate(delayValue, baseDate);

        const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(targetDate);
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        return `${delay.label} (${capitalizedDay})`;
    };

    const calculateFollowUpDate = (delay, baseDate = new Date(), customDateStr = null) => {
        let date = new Date(baseDate);
        switch (delay) {
            case '2_business_days':
                date = addBusinessDays(date, 2);
                break;
            case '3_business_days':
                date = addBusinessDays(date, 3);
                break;
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
                if (customDateStr) {
                    // Robust parsing for custom date to avoid UTC shift
                    const datePart = customDateStr.split('T')[0];
                    const [y, m, d] = datePart.split('-').map(Number);
                    return new Date(y, m - 1, d, 0, 0, 0);
                }
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
        // Note: Contacts are now optional via the "Ningún contacto" choice
        // if (selectedContactIds.length === 0) {
        //     toast.error('Debe asociar al menos un contacto.');
        //     return;
        // }

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

                        // Create follow-up tasks if requested
                        if (createFollowUp) {
                            for (const task of followUpTasks) {
                                let followUpDate = calculateFollowUpDate(task.delay, actionDate, task.customDate);

                                if (task.useSpecificTime && task.specificTime) {
                                    const [hours, minutes] = task.specificTime.split(':');
                                    followUpDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                } else {
                                    // Set to local midnight and mark as all-day
                                    // Robust parsing: extract year, month, day to avoid any UTC shift
                                    const y = followUpDate.getFullYear();
                                    const m = followUpDate.getMonth();
                                    const d = followUpDate.getDate();
                                    followUpDate = new Date(y, m, d, 0, 0, 0);
                                }

                                const { data: taskRow, error: taskError } = await supabase
                                    .from('crm_tasks')
                                    .insert({
                                        agent_id: user.id,
                                        contact_id: selectedContactIds[0] || null,
                                        property_id: selectedPropertyId === 'none' ? null : selectedPropertyId,
                                        action: `Seguimiento: ${resolvedType}`,
                                        execution_date: followUpDate.toISOString(),
                                        action_id: actionRow.id,
                                        task_type: 'task',
                                        is_all_day: !task.useSpecificTime
                                    })
                                    .select()
                                    .single();

                                if (taskError) {
                                    console.error('Error creating follow-up task:', taskError);
                                } else if (user.id) {
                                    try {
                                        const { data: profile } = await supabase.from('profiles').select('google_refresh_token').eq('id', user.id).single();
                                        if (profile?.google_refresh_token) {
                                            supabase.functions.invoke('google-calendar-sync', {
                                                body: { agentId: user.id, action: 'push_to_google', taskId: taskRow.id }
                                            });
                                        }
                                    } catch (error) {
                                        console.error('Error triggering google sync:', error);
                                    }
                                }
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

                        toast.success('Acción registrada exitosamente');

                        if (onActionSaved) onActionSaved(actionRow);
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
        setHasSelectedNone(false);
        setSelectedContactIds(prev =>
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        );
    };

    const removeContact = (contactId, e) => {
        e.stopPropagation();
        setSelectedContactIds(prev => prev.filter(id => id !== contactId));
        if (selectedContactIds.length === 1 && selectedContactIds[0] === contactId) {
            // If we're removing the last contact, we might want to keep hasSelectedNone false
            // unless the user explicitly clicks None.
        }
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
                        <DialogDescription className="sr-only">
                            {viewOnly ? 'Detalles de la acción seleccionada' : 'Formulario para agregar una nueva acción al CRM'}
                        </DialogDescription>
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
                                            {selectedContactIds.length === 0
                                                ? (hasSelectedNone ? "Ningún contacto seleccionado" : "Seleccionar contactos...")
                                                : null}
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
                                                <CommandItem
                                                    value="none"
                                                    onSelect={() => {
                                                        setSelectedContactIds([]);
                                                        setHasSelectedNone(true);
                                                        setOpenContactCombo(false);
                                                    }}
                                                    className="text-muted-foreground italic cursor-pointer"
                                                >
                                                    Ningún contacto
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
                        {/* Follow-up Tasks Section */}
                        {!viewOnly && (
                            <div className="pt-2 pb-4 space-y-4 border-t mt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="followup-master"
                                            checked={createFollowUp}
                                            onCheckedChange={setCreateFollowUp}
                                        />
                                        <Label htmlFor="followup-master" className="text-sm font-bold cursor-pointer">
                                            Crear tareas de seguimiento
                                        </Label>
                                    </div>
                                    {createFollowUp && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-primary"
                                            onClick={() => setFollowUpTasks(prev => [
                                                ...prev,
                                                {
                                                    id: Date.now(),
                                                    delay: '2_business_days',
                                                    customDate: toISOLocal(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
                                                    useSpecificTime: false,
                                                    specificTime: '09:00'
                                                }
                                            ])}
                                        >
                                            <Plus className="h-4 w-4 mr-1" /> Agregar otra tarea
                                        </Button>
                                    )}
                                </div>

                                {createFollowUp && (
                                    <div className="space-y-4 ml-6">
                                        {followUpTasks.map((task, index) => (
                                            <div key={task.id} className="p-3 bg-muted/30 rounded-lg space-y-3 relative border border-muted/50">
                                                <div className="flex flex-wrap items-center gap-2 pr-8">
                                                    <span className="text-sm">Hacer seguimiento en</span>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <span
                                                                className="text-primary hover:underline underline-offset-4 font-bold cursor-pointer text-sm"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {getFollowUpLabel(task.delay, task.customDate).toLowerCase()}
                                                            </span>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-56 p-0" align="start">
                                                            <div className="flex flex-col">
                                                                {FOLLOW_UP_DELAYS.map((delay) => (
                                                                    <Button
                                                                        key={delay.value}
                                                                        variant="ghost"
                                                                        className="justify-start font-normal h-9 px-4 rounded-none border-b last:border-0"
                                                                        onClick={() => {
                                                                            const updatedTasks = [...followUpTasks];
                                                                            updatedTasks[index].delay = delay.value;
                                                                            setFollowUpTasks(updatedTasks);
                                                                        }}
                                                                    >
                                                                        {getFollowUpLabel(delay.value)}
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>

                                                    <div className="flex items-center gap-1 ml-auto">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={cn("h-7 w-7", task.useSpecificTime ? "text-primary bg-primary/10" : "text-muted-foreground")}
                                                            onClick={() => {
                                                                const updatedTasks = [...followUpTasks];
                                                                updatedTasks[index].useSpecificTime = !task.useSpecificTime;
                                                                setFollowUpTasks(updatedTasks);
                                                            }}
                                                            title="A la hora..."
                                                        >
                                                            <Clock className="h-4 w-4" />
                                                        </Button>

                                                        {followUpTasks.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => setFollowUpTasks(prev => prev.filter(t => t.id !== task.id))}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-4 items-end">
                                                    {task.delay === 'custom' && (
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Fecha personalizada</Label>
                                                            <Input
                                                                type="datetime-local"
                                                                value={task.customDate}
                                                                onChange={(e) => {
                                                                    const updatedTasks = [...followUpTasks];
                                                                    updatedTasks[index].customDate = e.target.value;
                                                                    setFollowUpTasks(updatedTasks);
                                                                }}
                                                                className="h-8 py-1 text-sm bg-background"
                                                            />
                                                        </div>
                                                    )}

                                                    {task.useSpecificTime && (
                                                        <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-200">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">A la hora...</Label>
                                                            <Input
                                                                type="time"
                                                                value={task.specificTime}
                                                                onChange={(e) => {
                                                                    const updatedTasks = [...followUpTasks];
                                                                    updatedTasks[index].specificTime = e.target.value;
                                                                    setFollowUpTasks(updatedTasks);
                                                                }}
                                                                className="h-8 py-1 text-sm bg-background w-[110px]"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Display associated tasks in viewOnly mode */}
                        {viewOnly && associatedTasks.length > 0 && (
                            <div className="pt-4 border-t mt-4 space-y-3">
                                <Label className="text-sm font-bold flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary" />
                                    Tareas de Seguimiento Generadas
                                </Label>
                                <div className="space-y-2">
                                    {associatedTasks.map((task) => (
                                        <div key={task.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">{task.action}</div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {new Date(task.execution_date).toLocaleString('es-ES', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${task.completed
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                {task.completed ? 'Completada' : 'Pendiente'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Display linked emails in viewOnly mode */}
                        {viewOnly && linkedEmails.length > 0 && (
                            <div className="pt-4 border-t mt-4 space-y-3">
                                <Label className="text-sm font-bold flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-green-600" />
                                    Correos Vinculados
                                </Label>
                                <div className="space-y-1.5">
                                    {linkedEmails.map((link) => (
                                        <button
                                            key={link.id}
                                            type="button"
                                            onClick={() => { onClose(); navigate('/casilla', { state: { openThreadId: link.email_threads?.gmail_thread_id } }); }}
                                            className="w-full text-left flex items-center gap-2 text-sm text-green-700 hover:text-green-900 hover:bg-green-50 border border-green-100 px-3 py-2 rounded-lg transition-colors"
                                        >
                                            <Mail className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">{link.email_threads?.subject || '(Sin asunto)'}</span>
                                        </button>
                                    ))}
                                </div>
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
                </DialogContent >
            </Dialog >

    {/* Support Creation Modals */ }
{
    isCreateContactOpen && (
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
    )
}

{
    isCreatePropertyOpen && (
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
    )
}
        </>
    );
};

export default ActionModal;
