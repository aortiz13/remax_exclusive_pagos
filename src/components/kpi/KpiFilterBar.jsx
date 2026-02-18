import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { Button, Popover, PopoverContent, PopoverTrigger, Calendar } from '@/components/ui'
import { cn } from '@/lib/utils'

export function KpiFilterBar({ onFilterChange }) {
    const [date, setDate] = useState({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 })
    })
    const [activePreset, setActivePreset] = useState('week')

    const presets = [
        {
            id: 'today',
            label: 'Hoy',
            getValue: () => ({ from: new Date(), to: new Date() })
        },
        {
            id: 'week',
            label: 'Esta Semana',
            getValue: () => ({
                from: startOfWeek(new Date(), { weekStartsOn: 1 }),
                to: endOfWeek(new Date(), { weekStartsOn: 1 })
            })
        },
        {
            id: 'month',
            label: 'Este Mes',
            getValue: () => ({
                from: startOfMonth(new Date()),
                to: endOfMonth(new Date())
            })
        },
        {
            id: 'year',
            label: 'Este Año',
            getValue: () => ({
                from: startOfYear(new Date()),
                to: endOfYear(new Date())
            })
        }
    ]

    const handlePresetChange = (presetId) => {
        const preset = presets.find(p => p.id === presetId)
        if (preset) {
            const range = preset.getValue()
            setDate(range)
            setActivePreset(presetId)
            onFilterChange(range, presetId)
        }
    }

    const handleDateSelect = (newDate) => {
        setDate(newDate)
        setActivePreset('custom')
        if (newDate?.from && newDate?.to) {
            onFilterChange(newDate, 'custom')
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
            {presets.map(preset => (
                <button
                    key={preset.id}
                    onClick={() => handlePresetChange(preset.id)}
                    className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                        activePreset === preset.id
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                >
                    {preset.label}
                </button>
            ))}

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={activePreset === 'custom' ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                            "h-8 gap-2 font-normal",
                            activePreset === 'custom' && "bg-slate-900 text-white hover:bg-slate-800"
                        )}
                    >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "d MMM", { locale: es })} -{" "}
                                    {format(date.to, "d MMM", { locale: es })}
                                </>
                            ) : (
                                format(date.from, "d MMM", { locale: es })
                            )
                        ) : (
                            <span>Personalizado</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={handleDateSelect}
                        numberOfMonths={2}
                        locale={es}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
