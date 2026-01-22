import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, Badge, Button } from '@/components/ui'
import { FileText, Receipt, MapPin, User, Calendar, ExternalLink } from 'lucide-react'

export function KanbanCard({ request, isOverlay, onViewDetail }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: request.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    const typeConfig = {
        'calculation': {
            icon: Receipt,
            color: 'text-blue-600 bg-blue-50 border-blue-100',
            label: 'Cálculo'
        },
        'contract': {
            icon: FileText,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
            label: 'Contrato'
        },
        'invoice': {
            icon: Receipt,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
            label: 'Factura'
        }
    }

    const typeParams = typeConfig[request.type || 'contract'] || typeConfig['contract']
    const Icon = typeParams.icon

    const formatDate = (dateString) => {
        if (!dateString) return ''
        return new Date(dateString).toLocaleDateString('es-CL', {
            day: 'numeric',
            month: 'short'
        })
    }

    // Agent name logic (assuming profiles are joined or simply using data from request if available, 
    // or we might need to fetch it. For now, showing client name as it's more relevant for identifying the case)
    const clientName = request.data?.arrendatarioNombre || request.data?.dueñoNombre || request.data?.compradorNombre || 'Cliente'

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
            <Card className={`relativegroup cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${isOverlay ? 'shadow-xl rotate-2 scale-105 cursor-grabbing' : ''}`}>
                <CardHeader className="p-3 pb-2 space-y-0">
                    <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={`${typeParams.color} hover:${typeParams.color}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {typeParams.label}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-medium">
                            {formatDate(request.updated_at)}
                        </span>
                    </div>
                    <h4 className="font-semibold text-sm line-clamp-2 leading-tight text-slate-900 dark:text-slate-100 mb-1" title={request.data?.direccion}>
                        {request.data?.direccion || 'Propiedad sin dirección'}
                    </h4>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[150px]">
                            {/* Priority: Agent Name > Client Name > Default */}
                            {/* User requested Agent Name. Agent info is usually in data.agente (object) or data.agenteNombre (string) */}
                            <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">Agente:</span>
                            {request.data?.agente?.nombre
                                ? `${request.data.agente.nombre} ${request.data.agente.apellido || ''}`
                                : request.data?.agenteNombre
                                    ? `${request.data.agenteNombre} ${request.data.agenteApellido || ''}`
                                    : request.user
                                        ? `${request.user.first_name || ''} ${request.user.last_name || ''}`
                                        : 'Desconocido'}
                        </span>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 px-2 py-1 text-xs font-medium text-slate-600 hover:text-primary flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewDetail && onViewDetail(request);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            Ver detalle <ExternalLink className="h-3 w-3" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
