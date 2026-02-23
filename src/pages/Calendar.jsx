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
import { ChevronLeft, ChevronRight, Filter, Plus, Clock, Calendar as CalendarIcon, MapPin, User, Bell, Trash2, RefreshCw, Phone, Mail, Users, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

// Setup date-fns localizer
const locales = {
    'es': es,
}

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
})
const DnDCalendar = withDragAndDrop(Calendar)

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
        reminder: 'none'
    })
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

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
                const endDate = task.end_date ? new Date(task.end_date) : new Date(startDate.getTime() + 60 * 60000)

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
                    isGoogleEvent: !!task.google_event_id
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

    const getEventType = (action) => {
        const lower = (action || '').toLowerCase()
        if (lower.includes('llamar') || lower.includes('llamada')) return 'call'
        if (lower.includes('email') || lower.includes('correo')) return 'email'
        if (lower.includes('reunión') || lower.includes('visita')) return 'meeting'
        return 'other'
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
                // Handle token expiration/refresh if function returns retry
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
        setFormData({
            title: '',
            description: '',
            descriptionHtml: '',
            start: format(start, "yyyy-MM-dd'T'HH:mm"),
            end: format(end, "yyyy-MM-dd'T'HH:mm"),
            type: 'task',
            contactId: 'none',
            propertyId: 'none',
            reminder: 'none'
        })
        setIsModalOpen(true)
    }

    const handleSelectEvent = (event) => {
        setSelectedEvent(event)
        setFormData({
            title: event.title || '',
            description: event.description || '',
            descriptionHtml: event.descriptionHtml || '',
            start: format(event.start, "yyyy-MM-dd'T'HH:mm"),
            end: format(event.end, "yyyy-MM-dd'T'HH:mm"),
            type: event.type || 'task',
            contactId: event.contactId || 'none',
            propertyId: event.propertyId || 'none',
            reminder: event.reminder ? event.reminder.toString() : 'none'
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
            const payload = {
                agent_id: user.id,
                action: formData.title,
                description: formData.description,
                execution_date: new Date(formData.start).toISOString(),
                end_date: new Date(formData.end).toISOString(),
                task_type: formData.type,
                contact_id: formData.contactId === 'none' ? null : formData.contactId,
                property_id: formData.propertyId === 'none' ? null : formData.propertyId,
                reminder_minutes: formData.reminder === 'none' ? null : parseInt(formData.reminder)
            }

            if (selectedEvent) {
                const { error } = await supabase
                    .from('crm_tasks')
                    .update(payload)
                    .eq('id', selectedEvent.id)
                if (error) throw error
                toast.success('Tarea actualizada')

                // Trigger Google Sync
                if (profile?.google_refresh_token) {
                    supabase.functions.invoke('google-calendar-sync', {
                        body: { agentId: user.id, action: 'push_to_google', taskId: selectedEvent.id }
                    })
                }
            } else {
                const { data: newTask, error } = await supabase
                    .from('crm_tasks')
                    .insert([payload])
                    .select()
                    .single()
                if (error) throw error
                toast.success('Tarea creada')

                // Trigger Google Sync
                if (profile?.google_refresh_token && newTask) {
                    supabase.functions.invoke('google-calendar-sync', {
                        body: { agentId: user.id, action: 'push_to_google', taskId: newTask.id }
                    })
                }
            }

            setIsModalOpen(false)
            fetchEvents()
        } catch (error) {
            console.error('Error saving task:', error)
            toast.error('Error al guardar tarea')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!selectedEvent) return

        try {
            setIsDeleting(true)

            // Sync delete to Google first if it exists
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

            // Trigger Google Sync
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

            // Trigger Google Sync
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

    // Styles
    const eventStyleGetter = (event) => {
        let backgroundColor = '#6366f1'
        let borderColor = '#4f46e5'
        let icon = null

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
            case 'meeting': backgroundColor = '#10b981'; borderColor = '#059669'; break;
        }

        const isGoogle = event.isGoogleEvent;

        return {
            style: {
                backgroundColor: isGoogle ? `${backgroundColor}CC` : `${backgroundColor}1A`,
                color: isGoogle ? 'white' : borderColor,
                border: isGoogle ? 'none' : `1px solid ${backgroundColor}40`,
                borderLeft: isGoogle ? 'none' : `4px solid ${borderColor}`,
                borderRadius: '4px',
                fontWeight: '500',
                fontSize: '0.8rem',
                padding: '2px 5px',
                boxShadow: isGoogle ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            }
        }
    }

    const getModalConfig = () => {
        const type = formData.type
        const isGoogle = selectedEvent?.isGoogleEvent

        const configs = {
            call: { title: 'Llamada', icon: <Phone className="w-5 h-5 text-blue-500" /> },
            email: { title: 'Correo', icon: <Mail className="w-5 h-5 text-orange-500" /> },
            meeting: { title: 'Reunión', icon: <Users className="w-5 h-5 text-emerald-500" /> },
            task: { title: 'Tarea', icon: <CheckCircle className="w-5 h-5 text-indigo-500" /> }
        }

        const config = configs[type] || configs.task
        const prefix = selectedEvent ? 'Editar' : 'Nueva'

        return {
            title: isGoogle ? 'Evento de Google Calendar' : `${prefix} ${config.title}`,
            icon: isGoogle ? <RefreshCw className="w-5 h-5 text-slate-400" /> : config.icon
        }
    }

    // Custom Components
    const CustomToolbar = (toolbar) => {
        const goToBack = () => {
            toolbar.date.setDate(toolbar.date.getDate() - 7)
            toolbar.onNavigate('PREV')
        }
        const goToNext = () => {
            toolbar.date.setDate(toolbar.date.getDate() + 7)
            toolbar.onNavigate('NEXT')
        }
        const goToCurrent = () => {
            const now = new Date()
            toolbar.date.setMonth(now.getMonth())
            toolbar.date.setYear(now.getFullYear())
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
            --rdp-accent-color: #0f172a;
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

    return (
        <div className="w-full h-[calc(100vh-80px)] px-6 pb-6 flex gap-6 overflow-hidden">
            {/* Sidebar - Fixed Width & Left Aligned */}
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

            {/* Main Calendar - Flex Grow */}
            <div className="flex-1 h-full min-w-0">
                <Card className="h-full border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    <CardContent className="p-0 flex-1 bg-white dark:bg-slate-950 p-6 flex flex-col h-full overflow-hidden">
                        <style>{bigCalendarStyles}</style>
                        <DnDCalendar
                            localizer={localizer}
                            events={events.filter(event => {
                                // Keep existing filters logic just in case user wants it back later
                                return true
                            })}
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
                                        <div className="flex items-center gap-1 overflow-hidden">
                                            <Icon className="w-3 h-3 flex-none" />
                                            <span className="truncate">{event.title}</span>
                                        </div>
                                    )
                                }
                            }}
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

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {getModalConfig().icon}
                            {getModalConfig().title}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedEvent?.isGoogleEvent
                                ? 'Este evento se sincroniza con tu Google Calendar.'
                                : 'Completa los detalles de tu actividad.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo de Actividad</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={v => setFormData({ ...formData, type: v })}
                                    disabled={selectedEvent?.isGoogleEvent}
                                >
                                    <SelectTrigger>
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
                            <div className="space-y-2">
                                <Label>Estado</Label>
                                <Button
                                    variant="outline"
                                    className={`w-full justify-start gap-2 ${selectedEvent?.completed ? 'text-emerald-500 border-emerald-200 bg-emerald-50' : ''}`}
                                    onClick={() => setSelectedEvent(prev => ({ ...prev, completed: !prev.completed }))}
                                >
                                    {selectedEvent?.completed ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                    {selectedEvent?.completed ? 'Completado' : 'Pendiente'}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Título *</Label>
                            <Input
                                placeholder="Ej: Llamar a cliente..."
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Inicio *</Label>
                                <Input
                                    type="datetime-local"
                                    value={formData.start}
                                    onChange={e => setFormData({ ...formData, start: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Fin *</Label>
                                <Input
                                    type="datetime-local"
                                    value={formData.end}
                                    onChange={e => setFormData({ ...formData, end: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Recordatorio</Label>
                            <Select
                                value={formData.reminder}
                                onValueChange={v => setFormData({ ...formData, reminder: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Sin recordatorio" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin recordatorio</SelectItem>
                                    <SelectItem value="10">10 min antes</SelectItem>
                                    <SelectItem value="20">20 min antes</SelectItem>
                                    <SelectItem value="30">30 min antes</SelectItem>
                                    <SelectItem value="40">40 min antes</SelectItem>
                                    <SelectItem value="50">50 min antes</SelectItem>
                                    <SelectItem value="60">1 hora antes</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Contacto (Opcional)</Label>
                                <Select
                                    value={formData.contactId}
                                    onValueChange={v => setFormData({ ...formData, contactId: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar contacto..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Ninguno</SelectItem>
                                        {contacts.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Propiedad (Opcional)</Label>
                                <Select
                                    value={formData.propertyId}
                                    onValueChange={v => setFormData({ ...formData, propertyId: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar propiedad..." />
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
                            <Label>Descripción</Label>
                            {selectedEvent?.isGoogleEvent && formData.descriptionHtml ? (
                                <div
                                    className="p-3 rounded-md bg-slate-50 border border-slate-200 text-sm overflow-auto max-h-[150px] leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: formData.descriptionHtml }}
                                />
                            ) : (
                                <Textarea
                                    placeholder="Detalles adicionales..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                        {selectedEvent && (
                            <Button variant="destructive" type="button" onClick={() => setIsDeleteConfirmOpen(true)} className="sm:mr-auto">
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Guardando...' : selectedEvent ? 'Actualizar' : 'Crear Tarea'}
                        </Button>
                    </DialogFooter>
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
        </div >
    )
}
