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
    Textarea
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

const ActionModal = ({ isOpen, onClose, defaultContactId = null, defaultPropertyId = null, viewOnly = false, actionData = null, onActionSaved = null }) => {
    const { user } = useAuth();
    // Form state
    const [actionType, setActionType] = useState('');
    const [otherActionType, setOtherActionType] = useState('');
    const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId || 'none');
    const [selectedContactIds, setSelectedContactIds] = useState(defaultContactId ? [defaultContactId] : []);
    const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
    const [note, setNote] = useState('');

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

                // actionData.contacts podria ser array de objetos (id, name) o strings. En el mock es array de objetos.
                setSelectedContactIds(actionData.contacts?.map(c => c.id || c) || (defaultContactId ? [defaultContactId] : []));

                // Format date to datetime-local format if needed
                if (actionData.action_date) {
                    // Try to slice to YYYY-MM-DDTHH:mm format
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
                // Reset form when opened with new defaults or just opened
                setActionType('');
                setOtherActionType('');
                setSelectedPropertyId(defaultPropertyId || 'none');
                setSelectedContactIds(defaultContactId ? [defaultContactId] : []);
                setActionDate(new Date().toISOString().slice(0, 16));
                setNote('');
            }
        }
    }, [isOpen, defaultContactId, defaultPropertyId, actionData]);

    useEffect(() => {
        // When selected property changes, fetch roles for the contacts
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

    const handleSave = () => {
        // Validation
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
                                is_conversation_starter: actionType.includes('(I.C)')
                            })
                            .select()
                            .single();

                        if (actionError) throw actionError;

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

                        {/* Property Selector */}
                        <div className="space-y-2">
                            <Label htmlFor="property">Propiedad Asociada (Opcional)</Label>
                            <Select
                                disabled={viewOnly}
                                value={selectedPropertyId}
                                onValueChange={(val) => {
                                    if (val === 'new') {
                                        setIsCreatePropertyOpen(true);
                                        setSelectedPropertyId('none'); // Reset select temporarily
                                    } else {
                                        setSelectedPropertyId(val);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione propiedad" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Ninguna</SelectItem>
                                    {properties.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                                    ))}
                                    <div className="h-px bg-muted my-1" />
                                    <SelectItem value="new" className="text-primary font-medium">
                                        + Crear nueva propiedad
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Contact Selector (Multi) */}
                        <div className="space-y-2">
                            <Label>Contactos Asociados {viewOnly ? '' : <span className="text-red-500">*</span>}</Label>
                            <Popover open={openContactCombo} onOpenChange={(open) => {
                                if (!viewOnly) setOpenContactCombo(open);
                            }}>
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
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar contacto..." />
                                        <CommandList>
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
                                                            // Keep popover open for multi-select
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
