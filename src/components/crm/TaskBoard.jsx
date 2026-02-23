import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button } from "@/components/ui"
import { CheckCircle2, Circle, Calendar, Clock, User, Plus } from 'lucide-react'
import TaskModal from './TaskModal'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

const TaskBoard = () => {
    const { profile, user } = useAuth()
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        fetchTasks()
    }, [])

    const fetchTasks = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('crm_tasks')
                .select(`
                    *,
                    contacts (first_name, last_name)
                `)
                .order('execution_date', { ascending: true })

            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Error fetching tasks:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleComplete = async (taskId, currentStatus) => {
        try {
            const { error } = await supabase
                .from('crm_tasks')
                .update({ completed: !currentStatus })
                .eq('id', taskId)

            if (error) throw error

            // Optimistic update
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t))

            const task = tasks.find(t => t.id === taskId)
            if (profile?.google_refresh_token && task?.google_event_id) {
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'push_to_google', taskId: taskId }
                })
            }

            // Log completion
            if (!currentStatus) {
                // Fetch task to get details for log
                const task = tasks.find(t => t.id === taskId)
                if (task) {
                    await supabase.from('contact_activities').insert([{
                        contact_id: task.contact_id,
                        agent_id: task.agent_id,
                        type: 'task_completed',
                        description: `Tarea completada: ${task.action}`
                    }])
                }
            }

        } catch (error) {
            console.error('Error updating task:', error)
            toast.error('Error al actualizar tarea')
        }
    }

    const handleEdit = (task) => {
        setSelectedTask(task)
        setIsModalOpen(true)
    }

    const handleNew = () => {
        setSelectedTask(null)
        setIsModalOpen(true)
    }

    const handleModalClose = (shouldRefresh) => {
        setIsModalOpen(false)
        setSelectedTask(null)
        if (shouldRefresh) fetchTasks()
    }

    const bgColors = [
        "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/50",
        "bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/50",
        "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/50",
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Mis Tareas</h2>
                <Button onClick={handleNew} className="gap-2">
                    <Plus className="w-4 h-4" /> Nueva Tarea
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-10">Cargando tareas...</div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-10 border rounded-xl bg-gray-50 dark:bg-gray-900/50">
                    <p className="text-muted-foreground">No tienes tareas pendientes.</p>
                    <Button variant="link" onClick={handleNew}>Crear una tarea</Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tasks.map((task, i) => (
                        <div
                            key={task.id}
                            className={`p-4 rounded-xl border transition-all hover:shadow-md ${task.completed ? 'opacity-60 bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-900'}`}
                        >
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1">
                                    <h3
                                        className={`font-semibold text-gray-900 dark:text-white mb-1 cursor-pointer hover:underline ${task.completed ? 'line-through decoration-gray-400' : ''}`}
                                        onClick={() => handleEdit(task)}
                                    >
                                        {task.action}
                                    </h3>
                                    <div
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary cursor-pointer"
                                        onClick={() => navigate(`/crm/contact/${task.contact_id}`)}
                                    >
                                        <User className="w-3 h-3" />
                                        {task.contacts?.first_name} {task.contacts?.last_name}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggleComplete(task.id, task.completed)}
                                    className={`shrink-0 transition-colors ${task.completed ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}
                                >
                                    {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                </button>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(task.execution_date).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                                    <Clock className="w-3 h-3" />
                                    {new Date(task.execution_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <TaskModal
                task={selectedTask}
                isOpen={isModalOpen}
                onClose={handleModalClose}
            />
        </div>
    )
}

export default TaskBoard
