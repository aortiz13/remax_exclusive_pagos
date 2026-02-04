import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"

export function DateRangePicker({
    className,
    date,
    setDate,
}) {
    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLO y", { locale: es })} -{" "}
                                    {format(date.to, "LLO y", { locale: es })}
                                </>
                            ) : (
                                format(date.from, "LLO y", { locale: es })
                            )
                        ) : (
                            <span>Seleccionar fechas</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <DayPicker
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        locale={es}
                        className="p-3"
                        modifiersClassNames={{
                            selected: "bg-black text-white hover:bg-black hover:text-white rounded-md",
                            today: "bg-gray-100 text-black font-bold rounded-md",
                            range_start: "bg-black text-white rounded-l-md",
                            range_end: "bg-black text-white rounded-r-md",
                            range_middle: "bg-gray-100 text-black rounded-none",
                        }}
                        styles={{
                            caption: { textTransform: 'capitalize' }
                        }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
