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
import { Card, CardContent, Button, Checkbox, Label, Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui'
import { ChevronLeft, ChevronRight, Filter, Plus, Clock, Calendar as CalendarIcon, MapPin, User, Bell, Trash2 } from 'lucide-react'
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
    const { user } = useAuth()
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState(Views.WEEK)
    const [date, setDate] = useState(new Date())
    const [contacts, setContacts] = useState([])

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start: '',
        end: '',
        contactId: 'none',
        reminder: 'none'
    })
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (user) {
            fetchEvents()
            fetchContacts()
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

    const fetchEvents = async () => {
        try {
            const { data, error } = await supabase
                .from('crm_tasks')
                .select(`
                    id,
                    execution_date,
                    action,
                    description,
                    completed,
                    reminder_minutes,
                    contact:contacts(id, first_name, last_name)
                `)
                .eq('agent_id', user.id)

            if (error) throw error

            const formattedEvents = data.map(task => {
                const startDate = new Date(task.execution_date)
                const endDate = new Date(startDate.getTime() + 60 * 60000) // Default 1 hour

                return {
                    id: task.id,
                    title: task.action,
                    description: task.description,
                    start: startDate,
                    end: endDate,
                    resource: task,
                    completed: task.completed,
                    type: getEventType(task.action),
                    contactId: task.contact?.id,
                    contactName: task.contact ? `${task.contact.first_name} ${task.contact.last_name}` : null,
                    reminder: task.reminder_minutes
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
    const handleSelectSlot = ({ start, end }) => {
        setSelectedEvent(null)
        setFormData({
            title: '',
            description: '',
            start: format(start, "yyyy-MM-dd'T'HH:mm"),
            end: format(end, "yyyy-MM-dd'T'HH:mm"),
            contactId: 'none',
            reminder: 'none'
        })
        setIsModalOpen(true)
    }

    const handleSelectEvent = (event) => {
        setSelectedEvent(event)
        setFormData({
            title: event.title || '',
            description: event.description || '',
            start: format(event.start, "yyyy-MM-dd'T'HH:mm"),
            end: format(event.end, "yyyy-MM-dd'T'HH:mm"),
            contactId: event.contactId || 'none',
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
                contact_id: formData.contactId === 'none' ? null : formData.contactId,
                reminder_minutes: formData.reminder === 'none' ? null : parseInt(formData.reminder)
            }

            if (selectedEvent) {
                const { error } = await supabase
                    .from('crm_tasks')
                    .update(payload)
                    .eq('id', selectedEvent.id)
                if (error) throw error
                toast.success('Tarea actualizada')
            } else {
                const { error } = await supabase
                    .from('crm_tasks')
                    .insert([payload])
                if (error) throw error
                toast.success('Tarea creada')
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
        if (!window.confirm('¿Estás seguro de eliminar esta tarea?')) return

        try {
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
        }
    }

    const onEventDrop = async ({ event, start, end }) => {
        try {
            const { error } = await supabase
                .from('crm_tasks')
                .update({
                    execution_date: start.toISOString()
                })
                .eq('id', event.id)

            if (error) throw error
            toast.success('Evento reprogramado')

            // Optimistic update
            setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e))
        } catch (error) {
            console.error('Error updating event:', error)
            toast.error('Error al actualizar fecha')
            fetchEvents() // Revert
        }
    }

    // Styles
    const eventStyleGetter = (event) => {
        let backgroundColor = '#6366f1'
        let borderColor = '#4f46e5'

        if (event.completed) {
            backgroundColor = '#e2e8f0'
            borderColor = '#cbd5e1'
            return {
                style: {
                    backgroundColor, borderColor, color: '#94a3b8',
                    textDecoration: 'line-through', borderRadius: '6px',
                    borderLeft: `4px solid ${borderColor}`, opacity: 0.8
                }
            }
        }

        switch (event.type) {
            case 'call': backgroundColor = '#3b82f6'; borderColor = '#2563eb'; break;
            case 'email': backgroundColor = '#f59e0b'; borderColor = '#d97706'; break;
            case 'meeting': backgroundColor = '#10b981'; borderColor = '#059669'; break;
        }

        return {
            style: {
                backgroundColor: `${backgroundColor}1A`,
                color: borderColor,
                border: `1px solid ${backgroundColor}40`,
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: '6px',
                fontWeight: '500',
                fontSize: '0.85rem'
            }
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
                            components={{ toolbar: CustomToolbar }}
                            eventPropGetter={eventStyleGetter}
                            onEventDrop={onEventDrop}
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
                        <DialogTitle>{selectedEvent ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
                        <DialogDescription>Completa los detalles de tu evento o tarea.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
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
                                <Label>Fecha/Hora Inicio *</Label>
                                <div className="relative">
                                    <Input
                                        type="datetime-local"
                                        value={formData.start}
                                        onChange={e => setFormData({ ...formData, start: e.target.value })}
                                        className="pr-8 block w-full"
                                    />
                                    {/* Fix for calendar icon overlap if native icon is hidden or misaligned */}
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
                        </div>

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
                            <Label>Descripción</Label>
                            <Textarea
                                placeholder="Detalles adicionales..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                        {selectedEvent && (
                            <Button variant="destructive" type="button" onClick={handleDelete} className="sm:mr-auto">
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
        </div>
    )
}
