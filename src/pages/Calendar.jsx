import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import isToday from 'date-fns/isToday'
import addDays from 'date-fns/addDays'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { Card, CardContent, Button, Checkbox, Label, Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui'
import { ChevronLeft, ChevronRight, Filter, Plus, Clock, Calendar as CalendarIcon, MapPin, User, Bell, Trash2, RefreshCw, Phone, Mail, Users, CheckCircle, Pencil, Video, Check, X, HelpCircle, ExternalLink, Activity, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import PropertyPickerInline from '../components/ui/PropertyPickerInline'
import ContactPickerInline from '../components/ui/ContactPickerInline'
import { toISOLocal } from '../lib/utils'
import { withRetry } from '../lib/fetchWithRetry'
import { completeTaskWithAction, isTaskDeletionBlocked } from '../services/completeTaskAction'

const ACTION_TYPES = [
    "Café relacional",
    "Entrevista Venta (Pre-listing)",
    "Entrevista Compra (Pre-Buying)",
    "Evaluación Comercial",
    "Visita Propiedad",
    "Visita comprador/arrendatario (Canje)",
    "Carta Oferta",
    "Baja de Precio",
    "Facturación",
    "Contrato de arriendo firmado",
    "Promesa Firmada",
    "Llamada en frío (I.C)",
    "Llamada vendedor/arrendador (I.C)",
    "Llamada comprador/arrendatario (I.C)",
    "Llamada a base relacional (I.C)",
    "Visita a Conserjes (IC)",
    "Otra (I.C)"
]

// Setup date-fns localizer
const locales = {
    'es': es,
}

const decodeHtml = (html) => {
    if (!html) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
};

// Custom Components
const CustomToolbar = (toolbar) => {
    const goToBack = () => {
        toolbar.onNavigate('PREV')
    }
    const goToNext = () => {
        toolbar.onNavigate('NEXT')
    }
    const goToCurrent = () => {
        toolbar.onNavigate('TODAY')
    }

    const getNavLabel = () => {
        const { date, view } = toolbar;
        if (isToday(date)) return 'Hoy';
        if (view === 'day') return format(date, "d 'de' MMM", { locale: es });
        if (view === 'week') {
            const start = startOfWeek(date, { weekStartsOn: 1 });
            return format(start, "d 'de' MMM", { locale: es });
        }
        if (view === 'month') return format(date, "MMMM", { locale: es });
        return 'Hoy';
    }

    return (
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-2">
                <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1 shadow-sm items-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToBack}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 px-3 font-medium text-xs truncate max-w-[140px] capitalize" onClick={goToCurrent}>
                        {getNavLabel()}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}><ChevronRight className="w-4 h-4" /></Button>
                </div>
                <h2 className="text-xl font-bold ml-2 capitalize">
                    {toolbar.label}
                </h2>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                {['month', 'week', 'day', 'agenda'].map(v => (
                    <Button
                        key={v}
                        variant={toolbar.view === v ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => toolbar.onView(v)}
                        className="text-xs h-8 capitalize"
                    >
                        {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : v === 'day' ? 'Día' : 'Agenda'}
                    </Button>
                ))}
            </div>
        </div>
    )
}

// Customize DayPicker styles to fit container
const dayPickerStyles = `
        .rdp {
            margin: 0;
            --rdp-cell-size: 32px;
            --rdp-accent-color: #0c4a6e;
            --rdp-background-color: #f1f5f9;
        }
        .rdp-month { width: 100%; }
        .rdp-table { max-width: 100%; }
        .rdp-day_selected:not([disabled]) {
            background-color: var(--rdp-accent-color);
            color: white;
            font-weight: bold;
        }
        .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
            background-color: var(--rdp-background-color);
        }
        .rdp-nav_button { width: 24px; height: 24px; }
        .rdp-head_cell { font-size: 0.7rem; text-transform: uppercase; color: #64748b; font-weight: 600; }
        .rdp-caption_label { font-size: 0.875rem; font-weight: 700; text-transform: capitalize; }
        .rdp-day { font-size: 0.85rem; }
    `

// Styles for Big Calendar to force full width time indicator
const bigCalendarStyles = `
        .rbc-calendar { font-family: inherit; }
        .rbc-header { padding: 12px 4px; font-weight: 600; font-size: 0.875rem; border-bottom: 1px solid #e2e8f0; text-transform: capitalize; }
        .rbc-today { background-color: #f8fafc; }
        .rbc-event { border-radius: 6px; }
        .rbc-time-view, .rbc-month-view { border: 1px solid #e2e8f0; border-radius: 12px; }
        .rbc-current-time-indicator { background-color: #ef4444; height: 2px; }
        .rbc-time-content .rbc-current-time-indicator { width: 100% !important; left: 0 !important; z-index: 10; pointer-events: none; }
        .rbc-time-content .rbc-current-time-indicator::before {
            content: '';
            position: absolute;
            left: -6px;
            top: -3px;
            width: 8px;
            height: 8px;
            background-color: #ef4444;
            border-radius: 50%;
        }
    `

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
})
const DnDCalendar = withDragAndDrop(Calendar)

// Helpers
const getEventType = (action = '') => {
    const lowerAction = action.toLowerCase()
    if (lowerAction.includes('llamar') || lowerAction.includes('llamada') || lowerAction.includes('phone') || lowerAction.includes('call')) return 'call'
    if (lowerAction.includes('mail') || lowerAction.includes('correo') || lowerAction.includes('enviar')) return 'email'
    if (lowerAction.includes('reunion') || lowerAction.includes('reunión') || lowerAction.includes('visit') || lowerAction.includes('visita') || lowerAction.includes('meet') || lowerAction.includes('zoom')) return 'meeting'
    return 'task'
}

export default function CalendarPage() {
    const { user, profile } = useAuth()
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState(Views.WEEK)
    const [date, setDate] = useState(new Date())
    const [contacts, setContacts] = useState([])
    const [properties, setProperties] = useState([])

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        descriptionHtml: '',
        start: '',
        end: '',
        type: 'task',
        contactId: 'none',
        propertyId: 'none',
        attendees: [],
        create_meet: false,
        is_all_day: false
    })
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [guestInput, setGuestInput] = useState('')
    const [linkedActionType, setLinkedActionType] = useState('')
    const [hasExecutedAction, setHasExecutedAction] = useState(false)

    // Mobile detection
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)')
        const handler = (e) => setIsMobile(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    // Mobile-specific state
    const [showMiniCal, setShowMiniCal] = useState(false)

    // Default to day view on mobile (only on initial detection)
    useEffect(() => {
        if (isMobile && view === Views.WEEK) {
            setView(Views.DAY)
        }
    }, [])

    useEffect(() => {
        if (user) {
            fetchEvents()
            fetchContacts()
            fetchProperties()
        }
    }, [user])

    // Polling for task changes (replaces Supabase Realtime)
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            fetchEvents(true);
        }, 10000); // Poll every 10 seconds

        return () => clearInterval(interval);
    }, [user]);

    // Background polling for Google Calendar (Auto-Sync)
    useEffect(() => {
        if (!user || !profile?.google_refresh_token) return;

        const interval = setInterval(() => {
            // Perform silent sync in background
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: user.id, action: 'sync_from_google' }
            }).then(({ error }) => {
                // Sync action handles the DB update, Realtime handles the UI refresh
                // But we call fetchEvents(true) just in case to be sure
                if (!error) fetchEvents(true);
            });
        }, 60000); // Polling every 1 minute

        return () => clearInterval(interval);
    }, [user, profile?.google_refresh_token]);

    // Sync on window focus (when returning from another tab)
    useEffect(() => {
        const handleFocus = () => {
            if (user && profile?.google_refresh_token) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'sync_from_google' }
                }).then(({ error }) => {
                    if (!error) fetchEvents(true);
                });
            }
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [user, profile?.google_refresh_token]);

    // Auto-push unsynced CRM tasks to Google Calendar (once per task)
    const pushedTaskIdsRef = useRef(new Set());
    useEffect(() => {
        if (!user || !profile?.google_refresh_token || loading) return;

        const unsyncedEvents = events.filter(e => !e.isGoogleEvent && !pushedTaskIdsRef.current.has(e.id));
        if (unsyncedEvents.length === 0) return;

        // Mark as pushed immediately to prevent duplicates
        unsyncedEvents.forEach(evt => pushedTaskIdsRef.current.add(evt.id));

        // Push each unsynced task (fire and forget, silently)
        unsyncedEvents.forEach(evt => {
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: user.id, action: 'push_to_google', taskId: evt.id }
            }).catch(() => { })
        });
    }, [events, loading, user, profile?.google_refresh_token]);

    const fetchContacts = async () => {
        try {
            const { data } = await supabase.from('contacts').select('id, first_name, last_name').eq('agent_id', user.id)
            setContacts(data || [])
        } catch (error) {
            console.error('Error fetching contacts:', error)
        }
    }

    const fetchProperties = async () => {
        try {
            const { data } = await supabase.from('properties').select('id, address').order('address')
            setProperties(data || [])
        } catch (error) {
            console.error('Error fetching properties:', error)
        }
    }

    const fetchEvents = async (silent = false) => {
        try {
            if (!silent) setLoading(true)
            const { data, error } = await withRetry(() => supabase
                .from('crm_tasks')
                .select(`
                    id,
                    execution_date,
                    end_date,
                    action,
                    description,
                    description_html,
                    task_type,
                    location,
                    hangout_link,
                    attendees,
                    completed,
                    reminder_minutes,
                    google_event_id,
                    action_id,
                    is_all_day,
                    contact:contacts(id, first_name, last_name),
                    property:properties(id, address),
                    parent_action:crm_actions(id, action_type, note, kpi_deferred)
                `)
                .eq('agent_id', user.id)
            )

            if (error) throw error

            const formattedEvents = data.map(task => {
                let startDate, endDate;

                if (task.is_all_day) {
                    // Standard parsing: use the date part and force a safe local time or UTC
                    // The 12:00:00 ensures we stay on the target date regardless of TZ
                    const datePart = task.execution_date.split('T')[0];
                    startDate = new Date(datePart + 'T12:00:00');
                    endDate = new Date(datePart + 'T13:00:00');
                } else {
                    startDate = new Date(task.execution_date)
                    endDate = task.end_date ? new Date(task.end_date) : new Date(startDate.getTime() + 60 * 60000)
                }

                // Fix: Ensure at least 30 min duration for visibility if start == end
                if (!task.is_all_day && endDate.getTime() <= startDate.getTime()) {
                    endDate = new Date(startDate.getTime() + 30 * 60000)
                }

                return {
                    id: task.id,
                    title: task.action,
                    description: task.description,
                    descriptionHtml: task.description_html,
                    start: startDate,
                    end: endDate,
                    resource: task,
                    completed: task.completed,
                    type: task.task_type || getEventType(task.action),
                    contactId: task.contact?.id,
                    contactName: task.contact ? `${task.contact.first_name} ${task.contact.last_name}` : null,
                    propertyId: task.property?.id,
                    propertyName: task.property?.address,
                    reminder: task.reminder_minutes,
                    location: task.location,
                    hangoutLink: task.hangout_link,
                    attendees: task.attendees || [],
                    isGoogleEvent: !!task.google_event_id,
                    isSyncing: task.google_event_id && !task.last_synced_at,
                    actionId: task.action_id,
                    parentAction: task.parent_action,
                    allDay: !!task.is_all_day,
                    linkedAction: task.parent_action ? {
                        id: task.parent_action.id,
                        action_type: task.parent_action.action_type,
                        kpi_deferred: task.parent_action.kpi_deferred
                    } : null
                }
            })

            setEvents(formattedEvents)
        } catch (error) {
            console.error('Error fetching events:', error)
            if (!silent) toast.error('Error al cargar eventos')
        } finally {
            setLoading(false)
        }
    }

    // Handlers
    const handleSync = async () => {
        if (!profile?.google_refresh_token) {
            toast.error('Google Calendar no está vinculado')
            return
        }

        setIsSyncing(true)
        const toastId = toast.loading('Sincronizando con Google Calendar...')
        try {
            const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: user.id, action: 'sync_from_google' }
            })

            if (error) throw error

            if (data?.retry) {
                const retryResponse = await supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'sync_from_google' }
                })
                if (retryResponse.error) throw retryResponse.error
                const retryTotal = (retryResponse.data?.results?.events || 0) + (retryResponse.data?.results?.tasks || 0)
                toast.success(retryTotal > 0 ? `Sincronizados ${retryTotal} eventos` : 'Calendario sincronizado — sin cambios nuevos', { id: toastId })
            } else {
                const syncTotal = (data?.results?.events || 0) + (data?.results?.tasks || 0)
                toast.success(syncTotal > 0 ? `Sincronizados ${syncTotal} eventos` : 'Calendario sincronizado — sin cambios nuevos', { id: toastId })
            }

            fetchEvents()
        } catch (error) {
            console.error('Sync error:', error)
            toast.error('Error al sincronizar con Google', { id: toastId })
        } finally {
            setIsSyncing(false)
        }
    }

    const handleSelectSlot = ({ start, end, action }) => {
        setSelectedEvent(null)
        const isAllDay = action === 'select' && start.getHours() === 0 && end.getHours() === 0;

        const endWithDuration = start.getTime() === end.getTime()
            ? new Date(start.getTime() + 30 * 60000)
            : end

        setFormData({
            title: '',
            description: '',
            descriptionHtml: '',
            start: isAllDay ? format(start, "yyyy-MM-dd") : toISOLocal(start),
            end: isAllDay ? format(start, "yyyy-MM-dd") : toISOLocal(endWithDuration),
            type: 'task',
            contactId: 'none',
            propertyId: 'none',
            reminder: 'none',
            attendees: [],
            create_meet: false,
            is_all_day: isAllDay
        })
        setLinkedActionType('')
        setHasExecutedAction(false)
        setIsEditing(true)
        setIsModalOpen(true)
    }

    const handleSelectEvent = (event) => {
        setSelectedEvent(event)
        setIsEditing(false)
        setFormData({
            title: decodeHtml(event.title),
            description: event.description || '',
            descriptionHtml: event.descriptionHtml || event.description || '',
            start: event.allDay ? format(event.start, "yyyy-MM-dd") : toISOLocal(event.start),
            end: event.allDay ? format(event.end, "yyyy-MM-dd") : toISOLocal(event.end),
            type: event.type || 'task',
            contactId: event.contactId || 'none',
            propertyId: event.propertyId || 'none',
            reminder: event.reminder ? event.reminder.toString() : 'none',
            location: event.location || '',
            hangoutLink: event.hangoutLink || '',
            attendees: event.attendees || [],
            create_meet: !!event.hangoutLink,
            is_all_day: !!event.allDay || !!event.resource?.is_all_day
        })
        // Set linked action state
        if (event.parentAction) {
            setLinkedActionType(event.parentAction.action_type || '')
            setHasExecutedAction(!event.parentAction.kpi_deferred && event.completed)
        } else {
            setLinkedActionType('')
            setHasExecutedAction(false)
        }
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!formData.title || !formData.start) {
            toast.error('Título y fecha son obligatorios')
            return
        }

        setIsSaving(true)
        try {
            // Handle is_all_day correctly to avoid timezone shifts
            let executionDate, endDate;
            if (formData.is_all_day) {
                // Standardize to 12:00:00 UTC for all-day tasks
                const datePart = formData.start.split('T')[0];
                executionDate = new Date(`${datePart}T12:00:00Z`).toISOString();
                endDate = executionDate;
            } else {
                executionDate = new Date(formData.start).toISOString();
                endDate = new Date(formData.end).toISOString();
            }

            // Handle linked action creation/update
            let actionId = selectedEvent?.actionId || null
            const contactForAction = formData.contactId !== 'none' ? formData.contactId : null
            const propertyForAction = formData.propertyId !== 'none' ? formData.propertyId : null

            if (linkedActionType && linkedActionType !== 'none' && !selectedEvent?.actionId) {
                // Create new deferred action
                const { data: actionRow, error: actionError } = await supabase
                    .from('crm_actions')
                    .insert({
                        agent_id: user.id,
                        action_type: linkedActionType,
                        action_date: executionDate,
                        property_id: propertyForAction,
                        note: `Acción vinculada a actividad: ${formData.title}`,
                        is_conversation_starter: linkedActionType.includes('(I.C)'),
                        kpi_deferred: true
                    })
                    .select()
                    .single()

                if (actionError) {
                    console.error('Error creating linked action:', actionError)
                    toast.error('Error al crear acción vinculada')
                } else {
                    actionId = actionRow.id
                    // Insert contact junction if we have a contact
                    if (contactForAction) {
                        try {
                            await supabase.from('crm_action_contacts').insert({
                                action_id: actionRow.id,
                                contact_id: contactForAction
                            })
                        } catch (_) { /* ignore duplicate */ }
                    }
                }
            } else if ((!linkedActionType || linkedActionType === 'none') && selectedEvent?.actionId && !hasExecutedAction) {
                // User removed the linked action (only allowed before execution)
                await supabase.from('crm_actions').delete().eq('id', selectedEvent.actionId)
                actionId = null
            }

            const payload = {
                agent_id: user.id,
                action: formData.title,
                description: formData.description,
                execution_date: executionDate,
                end_date: endDate,
                task_type: formData.type,
                contact_id: contactForAction,
                property_id: propertyForAction,
                reminder_minutes: formData.reminder === 'none' ? null : parseInt(formData.reminder),
                location: formData.location,
                attendees: formData.attendees,
                is_all_day: !!formData.is_all_day,
                action_id: actionId
            }

            if (selectedEvent) {
                const { error } = await supabase
                    .from('crm_tasks')
                    .update(payload)
                    .eq('id', selectedEvent.id)
                if (error) throw error
                toast.success('Tarea actualizada')

                if (profile?.google_refresh_token) {
                    try {
                        const { data: syncData, error: syncInvokeErr } = await supabase.functions.invoke('google-calendar-sync', {
                            body: { agentId: user.id, action: 'push_to_google', taskId: selectedEvent.id, create_meet: formData.create_meet }
                        })
                        if (syncInvokeErr || (syncData && !syncData.success)) {
                            console.error('Sync error details:', syncInvokeErr || syncData?.error)
                            toast.error('Actualizada localmente, pero falló la sincronización con Google')
                        }
                    } catch (syncErr) {
                        console.error('Error syncing to Google:', syncErr)
                        toast.error('Actualizada localmente, pero falló la sincronización con Google')
                    }
                }
            } else {
                const { data: newTask, error } = await supabase
                    .from('crm_tasks')
                    .insert([payload])
                    .select()
                    .single()
                if (error) throw error
                toast.success('Tarea creada')

                if (profile?.google_refresh_token && newTask) {
                    try {
                        const { data: syncData, error: syncInvokeErr } = await supabase.functions.invoke('google-calendar-sync', {
                            body: { agentId: user.id, action: 'push_to_google', taskId: newTask.id, create_meet: formData.create_meet }
                        })

                        if (syncInvokeErr || (syncData && !syncData.success)) {
                            console.error('Sync error details:', syncInvokeErr || syncData?.error)
                            toast.error('Creada localmente, pero falló la sincronización con Google')
                        }
                    } catch (syncErr) {
                        console.error('Error syncing to Google:', syncErr)
                        toast.error('Creada localmente, pero falló la sincronización con Google')
                    }
                }
            }

            await fetchEvents()
            setIsModalOpen(false)
            setFormData({
                title: '',
                start: '',
                end: '',
                description: '',
                type: 'task',
                status: 'pending',
                location: '',
                contactId: 'none',
                propertyId: 'none',
                attendees: [],
                create_meet: false
            })
        } catch (error) {
            console.error('Error saving task:', error)
            toast.error('Error al guardar tarea: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    const addGuest = () => {
        if (!guestInput || !guestInput.includes('@')) {
            toast.error('Ingresa un correo válido')
            return
        }
        if (formData.attendees.some(a => a.email === guestInput)) {
            toast.error('Este invitado ya existe')
            return
        }
        setFormData({
            ...formData,
            attendees: [...formData.attendees, { email: guestInput, responseStatus: 'needsAction' }]
        })
        setGuestInput('')
    }

    const removeGuest = (email) => {
        setFormData({
            ...formData,
            attendees: formData.attendees.filter(a => a.email !== email)
        })
    }

    const handleDelete = async () => {
        if (!selectedEvent) return

        try {
            setIsDeleting(true)

            // Block deletion if task is completed with an executed linked action
            if (selectedEvent.completed && selectedEvent.actionId && selectedEvent.linkedAction && !selectedEvent.linkedAction.kpi_deferred) {
                toast.error('Esta tarea tiene una acción vinculada ya ejecutada y no se puede eliminar.')
                setIsDeleting(false)
                setIsDeleteConfirmOpen(false)
                return
            }

            if (profile?.google_refresh_token && selectedEvent.resource?.google_event_id) {
                const { error: syncError, data: syncData } = await supabase.functions.invoke('google-calendar-sync', {
                    body: {
                        agentId: user.id,
                        action: 'delete_from_google',
                        googleEventId: selectedEvent.resource.google_event_id
                    }
                })

                if (syncError || (syncData && !syncData.success)) {
                    console.error('Google sync error:', syncError || syncData?.error)
                    toast.error('Error al sincronizar con Google. Intente de nuevo.')
                    return
                }
            }

            const { error } = await supabase
                .from('crm_tasks')
                .delete()
                .eq('id', selectedEvent.id)

            if (error) throw error
            toast.success('Tarea eliminada')
            setIsModalOpen(false)
            setEvents(prev => prev.filter(e => e.id !== selectedEvent.id))
        } catch (error) {
            console.error('Delete error:', error)
            toast.error('Error al eliminar')
        } finally {
            setIsDeleting(false)
            setIsDeleteConfirmOpen(false)
        }
    }

    const toggleCompleted = async () => {
        if (!selectedEvent) return

        const result = await completeTaskWithAction(
            selectedEvent.id,
            selectedEvent.completed,
            selectedEvent.linkedAction,
            user.id
        )
        if (!result.success) return

        setSelectedEvent(prev => prev ? { ...prev, completed: result.newCompleted } : null)
        setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, completed: result.newCompleted } : e))

        if (profile?.google_refresh_token && selectedEvent.resource?.google_event_id) {
            supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: user.id, action: 'push_to_google', taskId: selectedEvent.id }
            })
        }

        toast.success(result.newCompleted ? 'Tarea completada' : 'Tarea pendiente')
    }

    const onEventDrop = async ({ event, start, end }) => {
        try {
            // Handle is_all_day correctly on drop
            let execution_date = start.toISOString();
            let end_date = end.toISOString();

            if (event.allDay) {
                // Standardize to 12:00:00 UTC on drop
                const datePart = start.toISOString().split('T')[0];
                execution_date = new Date(`${datePart}T12:00:00Z`).toISOString();
                end_date = execution_date;
            }

            const { error } = await supabase
                .from('crm_tasks')
                .update({
                    execution_date,
                    end_date
                })
                .eq('id', event.id)

            if (error) throw error
            toast.success('Evento actualizado')

            if (profile?.google_refresh_token) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'push_to_google', taskId: event.id }
                })
            }

            setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
        } catch (error) {
            console.error('Error updating event:', error)
            toast.error('Error al actualizar fecha')
            fetchEvents()
        }
    }

    const onEventResize = async ({ event, start, end }) => {
        try {
            // Handle is_all_day correctly on resize
            let execution_date = start.toISOString();
            let end_date = end.toISOString();

            if (event.allDay) {
                const datePartStart = start.toISOString().split('T')[0];
                const datePartEnd = end.toISOString().split('T')[0];
                execution_date = new Date(`${datePartStart}T12:00:00Z`).toISOString();
                end_date = new Date(`${datePartEnd}T12:00:00Z`).toISOString();
            }

            const { error } = await supabase
                .from('crm_tasks')
                .update({
                    execution_date,
                    end_date
                })
                .eq('id', event.id)

            if (error) throw error
            toast.success('Duración actualizada')

            if (profile?.google_refresh_token) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'push_to_google', taskId: event.id }
                })
            }

            setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
        } catch (error) {
            console.error('Error resizing event:', error)
            toast.error('Error al actualizar duración')
            fetchEvents()
        }
    }

    const eventStyleGetter = (event) => {
        let backgroundColor = '#6366f1'
        let borderColor = '#4f46e5'

        if (event.completed) {
            backgroundColor = '#e2e8f0'
            borderColor = '#cbd5e1'
            return {
                style: {
                    backgroundColor, borderColor, color: '#94a3b8',
                    textDecoration: 'line-through', borderRadius: '4px',
                    borderLeft: `4px solid ${borderColor}`, opacity: 0.8
                }
            }
        }

        switch (event.type) {
            case 'call': backgroundColor = '#3b82f6'; borderColor = '#2563eb'; break;
            case 'email': backgroundColor = '#f43f5e'; borderColor = '#e11d48'; break; // rose for emails
            case 'task': backgroundColor = '#f59e0b'; borderColor = '#d97706'; break;
            case 'meeting':
                backgroundColor = '#10b981'
                borderColor = '#059669'
                break;
        }

        const isMeeting = event.type === 'meeting'
        const isGoogle = event.isGoogleEvent;

        return {
            style: {
                backgroundColor: isGoogle ? `${backgroundColor}CC` : `${backgroundColor}1A`,
                color: isGoogle ? 'white' : borderColor,
                border: isGoogle ? 'none' : `1px solid ${backgroundColor}40`,
                borderLeft: isGoogle ? 'none' : `4px solid ${borderColor}`,
                borderTop: isMeeting && !isGoogle ? `2px solid ${borderColor}` : 'none',
                borderRadius: '4px',
                fontWeight: isMeeting ? '700' : '500',
                fontSize: '0.8rem',
                padding: '2px 5px',
                boxShadow: isMeeting ? (isGoogle ? '0 2px 4px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.05)') : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                zIndex: isMeeting ? 5 : 1
            }
        }
    }

    const getModalConfig = () => {
        const type = formData.type || 'task';
        const isGoogle = selectedEvent?.isGoogleEvent;
        const config = {
            title: selectedEvent ? (isGoogle ? 'Evento de Google' : 'Editar Actividad') : 'Nueva Actividad',
            icon: <Clock className="w-5 h-5 text-slate-400" />,
            label: 'Tarea'
        };

        switch (type) {
            case 'call':
                config.icon = <Phone className="w-5 h-5 text-blue-500" />;
                config.label = 'Llamada';
                break;
            case 'email':
                config.icon = <Mail className="w-5 h-5 text-orange-500" />;
                config.label = 'Correo';
                break;
            case 'meeting':
                config.icon = <Users className="w-5 h-5 text-emerald-500" />;
                config.label = 'Reunión';
                break;
            default:
                config.icon = <CheckCircle className="w-5 h-5 text-indigo-500" />;
                config.label = 'Tarea';
        }

        return config;
    };

    /* ─── Mobile toolbar component ──────────────────────────── */
    const MobileToolbar = (toolbar) => {
        const goToBack = () => toolbar.onNavigate('PREV')
        const goToNext = () => toolbar.onNavigate('NEXT')
        const goToCurrent = () => toolbar.onNavigate('TODAY')

        const getDateLabel = () => {
            const d = toolbar.date
            switch (toolbar.view) {
                case 'month':
                case 'agenda':
                    return format(d, "MMMM yyyy", { locale: es })
                case 'week': {
                    const weekStart = startOfWeek(d, { weekStartsOn: 1 })
                    const weekEnd = addDays(weekStart, 6)
                    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
                    return sameMonth
                        ? `${format(weekStart, "d", { locale: es })} - ${format(weekEnd, "d MMM", { locale: es })}`
                        : `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM", { locale: es })}`
                }
                default:
                    return format(d, "EEE, d MMM", { locale: es })
            }
        }
        const dateLabel = getDateLabel()

        const isViewingToday = isToday(toolbar.date)

        return (
            <div className="space-y-2 mb-3">
                {/* Row 1: Nav + Date + Today button */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <button onClick={goToBack} className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <button
                            onClick={() => setShowMiniCal(v => !v)}
                            className="text-base font-semibold text-gray-900 capitalize px-1"
                        >
                            {dateLabel}
                        </button>
                        <button onClick={goToNext} className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1">
                        {!isViewingToday && (
                            <button
                                onClick={goToCurrent}
                                className="text-xs font-medium text-blue-600 px-3 py-1.5 rounded-full border border-blue-200 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                            >
                                Hoy
                            </button>
                        )}
                    </div>
                </div>

                {/* Row 2: View toggle */}
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {['day', 'week', 'month', 'agenda'].map(v => (
                        <button
                            key={v}
                            onClick={() => toolbar.onView(v)}
                            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${toolbar.view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        >
                            {v === 'day' ? 'Día' : v === 'week' ? 'Sem' : v === 'month' ? 'Mes' : 'Agenda'}
                        </button>
                    ))}
                </div>

                {/* Collapsible mini calendar */}
                {showMiniCal && (
                    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm animate-in slide-in-from-top duration-150">
                        <style>{dayPickerStyles}</style>
                        <DayPicker
                            mode="single"
                            selected={date}
                            onSelect={(d) => {
                                if (d) { setDate(d); setShowMiniCal(false) }
                            }}
                            locale={es}
                            className="p-0"
                            showOutsideDays
                            fixedWeeks
                        />
                    </div>
                )}
            </div>
        )
    }

    /* ─── MOBILE LAYOUT ───────────────────────────────────────── */
    if (isMobile) {
        return (
            <>
                <div className="flex flex-col h-[calc(100dvh-64px)] bg-white overflow-hidden">
                    {/* Header area */}
                    <div className="px-3 pt-3 shrink-0">
                        <style>{bigCalendarStyles}</style>
                    </div>

                    {/* Calendar */}
                    <div className="flex-1 overflow-hidden px-1">
                        <DnDCalendar
                            localizer={localizer}
                            events={events}
                            startAccessor="start"
                            endAccessor="end"
                            style={{ height: '100%' }}
                            view={view}
                            onView={setView}
                            date={date}
                            onNavigate={setDate}
                            components={{
                                toolbar: MobileToolbar,
                                event: ({ event }) => {
                                    const Icon = event.type === 'call' ? Phone :
                                        event.type === 'email' ? Mail :
                                            event.type === 'meeting' ? Users : CheckCircle
                                    return (
                                        <div className="flex items-center gap-1 overflow-hidden w-full">
                                            <Icon className="w-3 h-3 flex-none" />
                                            <span className="truncate flex-1 text-[11px]">{event.title}</span>
                                        </div>
                                    )
                                }
                            }}
                            min={new Date(0, 0, 0, 7, 0, 0)}
                            max={new Date(0, 0, 0, 23, 59, 59)}
                            eventPropGetter={eventStyleGetter}
                            selectable
                            onSelectSlot={handleSelectSlot}
                            onSelectEvent={handleSelectEvent}
                            culture='es'
                            messages={{
                                next: "Sig", previous: "Ant", today: "Hoy", month: "Mes",
                                week: "Semana", day: "Día", agenda: "Agenda", date: "Fecha",
                                time: "Hora", event: "Evento", noEventsInRange: "Sin eventos en este rango"
                            }}
                        />
                    </div>

                    {/* FAB: New Task */}
                    <button
                        onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })}
                        className="fixed bottom-6 right-5 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center z-30 active:scale-95 transition-transform"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </div>

                {/* Modals (same as desktop) */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[640px] p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[85dvh] rounded-2xl">
                        {!isEditing && selectedEvent ? (
                        <div className="flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto">
                                {/* View Mode Header */}
                                <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: eventStyleGetter(selectedEvent).style.borderColor }} />
                                <div className="p-4 space-y-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1 flex-1 min-w-0">
                                            <h2 className="text-xl font-semibold leading-tight text-slate-900 break-words">{selectedEvent.title}</h2>
                                            <div className="flex items-center gap-2 text-slate-500 text-sm mt-1.5">
                                                <Clock className="w-4 h-4 flex-none" />
                                                <span>
                                                    {format(selectedEvent.start, "EEEE, d 'de' MMMM", { locale: es })}
                                                    {!selectedEvent.allDay && (
                                                        <>
                                                            <br />
                                                            {format(selectedEvent.start, "p")} - {format(selectedEvent.end, "p")}
                                                        </>
                                                    )}
                                                    {selectedEvent.allDay && (
                                                        <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full font-bold text-slate-400 uppercase tracking-tighter">Todo el día</span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 flex-none bg-slate-50 rounded-lg p-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-white shadow-sm transition-all" onClick={() => setIsEditing(true)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-white shadow-sm transition-all" onClick={() => setIsDeleteConfirmOpen(true)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                            <div className="w-5 h-5 flex items-center justify-center">
                                                {getModalConfig().icon}
                                            </div>
                                            <span className="font-semibold text-slate-700">{getModalConfig().label}</span>
                                            <span className="mx-1 text-slate-300">•</span>
                                            <button
                                                onClick={toggleCompleted}
                                                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors ${selectedEvent.completed ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
                                            >
                                                {selectedEvent.completed ? 'Completada' : 'Pendiente'}
                                            </button>
                                        </div>

                                        {formData.location && formData.type !== 'task' && (
                                            <div className="flex items-start gap-3 text-sm text-slate-600 group">
                                                <div className="w-5 h-5 flex items-center justify-center flex-none">
                                                    <MapPin className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                </div>
                                                <span className="flex-1 leading-relaxed">{formData.location}</span>
                                            </div>
                                        )}

                                        {formData.hangoutLink && (
                                            <div className="flex items-center gap-3 py-0.5">
                                                <div className="w-5 h-5 flex items-center justify-center flex-none">
                                                    <Video className="w-4 h-4 text-blue-500" />
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100 h-8 rounded-full px-4 gap-2 text-xs font-semibold"
                                                    onClick={() => window.open(formData.hangoutLink, '_blank')}
                                                >
                                                    Unirse con Google Meet
                                                    <ExternalLink className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        )}

                                        {(selectedEvent.contactId && selectedEvent.contactId !== 'none') || (selectedEvent.propertyId && selectedEvent.propertyId !== 'none') ? (
                                            <div className="flex flex-col gap-2 pt-1">
                                                {selectedEvent.contactName && (
                                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                                        <div className="w-5 h-5 flex items-center justify-center flex-none">
                                                            <User className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                        <Link
                                                            to={`/crm/contact/${selectedEvent.contactId}`}
                                                            target="_blank"
                                                            className="font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                                                        >
                                                            {selectedEvent.contactName}
                                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                                        </Link>
                                                    </div>
                                                )}
                                                {selectedEvent.propertyName && (
                                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                                        <div className="w-5 h-5 flex items-center justify-center flex-none">
                                                            <MapPin className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                        <Link
                                                            to={`/crm/property/${selectedEvent.propertyId}`}
                                                            target="_blank"
                                                            className="truncate italic text-slate-500 hover:text-blue-600 hover:underline flex items-center gap-1 min-w-0"
                                                        >
                                                            <span className="truncate">{selectedEvent.propertyName}</span>
                                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}

                                        {formData.attendees && formData.attendees.length > 0 && formData.type !== 'task' && (
                                            <div className="space-y-2 pt-2 border-t border-slate-50">
                                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                                    <div className="w-5 h-5 flex items-center justify-center flex-none">
                                                        <Users className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <span className="font-semibold">{formData.attendees.length} invitados</span>
                                                </div>
                                                <div className="ml-8 space-y-1 max-h-[100px] overflow-y-auto pr-1">
                                                    {formData.attendees.map((attendee, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                                                            <span className="text-slate-600 truncate mr-2" title={attendee.email}>
                                                                {attendee.email}
                                                                {attendee.self && <span className="text-[10px] text-slate-400 ml-1">(Tú)</span>}
                                                            </span>
                                                            <div className="flex-none">
                                                                {attendee.responseStatus === 'accepted' ? (
                                                                    <div className="bg-emerald-100 p-0.5 rounded-full" title="Asistirá"><Check className="w-2.5 h-2.5 text-emerald-600" /></div>
                                                                ) : attendee.responseStatus === 'declined' ? (
                                                                    <div className="bg-red-100 p-0.5 rounded-full" title="No asistirá"><X className="w-2.5 h-2.5 text-red-600" /></div>
                                                                ) : attendee.responseStatus === 'tentative' ? (
                                                                    <div className="bg-orange-100 p-0.5 rounded-full" title="Quizás"><HelpCircle className="w-2.5 h-2.5 text-orange-600" /></div>
                                                                ) : (
                                                                    <div className="bg-slate-100 p-0.5 rounded-full" title="Pendiente"><Clock className="w-2.5 h-2.5 text-slate-400" /></div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {selectedEvent.actionId && selectedEvent.parentAction && (
                                            <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 mt-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 flex items-center justify-center flex-none">
                                                        <Activity className="w-3.5 h-3.5 text-blue-500" />
                                                    </div>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        Acción Relacionada: {selectedEvent.parentAction.action_type}
                                                    </span>
                                                </div>
                                                {selectedEvent.parentAction.note && (
                                                    <div className="ml-8 text-sm text-slate-600 italic bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                                                        "{selectedEvent.parentAction.note}"
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {(formData.descriptionHtml || formData.description) && (
                                            <div className="flex items-start gap-3 pt-3 border-t border-slate-100 mt-1">
                                                <div className="w-5 h-5 mt-0.5 flex-none flex items-center justify-center">
                                                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                                                </div>
                                                <div className="flex-1 text-sm text-slate-600 leading-relaxed max-h-[150px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                                    <div
                                                        className="description-html text-slate-700 space-y-1.5 prose prose-sm max-w-none [&_p]:my-0"
                                                        dangerouslySetInnerHTML={{ __html: decodeHtml(formData.descriptionHtml || formData.description) }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 flex justify-end gap-2 border-t border-slate-100 shrink-0">
                                <Button variant="ghost" size="sm" className="text-slate-500 h-8 px-4" onClick={() => setIsModalOpen(false)}>Cerrar</Button>
                                {!selectedEvent.isGoogleEvent && (
                                    <Button size="sm" className="h-8 px-4 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => setIsEditing(true)}>Editar</Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Edit Mode */
                        <div className="flex flex-col overflow-hidden h-full">
                            <div className="p-3 border-b border-slate-100 shrink-0 bg-slate-50/50">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                                        {getModalConfig().icon}
                                        {getModalConfig().title}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500 flex flex-col gap-1">
                                        <span>
                                            {selectedEvent?.isGoogleEvent
                                                ? 'Este evento se sincroniza con Google Calendar.'
                                                : 'Completa los detalles de tu actividad.'}
                                        </span>
                                        {formData.type === 'task' && profile?.google_refresh_token && (
                                            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full w-fit border border-amber-100 italic">
                                                Reconecta tu cuenta de Google para activar la sincronización nativa de Tareas.
                                            </span>
                                        )}
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                {/* Row 1: Type + Estado */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tipo</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={v => setFormData({ ...formData, type: v })}
                                            disabled={selectedEvent?.isGoogleEvent}
                                        >
                                            <SelectTrigger className="h-8 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="meeting">Evento / Reunión</SelectItem>
                                                <SelectItem value="task">Tarea</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estado</Label>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start gap-2 h-8 text-sm font-medium"
                                            onClick={toggleCompleted}
                                            type="button"
                                        >
                                            <div className={`w-2 h-2 rounded-full ${formData.completed ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'}`} />
                                            {formData.completed ? 'Completado' : 'Pendiente'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Row 2: Título + Vincular Acción side by side */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Título / Acción</Label>
                                        <Input
                                            placeholder="Ej: Llamar a cliente..."
                                            className="h-8 text-sm"
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            disabled={selectedEvent?.isGoogleEvent}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <Link2 className="w-3 h-3 text-indigo-500" />
                                            Vincular Acción
                                        </Label>
                                        {hasExecutedAction ? (
                                            <div className="bg-green-50 p-2 rounded-lg border border-green-200 flex items-center gap-1.5">
                                                <Activity className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                                <span className="text-xs text-green-700 font-medium truncate">{linkedActionType}</span>
                                            </div>
                                        ) : selectedEvent?.actionId && linkedActionType ? (
                                            <div className="flex items-center gap-1">
                                                <div className="flex-1 bg-indigo-50 p-2 rounded-lg border border-indigo-200 flex items-center gap-1.5 min-w-0">
                                                    <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                    <span className="text-xs text-indigo-700 font-medium truncate">{linkedActionType}</span>
                                                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full shrink-0">⏳</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => setLinkedActionType('')}
                                                    title="Desvincular acción"
                                                >
                                                    <Unlink className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Select value={linkedActionType} onValueChange={setLinkedActionType}>
                                                <SelectTrigger className="w-full h-8 text-sm">
                                                    <SelectValue placeholder="Sin acción vinculada" />
                                                </SelectTrigger>
                                                <SelectContent className="z-[300]">
                                                    <SelectItem value="none">Sin acción vinculada</SelectItem>
                                                    {ACTION_TYPES.map(type => (
                                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>
                                {linkedActionType && linkedActionType !== 'none' && !selectedEvent?.actionId && (
                                    <p className="text-[10px] text-amber-600 -mt-1.5">
                                        ⏳ La acción se registrará como pendiente hasta que la tarea se marque como realizada.
                                    </p>
                                )}

                                {/* Row 3: Todo el día + Fecha(s) */}
                                <div className="flex items-end gap-3">
                                    <div className="flex items-center gap-1.5 pb-1.5 shrink-0">
                                        <input
                                            type="checkbox"
                                            id="isAllDay"
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                                            checked={formData.is_all_day}
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                let newStart = formData.start;
                                                let newEnd = formData.end;
                                                if (checked) {
                                                    if (newStart.includes('T')) newStart = newStart.split('T')[0];
                                                    if (newEnd.includes('T')) newEnd = newEnd.split('T')[0];
                                                } else {
                                                    if (!newStart.includes('T')) newStart = `${newStart}T09:00`;
                                                    if (!newEnd.includes('T')) newEnd = `${newEnd}T09:30`;
                                                }
                                                setFormData({ ...formData, is_all_day: checked, start: newStart, end: newEnd });
                                            }}
                                        />
                                        <Label htmlFor="isAllDay" className="text-[10px] text-slate-500 cursor-pointer whitespace-nowrap">Todo el día</Label>
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                {formData.type === 'task' ? 'Fecha Límite' : 'Inicio'}
                                            </Label>
                                            <Input
                                                type={formData.is_all_day ? "date" : "datetime-local"}
                                                className="h-8 text-sm"
                                                value={formData.start}
                                                onChange={e => {
                                                    const newStart = e.target.value;
                                                    const updates = { start: newStart };
                                                    if (formData.type === 'task') {
                                                        if (formData.is_all_day) {
                                                            updates.end = newStart;
                                                        } else {
                                                            const startDate = new Date(newStart);
                                                            if (!isNaN(startDate.getTime())) {
                                                                const endDate = new Date(startDate.getTime() + 15 * 60000);
                                                                const year = endDate.getFullYear();
                                                                const month = String(endDate.getMonth() + 1).padStart(2, '0');
                                                                const day = String(endDate.getDate()).padStart(2, '0');
                                                                const hours = String(endDate.getHours()).padStart(2, '0');
                                                                const minutes = String(endDate.getMinutes()).padStart(2, '0');
                                                                updates.end = `${year}-${month}-${day}T${hours}:${minutes}`;
                                                            }
                                                        }
                                                    }
                                                    setFormData({ ...formData, ...updates });
                                                }}
                                            />
                                        </div>
                                        {formData.type !== 'task' && !formData.is_all_day && (
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fin</Label>
                                                <Input
                                                    type="datetime-local"
                                                    className="h-8 text-sm"
                                                    value={formData.end}
                                                    onChange={e => setFormData({ ...formData, end: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Row 4: Google Meet + Ubicación (meetings only) */}
                                {formData.type !== 'task' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        {profile?.google_refresh_token && (
                                            <div className="flex items-center space-x-2 py-2 bg-blue-50/50 rounded-lg px-3 border border-blue-100">
                                                <Checkbox
                                                    id="create_meet"
                                                    checked={formData.create_meet}
                                                    onCheckedChange={checked => setFormData({ ...formData, create_meet: !!checked })}
                                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                />
                                                <label htmlFor="create_meet" className="text-xs font-bold text-blue-900 flex items-center gap-1.5 cursor-pointer">
                                                    <Video className="w-3.5 h-3.5" />
                                                    Google Meet
                                                </label>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <div className="relative group">
                                                <MapPin className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                                <Input
                                                    className="pl-8 h-8 text-sm"
                                                    placeholder="Ubicación..."
                                                    value={formData.location}
                                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Row 5: Cliente + Propiedad */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <ContactPickerInline
                                            label="Cliente"
                                            value={formData.contactId !== 'none' ? formData.contactId : ''}
                                            onSelectContact={contact => setFormData({ ...formData, contactId: contact?.id || 'none' })}
                                            disabled={selectedEvent?.isGoogleEvent}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <PropertyPickerInline
                                            label="Propiedad"
                                            value={formData.propertyId !== 'none' ? formData.propertyId : ''}
                                            onSelectProperty={property => setFormData({ ...formData, propertyId: property?.id || 'none' })}
                                            disabled={selectedEvent?.isGoogleEvent}
                                        />
                                    </div>
                                </div>

                                {/* Row 6: Invitados (meetings only) */}
                                {formData.type !== 'task' && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                Invitados ({(() => {
                                                    const contact = contacts.find(c => c.id === formData.contactId);
                                                    const contactEmail = contact?.email;
                                                    const attendees = formData.attendees || [];
                                                    const uniqueEmails = new Set(attendees.map(a => a.email));
                                                    if (contactEmail) uniqueEmails.add(contactEmail);
                                                    return uniqueEmails.size;
                                                })()})
                                            </Label>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                className="h-8 text-sm bg-slate-50/50"
                                                placeholder="ejemplo@correo.com"
                                                value={guestInput}
                                                onChange={e => setGuestInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                                            />
                                            <Button type="button" variant="outline" size="sm" onClick={addGuest} className="shrink-0 h-8 px-3 text-xs font-semibold hover:bg-slate-50">
                                                Añadir
                                            </Button>
                                        </div>
                                        {formData.attendees.length > 0 && (
                                            <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto p-1.5 bg-slate-50/50 rounded-lg border border-slate-100">
                                                {formData.attendees.map((attendee, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm text-[10px] text-slate-600">
                                                        <span className="truncate max-w-[120px] font-medium">{attendee.email}</span>
                                                        <button onClick={() => removeGuest(attendee.email)} className="text-slate-400 hover:text-red-500 transition-colors p-0.5">
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {(() => {
                                            const contact = contacts.find(c => c.id === formData.contactId);
                                            return contact?.email && (
                                                <div className="flex items-center text-[10px] py-1 px-2.5 bg-blue-50/50 rounded border border-blue-100/50 gap-1.5">
                                                    <span className="text-blue-700 font-medium truncate">{contact.email}</span>
                                                    <span className="text-[9px] text-blue-500 bg-blue-100/50 px-1 rounded uppercase font-bold">Cliente</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Row 7: Descripción */}
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Descripción</Label>
                                    <Textarea
                                        placeholder="Detalles adicionales..."
                                        className="min-h-[56px] text-sm resize-none bg-slate-50/50 focus:bg-white transition-all"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        disabled={selectedEvent?.isGoogleEvent}
                                    />
                                </div>
                            </div>

                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (selectedEvent && isEditing) setIsEditing(false)
                                        else setIsModalOpen(false)
                                    }}
                                    className="h-8 px-5 text-sm font-semibold"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="h-8 px-6 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                                >
                                    {isSaving ? (
                                        <span className="flex items-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Guardando...
                                        </span>
                                    ) : 'Guardar'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la tarea <strong>{selectedEvent?.title}</strong>. No se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </>
        )
    }

    /* ─── DESKTOP LAYOUT ──────────────────────────────────────── */
    return (
        <div className="w-full h-[calc(100vh-80px)] px-6 pb-6 flex gap-6 overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 flex-none space-y-6 h-full overflow-y-auto pr-1">
                <div>
                    <h1 className="text-3xl font-display font-bold tracking-tight">Calendario</h1>
                    <p className="text-slate-500 text-sm">Gestiona tu agenda.</p>
                </div>

                <Button
                    className="w-full justify-start gap-2"
                    size="lg"
                    onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })}
                >
                    <Plus className="w-5 h-5" /> Nueva Tarea
                </Button>

                {profile?.google_refresh_token && (
                    <Button
                        className="w-full justify-start gap-2"
                        variant="outline"
                        size="lg"
                        onClick={handleSync}
                        disabled={isSyncing}
                    >
                        <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar con Google'}
                    </Button>
                )}

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex justify-center">
                    <style>{dayPickerStyles}</style>
                    <DayPicker
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        locale={es}
                        className="p-0"
                        showOutsideDays
                        fixedWeeks
                    />
                </div>
            </div>

            {/* Main Calendar */}
            <div className="flex-1 h-full min-w-0">
                <Card className="h-full border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    <CardContent className="p-0 flex-1 bg-white dark:bg-slate-950 p-6 flex flex-col h-full overflow-hidden">
                        <style>{bigCalendarStyles}</style>
                        <DnDCalendar
                            localizer={localizer}
                            events={events}
                            startAccessor="start"
                            endAccessor="end"
                            style={{ height: '100%' }}
                            view={view}
                            onView={setView}
                            date={date}
                            onNavigate={setDate}
                            components={{
                                toolbar: CustomToolbar,
                                event: ({ event }) => {
                                    const Icon = event.type === 'call' ? Phone :
                                        event.type === 'email' ? Mail :
                                            event.type === 'meeting' ? Users : CheckCircle
                                    return (
                                        <div className="flex items-center gap-1 overflow-hidden w-full">
                                            <Icon className="w-3 h-3 flex-none" />
                                            <span className="truncate flex-1">{event.title}</span>
                                            {event.isSyncing && (
                                                <RefreshCw className="w-2.5 h-2.5 flex-none animate-spin text-white/70" />
                                            )}
                                        </div>
                                    )
                                }
                            }}
                            min={new Date(0, 0, 0, 8, 0, 0)}
                            max={new Date(0, 0, 0, 23, 59, 59)}
                            eventPropGetter={eventStyleGetter}
                            onEventDrop={onEventDrop}
                            onEventResize={onEventResize}
                            resizable
                            selectable
                            onSelectSlot={handleSelectSlot}
                            onSelectEvent={handleSelectEvent}
                            culture='es'
                            messages={{
                                next: "Sig", previous: "Ant", today: "Hoy", month: "Mes",
                                week: "Semana", day: "Día", agenda: "Agenda", date: "Fecha",
                                time: "Hora", event: "Evento", noEventsInRange: "Sin eventos"
                            }}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Modals */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[92vh]">
                    {!isEditing && selectedEvent ? (
                        <div className="flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto">
                                {/* View Mode Header */}
                                <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: eventStyleGetter(selectedEvent).style.borderColor }} />
                                <div className="p-4 space-y-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1 flex-1 min-w-0">
                                            <h2 className="text-xl font-semibold leading-tight text-slate-900 break-words">{selectedEvent.title}</h2>
                                            <div className="flex items-center gap-2 text-slate-500 text-sm mt-1.5">
                                                <Clock className="w-4 h-4 flex-none" />
                                                <span>
                                                    {format(selectedEvent.start, "EEEE, d 'de' MMMM", { locale: es })}
                                                    {!selectedEvent.allDay && (
                                                        <>
                                                            <br />
                                                            {format(selectedEvent.start, "p")} - {format(selectedEvent.end, "p")}
                                                        </>
                                                    )}
                                                    {selectedEvent.allDay && (
                                                        <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full font-bold text-slate-400 uppercase tracking-tighter">Todo el día</span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            {!selectedEvent.isGoogleEvent && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}><Pencil className="w-4 h-4" /></Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setIsDeleteConfirmOpen(true)}><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    </div>

                                    {selectedEvent.contactName && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <Link to={`/contacts/${selectedEvent.contactId}`} className="text-blue-600 hover:underline font-medium">{selectedEvent.contactName}</Link>
                                        </div>
                                    )}
                                    {selectedEvent.propertyName && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <MapPin className="w-4 h-4 text-slate-400" />
                                            <Link to={`/properties/${selectedEvent.propertyId}`} className="text-blue-600 hover:underline font-medium">{selectedEvent.propertyName}</Link>
                                        </div>
                                    )}
                                    {selectedEvent.location && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <MapPin className="w-4 h-4 text-slate-400" />
                                            <span>{selectedEvent.location}</span>
                                        </div>
                                    )}
                                    {selectedEvent.hangoutLink && (
                                        <a href={selectedEvent.hangoutLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-emerald-600 hover:underline font-medium">
                                            <Video className="w-4 h-4" />
                                            Unirse a Google Meet
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                    {selectedEvent.description && (
                                        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">
                                            {selectedEvent.descriptionHtml ? (
                                                <div dangerouslySetInnerHTML={{ __html: selectedEvent.descriptionHtml }} className="prose prose-sm max-w-none" />
                                            ) : (
                                                <p className="whitespace-pre-wrap">{selectedEvent.description}</p>
                                            )}
                                        </div>
                                    )}
                                    {selectedEvent.attendees?.length > 0 && (
                                        <div className="space-y-1">
                                            <span className="text-xs font-semibold px-2 uppercase tracking-wider text-slate-400">Invitados</span>
                                            <div className="flex flex-wrap gap-1 pl-2">
                                                {selectedEvent.attendees.map((att, i) => (
                                                    <div key={i} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-full text-xs text-slate-700">
                                                        {att.responseStatus === 'accepted' ? <Check className="w-3 h-3 text-emerald-500" /> : att.responseStatus === 'declined' ? <X className="w-3 h-3 text-red-400" /> : <HelpCircle className="w-3 h-3 text-amber-400" />}
                                                        <span className="truncate max-w-[120px]">{att.email}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                <Button
                                    variant={selectedEvent.completed ? "secondary" : "default"}
                                    size="sm"
                                    onClick={toggleCompleted}
                                    className={`gap-1.5 text-xs font-bold h-8 ${selectedEvent.completed ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' : ''}`}
                                >
                                    {selectedEvent.completed ? <><CheckCircle className="w-4 h-4" /> Completada</> : <><Clock className="w-4 h-4" /> Pendiente</>}
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs h-8 font-bold" onClick={() => setIsModalOpen(false)}>Cerrar</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col overflow-hidden">
                            {/* Edit / Create Form Header */}
                            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500 shrink-0" />
                            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                                <div className="flex items-center gap-2">
                                    {getModalConfig().icon}
                                    <DialogTitle className="text-base font-bold text-slate-900">{getModalConfig().title}</DialogTitle>
                                </div>
                                {selectedEvent?.isGoogleEvent && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1">
                                        <RefreshCw className="w-2.5 h-2.5" /> Google
                                    </span>
                                )}
                            </div>
                            <DialogDescription className="sr-only">Formulario para crear o editar una actividad del calendario</DialogDescription>

                            {/* Form */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {/* Row 1 */}
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Título</Label>
                                    <Input
                                        placeholder="¿Qué necesitas hacer?"
                                        className="text-sm font-semibold h-9 bg-slate-50/50 focus:bg-white transition-all"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        disabled={selectedEvent?.isGoogleEvent}
                                    />
                                </div>

                                {/* Row 2: Tipo + All Day */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tipo</Label>
                                        <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })} disabled={selectedEvent?.isGoogleEvent}>
                                            <SelectTrigger className="text-xs h-8 bg-slate-50/50"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="task">✅ Tarea</SelectItem>
                                                <SelectItem value="call">📞 Llamada</SelectItem>
                                                <SelectItem value="email">📧 Correo</SelectItem>
                                                <SelectItem value="meeting">👥 Reunión</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-end pb-1 gap-2">
                                        <Checkbox
                                            id="is_all_day"
                                            checked={formData.is_all_day}
                                            onCheckedChange={v => setFormData({ ...formData, is_all_day: v })}
                                        />
                                        <Label htmlFor="is_all_day" className="text-xs font-medium text-slate-600 cursor-pointer">Todo el día</Label>
                                    </div>
                                </div>

                                {/* Row 3: Dates */}
                                <div className={`grid ${formData.is_all_day ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{formData.is_all_day ? 'Fecha' : 'Inicio'}</Label>
                                        <Input
                                            type={formData.is_all_day ? "date" : "datetime-local"}
                                            className="text-xs h-8 bg-slate-50/50"
                                            value={formData.start}
                                            onChange={e => setFormData({ ...formData, start: e.target.value })}
                                        />
                                    </div>
                                    {!formData.is_all_day && (
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fin</Label>
                                            <Input
                                                type="datetime-local"
                                                className="text-xs h-8 bg-slate-50/50"
                                                value={formData.end}
                                                onChange={e => setFormData({ ...formData, end: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Row 4: Contact + Property */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Contacto</Label>
                                        <ContactPickerInline
                                            value={formData.contactId === 'none' ? null : formData.contactId}
                                            onChange={v => setFormData({ ...formData, contactId: v || 'none' })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Propiedad</Label>
                                        <PropertyPickerInline
                                            value={formData.propertyId === 'none' ? null : formData.propertyId}
                                            onChange={v => setFormData({ ...formData, propertyId: v || 'none' })}
                                        />
                                    </div>
                                </div>

                                {/* Row 4.5: KPI Action Link */}
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                        <Activity className="w-3 h-3" /> Acción KPI vinculada
                                    </Label>
                                    {hasExecutedAction ? (
                                        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 font-medium">
                                            <Link2 className="w-3.5 h-3.5" />
                                            {selectedEvent?.parentAction?.action_type || linkedActionType}
                                            <span className="text-[9px] bg-emerald-200 text-emerald-800 rounded px-1.5 py-0.5 uppercase font-bold">Ejecutada</span>
                                        </div>
                                    ) : (
                                        <Select value={linkedActionType || 'none'} onValueChange={v => setLinkedActionType(v === 'none' ? '' : v)}>
                                            <SelectTrigger className="text-xs h-8 bg-slate-50/50">
                                                <SelectValue placeholder="Sin acción vinculada" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[200px]">
                                                <SelectItem value="none"><span className="flex items-center gap-1.5 text-slate-400"><Unlink className="w-3 h-3" /> Sin acción</span></SelectItem>
                                                {ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Row 5: Reminder + Location */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recordatorio</Label>
                                        <Select value={formData.reminder || 'none'} onValueChange={v => setFormData({ ...formData, reminder: v })}>
                                            <SelectTrigger className="text-xs h-8 bg-slate-50/50"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sin recordatorio</SelectItem>
                                                <SelectItem value="5">5 minutos antes</SelectItem>
                                                <SelectItem value="15">15 minutos antes</SelectItem>
                                                <SelectItem value="30">30 minutos antes</SelectItem>
                                                <SelectItem value="60">1 hora antes</SelectItem>
                                                <SelectItem value="1440">1 día antes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ubicación</Label>
                                        <Input
                                            placeholder="Lugar (opcional)"
                                            className="text-xs h-8 bg-slate-50/50"
                                            value={formData.location || ''}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Row 6: Google Meet + Guests */}
                                {profile?.google_refresh_token && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="create_meet"
                                                checked={formData.create_meet}
                                                onCheckedChange={v => setFormData({ ...formData, create_meet: v })}
                                                disabled={!!formData.hangoutLink}
                                            />
                                            <Label htmlFor="create_meet" className="text-xs font-semibold text-slate-600 flex items-center gap-1 cursor-pointer">
                                                <Video className="w-3.5 h-3.5 text-emerald-500" /> Google Meet
                                            </Label>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                type="email"
                                                className="text-xs h-8 flex-1 bg-slate-50/50"
                                                placeholder="ejemplo@correo.com"
                                                value={guestInput}
                                                onChange={e => setGuestInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                                            />
                                            <Button type="button" variant="outline" size="sm" onClick={addGuest} className="shrink-0 h-8 px-3 text-xs font-semibold hover:bg-slate-50">
                                                Añadir
                                            </Button>
                                        </div>
                                        {formData.attendees.length > 0 && (
                                            <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto p-1.5 bg-slate-50/50 rounded-lg border border-slate-100">
                                                {formData.attendees.map((attendee, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm text-[10px] text-slate-600">
                                                        <span className="truncate max-w-[120px] font-medium">{attendee.email}</span>
                                                        <button onClick={() => removeGuest(attendee.email)} className="text-slate-400 hover:text-red-500 transition-colors p-0.5">
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {(() => {
                                            const contact = contacts.find(c => c.id === formData.contactId);
                                            return contact?.email && (
                                                <div className="flex items-center text-[10px] py-1 px-2.5 bg-blue-50/50 rounded border border-blue-100/50 gap-1.5">
                                                    <span className="text-blue-700 font-medium truncate">{contact.email}</span>
                                                    <span className="text-[9px] text-blue-500 bg-blue-100/50 px-1 rounded uppercase font-bold">Cliente</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Row 7: Descripción */}
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Descripción</Label>
                                    <Textarea
                                        placeholder="Detalles adicionales..."
                                        className="min-h-[56px] text-sm resize-none bg-slate-50/50 focus:bg-white transition-all"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        disabled={selectedEvent?.isGoogleEvent}
                                    />
                                </div>
                            </div>

                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (selectedEvent && isEditing) setIsEditing(false)
                                        else setIsModalOpen(false)
                                    }}
                                    className="h-8 px-5 text-sm font-semibold"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="h-8 px-6 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                                >
                                    {isSaving ? (
                                        <span className="flex items-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Guardando...
                                        </span>
                                    ) : 'Guardar'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la tarea <strong>{selectedEvent?.title}</strong>. No se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
