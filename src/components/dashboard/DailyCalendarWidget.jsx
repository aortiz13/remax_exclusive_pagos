import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { Calendar as CalendarIcon, Clock, CheckCircle2, Circle } from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

export default function DailyCalendarWidget() {
    const { user } = useAuth()
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        if (user) fetchTodayTasks()
    }, [user])

    const fetchTodayTasks = async () => {
        try {
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)
            const todayEnd = new Date()
            todayEnd.setHours(23, 59, 59, 999)

            const { data, error } = await supabase
                .from('crm_tasks')
                .select(`
                    *,
                    contact:contacts(first_name, last_name)
                `)
                .eq('agent_id', user.id)
                .gte('execution_date', todayStart.toISOString())
                .lte('execution_date', todayEnd.toISOString())
                .order('execution_date', { ascending: true })

            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Error fetching daily tasks:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleTask = async (id, currentStatus) => {
        try {
            const { error } = await supabase
                .from('crm_tasks')
                .update({ completed: !currentStatus })
                .eq('id', id)

            if (error) throw error
            setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t))
        } catch (error) {
            console.error('Error toggling task:', error)
        }
    }

    return (
        <Card className="h-full border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-indigo-500" />
                    Agenda de Hoy
                </CardTitle>
                <div className="text-sm text-slate-500 capitalize">
                    {format(new Date(), 'EEEE d', { locale: es })}
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-8">
                        <Clock className="w-8 h-8 mb-2 opacity-50" />
                        <p>No hay tareas para hoy.</p>
                        <Button variant="link" size="sm" onClick={() => navigate('/calendar')} className="mt-2 text-indigo-500">
                            Ver Calendario Completo
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tasks.map(task => (
                            <div
                                key={task.id}
                                className={`
                                    flex items-start gap-3 p-3 rounded-xl border transition-all
                                    ${task.completed
                                        ? 'bg-slate-50 border-slate-100 dark:bg-slate-900/50 dark:border-slate-800 opacity-60'
                                        : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-sm'
                                    }
                                `}
                            >
                                <button
                                    onClick={() => toggleTask(task.id, task.completed)}
                                    className={`mt-0.5 shrink-0 transition-colors ${task.completed ? 'text-green-500' : 'text-slate-300 hover:text-indigo-500'}`}
                                >
                                    {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${task.completed ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                                        {task.action}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {task.is_all_day ? (
                                                <span className="font-bold uppercase tracking-tighter text-[9px] bg-blue-100 text-blue-700 px-1 rounded">Todo el día</span>
                                            ) : (
                                                format(parseISO(task.execution_date), 'HH:mm')
                                            )}
                                        </span>
                                        {task.contact && (
                                            <span className="text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded flex items-center gap-1 truncate max-w-[120px]">
                                                {task.contact.first_name} {task.contact.last_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
            {tasks.length > 0 && (
                <div className="pt-3 mt-auto border-t border-slate-100 dark:border-slate-800">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-slate-500" onClick={() => navigate('/calendar')}>
                        Ver todo el calendario
                    </Button>
                </div>
            )}
        </Card>
    )
}
