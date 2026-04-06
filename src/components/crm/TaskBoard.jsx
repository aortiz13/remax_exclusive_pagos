import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import {
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Calendar,
    Badge
} from "@/components/ui"
import {
    CheckCircle2,
    Circle,
    Calendar as CalendarIcon,
    Clock,
    User,
    Plus,
    Activity,
    Search,
    LayoutGrid,
    List,
    Filter,
    X,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Mail,
    Phone,
    Video
} from 'lucide-react'
import TaskModal from './TaskModal'
import { completeTaskWithAction } from '../../services/completeTaskAction'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { format, isSameDay, isWithinInterval, startOfToday, endOfToday, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const TaskBoard = () => {
    const { profile, user } = useAuth()
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState(null)
    const navigate = useNavigate()

    // Filter States
    const [view, setView] = useState('grid') // 'grid' or 'list'
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all') // 'all', 'pending', 'completed'
    const [typeFilter, setTypeFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState({ mode: 'all', date: null, range: { from: null, to: null } })

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
                    contacts (id, first_name, last_name, email, phone),
                    crm_actions (id, action_type, note, kpi_deferred)
                `)
                // .eq('task_type', 'task') // Removed to show all types
                .order('execution_date', { ascending: true })

            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Error fetching tasks:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase()
                const actionMatch = task.action?.toLowerCase().includes(term)
                const contactMatch = `${task.contacts?.first_name} ${task.contacts?.last_name}`.toLowerCase().includes(term)
                if (!actionMatch && !contactMatch) return false
            }

            // Status filter
            if (statusFilter === 'pending' && task.completed) return false
            if (statusFilter === 'completed' && !task.completed) return false

            // Type filter
            if (typeFilter !== 'all' && task.task_type !== typeFilter) return false

            // Date filter
            if (dateFilter.mode !== 'all') {
                const taskDate = parseISO(task.execution_date)
                if (dateFilter.mode === 'specific' && dateFilter.date) {
                    if (!isSameDay(taskDate, dateFilter.date)) return false
                } else if (dateFilter.mode === 'range' && dateFilter.range.from && dateFilter.range.to) {
                    if (!isWithinInterval(taskDate, { start: dateFilter.range.from, end: dateFilter.range.to })) return false
                } else if (dateFilter.mode === 'today') {
                    if (!isSameDay(taskDate, startOfToday())) return false
                } else if (dateFilter.mode === 'week') {
                    if (!isWithinInterval(taskDate, { start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) })) return false
                }
            }

            return true
        })
    }, [tasks, searchTerm, statusFilter, typeFilter, dateFilter])

    const handleToggleComplete = async (taskId, currentStatus) => {
        const task = tasks.find(t => t.id === taskId)
        const linkedAction = task?.crm_actions ? {
            id: task.crm_actions.id,
            action_type: task.crm_actions.action_type,
            kpi_deferred: task.crm_actions.kpi_deferred
        } : null

        const result = await completeTaskWithAction(taskId, currentStatus, linkedAction, user.id)
        if (!result.success) return

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? {
            ...t,
            completed: result.newCompleted,
            crm_actions: t.crm_actions && result.newCompleted
                ? { ...t.crm_actions, kpi_deferred: false }
                : t.crm_actions
        } : t))

        if (profile?.google_refresh_token && task?.google_event_id) {
            await supabase.functions.invoke('google-calendar-sync', {
                body: { agentId: user.id, action: 'push_to_google', taskId: taskId }
            })
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

    const getTypeIcon = (type) => {
        switch (type) {
            case 'call': return <Phone className="w-3.5 h-3.5" />
            case 'email': return <Mail className="w-3.5 h-3.5" />
            case 'meeting': return <Video className="w-3.5 h-3.5" />
            default: return <Activity className="w-3.5 h-3.5" />
        }
    }

    const getTypeColor = (type) => {
        switch (type) {
            case 'call': return 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
            case 'email': return 'text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800'
            case 'meeting': return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800'
            case 'event': return 'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800'
            default: return 'text-slate-600 bg-slate-50 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800'
        }
    }

    return (
        <div className="space-y-6">
            {/* Header & Toolbar */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Mis Tareas</h2>
                    <Button onClick={handleNew} className="gap-2">
                        <Plus className="w-4 h-4" /> Nueva Tarea
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por tarea o contacto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white dark:bg-slate-950"
                        />
                    </div>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] bg-white dark:bg-slate-950">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="pending">Pendientes</SelectItem>
                            <SelectItem value="completed">Completadas</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Type Filter */}
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[140px] bg-white dark:bg-slate-950">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los tipos</SelectItem>
                            <SelectItem value="task">Tarea</SelectItem>
                            <SelectItem value="call">Llamada</SelectItem>
                            <SelectItem value="email">Correo</SelectItem>
                            <SelectItem value="meeting">Reunión</SelectItem>
                            <SelectItem value="event">Evento</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Date Picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={`gap-2 bg-white dark:bg-slate-950 ${dateFilter.mode !== 'all' ? 'border-primary text-primary font-bold' : ''}`}>
                                <CalendarIcon className="w-4 h-4" />
                                {dateFilter.mode === 'all' && 'Cualquier fecha'}
                                {dateFilter.mode === 'today' && 'Hoy'}
                                {dateFilter.mode === 'week' && 'Esta semana'}
                                {dateFilter.mode === 'specific' && dateFilter.date && format(dateFilter.date, 'dd/MM/yy')}
                                {dateFilter.mode === 'range' && dateFilter.range?.from && (
                                    <>
                                        {format(dateFilter.range.from, 'dd/MM')}
                                        {dateFilter.range.to && ` - ${format(dateFilter.range.to, 'dd/MM')}`}
                                    </>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <div className="p-3 border-b flex flex-col gap-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filtros rápidos</p>
                                <div className="flex flex-wrap gap-1.5">
                                    <Button
                                        variant={dateFilter.mode === 'all' ? 'default' : 'outline'}
                                        size="xs"
                                        className="h-7 text-[10px] px-2"
                                        onClick={() => setDateFilter({ mode: 'all', date: null, range: { from: null, to: null } })}
                                    >
                                        TODAS
                                    </Button>
                                    <Button
                                        variant={dateFilter.mode === 'today' ? 'default' : 'outline'}
                                        size="xs"
                                        className="h-7 text-[10px] px-2"
                                        onClick={() => setDateFilter({ mode: 'today', date: null, range: { from: null, to: null } })}
                                    >
                                        HOY
                                    </Button>
                                    <Button
                                        variant={dateFilter.mode === 'week' ? 'default' : 'outline'}
                                        size="xs"
                                        className="h-7 text-[10px] px-2"
                                        onClick={() => setDateFilter({ mode: 'week', date: null, range: { from: null, to: null } })}
                                    >
                                        ESTA SEMANA
                                    </Button>
                                </div>
                            </div>
                            <div className="p-1">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateFilter.range?.from || dateFilter.date || new Date()}
                                    selected={dateFilter.mode === 'range' ? dateFilter.range : (dateFilter.date ? { from: dateFilter.date, to: dateFilter.date } : undefined)}
                                    onSelect={(range) => {
                                        if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
                                            setDateFilter({ mode: 'range', date: null, range })
                                        } else if (range?.from) {
                                            setDateFilter({ mode: 'specific', date: range.from, range: { from: null, to: null } })
                                        }
                                    }}
                                    numberOfMonths={1}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>


                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

                    {/* View Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <Button
                            variant={view === 'grid' ? 'white' : 'ghost'}
                            size="sm"
                            className={`h-7 w-7 p-0 ${view === 'grid' ? 'shadow-sm bg-white dark:bg-slate-700' : ''}`}
                            onClick={() => setView('grid')}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={view === 'list' ? 'white' : 'ghost'}
                            size="sm"
                            className={`h-7 w-7 p-0 ${view === 'list' ? 'shadow-sm bg-white dark:bg-slate-700' : ''}`}
                            onClick={() => setView('list')}
                        >
                            <List className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground animate-pulse">Cargando tareas...</p>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-20 border rounded-2xl bg-gray-50/50 dark:bg-gray-900/50 border-dashed">
                    <div className="bg-white dark:bg-gray-800 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border">
                        <X className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">No se encontraron tareas</p>
                    <p className="text-muted-foreground max-w-xs mx-auto mt-1">Intenta ajustar los filtros para ver otros resultados.</p>
                    {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || dateFilter.mode !== 'all') && (
                        <Button
                            variant="link"
                            onClick={() => {
                                setSearchTerm('')
                                setStatusFilter('all')
                                setTypeFilter('all')
                                setDateFilter({ mode: 'all', date: null, range: { from: null, to: null } })
                            }}
                            className="mt-4"
                        >
                            Limpiar filtros
                        </Button>
                    )}
                </div>
            ) : view === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className={`group p-5 rounded-2xl border transition-all hover:shadow-xl hover:translate-y-[-2px] ${task.completed ? 'opacity-60 bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-slate-800 shadow-sm'}`}
                        >
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-tight px-1.5 py-0 border ${getTypeColor(task.task_type)} flex items-center gap-1`}>
                                            {getTypeIcon(task.task_type)}
                                            {task.task_type}
                                        </Badge>
                                    </div>
                                    <h3
                                        className={`font-bold text-gray-900 dark:text-white text-lg cursor-pointer hover:text-primary transition-colors leading-tight ${task.completed ? 'line-through decoration-gray-400' : ''}`}
                                        onClick={() => handleEdit(task)}
                                    >
                                        {task.action}
                                    </h3>
                                    <div
                                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary cursor-pointer mt-1"
                                        onClick={() => navigate(`/crm/contact/${task.contact_id}`)}
                                    >
                                        <User className="w-3.5 h-3.5" />
                                        <span className="font-medium">{task.contacts?.first_name} {task.contacts?.last_name}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggleComplete(task.id, task.completed)}
                                    className={`shrink-0 transition-all transform hover:scale-110 ${task.completed ? 'text-green-500' : 'text-slate-300 hover:text-green-500'}`}
                                >
                                    {task.completed ? <CheckCircle2 className="w-8 h-8 fill-green-50" /> : <Circle className="w-8 h-8" />}
                                </button>
                            </div>

                            {task.crm_actions && (
                                <div className="mt-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/50 text-[11px] space-y-1.5">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold">
                                        <Activity className="w-3.5 h-3.5" />
                                        <span>ÚLTIMA ACCIÓN: {task.crm_actions.action_type.toUpperCase()}</span>
                                    </div>
                                    {task.crm_actions.note && (
                                        <p className="text-slate-600 dark:text-slate-300 italic line-clamp-2 pl-3 border-l-2 border-blue-200">
                                            "{task.crm_actions.note}"
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-full">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    {task.is_all_day ? (
                                        format(parseISO(task.execution_date), 'dd MMM yyyy', { locale: es })
                                    ) : (
                                        format(parseISO(task.execution_date), 'dd MMM yyyy', { locale: es })
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-full">
                                    <Clock className="w-3.5 h-3.5" />
                                    {task.is_all_day ? (
                                        <span className="text-blue-600 dark:text-blue-400">TODO EL DÍA</span>
                                    ) : (
                                        format(parseISO(task.execution_date), 'HH:mm')
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl border bg-white dark:bg-gray-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[40%] h-11 text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-6">Tarea / Acción</TableHead>
                                <TableHead className="h-11 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contacto</TableHead>
                                <TableHead className="h-11 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha</TableHead>
                                <TableHead className="h-11 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Tipo</TableHead>
                                <TableHead className="w-[80px] h-11 text-[10px] text-center font-bold text-slate-500 uppercase tracking-wider pr-6">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTasks.map((task) => (
                                <TableRow 
                                    key={task.id} 
                                    className={`cursor-pointer group hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors ${task.completed ? 'opacity-70' : ''}`} 
                                    onClick={() => handleEdit(task)}
                                >
                                    <TableCell className="pl-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`font-bold text-slate-900 dark:text-white text-sm transition-all group-hover:text-primary ${task.completed ? 'line-through text-slate-400 font-medium' : ''}`}>
                                                {task.action}
                                            </span>
                                            {task.crm_actions && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full w-fit">
                                                    <Activity className="w-3 h-3" />
                                                    <span className="truncate max-w-[250px]">
                                                        {task.crm_actions.action_type.toUpperCase()}: {task.crm_actions.note}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div
                                            className="flex items-center gap-2.5 text-sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                navigate(`/crm/contact/${task.contact_id}`)
                                            }}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold ring-1 ring-inset ring-slate-200 dark:ring-slate-700 text-slate-500">
                                                {task.contacts?.first_name?.[0].toUpperCase() || '?'}
                                            </div>
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors hover:underline underline-offset-4 decoration-2 decoration-primary/30">
                                                {task.contacts?.first_name} {task.contacts?.last_name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-xs">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                                                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                {format(parseISO(task.execution_date), 'dd/MM/yyyy')}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 font-medium mt-0.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {task.is_all_day ? 'TODO EL DÍA' : format(parseISO(task.execution_date), 'HH:mm')}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0 border ${getTypeColor(task.task_type)} inline-flex items-center gap-1`}>
                                            {getTypeIcon(task.task_type)}
                                            {task.task_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="pr-6">
                                        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleToggleComplete(task.id, task.completed)}
                                                className={`group/check p-2 rounded-full transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${task.completed ? 'text-green-500' : 'text-slate-200 hover:text-green-400'}`}
                                            >
                                                {task.completed ? (
                                                    <CheckCircle2 className="w-6 h-6 fill-green-50 dark:fill-green-900/10" />
                                                ) : (
                                                    <Circle className="w-6 h-6 transition-colors group-hover/check:text-green-500 lg:group-hover/check:scale-110" />
                                                )}
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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

