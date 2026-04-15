import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { motion } from 'framer-motion'

export default function DashboardCard({ id, children, className = '' }) {
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group ${isDragging ? 'opacity-50' : ''} ${className}`}
        >
            {/* Drag Handle — top-right corner, visible on hover */}
            <button
                {...attributes}
                {...listeners}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-lg 
                           bg-white/80 backdrop-blur border border-slate-200/60 shadow-sm
                           opacity-0 group-hover:opacity-100 transition-all duration-200
                           hover:bg-slate-100 hover:shadow cursor-grab active:cursor-grabbing
                           focus:outline-none focus:ring-2 focus:ring-indigo-300"
                aria-label="Reordenar tarjeta"
            >
                <GripVertical className="w-4 h-4 text-slate-400" />
            </button>

            {children}
        </div>
    )
}
