import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button, Badge, Checkbox } from '@/components/ui'
import { X, MapPin, User, Building, ClipboardList, ExternalLink, Calendar, CheckCircle2, Circle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

const PropertyQuickView = ({ property, isOpen, onClose, onEdit }) => {
    const navigate = useNavigate()
    const [tasks, setTasks] = useState([])
    const [loadingTasks, setLoadingTasks] = useState(false)

    useEffect(() => {
        if (property?.id) {
            fetchTasks()
        }
    }, [property])

    const fetchTasks = async () => {
        setLoadingTasks(true)
        try {
            const { data, error } = await supabase
                .from('crm_tasks')
                .select('*')
                .eq('property_id', property.id)
                .order('execution_date', { ascending: true })

            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Error fetching tasks:', error)
        } finally {
            setLoadingTasks(false)
        }
    }

    const handleTaskToggle = async (taskId, currentStatus) => {
        try {
            // Optimistic update
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t))

            const { error } = await supabase
                .from('crm_tasks')
                .update({ completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : null })
                .eq('id', taskId)

            if (error) throw error
        } catch (error) {
            console.error('Error toggling task:', error)
            // Revert on error
            fetchTasks()
        }
    }

    if (!isOpen || !property) return null

    return createPortal(
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose()} />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl h-full border-l border-gray-200 dark:border-gray-800 relative z-50 flex flex-col"
            >
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-start bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <Badge variant="outline" className="mb-2">{property.property_type}</Badge>
                        <h2 className="text-xl font-bold leading-tight">{property.address}</h2>
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {property.commune} {property.unit_number ? `, Unidad ${property.unit_number}` : ''}
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onClose()} className="-mr-2 -mt-2">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Content */}
                <div
                    className="flex-1 overflow-y-auto p-6 space-y-6"
                    onWheel={(e) => e.stopPropagation()}
                >

                    {/* Status */}
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Estado Comercial</h3>
                        <div className="flex flex-wrap gap-2">
                            {property.status && property.status.map((s, i) => (
                                <Badge key={i} variant="secondary" className="px-3 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    {s}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Owner */}
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Dueño</h3>
                        {property.contacts ? (
                            <div
                                className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => {
                                    onClose()
                                    navigate(`/crm/contact/${property.owner_id}`)
                                }}
                            >
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-medium hover:underline">{property.contacts.first_name} {property.contacts.last_name}</div>
                                    <div className="text-xs text-muted-foreground">Propietario Principal</div>
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto" />
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic">Sin dueño asignado</div>
                        )}
                    </div>

                    {/* Tasks */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <ClipboardList className="w-4 h-4" />
                                Tareas Asociadas
                            </h3>
                            {/* <Button variant="link" size="sm" className="h-auto p-0 text-xs">Nueva Tarea</Button> */}
                        </div>

                        <div className="space-y-2">
                            {loadingTasks ? (
                                <div className="text-xs text-muted-foreground">Cargando tareas...</div>
                            ) : tasks.length === 0 ? (
                                <div className="text-xs text-muted-foreground italic border-l-2 pl-3 py-1">No hay tareas pendientes.</div>
                            ) : (
                                tasks.map(task => (
                                    <div key={task.id} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                                        <button
                                            onClick={() => handleTaskToggle(task.id, task.completed)}
                                            className={`shrink-0 mt-0.5 ${task.completed ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}
                                        >
                                            {task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                        </button>
                                        <div className="flex-1">
                                            <div className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                                                {task.action}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                {task.is_all_day ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-bold uppercase tracking-tighter text-[9px] bg-blue-100 text-blue-700 px-1 rounded">Todo el día</span>
                                                        <span>{new Date(task.execution_date.split('T')[0] + 'T00:00:00').toLocaleDateString()}</span>
                                                    </span>
                                                ) : (
                                                    new Date(task.execution_date).toLocaleDateString()
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Quick Stats/Notes Preview */}
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Notas Rápidas</h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded border border-yellow-100 dark:border-yellow-900/20">
                            {property.notes || <span className="italic text-muted-foreground">Sin notas registradas.</span>}
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 dark:bg-gray-800/50 grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={onEdit}>
                        Editar
                    </Button>
                    <Button onClick={() => {
                        onClose()
                        navigate(`/crm/property/${property.id}`) // Assuming we will create this route
                    }}>
                        Ver Ficha Completa
                    </Button>
                </div>
            </motion.div>
        </div>,
        document.body
    )
}

export default PropertyQuickView
