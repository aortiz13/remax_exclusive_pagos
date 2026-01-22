import { useState, useMemo } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { createPortal } from 'react-dom'

export function KanbanBoard({ requests, onStatusChange }) {
    const [activeId, setActiveId] = useState(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // minimum distance before drag starts to prevent accidental clicks
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const columns = useMemo(() => {
        const cols = {
            pendiente: [],
            realizado: [],
            rechazado: []
        }

        requests.forEach(req => {
            // Map old 'submitted' status to 'pendiente', or 'draft' to ignore (though filtered upstream)
            // Or if status is already one of the keys, use it.
            let status = req.status
            if (status === 'submitted') status = 'pendiente'
            if (!cols[status] && status !== 'draft') {
                // If unknown status, maybe default to pendiente or ignore? 
                // For now, let's assume valid statuses.
                if (['pendiente', 'realizado', 'rechazado'].includes(status)) {
                    // correct
                } else {
                    status = 'pendiente' // Fallback
                }
            }

            if (cols[status]) {
                cols[status].push(req)
            }
        })
        return cols
    }, [requests])

    const handleDragStart = (event) => {
        setActiveId(event.active.id)
    }

    const handleDragEnd = (event) => {
        const { active, over } = event

        if (!over) {
            setActiveId(null)
            return
        }

        const activeReq = requests.find(r => r.id === active.id)
        if (!activeReq) return

        // Determine new status based on drop target
        // The over.id could be a container (column) OR another item in that column
        let newStatus = over.id

        // If dropped on a card, find that card's column
        if (!['pendiente', 'realizado', 'rechazado'].includes(newStatus)) {
            // Find the request corresponding to the over.id to get its status (or column)
            // But we can simply rely on the Container ID strategy if we make sure Droppables are Containers
            // However, with Sortable, over.id is usually the item id.
            // We need a way to map item ID to column.
            const overReq = requests.find(r => r.id === over.id)
            if (overReq) {
                newStatus = overReq.status === 'submitted' ? 'pendiente' : overReq.status
            } else {
                // Should not happen if over is valid
                setActiveId(null)
                return
            }
        }

        const currentStatus = activeReq.status === 'submitted' ? 'pendiente' : activeReq.status

        if (currentStatus !== newStatus) {
            onStatusChange(active.id, newStatus)
        }

        setActiveId(null)
    }

    // Custom drop animation
    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    }

    const activeRequest = useMemo(() => requests.find(r => r.id === activeId), [activeId, requests])

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full gap-6 overflow-x-auto pb-4">
                <KanbanColumn
                    id="pendiente"
                    title="Pendiente"
                    items={columns.pendiente}
                    color="bg-amber-100 text-amber-900 border-amber-200"
                />
                <KanbanColumn
                    id="realizado"
                    title="Realizado"
                    items={columns.realizado}
                    color="bg-green-100 text-green-900 border-green-200"
                />
                <KanbanColumn
                    id="rechazado"
                    title="Rechazado"
                    items={columns.rechazado}
                    color="bg-red-100 text-red-900 border-red-200"
                />
            </div>

            {createPortal(
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeRequest ? (
                        <KanbanCard request={activeRequest} isOverlay />
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    )
}
