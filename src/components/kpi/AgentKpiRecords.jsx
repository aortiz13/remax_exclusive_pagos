import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { Columns3, CalendarIcon, Search, Loader2, LayoutList } from 'lucide-react'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    Button, Popover, PopoverContent, PopoverTrigger,
    Calendar, Checkbox, Badge
} from "@/components/ui"

// KPI Numeric Column definitions – same as AdminKpiView "Registros Detallados"
const RECORD_COLUMNS = [
    { key: 'conversations_started', label: 'I.C.', align: 'center' },
    { key: 'relational_coffees', label: 'Cafés', align: 'center' },
    { key: 'sales_interviews', label: 'Ent. Venta', align: 'center' },
    { key: 'buying_interviews', label: 'Ent. Compra', align: 'center' },
    { key: 'commercial_evaluations', label: 'Eval. Com.', align: 'center' },
    { key: 'new_listings', label: 'Captaciones', align: 'center' },
    { key: 'active_portfolio', label: 'Cartera', align: 'center' },
    { key: 'price_reductions', label: 'Bajas Precio', align: 'center' },
    { key: 'portfolio_visits', label: 'Vis. Prop.', align: 'center' },
    { key: 'buyer_visits', label: 'Vis. Comp.', align: 'center' },
    { key: 'offers_in_negotiation', label: 'Ofertas Neg.', align: 'center' },
    { key: 'signed_promises', label: 'Promesas', align: 'center' },
    { key: 'referrals_count', label: 'Referidos', align: 'center' },
    { key: 'billing_primary', label: 'Fact. Prim.', align: 'right', isCurrency: true },
    { key: 'billing_secondary', label: 'Fact. Sec.', align: 'right', isCurrency: true },
]

const DEFAULT_VISIBLE = RECORD_COLUMNS.map(c => c.key)
const LS_KEY = 'agent_kpi_records_visible_cols'

const fmtCLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

// Grouping modes
const GROUP_MODES = [
    { value: 'daily', label: 'Diario' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensual' },
]

export default function AgentKpiRecords() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [records, setRecords] = useState([])
    const [dateRange, setDateRange] = useState('3m')
    const [groupBy, setGroupBy] = useState('monthly')
    const [customDate, setCustomDate] = useState({ from: undefined, to: undefined })
    const [tempDate, setTempDate] = useState({ from: undefined, to: undefined })
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem(LS_KEY)
        return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
    })

    const toggleColumn = (key) => {
        setVisibleColumns(prev => {
            const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
            localStorage.setItem(LS_KEY, JSON.stringify(next))
            return next
        })
    }

    const activeColumns = RECORD_COLUMNS.filter(c => visibleColumns.includes(c.key))

    // Calculate date range
    const getRange = () => {
        const now = new Date()
        let start, end = now
        if (dateRange === 'custom') {
            start = customDate.from
            end = customDate.to || customDate.from || now
        } else if (dateRange === '1m') start = subMonths(now, 1)
        else if (dateRange === '3m') start = subMonths(now, 3)
        else if (dateRange === '6m') start = subMonths(now, 6)
        else if (dateRange === '1y') start = subMonths(now, 12)
        else if (dateRange === 'ytd') start = startOfMonth(new Date(now.getFullYear(), 0, 1))
        return { start, end }
    }

    useEffect(() => {
        if (!user) return
        if (dateRange === 'custom' && !customDate.from) return
        fetchRecords()
    }, [user, dateRange, customDate])

    const fetchRecords = async () => {
        setLoading(true)
        try {
            const { start, end } = getRange()
            if (!start) return

            const { data, error } = await supabase
                .from('kpi_records')
                .select('*')
                .eq('agent_id', user.id)
                .gte('date', format(start, 'yyyy-MM-dd'))
                .lte('date', format(end, 'yyyy-MM-dd'))
                .order('date', { ascending: false })

            if (error) throw error
            setRecords(data || [])
        } catch (err) {
            console.error('Error fetching agent KPI records:', err)
        } finally {
            setLoading(false)
        }
    }

    // Aggregate records based on groupBy mode
    const groupedRows = useMemo(() => {
        if (records.length === 0) return []

        // Filter only daily records (avoid double-counting weekly summaries)
        const dailyRecords = records.filter(r => r.period_type === 'daily')

        if (groupBy === 'daily') {
            // Return individual records, each as its own row
            return dailyRecords.map(r => ({
                label: format(new Date(r.date), 'dd MMM yyyy', { locale: es }),
                sortKey: r.date,
                ...RECORD_COLUMNS.reduce((acc, c) => {
                    acc[c.key] = Number(r[c.key]) || 0
                    return acc
                }, {})
            }))
        }

        // Group by week or month
        const buckets = {}
        dailyRecords.forEach(r => {
            const d = new Date(r.date)
            let key, label

            if (groupBy === 'weekly') {
                const weekStart = startOfWeek(d, { weekStartsOn: 1 })
                key = format(weekStart, 'yyyy-MM-dd')
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekEnd.getDate() + 6)
                label = `${format(weekStart, 'dd MMM', { locale: es })} – ${format(weekEnd, 'dd MMM yyyy', { locale: es })}`
            } else {
                // monthly
                key = format(d, 'yyyy-MM')
                label = format(d, 'MMMM yyyy', { locale: es })
                // Capitalize first letter
                label = label.charAt(0).toUpperCase() + label.slice(1)
            }

            if (!buckets[key]) {
                buckets[key] = { label, sortKey: key }
                RECORD_COLUMNS.forEach(c => { buckets[key][c.key] = 0 })
            }

            RECORD_COLUMNS.forEach(c => {
                if (c.key === 'active_portfolio') {
                    buckets[key][c.key] = Math.max(buckets[key][c.key], Number(r[c.key]) || 0)
                } else {
                    buckets[key][c.key] += Number(r[c.key]) || 0
                }
            })
        })

        return Object.values(buckets).sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    }, [records, groupBy])

    // Grand totals
    const totals = useMemo(() => {
        return groupedRows.reduce((acc, r) => {
            RECORD_COLUMNS.forEach(c => {
                if (c.key === 'active_portfolio') {
                    acc[c.key] = Math.max(acc[c.key] || 0, r[c.key] || 0)
                } else {
                    acc[c.key] = (acc[c.key] || 0) + (Number(r[c.key]) || 0)
                }
            })
            return acc
        }, {})
    }, [groupedRows])

    const colSpan = activeColumns.length + 2

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg shadow-sm border">
                    {/* Date Range */}
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px] border-0 focus:ring-0">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1m">Último mes</SelectItem>
                            <SelectItem value="3m">Últimos 3 meses</SelectItem>
                            <SelectItem value="6m">Últimos 6 meses</SelectItem>
                            <SelectItem value="1y">Último año</SelectItem>
                            <SelectItem value="ytd">Año a la fecha</SelectItem>
                            <SelectItem value="custom">Personalizado...</SelectItem>
                        </SelectContent>
                    </Select>

                    {dateRange === 'custom' && (
                        <Popover open={isCustomDateOpen} onOpenChange={(open) => {
                            if (open) setTempDate(customDate)
                            setIsCustomDateOpen(open)
                        }}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-9 justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {customDate.from
                                        ? `${format(customDate.from, 'dd/MM/yyyy')} - ${customDate.to ? format(customDate.to, 'dd/MM/yyyy') : '...'}`
                                        : 'Seleccionar fechas'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="center">
                                <div className="scale-90 origin-top">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={tempDate?.from}
                                        selected={tempDate}
                                        onSelect={setTempDate}
                                        numberOfMonths={2}
                                        locale={es}
                                    />
                                    <div className="p-3 border-t flex justify-end">
                                        <Button size="sm" onClick={() => {
                                            setCustomDate(tempDate)
                                            setIsCustomDateOpen(false)
                                        }}>
                                            OK
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}

                    <div className="h-6 w-px bg-slate-200" />

                    {/* Group By */}
                    <Select value={groupBy} onValueChange={setGroupBy}>
                        <SelectTrigger className="w-[150px] border-0 focus:ring-0">
                            <LayoutList className="h-4 w-4 mr-2 text-slate-400" />
                            <SelectValue placeholder="Agrupar por" />
                        </SelectTrigger>
                        <SelectContent>
                            {GROUP_MODES.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button size="icon" variant="ghost" onClick={fetchRecords} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <Search className="w-4 h-4 text-slate-500" />}
                    </Button>
                </div>

                {/* Column Visibility */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Columns3 className="h-4 w-4" />
                            Columnas ({activeColumns.length}/{RECORD_COLUMNS.length})
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-3">
                        <div className="space-y-1">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b">
                                <span className="text-sm font-medium">Columnas visibles</span>
                                <button
                                    className="text-xs text-indigo-600 hover:underline"
                                    onClick={() => {
                                        const allKeys = RECORD_COLUMNS.map(c => c.key)
                                        const next = visibleColumns.length === allKeys.length ? allKeys.slice(0, 6) : allKeys
                                        setVisibleColumns(next)
                                        localStorage.setItem(LS_KEY, JSON.stringify(next))
                                    }}
                                >
                                    {visibleColumns.length === RECORD_COLUMNS.length ? 'Mostrar mínimo' : 'Mostrar todas'}
                                </button>
                            </div>
                            {RECORD_COLUMNS.map(col => (
                                <label key={col.key} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer text-sm">
                                    <Checkbox
                                        checked={visibleColumns.includes(col.key)}
                                        onCheckedChange={() => toggleColumn(col.key)}
                                    />
                                    {col.label}
                                </label>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Summary badge */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Badge variant="secondary" className="font-normal">
                    {groupedRows.length} {groupBy === 'daily' ? 'registros' : groupBy === 'weekly' ? 'semanas' : 'meses'}
                </Badge>
                <span className="text-slate-400">
                    ({records.filter(r => r.period_type === 'daily').length} registros diarios en total)
                </span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="sticky left-0 bg-slate-50 z-10 min-w-[40px] text-center">#</TableHead>
                                <TableHead className="sticky left-[40px] bg-slate-50 z-10 min-w-[160px]">
                                    {groupBy === 'daily' ? 'Fecha' : groupBy === 'weekly' ? 'Semana' : 'Mes'}
                                </TableHead>
                                {activeColumns.map(col => (
                                    <TableHead key={col.key} className={col.align === 'right' ? 'text-right' : 'text-center'}>
                                        {col.label}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={colSpan} className="text-center py-12">
                                        <div className="flex items-center justify-center gap-2 text-slate-400">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Cargando registros...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : groupedRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={colSpan} className="text-center py-12 text-slate-400">
                                        No hay registros para este periodo.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {groupedRows.map((row, idx) => (
                                        <TableRow key={row.sortKey} className="hover:bg-slate-50/50">
                                            <TableCell className="sticky left-0 bg-white z-10 text-center text-xs text-slate-400">{idx + 1}</TableCell>
                                            <TableCell className="sticky left-[40px] bg-white z-10 font-medium text-slate-700 whitespace-nowrap">
                                                {row.label}
                                            </TableCell>
                                            {activeColumns.map(col => (
                                                <TableCell
                                                    key={col.key}
                                                    className={`${col.align === 'right' ? 'text-right font-mono' : 'text-center'} ${col.isCurrency ? 'text-sm' : ''}`}
                                                >
                                                    {col.isCurrency ? fmtCLP(row[col.key]) : row[col.key]}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                    {/* Totals Row */}
                                    <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                        <TableCell className="sticky left-0 bg-slate-100 z-10 text-center text-xs">Σ</TableCell>
                                        <TableCell className="sticky left-[40px] bg-slate-100 z-10">
                                            TOTAL
                                        </TableCell>
                                        {activeColumns.map(col => (
                                            <TableCell
                                                key={col.key}
                                                className={`${col.align === 'right' ? 'text-right font-mono' : 'text-center'}`}
                                            >
                                                {col.isCurrency ? fmtCLP(totals[col.key] || 0) : (totals[col.key] || 0)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
