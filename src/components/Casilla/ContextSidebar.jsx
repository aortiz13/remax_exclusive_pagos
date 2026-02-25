import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
    Loader2, User, Phone, Briefcase, PlusCircle, Home,
    ListTodo, Activity, ExternalLink, X, Calendar,
    CheckCircle2, Circle, ChevronDown, ChevronUp, Mail,
    Bed, Bath, Square, DollarSign, ExternalLink as LinkIcon,
    Save, AlertCircle, Plus, Search, Link2
} from 'lucide-react';
import { Button } from '@/components/ui';
import { toast } from 'sonner';
import TaskModal from '../crm/TaskModal';
import ActionModal from '../crm/ActionModal';
import ContactForm from '../crm/ContactForm';

// ──────────────────────────────────────────────
// Data fetchers
// ──────────────────────────────────────────────
const fetchContactFull = async (contactId) => {
    if (!contactId) return null;
    const { data } = await supabase.from('contacts').select('*').eq('id', contactId).single();
    return data;
};

const fetchProperties = async (contactId) => {
    if (!contactId) return [];
    const { data } = await supabase
        .from('property_contacts')
        .select('id, role, property:property_id(id, address, commune, property_type, operation_type, status, price, currency, m2_total, m2_built, bedrooms, bathrooms, notes, listing_link, image_url)')
        .eq('contact_id', contactId);
    return (data || []).map(l => ({ ...l.property, role: l.role, linkId: l.id })).filter(Boolean);
};

const fetchTasks = async (contactId) => {
    if (!contactId) return [];
    const { data } = await supabase
        .from('crm_tasks')
        .select('id, action, execution_date, completed, is_all_day, description')
        .eq('contact_id', contactId)
        .order('execution_date', { ascending: true });
    return data || [];
};

const fetchActions = async (contactId) => {
    if (!contactId) return [];
    const { data } = await supabase
        .from('crm_action_contacts')
        .select('crm_actions(id, action_type, action_date, note)')
        .eq('contact_id', contactId);
    return (data || []).map(r => r.crm_actions).filter(Boolean);
};

// ──────────────────────────────────────────────
// Collapsible section
// ──────────────────────────────────────────────
const Section = ({ icon: Icon, title, count, children, colorClass = 'text-gray-500', onAdd }) => {
    const [open, setOpen] = useState(true);
    return (
        <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
                <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 text-left flex-1">
                    <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${colorClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {title}
                        {count != null && (
                            <span className="ml-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{count}</span>
                        )}
                    </span>
                    {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />}
                </button>
                {onAdd && (
                    <button
                        onClick={onAdd}
                        title="Crear nuevo"
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${colorClass.replace('text-', 'bg-').replace('-500', '-100')} hover:opacity-80 transition-opacity`}
                    >
                        <Plus className={`w-3 h-3 ${colorClass}`} />
                    </button>
                )}
            </div>
            {open && children}
        </div>
    );
};

// ──────────────────────────────────────────────
// Slide-over base
// ──────────────────────────────────────────────
const SlideOver = ({ title, onClose, children, footer }) => (
    <div className="fixed inset-0 z-[300] flex">
        <div className="flex-1 bg-black/30" onClick={onClose} />
        <div className="w-[380px] bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <h2 className="font-bold text-gray-900 text-base">{title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="px-5 pb-6 pt-3 border-t border-gray-100 shrink-0">{footer}</div>}
        </div>
    </div>
);

// ──────────────────────────────────────────────
// Property Panel
// ──────────────────────────────────────────────
const PropertyPanel = ({ prop, onClose, onNavigate }) => {
    const operationLabel = { 'venta': 'Venta', 'arriendo': 'Arriendo', 'arriendo_temporal': 'Arriendo Temporal' };
    const statusColors = {
        'activa': 'bg-green-100 text-green-700',
        'vendida': 'bg-gray-100 text-gray-600',
        'arrendada': 'bg-blue-100 text-blue-700',
        'inactiva': 'bg-red-100 text-red-600',
    };

    const formatPrice = (price, currency) => {
        if (!price) return null;
        return `${currency === 'UF' ? 'UF ' : '$'} ${Number(price).toLocaleString('es-CL')}`;
    };

    return (
        <SlideOver
            title="Detalle de Propiedad"
            onClose={onClose}
            footer={
                <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={onNavigate}>
                    <ExternalLink className="w-4 h-4" />
                    Ir a la propiedad
                </Button>
            }
        >
            {/* Image */}
            {prop.image_url ? (
                <img src={prop.image_url} alt={prop.address} className="w-full h-40 object-cover" />
            ) : (
                <div className="w-full h-32 bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
                    <Home className="w-10 h-10 text-orange-300" />
                </div>
            )}

            <div className="px-5 py-4 space-y-4">
                {/* Header */}
                <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">{prop.address || 'Sin dirección'}</h3>
                    {prop.commune && <p className="text-sm text-gray-500 mt-0.5">{prop.commune}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {prop.status && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[prop.status] || 'bg-gray-100 text-gray-600'}`}>
                                {prop.status}
                            </span>
                        )}
                        {prop.operation_type && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium capitalize">
                                {operationLabel[prop.operation_type] || prop.operation_type}
                            </span>
                        )}
                        {prop.property_type && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                                {prop.property_type}
                            </span>
                        )}
                        {prop.role && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium capitalize">
                                {prop.role}
                            </span>
                        )}
                    </div>
                </div>

                {/* Price */}
                {prop.price && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
                        <DollarSign className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="font-bold text-green-800 text-sm">{formatPrice(prop.price, prop.currency)}</span>
                    </div>
                )}

                {/* Stats */}
                {(prop.m2_total || prop.bedrooms || prop.bathrooms) && (
                    <div className="flex gap-3">
                        {prop.m2_total && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Square className="w-3.5 h-3.5 text-gray-400" />
                                <span>{prop.m2_total} m²</span>
                            </div>
                        )}
                        {prop.m2_built && prop.m2_built !== prop.m2_total && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Square className="w-3.5 h-3.5 text-gray-400" />
                                <span>{prop.m2_built} m² const.</span>
                            </div>
                        )}
                        {prop.bedrooms && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Bed className="w-3.5 h-3.5 text-gray-400" />
                                <span>{prop.bedrooms} hab.</span>
                            </div>
                        )}
                        {prop.bathrooms && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Bath className="w-3.5 h-3.5 text-gray-400" />
                                <span>{prop.bathrooms} baños</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Notes */}
                {prop.notes && (
                    <div>
                        <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wide mb-1">Notas</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{prop.notes}</p>
                    </div>
                )}

                {/* Listing link */}
                {prop.listing_link && (
                    <a
                        href={prop.listing_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                    >
                        <LinkIcon className="w-3.5 h-3.5" />
                        Ver publicación
                    </a>
                )}
            </div>
        </SlideOver>
    );
};

// ──────────────────────────────────────────────
// Task Panel (editable)
// ──────────────────────────────────────────────
const TaskPanel = ({ task, onClose, onSaved }) => {
    const [action, setAction] = useState(task.action || '');
    const [description, setDescription] = useState(task.description || '');
    const [executionDate, setExecutionDate] = useState(
        task.execution_date
            ? (task.is_all_day
                ? task.execution_date.split('T')[0]
                : task.execution_date.slice(0, 16))
            : ''
    );
    const [isAllDay, setIsAllDay] = useState(task.is_all_day || false);
    const [completed, setCompleted] = useState(task.completed || false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!action.trim()) { toast.error('El título de la tarea es obligatorio'); return; }
        setSaving(true);
        try {
            let finalDate = executionDate;
            if (isAllDay && executionDate && !executionDate.includes('T')) {
                finalDate = `${executionDate}T00:00:00`;
            }

            const { error } = await supabase
                .from('crm_tasks')
                .update({
                    action: action.trim(),
                    description: description.trim() || null,
                    execution_date: finalDate || null,
                    is_all_day: isAllDay,
                    completed,
                })
                .eq('id', task.id);

            if (error) throw error;
            toast.success('Tarea actualizada');
            onSaved();
        } catch (err) {
            console.error(err);
            toast.error('Error al guardar la tarea');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SlideOver
            title="Editar Tarea"
            onClose={onClose}
            footer={
                <Button
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
            }
        >
            <div className="px-5 py-5 space-y-5">
                {/* Completed toggle */}
                <button
                    onClick={() => setCompleted(v => !v)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${completed
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                        }`}
                >
                    {completed
                        ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        : <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                    }
                    <span className="text-sm font-medium">{completed ? 'Tarea completada' : 'Marcar como completada'}</span>
                </button>

                {/* Title */}
                <div>
                    <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">
                        Título de la tarea <span className="text-red-400">*</span>
                    </label>
                    <input
                        value={action}
                        onChange={e => setAction(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                        placeholder="¿Qué hay que hacer?"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">
                        Descripción
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors resize-none"
                        placeholder="Detalles adicionales..."
                    />
                </div>

                {/* All-day toggle */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsAllDay(v => !v)}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${isAllDay ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isAllDay ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <label className="text-sm text-gray-700 cursor-pointer" onClick={() => setIsAllDay(v => !v)}>
                        Todo el día
                    </label>
                </div>

                {/* Date */}
                <div>
                    <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">
                        {isAllDay ? 'Fecha' : 'Fecha y hora'}
                    </label>
                    <input
                        type={isAllDay ? 'date' : 'datetime-local'}
                        value={executionDate}
                        onChange={e => setExecutionDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                    />
                </div>

                {completed && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">Las tareas completadas no pueden reactivarse desde aquí.</p>
                    </div>
                )}
            </div>
        </SlideOver>
    );
};

// ──────────────────────────────────────────────
// Contact Detail Modal
// ──────────────────────────────────────────────
const ContactDetailModal = ({ contact, onClose, onNavigate }) => {
    if (!contact) return null;

    const fields = [
        ['Email', contact.email],
        ['Teléfono', contact.phone],
        ['Profesión', contact.profession],
        ['Estado', contact.status],
        ['Calificación', contact.rating],
        ['Necesidad', contact.need],
        ['Fuente', contact.source],
        ['RUT', contact.rut],
        ['Dirección', contact.address],
        ['Comuna', contact.barrio_comuna],
        ['Sobre el contacto', contact.about],
        ['Observaciones', contact.observations],
    ].filter(([, v]) => v);

    return (
        <SlideOver
            title="Perfil del Contacto"
            onClose={onClose}
            footer={
                <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={onNavigate}>
                    <ExternalLink className="w-4 h-4" />
                    Ir al contacto
                </Button>
            }
        >
            <div className="px-5 pt-6 pb-4 flex flex-col items-center text-center border-b border-gray-100">
                <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-3xl font-bold mb-3">
                    {contact.first_name?.charAt(0) || 'C'}
                </div>
                <h3 className="text-xl font-bold text-gray-900">{contact.first_name} {contact.last_name}</h3>
                {contact.profession && <p className="text-sm text-gray-500 mt-0.5">{contact.profession}</p>}
                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                    {contact.status && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{contact.status}</span>}
                    {contact.rating && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{contact.rating}</span>}
                    {contact.need && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{contact.need}</span>}
                </div>
            </div>
            <dl className="px-5 py-4 space-y-3">
                {fields.map(([label, value]) => (
                    <div key={label}>
                        <dt className="text-[11px] text-gray-400 uppercase font-semibold tracking-wide">{label}</dt>
                        <dd className="text-sm text-gray-800 mt-0.5 break-words">{value}</dd>
                    </div>
                ))}
            </dl>
        </SlideOver>
    );
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
// ── Link contact to thread helper ────────────────────────────
const linkContactToThread = async (threadId, contactId) => {
    const { error } = await supabase
        .from('email_threads')
        .update({ contact_id: contactId })
        .eq('id', threadId);
    if (error) throw error;
};

// ── Vincular Existente Panel ──────────────────────────────────
const LinkContactPanel = ({ thread, onLinked, onCancel }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [linking, setLinking] = useState(false);

    const handleSearch = async (value) => {
        setQuery(value);
        if (value.trim().length < 2) { setResults([]); return; }
        setSearching(true);
        try {
            const { data } = await supabase
                .from('contacts')
                .select('id, first_name, last_name, email, phone')
                .or(`first_name.ilike.%${value}%,last_name.ilike.%${value}%,email.ilike.%${value}%`)
                .limit(10);
            setResults(data || []);
        } finally {
            setSearching(false);
        }
    };

    const handleSelect = async (contact) => {
        setLinking(true);
        try {
            await linkContactToThread(thread.id, contact.id);
            toast.success(`Vinculado con ${contact.first_name} ${contact.last_name}`);
            onLinked(contact.id);
        } catch (err) {
            console.error(err);
            toast.error('Error al vincular contacto');
        } finally {
            setLinking(false);
        }
    };

    return (
        <div className="mt-3 w-full">
            <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    placeholder="Buscar por nombre o email..."
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                />
            </div>

            {searching && (
                <div className="flex justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
            )}

            {!searching && results.length > 0 && (
                <div className="border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-50 max-h-52 overflow-y-auto">
                    {results.map(c => (
                        <button
                            key={c.id}
                            onClick={() => handleSelect(c)}
                            disabled={linking}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5 group"
                        >
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {c.first_name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-blue-700">
                                    {c.first_name} {c.last_name}
                                </p>
                                {c.email && <p className="text-[10px] text-gray-500 truncate">{c.email}</p>}
                            </div>
                            <Link2 className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 shrink-0" />
                        </button>
                    ))}
                </div>
            )}

            {!searching && query.length >= 2 && results.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">Sin resultados para "{query}"</p>
            )}

            <button
                onClick={onCancel}
                className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
            >
                Cancelar
            </button>
        </div>
    );
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
const ContextSidebar = ({ thread, onContactLinked }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [profileOpen, setProfileOpen] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isContactFormOpen, setIsContactFormOpen] = useState(false);
    const [isLinkPanelOpen, setIsLinkPanelOpen] = useState(false);

    const contactId = thread?.contact_id;

    // Extract sender email from thread messages
    const senderEmail = (() => {
        const messages = thread?.email_messages || [];
        const latest = [...messages].sort((a, b) => new Date(a.received_at) - new Date(b.received_at))[0];
        const from = latest?.from_address || '';
        const match = from.match(/<(.+?)>/);
        return match ? match[1] : from.trim();
    })();

    const invalidateThread = () => {
        queryClient.invalidateQueries({ queryKey: ['threadContact', contactId] });
        queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    };

    const { data: contact, isLoading } = useQuery({
        queryKey: ['threadContact', contactId],
        queryFn: () => fetchContactFull(contactId),
        enabled: !!contactId,
    });

    const { data: properties = [] } = useQuery({
        queryKey: ['sidebarProperties', contactId],
        queryFn: () => fetchProperties(contactId),
        enabled: !!contactId,
    });

    const { data: tasks = [] } = useQuery({
        queryKey: ['sidebarTasks', contactId],
        queryFn: () => fetchTasks(contactId),
        enabled: !!contactId,
    });

    const { data: actions = [] } = useQuery({
        queryKey: ['sidebarActions', contactId],
        queryFn: () => fetchActions(contactId),
        enabled: !!contactId,
    });

    // ── States ────────────────────────────────
    if (!thread) {
        return (
            <div className="text-center text-gray-400 mt-10 text-sm px-3">
                Selecciona un correo para ver información de contacto relacionado.
            </div>
        );
    }

    if (isLoading) {
        return <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    }

    if (!contact) {
        return (
            <>
                <div className="flex flex-col items-center justify-center p-6 text-center bg-gray-50 rounded-lg border border-gray-100 mt-4 mx-2">
                    <User className="w-12 h-12 text-gray-300 mb-2" />
                    <h3 className="font-medium text-gray-700 mb-1">Contacto Desconocido</h3>
                    <p className="text-xs text-gray-500 mb-4">Este correo no está vinculado a ningún contacto en su CRM.</p>
                    <div className="flex flex-col w-full gap-2">
                        <Button
                            size="sm"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => { setIsLinkPanelOpen(false); setIsContactFormOpen(true); }}
                        >
                            <PlusCircle className="w-4 h-4 mr-2" /> Crear Contacto
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => { setIsContactFormOpen(false); setIsLinkPanelOpen(v => !v); }}
                        >
                            Vincular Existente
                        </Button>
                    </div>

                    {isLinkPanelOpen && (
                        <LinkContactPanel
                            thread={thread}
                            onLinked={(contactId) => {
                                setIsLinkPanelOpen(false);
                                queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
                                queryClient.invalidateQueries({ queryKey: ['threadContact'] });
                                onContactLinked?.(contactId);
                            }}
                            onCancel={() => setIsLinkPanelOpen(false)}
                        />
                    )}
                </div>

                {/* Create Contact Form */}
                <ContactForm
                    isOpen={isContactFormOpen}
                    contact={null}
                    onClose={async (newContact) => {
                        setIsContactFormOpen(false);
                        if (newContact?.id) {
                            try {
                                await linkContactToThread(thread.id, newContact.id);
                                toast.success('Contacto creado y vinculado al correo');
                                queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
                                queryClient.invalidateQueries({ queryKey: ['threadContact'] });
                                onContactLinked?.(newContact.id);
                            } catch (err) {
                                console.error(err);
                                toast.error('Contacto creado, pero no se pudo vincular automáticamente');
                            }
                        }
                    }}
                    initialEmail={senderEmail}
                />
            </>
        );
    }

    return (
        <>
            <div className="flex flex-col bg-white px-1">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1">Info CRM</h3>

                {/* Contact card */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold shrink-0">
                            {contact.first_name?.charAt(0) || 'C'}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-gray-800 truncate">{contact.first_name} {contact.last_name}</h2>
                            {contact.profession && (
                                <div className="flex items-center text-xs text-gray-500 truncate">
                                    <Briefcase className="w-3 h-3 mr-1 shrink-0" />{contact.profession}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1.5 text-xs">
                        {contact.email && (
                            <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline truncate">{contact.email}</a>
                            </div>
                        )}
                        {contact.phone && (
                            <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a>
                            </div>
                        )}
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-4 text-xs bg-white" onClick={() => setProfileOpen(true)}>
                        Ver Perfil Completo
                    </Button>
                </div>

                {/* Properties */}
                <Section icon={Home} title="Propiedades" count={properties.length} colorClass="text-orange-500">
                    {properties.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Sin propiedades vinculadas</p>
                    ) : (
                        <div className="space-y-2">
                            {properties.map(prop => (
                                <button
                                    key={prop.linkId || prop.id}
                                    onClick={() => setSelectedProperty(prop)}
                                    className="w-full text-left flex flex-col gap-0.5 bg-orange-50 hover:bg-orange-100 border border-orange-100 px-2.5 py-2 rounded-lg transition-colors group"
                                >
                                    <span className="text-xs font-semibold text-gray-800 truncate group-hover:text-orange-700">{prop.address || 'Sin dirección'}</span>
                                    <div className="flex items-center gap-1.5">
                                        {prop.commune && <span className="text-[10px] text-gray-500 truncate">{prop.commune}</span>}
                                        {prop.role && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded-full capitalize">{prop.role}</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </Section>

                {/* Tasks */}
                <Section icon={ListTodo} title="Tareas" count={tasks.length} colorClass="text-blue-500" onAdd={() => setIsTaskModalOpen(true)}>
                    {tasks.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Sin tareas registradas</p>
                    ) : (
                        <div className="space-y-1.5">
                            {tasks.slice(0, 5).map(task => (
                                <button
                                    key={task.id}
                                    onClick={() => setSelectedTask(task)}
                                    className="w-full text-left flex items-start gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-2.5 py-2 rounded-lg transition-colors group"
                                >
                                    {task.completed
                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                        : <Circle className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0 group-hover:text-blue-500" />
                                    }
                                    <div className="min-w-0">
                                        <p className={`text-xs font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-800 group-hover:text-blue-700'}`}>
                                            {task.action}
                                        </p>
                                        {task.execution_date && (
                                            <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                                                <Calendar className="w-2.5 h-2.5" />
                                                {task.is_all_day
                                                    ? new Date(task.execution_date.split('T')[0] + 'T00:00:00').toLocaleDateString('es-ES')
                                                    : new Date(task.execution_date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                }
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {tasks.length > 5 && (
                                <button onClick={() => navigate(`/crm/contact/${contactId}`)} className="text-[10px] text-blue-600 hover:underline w-full text-center mt-1">
                                    Ver {tasks.length - 5} más →
                                </button>
                            )}
                        </div>
                    )}
                </Section>

                {/* Actions */}
                <Section icon={Activity} title="Acciones" count={actions.length} colorClass="text-purple-500" onAdd={() => setIsActionModalOpen(true)}>
                    {actions.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Sin acciones registradas</p>
                    ) : (
                        <div className="space-y-1.5">
                            {actions.slice(0, 5).map(action => (
                                <div key={action.id} className="flex flex-col gap-0.5 bg-purple-50 border border-purple-100 px-2.5 py-2 rounded-lg">
                                    <span className="text-xs font-semibold text-purple-800 truncate">{action.action_type}</span>
                                    {action.action_date && (
                                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                            <Calendar className="w-2.5 h-2.5" />
                                            {new Date(action.action_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>
                                    )}
                                    {action.note && <p className="text-[10px] text-gray-600 italic truncate">{action.note}</p>}
                                </div>
                            ))}
                            {actions.length > 5 && (
                                <button onClick={() => navigate(`/crm/contact/${contactId}`)} className="text-[10px] text-purple-600 hover:underline w-full text-center mt-1">
                                    Ver {actions.length - 5} más →
                                </button>
                            )}
                        </div>
                    )}
                </Section>
            </div>

            {/* ── Slide-overs ─────────────────────────── */}

            {profileOpen && (
                <ContactDetailModal
                    contact={contact}
                    onClose={() => setProfileOpen(false)}
                    onNavigate={() => { setProfileOpen(false); navigate(`/crm/contact/${contactId}`); }}
                />
            )}

            {selectedProperty && (
                <PropertyPanel
                    prop={selectedProperty}
                    onClose={() => setSelectedProperty(null)}
                    onNavigate={() => { setSelectedProperty(null); navigate(`/crm/property/${selectedProperty.id}`); }}
                />
            )}

            {selectedTask && (
                <TaskPanel
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onSaved={() => {
                        setSelectedTask(null);
                        queryClient.invalidateQueries({ queryKey: ['sidebarTasks', contactId] });
                    }}
                />
            )}

            {/* Create Task Modal */}
            <TaskModal
                isOpen={isTaskModalOpen}
                contactId={contactId}
                onClose={(saved) => {
                    setIsTaskModalOpen(false);
                    if (saved) queryClient.invalidateQueries({ queryKey: ['sidebarTasks', contactId] });
                }}
            />

            {/* Create Action Modal */}
            <ActionModal
                isOpen={isActionModalOpen}
                defaultContactId={contactId}
                onClose={() => setIsActionModalOpen(false)}
                onActionSaved={() => {
                    setIsActionModalOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['sidebarActions', contactId] });
                }}
            />
        </>
    );
};

export default ContextSidebar;
