import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'

export function KanbanColumn({ id, title, items, color, onViewDetail }) {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    })

    return (
        <div className={`flex flex-col h-full w-full min-w-[300px] rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 ${isOver ? 'ring-2 ring-primary/20 bg-slate-100 dark:bg-slate-800' : ''}`}>

            {/* Header */}
            <div className={`p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between rounded-t-xl ${color}`}>
                <h3 className="font-semibold">{title}</h3>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/50 text-xs font-semibold">
                    {items.length}
                </span>
            </div>

            {/* Cards Container */}
            <div ref={setNodeRef} className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[150px]">
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {items.map((request) => (
                        <KanbanCard key={request.id} request={request} onViewDetail={onViewDetail} />
                    ))}
                </SortableContext>
                {items.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                        Arrastra aquí
                    </div>
                )}
            </div>
        </div>
    )
}
