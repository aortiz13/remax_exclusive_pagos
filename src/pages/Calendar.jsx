import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { Card, CardContent, Button, Checkbox, Label, Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui'
import { ChevronLeft, ChevronRight, Filter, Plus, Clock, Calendar as CalendarIcon, MapPin, User, Bell, Trash2, RefreshCw, Phone, Mail, Users, CheckCircle, Pencil, Video, Check, X, HelpCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

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

    return (
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-2">
                <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToBack}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 px-3" onClick={goToCurrent}>Hoy</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}><ChevronRight className="w-4 h-4" /></Button>
                </div>
                <h2 className="text-xl font-bold ml-2 capitalize">
                    {format(toolbar.date, 'MMMM yyyy', { locale: es })}
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
        reminder: 'none',
        location: '',
        hangoutLink: '',
        attendees: [],
        create_meet: false
    })
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [guestInput, setGuestInput] = useState('')

    useEffect(() => {
        if (user) {
            fetchEvents()
            fetchContacts()
            fetchProperties()
        }
    }, [user])

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

    const fetchEvents = async () => {
        try {
            const { data, error } = await supabase
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
                    contact:contacts(id, first_name, last_name),
                    property:properties(id, address)
                `)
                .eq('agent_id', user.id)

            if (error) throw error

            const formattedEvents = data.map(task => {
                const startDate = new Date(task.execution_date)
                let endDate = task.end_date ? new Date(task.end_date) : new Date(startDate.getTime() + 60 * 60000)

                // Fix: Ensure at least 30 min duration for visibility if start == end
                if (endDate.getTime() <= startDate.getTime()) {
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
                    isSyncing: task.google_event_id && !task.last_synced_at
                }
            })

            setEvents(formattedEvents)
        } catch (error) {
            console.error('Error fetching events:', error)
            toast.error('Error al cargar eventos')
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
                toast.success(`Sincronizados ${retryResponse.data?.count || 0} eventos`, { id: toastId })
            } else {
                toast.success(`Sincronizados ${data?.count || 0} eventos`, { id: toastId })
            }

            fetchEvents()
        } catch (error) {
            console.error('Sync error:', error)
            toast.error('Error al sincronizar con Google', { id: toastId })
        } finally {
            setIsSyncing(false)
        }
    }

    const handleSelectSlot = ({ start, end }) => {
        setSelectedEvent(null)
        const endWithDuration = start.getTime() === end.getTime()
            ? new Date(start.getTime() + 30 * 60000)
            : end

        setFormData({
            title: '',
            description: '',
            descriptionHtml: '',
            start: format(start, "yyyy-MM-dd'T'HH:mm"),
            end: format(endWithDuration, "yyyy-MM-dd'T'HH:mm"),
            type: 'task',
            contactId: 'none',
            propertyId: 'none',
            reminder: 'none',
            location: '',
            hangoutLink: '',
            attendees: [],
            create_meet: false
        })
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
            start: format(event.start, "yyyy-MM-dd'T'HH:mm"),
            end: format(event.end, "yyyy-MM-dd'T'HH:mm"),
            type: event.type || 'task',
            contactId: event.contactId || 'none',
            propertyId: event.propertyId || 'none',
            reminder: event.reminder ? event.reminder.toString() : 'none',
            location: event.location || '',
            hangoutLink: event.hangoutLink || '',
            attendees: event.attendees || [],
            create_meet: !!event.hangoutLink
        })
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!formData.title || !formData.start) {
            toast.error('Título y fecha son obligatorios')
            return
        }

        setIsSaving(true)
        try {
            // Validate dates
            const startD = new Date(formData.start)
            let endD = new Date(formData.end)

            if (endD <= startD) {
                endD = new Date(startD.getTime() + 30 * 60000)
            }

            const payload = {
                agent_id: user.id,
                action: formData.title,
                description: formData.description,
                execution_date: startD.toISOString(),
                end_date: endD.toISOString(),
                task_type: formData.type,
                contact_id: formData.contactId === 'none' ? null : formData.contactId,
                property_id: formData.propertyId === 'none' ? null : formData.propertyId,
                reminder_minutes: formData.reminder === 'none' ? null : parseInt(formData.reminder),
                location: formData.location,
                attendees: formData.attendees
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
            if (profile?.google_refresh_token && selectedEvent.resource?.google_event_id) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: {
                        agentId: user.id,
                        action: 'delete_from_google',
                        googleEventId: selectedEvent.resource.google_event_id
                    }
                })
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
        const newStatus = !selectedEvent.completed
        const { error } = await supabase
            .from('crm_tasks')
            .update({ completed: newStatus })
            .eq('id', selectedEvent.id)

        if (error) {
            toast.error('Error al actualizar estado')
            return
        }

        setSelectedEvent(prev => prev ? { ...prev, completed: newStatus } : null)
        setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, completed: newStatus } : e))
        toast.success(newStatus ? 'Tarea completada' : 'Tarea pendiente')
    }

    const onEventDrop = async ({ event, start, end }) => {
        try {
            const { error } = await supabase
                .from('crm_tasks')
                .update({
                    execution_date: start.toISOString(),
                    end_date: end.toISOString()
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
            const { error } = await supabase
                .from('crm_tasks')
                .update({
                    execution_date: start.toISOString(),
                    end_date: end.toISOString()
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
            case 'email': backgroundColor = '#f59e0b'; borderColor = '#d97706'; break;
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
                            min={new Date(0, 0, 0, 8, 0, 0)} // 8:00 AM
                            max={new Date(0, 0, 0, 23, 0, 0)} // 11:00 PM
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
                <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[92vh]">
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
                                                    <br />
                                                    {format(selectedEvent.start, "p")} - {format(selectedEvent.end, "p")}
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

                                        {formData.location && (
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
                                                        <span className="font-medium text-blue-600">{selectedEvent.contactName}</span>
                                                    </div>
                                                )}
                                                {selectedEvent.propertyName && (
                                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                                        <div className="w-5 h-5 flex items-center justify-center flex-none">
                                                            <MapPin className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                        <span className="truncate italic text-slate-500">{selectedEvent.propertyName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}

                                        {formData.attendees && formData.attendees.length > 0 && (
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
                            <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                                        {getModalConfig().icon}
                                        {getModalConfig().title}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500">
                                        {selectedEvent?.isGoogleEvent
                                            ? 'Este evento se sincroniza con Google Calendar.'
                                            : 'Completa los detalles de tu actividad.'}
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tipo</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={v => setFormData({ ...formData, type: v })}
                                            disabled={selectedEvent?.isGoogleEvent}
                                        >
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="task">Tarea</SelectItem>
                                                <SelectItem value="call">Llamada</SelectItem>
                                                <SelectItem value="meeting">Reunión / Visita</SelectItem>
                                                <SelectItem value="email">Correo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estado</Label>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start gap-2 h-9 text-sm font-medium"
                                            onClick={toggleCompleted}
                                            type="button"
                                        >
                                            <div className={`w-2 h-2 rounded-full ${formData.completed ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'}`} />
                                            {formData.completed ? 'Completado' : 'Pendiente'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Título / Acción</Label>
                                    <Input
                                        placeholder="Ej: Llamar a cliente..."
                                        className="h-9 text-sm"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        disabled={selectedEvent?.isGoogleEvent}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Inicio</Label>
                                        <Input
                                            type="datetime-local"
                                            className="h-9 text-sm"
                                            value={formData.start}
                                            onChange={e => setFormData({ ...formData, start: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fin</Label>
                                        <Input
                                            type="datetime-local"
                                            className="h-9 text-sm"
                                            value={formData.end}
                                            onChange={e => setFormData({ ...formData, end: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {profile?.google_refresh_token && (
                                    <div className="flex items-center space-x-3 py-2.5 bg-blue-50/50 rounded-xl px-4 border border-blue-100 transition-all hover:bg-blue-50">
                                        <Checkbox
                                            id="create_meet"
                                            checked={formData.create_meet}
                                            onCheckedChange={checked => setFormData({ ...formData, create_meet: !!checked })}
                                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        />
                                        <div className="grid gap-1 leading-none">
                                            <label htmlFor="create_meet" className="text-sm font-bold text-blue-900 flex items-center gap-2 cursor-pointer">
                                                <Video className="w-4 h-4" />
                                                Generar enlace de Google Meet
                                            </label>
                                            <p className="text-[10px] text-blue-700/70">Sincroniza automáticamente una sala de video.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ubicación</Label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                        <Input
                                            className="pl-9 h-9 text-sm"
                                            placeholder="Añadir ubicación..."
                                            value={formData.location}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cliente</Label>
                                        <Select
                                            value={formData.contactId}
                                            onValueChange={v => setFormData({ ...formData, contactId: v })}
                                        >
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue placeholder="Seleccionar..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Ninguno</SelectItem>
                                                {contacts.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Propiedad</Label>
                                        <Select
                                            value={formData.propertyId}
                                            onValueChange={v => setFormData({ ...formData, propertyId: v })}
                                        >
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue placeholder="Seleccionar..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Ninguna</SelectItem>
                                                {properties.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Invitados</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            className="h-9 text-sm bg-slate-50/50"
                                            placeholder="ejemplo@correo.com"
                                            value={guestInput}
                                            onChange={e => setGuestInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                                        />
                                        <Button type="button" variant="outline" size="sm" onClick={addGuest} className="shrink-0 h-9 px-4 font-semibold hover:bg-slate-50">
                                            Añadir
                                        </Button>
                                    </div>
                                    {formData.attendees.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto p-2 bg-slate-50/50 rounded-lg border border-slate-100">
                                            {formData.attendees.map((attendee, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm text-[11px] text-slate-600">
                                                    <span className="truncate max-w-[140px] font-medium">{attendee.email}</span>
                                                    <button onClick={() => removeGuest(attendee.email)} className="text-slate-400 hover:text-red-500 transition-colors p-0.5">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Descripción</Label>
                                    <Textarea
                                        placeholder="Detalles adicionales..."
                                        className="min-h-[80px] text-sm resize-none bg-slate-50/50 focus:bg-white transition-all"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        disabled={selectedEvent?.isGoogleEvent}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (selectedEvent && isEditing) setIsEditing(false)
                                        else setIsModalOpen(false)
                                    }}
                                    className="h-10 px-6 font-semibold"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
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
