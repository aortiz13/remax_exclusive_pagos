import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import moment from 'moment'
import 'moment/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { Card, CardContent, Button, Checkbox, Label } from '@/components/ui'
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Filter, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Setup the localizer for moment
moment.locale('es')
const localizer = momentLocalizer(moment)
const DnDCalendar = withDragAndDrop(Calendar)

export default function CalendarPage() {
    const { user } = useAuth()
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState(Views.WEEK)
    const [date, setDate] = useState(new Date())

    // Filters
    const [filters, setFilters] = useState({
        calls: true,
        emails: true,
        meetings: true,
        others: true
    })

    useEffect(() => {
        if (user) fetchEvents()
    }, [user])

    const fetchEvents = async () => {
        try {
            const { data, error } = await supabase
                .from('crm_tasks')
                .select(`
                    id,
                    execution_date,
                    action,
                    completed,
                    description,
                    contact:contacts(first_name, last_name)
                `)
                .eq('agent_id', user.id)

            if (error) throw error

            const formattedEvents = data.map(task => {
                const startDate = new Date(task.execution_date)
                // Default duration 30 mins if not specified
                const endDate = new Date(startDate.getTime() + 30 * 60000)

                return {
                    id: task.id,
                    title: `${task.action} - ${task.contact ? `${task.contact.first_name} ${task.contact.last_name}` : 'Sin contacto'}`,
                    start: startDate,
                    end: endDate,
                    allDay: false,
                    resource: task,
                    completed: task.completed,
                    type: getEventType(task.action)
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

    const onEventDrop = async ({ event, start, end }) => {
        try {
            // Optimistic update
            const nextEvents = events.map(existingEvent => {
                return existingEvent.id === event.id
                    ? { ...existingEvent, start, end }
                    : existingEvent
            })
            setEvents(nextEvents)

            const { error } = await supabase
                .from('crm_tasks')
                .update({
                    execution_date: start.toISOString()
                    // Note: crm_tasks might not have an end date column, so we just update the start
                })
                .eq('id', event.id)

            if (error) throw error
            toast.success('Evento reprogramado')
        } catch (error) {
            console.error('Error updating event:', error)
            toast.error('Error al actualizar fecha')
            fetchEvents() // Revert on fail
        }
    }

    const onEventResize = async ({ event, start, end }) => {
        // Since we might not store duration/end_date in crm_tasks yet, 
        // we'll just update the optimistic UI state for now or handle it if we add that column.
        // For now, let's just update the start time if it changed, 
        // or effectively do nothing on backend if only duration changed but we don't store it.
        // Assuming we only care about start time persistence for now based on schema.

        const nextEvents = events.map(existingEvent => {
            return existingEvent.id === event.id
                ? { ...existingEvent, start, end }
                : existingEvent
        })
        setEvents(nextEvents)

        toast.info('Duración actualizada (visual)')
    }

    const handleSelectSlot = ({ start, end }) => {
        // Implementation for creating new task would go here
        // For now, open a modal or navigate to task creation
        const title = window.prompt('Nueva Tarea:')
        if (title) {
            // Create dummy event for now, ideally call API
            const newEvent = {
                start,
                end,
                title,
                type: 'other'
            }
            setEvents([...events, newEvent])
            // TODO: Persist to DB
        }
    }

    const eventStyleGetter = (event, start, end, isSelected) => {
        let backgroundColor = '#6366f1' // Indigo
        let borderColor = '#4f46e5'

        if (event.completed) {
            backgroundColor = '#e2e8f0' // Slate 200
            borderColor = '#cbd5e1'
            return {
                style: {
                    backgroundColor,
                    borderColor,
                    color: '#94a3b8',
                    textDecoration: 'line-through',
                    borderRadius: '6px',
                    border: 'none',
                    borderLeft: `4px solid ${borderColor}`,
                    opacity: 0.8
                }
            }
        }

        switch (event.type) {
            case 'call':
                backgroundColor = '#3b82f6'; // Blue
                borderColor = '#2563eb';
                break;
            case 'email':
                backgroundColor = '#f59e0b'; // Amber
                borderColor = '#d97706';
                break;
            case 'meeting':
                backgroundColor = '#10b981'; // Emerald
                borderColor = '#059669';
                break;
        }

        return {
            style: {
                backgroundColor: `${backgroundColor}1A`, // 10% opacity
                color: borderColor,
                border: `1px solid ${backgroundColor}40`,
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: '6px',
                fontWeight: '500',
                fontSize: '0.85rem'
            }
        }
    }

    const filteredEvents = events.filter(event => {
        if (!filters.calls && event.type === 'call') return false
        if (!filters.emails && event.type === 'email') return false
        if (!filters.meetings && event.type === 'meeting') return false
        if (!filters.others && event.type === 'other') return false
        return true
    })

    // Custom Toolbar Component
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

        const label = () => {
            const date = moment(toolbar.date)
            return <span className="capitalize">{date.format('MMMM YYYY')}</span>
        }

        return (
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToBack}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-3 font-medium text-slate-700 dark:text-slate-300" onClick={goToCurrent}>
                            Hoy
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white ml-2 flex items-center gap-2">
                        {label()}
                    </h2>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                    <Button
                        variant={toolbar.view === 'month' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => toolbar.onView('month')}
                        className="text-xs h-8"
                    >
                        Mes
                    </Button>
                    <Button
                        variant={toolbar.view === 'week' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => toolbar.onView('week')}
                        className="text-xs h-8"
                    >
                        Semana
                    </Button>
                    <Button
                        variant={toolbar.view === 'day' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => toolbar.onView('day')}
                        className="text-xs h-8"
                    >
                        Día
                    </Button>
                    <Button
                        variant={toolbar.view === 'agenda' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => toolbar.onView('agenda')}
                        className="text-xs h-8"
                    >
                        Agenda
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="container max-w-7xl mx-auto pb-12 h-[calc(100vh-100px)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

                {/* Sidebar Controls */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                            Calendario
                        </h1>
                        <p className="text-slate-500 text-sm">Gestiona tu agenda.</p>
                    </div>

                    <Button className="w-full justify-start gap-2" size="lg">
                        <Plus className="w-5 h-5" />
                        Nueva Tarea
                    </Button>

                    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Filter className="w-3 h-3" /> Filtros
                                </Label>
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="calls"
                                            checked={filters.calls}
                                            onCheckedChange={(checked) => setFilters(prev => ({ ...prev, calls: checked }))}
                                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        />
                                        <Label htmlFor="calls" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Llamadas
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="emails"
                                            checked={filters.emails}
                                            onCheckedChange={(checked) => setFilters(prev => ({ ...prev, emails: checked }))}
                                            className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                        />
                                        <Label htmlFor="emails" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Correos
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="meetings"
                                            checked={filters.meetings}
                                            onCheckedChange={(checked) => setFilters(prev => ({ ...prev, meetings: checked }))}
                                            className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                        />
                                        <Label htmlFor="meetings" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Reuniones
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="others"
                                            checked={filters.others}
                                            onCheckedChange={(checked) => setFilters(prev => ({ ...prev, others: checked }))}
                                            className="data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                                        />
                                        <Label htmlFor="others" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Otros
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Mini Month View Placeholder - React Big Calendar doesn't strictly have a mini-cal component, usually we use a datepicker here */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                        <div className="text-center text-xs text-slate-500 mb-2">
                            Vista Rápida
                        </div>
                        <Calendar
                            localizer={localizer}
                            events={[]}
                            view="month"
                            date={date}
                            onNavigate={date => setDate(date)}
                            toolbar={false}
                            className="h-[250px] text-xs pointer-events-none opacity-50"
                        />
                    </div>
                </div>

                {/* Main Calendar Area */}
                <div className="lg:col-span-9 h-full flex flex-col">
                    <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                        <CardContent className="p-0 flex-1 flex flex-col">
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
                                </div>
                            ) : (
                                <div className="flex-1 p-6 bg-white dark:bg-slate-950">
                                    <style>{`
                                        .rbc-calendar { font-family: inherit; }
                                        .rbc-header { padding: 12px 4px; font-weight: 600; color: #64748b; font-size: 0.875rem; border-bottom: 1px solid #e2e8f0; }
                                        .rbc-today { background-color: #f8fafc; }
                                        .rbc-event { border-radius: 6px; }
                                        .rbc-time-view { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
                                        .rbc-timeslot-group { border-bottom: 1px solid #f1f5f9; }
                                        .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #f1f5f9; }
                                        .rbc-time-content { border-top: 1px solid #e2e8f0; }
                                        .rbc-time-header-content { border-left: 1px solid #e2e8f0; }
                                        .rbc-off-range-bg { background-color: #f8fafc; }
                                        .dark .rbc-header { color: #94a3b8; border-bottom-color: #1e293b; }
                                        .dark .rbc-today { background-color: #0f172a; }
                                        .dark .rbc-time-view { border-color: #1e293b; }
                                        .dark .rbc-timeslot-group { border-bottom-color: #1e293b; }
                                        .dark .rbc-day-bg + .rbc-day-bg { border-left-color: #1e293b; }
                                        .dark .rbc-time-content { border-top-color: #1e293b; }
                                        .dark .rbc-time-header-content { border-left-color: #1e293b; }
                                        .dark .rbc-off-range-bg { background-color: #0f172a; }
                                    `}</style>
                                    <DnDCalendar
                                        localizer={localizer}
                                        events={filteredEvents}
                                        startAccessor="start"
                                        endAccessor="end"
                                        style={{ height: '100%' }}
                                        view={view}
                                        onView={setView}
                                        date={date}
                                        onNavigate={setDate}
                                        components={{
                                            toolbar: CustomToolbar
                                        }}
                                        eventPropGetter={eventStyleGetter}
                                        onEventDrop={onEventDrop}
                                        onEventResize={onEventResize}
                                        resizable
                                        selectable
                                        onSelectSlot={handleSelectSlot}
                                        popup
                                        culture='es'
                                        messages={{
                                            next: "Siguiente",
                                            previous: "Anterior",
                                            today: "Hoy",
                                            month: "Mes",
                                            week: "Semana",
                                            day: "Día",
                                            agenda: "Agenda",
                                            date: "Fecha",
                                            time: "Hora",
                                            event: "Evento",
                                            noEventsInRange: "No hay eventos en este rango",
                                            showMore: total => `+ Ver más (${total})`
                                        }}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
