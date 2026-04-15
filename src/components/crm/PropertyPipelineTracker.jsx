import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { getStagesForPipeline, PIPELINE_TYPES, fetchDealHistory } from '../../services/dealsPipelineService'
import { CheckCircle2, Clock, Circle, GitBranch, ArrowRight, Trophy, XCircle, Link2, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PropertyPipelineTracker = ({ propertyId, contactId }) => {
    const [deals, setDeals] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetchDeals()
    }, [propertyId, contactId])

    const fetchDeals = async () => {
        const filterCol = propertyId ? 'property_id' : 'contact_id'
        const filterVal = propertyId || contactId
        if (!filterVal) return
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('deals')
                .select(`
                    *,
                    contact:contact_id(id, first_name, last_name),
                    agent:agent_id(id, first_name, last_name)
                `)
                .eq(filterCol, filterVal)
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
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent" />
            </div>
        )
    }

    if (deals.length === 0) {
        return (
            <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <GitBranch className="w-7 h-7 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Sin pipeline activo</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                    {propertyId
                        ? 'Esta propiedad aún no tiene un negocio asociado en el Pipeline. Crea uno desde la sección "Pipeline Negocios".'
                        : 'Este contacto aún no tiene un negocio asociado en el Pipeline. Crea uno desde la sección "Pipeline Negocios".'}
                </p>
                <button
                    onClick={() => navigate('/pipeline-sales')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 hover:underline mt-2"
                >
                    Ir a Pipeline Negocios <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        )
    }

    // Build genealogy map
    const genealogyMap = {}
    deals.forEach(d => {
        if (d.spawned_from_deal_id) {
            if (!genealogyMap[d.spawned_from_deal_id]) genealogyMap[d.spawned_from_deal_id] = []
            genealogyMap[d.spawned_from_deal_id].push(d)
        }
    })

    const getParentLabel = (deal) => {
        if (!deal.spawned_from_deal_id) return null
        const parent = deals.find(d => d.id === deal.spawned_from_deal_id)
        if (!parent) return null
        const parentPipeline = PIPELINE_TYPES.find(p => p.id === parent.pipeline_type)
        return `${parentPipeline?.label || parent.pipeline_type}`
    }

    const activeDeals = deals.filter(d => d.status === 'active')
    const closedDeals = deals.filter(d => d.status === 'won' || d.status === 'lost')

    return (
        <div className="space-y-5">
            {activeDeals.map(deal => (
                <DealPipelineCard
                    key={deal.id}
                    deal={deal}
                    parentLabel={getParentLabel(deal)}
                    childDeals={genealogyMap[deal.id]}
                />
            ))}

            {closedDeals.length > 0 && (
                <>
                    {activeDeals.length > 0 && (
                        <div className="flex items-center gap-3 pt-1">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Historial</span>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
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
    const [stageTimeline, setStageTimeline] = useState({})

    useEffect(() => {
        fetchDealHistory(deal.id).then(history => {
            // history is sorted desc by created_at
            const sorted = [...history].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            const timeline = {}

            sorted.forEach((entry, idx) => {
                const stage = entry.to_stage
                if (!stage) return
                const enteredAt = new Date(entry.created_at)
                // Duration = time from this entry to the next entry (or now)
                const nextEntry = sorted[idx + 1]
                const exitAt = nextEntry ? new Date(nextEntry.created_at) : (deal.current_stage === stage ? new Date() : null)
                const durationMs = exitAt ? exitAt - enteredAt : null
                timeline[stage] = { enteredAt, durationMs }
            })

            // If no history for the first stage, use deal.created_at
            if (stages.length > 0 && !timeline[stages[0].id]) {
                timeline[stages[0].id] = { enteredAt: new Date(deal.created_at), durationMs: null }
            }

            setStageTimeline(timeline)
        }).catch(() => {})
    }, [deal.id])

    const formatDuration = (ms) => {
        if (!ms || ms < 0) return null
        const minutes = Math.floor(ms / 60000)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)
        if (days > 0) return `${days}d`
        if (hours > 0) return `${hours}h`
        return `${minutes}m`
    }

    const formatDate = (date) => {
        if (!date) return null
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    }

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
        <div className={`rounded-xl border overflow-hidden transition-opacity ${
            isHistorical
                ? 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-80'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
        }`}>
            {/* Genealogy badge */}
            {parentLabel && (
                <div className="px-5 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Generado desde <span className="font-semibold text-slate-600 dark:text-slate-300">{parentLabel}</span>
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <GitBranch className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                {pipelineMeta?.label || deal.pipeline_type}
                            </h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                {deal.title || (deal.contact?.first_name ? `${deal.contact?.first_name || ''} ${deal.contact?.last_name || ''}`.trim() : 'Sin título')}
                            </p>
                        </div>
                    </div>
                    <div>
                        {allCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <Trophy className="w-3 h-3" /> Ganado
                            </span>
                        ) : isLost ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                <XCircle className="w-3 h-3" /> Perdido
                            </span>
                        ) : (
                            <span className="text-xs text-slate-400">
                                {currentStageIndex + 1} / {stages.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                            allCompleted ? 'bg-emerald-500 dark:bg-emerald-400' :
                            isLost ? 'bg-slate-400 dark:bg-slate-500' :
                            'bg-emerald-500 dark:bg-emerald-400'
                        }`}
                        style={{
                            width: allCompleted ? '100%' :
                                `${Math.max(((currentStageIndex + 1) / stages.length) * 100, 5)}%`
                        }}
                    />
                </div>
            </div>

            {/* Stages */}
            <div className="px-5 py-4">
                <div className="relative">
                    {stages.map((stage, idx) => {
                        const status = getStageStatus(idx)
                        const isLastStage = idx === stages.length - 1

                        return (
                            <div key={stage.id} className="relative flex gap-3.5">
                                {/* Vertical line */}
                                {!isLastStage && (
                                    <div
                                        className="absolute left-[13px] top-[30px] w-px bottom-0"
                                        style={{
                                            background: status === 'completed'
                                                ? '#34d399'  // emerald-400
                                                : status === 'current'
                                                ? '#94a3b8'  // slate-400
                                                : '#e2e8f0'  // slate-200
                                        }}
                                    />
                                )}

                                {/* Icon */}
                                <div className="relative z-10 flex-shrink-0 mt-0.5">
                                    {status === 'completed' ? (
                                        <div className="w-[26px] h-[26px] rounded-full bg-emerald-500 dark:bg-emerald-400 flex items-center justify-center">
                                            <CheckCircle2 className="w-4 h-4 text-white dark:text-emerald-950" strokeWidth={2.5} />
                                        </div>
                                    ) : status === 'current' ? (
                                        <div className="w-[26px] h-[26px] rounded-full bg-slate-800 dark:bg-white flex items-center justify-center ring-[3px] ring-slate-200 dark:ring-slate-700">
                                            <Clock className="w-3.5 h-3.5 text-white dark:text-slate-900" />
                                        </div>
                                    ) : (
                                        <div className="w-[26px] h-[26px] rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                            <Circle className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 ${isLastStage ? 'pb-0' : 'pb-5'}`}>
                                    <div className={`rounded-lg px-3.5 py-2.5 border transition-colors ${
                                        status === 'completed'
                                            ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                                            : status === 'current'
                                            ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 shadow-sm'
                                            : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/60'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <h4 className={`text-[13px] font-medium ${
                                                status === 'completed'
                                                    ? 'text-slate-600 dark:text-slate-300'
                                                    : status === 'current'
                                                    ? 'text-slate-900 dark:text-white font-semibold'
                                                    : 'text-slate-400 dark:text-slate-500'
                                            }`}>
                                                {stage.label}
                                            </h4>
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                                status === 'completed'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                    : status === 'current'
                                                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                                            }`}>
                                                {status === 'completed' ? 'Completada' : status === 'current' ? 'En curso' : 'Pendiente'}
                                            </span>
                                        </div>
                                        <p className={`text-[11px] mt-0.5 ${
                                            status === 'completed'
                                                ? 'text-slate-400 dark:text-slate-500'
                                                : status === 'current'
                                                ? 'text-slate-500 dark:text-slate-400'
                                                : 'text-slate-300 dark:text-slate-600'
                                        }`}>
                                            {stage.description}
                                        </p>
                                        {/* Date & Duration */}
                                        {stageTimeline[stage.id] && (status === 'completed' || status === 'current') && (
                                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="w-3 h-3" />
                                                    {formatDate(stageTimeline[stage.id].enteredAt)}
                                                </span>
                                                {stageTimeline[stage.id].durationMs != null && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDuration(stageTimeline[stage.id].durationMs)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Child deals */}
            {childDeals && childDeals.length > 0 && (
                <div className="px-5 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                            Transiciones
                        </span>
                    </div>
                    {childDeals.map(child => {
                        const childPipeline = PIPELINE_TYPES.find(p => p.id === child.pipeline_type)
                        return (
                            <div key={child.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 mb-1.5">
                                <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                    <GitBranch className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                                        {childPipeline?.label || child.pipeline_type}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
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
