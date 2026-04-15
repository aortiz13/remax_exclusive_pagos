import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Columns2, Columns3, RectangleHorizontal } from 'lucide-react'

const SPAN_OPTIONS = [
    { value: 1, icon: RectangleHorizontal, label: '1 col' },
    { value: 2, icon: Columns2, label: '2 col' },
    { value: 3, icon: Columns3, label: 'Completo' },
]

export default function DashboardCard({ id, children, className = '', colSpan = 1, onSpanChange }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    }

    const nextSpan = () => {
        if (!onSpanChange) return
        const next = colSpan >= 3 ? 1 : colSpan + 1
        onSpanChange(id, next)
    }

    const spanClass =
        colSpan === 3 ? 'md:col-span-2 lg:col-span-3'
        : colSpan === 2 ? 'md:col-span-2 lg:col-span-2'
        : ''

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group ${isDragging ? 'opacity-50' : ''} ${spanClass} ${className}`}
        >
            {/* Controls — top-right corner, visible on hover */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1
                            opacity-0 group-hover:opacity-100 transition-all duration-200">

                {/* Resize toggle */}
                {onSpanChange && (
                    <button
                        onClick={nextSpan}
                        className="p-1.5 rounded-lg bg-white/80 backdrop-blur border border-slate-200/60 shadow-sm
                                   hover:bg-indigo-50 hover:border-indigo-200 hover:shadow transition-all
                                   focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        aria-label={`Cambiar a ${SPAN_OPTIONS.find(s => s.value === (colSpan >= 3 ? 1 : colSpan + 1))?.label}`}
                        title={`Ahora: ${SPAN_OPTIONS.find(s => s.value === colSpan)?.label} — Click para cambiar`}
                    >
                        {(() => {
                            const Icon = SPAN_OPTIONS.find(s => s.value === colSpan)?.icon || RectangleHorizontal
                            return <Icon className="w-4 h-4 text-indigo-500" />
                        })()}
                    </button>
                )}

                {/* Drag handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1.5 rounded-lg bg-white/80 backdrop-blur border border-slate-200/60 shadow-sm
                               hover:bg-slate-100 hover:shadow cursor-grab active:cursor-grabbing transition-all
                               focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    aria-label="Reordenar tarjeta"
                >
                    <GripVertical className="w-4 h-4 text-slate-400" />
                </button>
            </div>

            {children}
        </div>
    )
}
