import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { Card, CardContent } from '@/components/ui'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import esLocale from '@fullcalendar/core/locales/es'

export default function CalendarPage() {
    const { user } = useAuth()
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)

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
                    contact:contacts(first_name, last_name)
                `)
                .eq('agent_id', user.id)

            if (error) throw error

            const formattedEvents = data.map(task => ({
                id: task.id,
                title: `${task.action} - ${task.contact ? `${task.contact.first_name} ${task.contact.last_name}` : 'Sin contacto'}`,
                start: task.execution_date,
                backgroundColor: task.completed ? '#e2e8f0' : getEventColor(task.action),
                borderColor: task.completed ? '#cbd5e1' : getEventColor(task.action),
                textColor: task.completed ? '#94a3b8' : '#ffffff',
                extendedProps: {
                    completed: task.completed,
                    contact: task.contact
                }
            }))

            setEvents(formattedEvents)
        } catch (error) {
            console.error('Error fetching events:', error)
            toast.error('Error al cargar eventos')
        } finally {
            setLoading(false)
        }
    }

    const getEventColor = (action) => {
        const lowerAction = (action || '').toLowerCase()
        if (lowerAction.includes('llamar') || lowerAction.includes('llamada')) return '#3b82f6' // Blue
        if (lowerAction.includes('email') || lowerAction.includes('correo')) return '#f59e0b' // Amber
        if (lowerAction.includes('reunión') || lowerAction.includes('visita')) return '#10b981' // Emerald
        return '#6366f1' // Indigo default
    }

    const handleEventDrop = async (info) => {
        try {
            const { error } = await supabase
                .from('crm_tasks')
                .update({ execution_date: info.event.start.toISOString() })
                .eq('id', info.event.id)

            if (error) throw error
            toast.success('Evento reprogramado')
        } catch (error) {
            console.error('Error updating event:', error)
            toast.error('Error al actualizar fecha')
            info.revert()
        }
    }

    return (
        <div className="container max-w-7xl mx-auto space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                        Calendario
                    </h1>
                    <p className="text-slate-500 mt-1">Gestiona tu agenda y tareas.</p>
                </div>
            </div>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="h-[600px] flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="p-4 bg-white dark:bg-slate-900">
                            <style>{`
                                .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 600; }
                                .fc-button-primary { background-color: #0f172a !important; border-color: #0f172a !important; }
                                .fc-button-primary:hover { background-color: #1e293b !important; border-color: #1e293b !important; }
                                .fc-button-active { background-color: #334155 !important; border-color: #334155 !important; }
                                .fc-day-today { background-color: #f1f5f9 !important; }
                                .dark .fc-day-today { background-color: #1e293b !important; }
                                .fc-event { cursor: pointer; border-radius: 4px; border: none; padding: 2px 4px; font-size: 0.85rem; }
                            `}</style>
                            <FullCalendar
                                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                                initialView="timeGridWeek"
                                headerToolbar={{
                                    left: 'prev,next today',
                                    center: 'title',
                                    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
                                }}
                                locale={esLocale}
                                events={events}
                                editable={true}
                                selectable={true}
                                selectMirror={true}
                                dayMaxEvents={true}
                                height="auto"
                                minHeight="700px"
                                slotMinTime="07:00:00"
                                slotMaxTime="22:00:00"
                                expandRows={true}
                                stickyHeaderDates={true}
                                nowIndicator={true} // Red line for current time
                                eventDrop={handleEventDrop}
                                // eventClick={handleEventClick} // To be implemented
                                // dateClick={handleDateClick} // To be implemented
                                allDaySlot={true}
                                slotEventOverlap={false} // Prevent overlap visually
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
