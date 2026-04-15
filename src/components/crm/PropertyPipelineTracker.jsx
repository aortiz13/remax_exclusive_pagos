import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { getStagesForPipeline, PIPELINE_TYPES } from '../../services/dealsPipelineService'
import { CheckCircle2, Clock, Circle, GitBranch, ArrowRight, Trophy, XCircle, Link2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PropertyPipelineTracker = ({ propertyId }) => {
    const [deals, setDeals] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetchPropertyDeals()
    }, [propertyId])

    const fetchPropertyDeals = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('deals')
                .select(`
                    *,
                    contact:contact_id(id, first_name, last_name),
                    agent:agent_id(id, first_name, last_name)
                `)
                .eq('property_id', propertyId)
                .in('status', ['active', 'won', 'lost'])
                .order('created_at', { ascending: true })

            if (error) throw error
            setDeals(data || [])
        } catch (err) {
            console.error('Error fetching property deals:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
        )
    }

    if (deals.length === 0) {
        return (
            <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <GitBranch className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Sin pipeline activo</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Esta propiedad aún no tiene un negocio asociado en el Pipeline. Crea uno desde la sección "Pipeline Negocios".
                </p>
                <button
                    onClick={() => navigate('/pipeline-sales')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#003DA5] hover:underline mt-2"
                >
                    Ir a Pipeline Negocios <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        )
    }

    // Build genealogy map: parentId -> childDeals
    const genealogyMap = {}
    deals.forEach(d => {
        if (d.spawned_from_deal_id) {
            if (!genealogyMap[d.spawned_from_deal_id]) genealogyMap[d.spawned_from_deal_id] = []
            genealogyMap[d.spawned_from_deal_id].push(d)
        }
    })

    // Find parent deal name
    const getParentLabel = (deal) => {
        if (!deal.spawned_from_deal_id) return null
        const parent = deals.find(d => d.id === deal.spawned_from_deal_id)
        if (!parent) return null
        const parentPipeline = PIPELINE_TYPES.find(p => p.id === parent.pipeline_type)
        return `${parentPipeline?.label || parent.pipeline_type}`
    }

    // Separate active vs closed
    const activeDeals = deals.filter(d => d.status === 'active')
    const closedDeals = deals.filter(d => d.status === 'won' || d.status === 'lost')

    return (
        <div className="space-y-6">
            {/* Active deals first */}
            {activeDeals.map(deal => (
                <DealPipelineCard
                    key={deal.id}
                    deal={deal}
                    parentLabel={getParentLabel(deal)}
                    childDeals={genealogyMap[deal.id]}
                />
            ))}

            {/* Closed deals */}
            {closedDeals.length > 0 && (
                <>
                    {activeDeals.length > 0 && (
                        <div className="flex items-center gap-3 pt-2">
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Historial</span>
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                        </div>
                    )}
                    {closedDeals.map(deal => (
                        <DealPipelineCard
                            key={deal.id}
                            deal={deal}
                            parentLabel={getParentLabel(deal)}
                            childDeals={genealogyMap[deal.id]}
                            isHistorical
                        />
                    ))}
                </>
            )}
        </div>
    )
}

const DealPipelineCard = ({ deal, parentLabel, childDeals, isHistorical }) => {
    const stages = getStagesForPipeline(deal.pipeline_type)
    const currentStageIndex = stages.findIndex(s => s.id === deal.current_stage)
    const pipelineMeta = PIPELINE_TYPES.find(p => p.id === deal.pipeline_type)

    const getStageStatus = (stageIndex) => {
        if (deal.current_stage === 'won') return 'completed'
        if (deal.current_stage === 'lost') return stageIndex <= currentStageIndex ? 'completed' : 'pending'
        if (stageIndex < currentStageIndex) return 'completed'
        if (stageIndex === currentStageIndex) return 'current'
        return 'pending'
    }

    const allCompleted = deal.current_stage === 'won'
    const isLost = deal.current_stage === 'lost'

    return (
        <div className={`bg-white dark:bg-gray-900 rounded-xl border overflow-hidden ${
            isHistorical ? 'border-gray-200 dark:border-gray-800 opacity-75' : 'border-gray-200 dark:border-gray-800'
        }`}>
            {/* Genealogy badge */}
            {parentLabel && (
                <div className="px-5 py-2 bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs text-indigo-600 dark:text-indigo-400">
                        Generado desde pipeline <span className="font-semibold">{parentLabel}</span>
                    </span>
                </div>
            )}

            {/* Deal header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-900">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            deal.pipeline_type === 'propietarios' ? 'bg-blue-100 dark:bg-blue-900/30' :
                            deal.pipeline_type === 'compradores' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                            'bg-amber-100 dark:bg-amber-900/30'
                        }`}>
                            <GitBranch className={`w-4.5 h-4.5 ${
                                deal.pipeline_type === 'propietarios' ? 'text-blue-600 dark:text-blue-400' :
                                deal.pipeline_type === 'compradores' ? 'text-emerald-600 dark:text-emerald-400' :
                                'text-amber-600 dark:text-amber-400'
                            }`} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {pipelineMeta?.label || deal.pipeline_type}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {deal.title || (deal.contact?.first_name ? `${deal.contact?.first_name || ''} ${deal.contact?.last_name || ''}`.trim() : 'Sin título')}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        {allCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <Trophy className="w-3.5 h-3.5" /> Ganado
                            </span>
                        ) : isLost ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                <XCircle className="w-3.5 h-3.5" /> Perdido
                            </span>
                        ) : (
                            <span className="text-xs text-muted-foreground">
                                Etapa {currentStageIndex + 1} de {stages.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                            allCompleted ? 'bg-emerald-500' :
                            isLost ? 'bg-red-400' :
                            'bg-[#003DA5]'
                        }`}
                        style={{
                            width: allCompleted ? '100%' :
                                `${Math.max(((currentStageIndex + 1) / stages.length) * 100, 5)}%`
                        }}
                    />
                </div>
            </div>

            {/* Stages list */}
            <div className="px-5 py-4">
                <div className="relative">
                    {stages.map((stage, idx) => {
                        const status = getStageStatus(idx)
                        const isLastStage = idx === stages.length - 1

                        return (
                            <div key={stage.id} className="relative flex gap-4">
                                {/* Vertical connector line */}
                                {!isLastStage && (
                                    <div
                                        className="absolute left-[15px] top-[32px] w-0.5 bottom-0"
                                        style={{
                                            background: status === 'completed' || (status === 'current' && idx < stages.length - 1)
                                                ? '#10b981'
                                                : '#e5e7eb'
                                        }}
                                    />
                                )}

                                {/* Icon */}
                                <div className="relative z-10 flex-shrink-0 mt-1">
                                    {status === 'completed' ? (
                                        <div className="w-[30px] h-[30px] rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-200 dark:shadow-emerald-900/50">
                                            <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2.5} />
                                        </div>
                                    ) : status === 'current' ? (
                                        <div className="w-[30px] h-[30px] rounded-full bg-[#003DA5] flex items-center justify-center shadow-sm shadow-blue-200 dark:shadow-blue-900/50 ring-4 ring-blue-100 dark:ring-blue-900/30">
                                            <Clock className="w-4 h-4 text-white animate-pulse" />
                                        </div>
                                    ) : (
                                        <div className="w-[30px] h-[30px] rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                            <Circle className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 pb-6 ${isLastStage ? 'pb-0' : ''}`}>
                                    <div className={`rounded-lg px-4 py-3 transition-colors ${
                                        status === 'completed'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30'
                                            : status === 'current'
                                            ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30'
                                            : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <h4 className={`text-sm font-semibold ${
                                                status === 'completed'
                                                    ? 'text-emerald-800 dark:text-emerald-300'
                                                    : status === 'current'
                                                    ? 'text-[#003DA5] dark:text-blue-300'
                                                    : 'text-gray-500 dark:text-gray-400'
                                            }`}>
                                                {stage.label}
                                            </h4>
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                                status === 'completed'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                    : status === 'current'
                                                    ? 'bg-blue-100 text-[#003DA5] dark:bg-blue-900/40 dark:text-blue-300'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                            }`}>
                                                {status === 'completed' ? 'Completada' : status === 'current' ? 'En curso' : 'Pendiente'}
                                            </span>
                                        </div>
                                        <p className={`text-xs mt-1 ${
                                            status === 'completed'
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : status === 'current'
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-gray-400 dark:text-gray-500'
                                        }`}>
                                            {stage.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Child deals (spawned transitions) */}
            {childDeals && childDeals.length > 0 && (
                <div className="px-5 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            Transiciones generadas
                        </span>
                    </div>
                    {childDeals.map(child => {
                        const childPipeline = PIPELINE_TYPES.find(p => p.id === child.pipeline_type)
                        return (
                            <div key={child.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 mb-1.5">
                                <div className="w-7 h-7 rounded-md bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                    <GitBranch className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 truncate">
                                        {childPipeline?.label || child.pipeline_type}
                                    </p>
                                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400">
                                        {child.status === 'active' ? 'En curso' : child.status === 'won' ? 'Ganado' : 'Perdido'}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default PropertyPipelineTracker
