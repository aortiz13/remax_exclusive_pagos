import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import ContactPickerInline from '../components/ui/ContactPickerInline'
import PropertyPickerInline from '../components/ui/PropertyPickerInline'
import {
  fetchDeals, createDeal, moveDealToStage, closeDealWon, closeDealLost,
  getStagesForPipeline, getFirstStage, PIPELINE_TYPES,
  STAGE_COLUMN_STYLES, TERMINAL_COLUMN_STYLES,
  fetchDealHistory,
} from '../services/dealsPipelineService'
import {
  Search, RotateCcw, Mail, Phone,
  ExternalLink, Eye, ChevronDown, ChevronUp, Filter, Plus,
  GripVertical, Columns3, Check, X, Trophy, XCircle,
  Home, ShoppingCart, Key, Users, User, Building2,
  FileSignature, DollarSign, Calendar, Clock, Zap,
  ArrowRight, AlertTriangle, Loader2, SkipForward
} from 'lucide-react'

// ─── Pipeline Tab Config (professional Lucide icons, no emojis) ──────────────

const TAB_CONFIG = {
  propietarios: {
    icon: Home,
    gradient: 'from-blue-600 to-indigo-600',
    activeBg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-500/30',
  },
  compradores: {
    icon: ShoppingCart,
    gradient: 'from-emerald-600 to-teal-600',
    activeBg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
    hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-500/30',
  },
  arriendos: {
    icon: Key,
    gradient: 'from-amber-500 to-orange-500',
    activeBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/30',
  },
}

// ─── Column Visibility Persistence ──────────────────────────────────────────

const VIS_KEY_PREFIX = 'deals_pipeline_visible_'
function loadVisibleCols(pipelineType) {
  try {
    const s = localStorage.getItem(VIS_KEY_PREFIX + pipelineType)
    if (s) { const p = JSON.parse(s); if (p.length > 0) return p }
  } catch { /* ignore */ }
  return null // null = show all
}

function saveVisibleCols(pipelineType, cols) {
  localStorage.setItem(VIS_KEY_PREFIX + pipelineType, JSON.stringify(cols))
}

// ─── Admin Roles ────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['superadministrador', 'administracion', 'comercial', 'legal', 'tecnico']

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SalesPipeline() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = ADMIN_ROLES.includes(profile?.role)

  // Active pipeline tab (persisted)
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem('deals_pipeline_tab') || 'propietarios' } catch { return 'propietarios' }
  })

  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  // Drag
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  // Column visibility per-tab
  const stages = useMemo(() => getStagesForPipeline(activeTab), [activeTab])
  const [visibleCols, setVisibleCols] = useState(() => loadVisibleCols(activeTab) || stages.map(s => s.id).concat(['won', 'lost']))
  const [showColMenu, setShowColMenu] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterAgent, setFilterAgent] = useState('all')
  const [filterStatus, setFilterStatus] = useState('active')
  const [agents, setAgents] = useState([])

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)
  const [showDealDetail, setShowDealDetail] = useState(null)

  // When tab changes, update columns
  useEffect(() => {
    const newStages = getStagesForPipeline(activeTab)
    const saved = loadVisibleCols(activeTab)
    setVisibleCols(saved || newStages.map(s => s.id).concat(['won', 'lost']))
  }, [activeTab])

  const toggleTab = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('deals_pipeline_tab', tab)
    setSearchTerm('')
    setFilterAgent('all')
  }

  const toggleCol = (id) => {
    setVisibleCols(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (next.length === 0) { toast.error('Al menos una columna'); return prev }
      saveVisibleCols(activeTab, next)
      return next
    })
  }

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const loadDeals = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchDeals(activeTab, {
        agentId: user?.id,
        isAdmin: isAdmin && filterAgent === 'all',
        status: filterStatus,
      })
      // If admin filters by specific agent
      if (isAdmin && filterAgent !== 'all') {
        setDeals(data.filter(d => d.agent_id === filterAgent))
      } else {
        setDeals(data)
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar pipeline')
    }
    setLoading(false)
  }, [activeTab, user?.id, isAdmin, filterAgent, filterStatus])

  useEffect(() => { loadDeals() }, [loadDeals])

  // Fetch agents list for admin filter
  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('id, first_name, last_name').eq('role', 'agent')
        .then(({ data }) => setAgents(data || []))
    }
  }, [isAdmin])

  // ─── Filter Logic ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!searchTerm) return deals
    const term = searchTerm.toLowerCase()
    return deals.filter(d => {
      const name = `${d.contact?.first_name || ''} ${d.contact?.last_name || ''}`.toLowerCase()
      const addr = (d.property?.address || '').toLowerCase()
      const title = (d.title || '').toLowerCase()
      return name.includes(term) || addr.includes(term) || title.includes(term)
    })
  }, [deals, searchTerm])

  const getColDeals = (colId) => {
    if (colId === 'won') return filtered.filter(d => d.status === 'won')
    if (colId === 'lost') return filtered.filter(d => d.status === 'lost')
    return filtered.filter(d => d.current_stage === colId && d.status === 'active')
  }

  const hasFilters = searchTerm || filterAgent !== 'all' || filterStatus !== 'active'

  const allColumns = [...stages.map(s => ({ ...s, isTerminal: false })),
    { id: 'won', label: 'Ganado', color: 'emerald', isTerminal: true },
    { id: 'lost', label: 'Perdido', color: 'slate', isTerminal: true },
  ]

  // ─── Drag & Drop ─────────────────────────────────────────────────────────

  const handleDragStart = (e, dealId) => {
    setDraggedId(dealId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', dealId)
    setTimeout(() => { if (e.target) e.target.style.opacity = '0.5' }, 0)
  }
  const handleDragEnd = (e) => { if (e.target) e.target.style.opacity = '1'; setDraggedId(null); setDragOverCol(null) }
  const handleDragOver = (e, colId) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(colId) }
  const handleDragLeave = () => setDragOverCol(null)

  const handleDrop = async (e, targetCol) => {
    e.preventDefault(); setDragOverCol(null)
    const dealId = e.dataTransfer.getData('text/plain')
    const deal = deals.find(d => d.id === dealId)
    if (!deal) { setDraggedId(null); return }

    const fromStage = deal.current_stage
    if (fromStage === targetCol) { setDraggedId(null); return }

    // Handle terminal columns
    if (targetCol === 'won') {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: 'won', current_stage: 'won' } : d))
      setDraggedId(null)
      try {
        await closeDealWon(dealId, user?.id)
        toast.success('Deal marcado como Ganado', { icon: '🏆' })
      } catch {
        toast.error('Error al cerrar deal')
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: 'active', current_stage: fromStage } : d))
      }
      return
    }

    if (targetCol === 'lost') {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: 'lost', current_stage: 'lost' } : d))
      setDraggedId(null)
      try {
        await closeDealLost(dealId, null, user?.id)
        toast.success('Deal marcado como Perdido')
      } catch {
        toast.error('Error al cerrar deal')
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: 'active', current_stage: fromStage } : d))
      }
      return
    }

    // Normal stage move (optimistic)
    setDeals(prev => prev.map(d =>
      d.id === dealId ? { ...d, current_stage: targetCol, updated_at: new Date().toISOString() } : d
    ))
    setDraggedId(null)

    try {
      await moveDealToStage(dealId, fromStage, targetCol, activeTab, user?.id)
      const stageLabel = stages.find(s => s.id === targetCol)?.label || targetCol
      toast.success(`Movido a "${stageLabel}"`, { icon: '✓' })
    } catch {
      toast.error('Error al mover deal')
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, current_stage: fromStage } : d))
    }
  }

  // ─── New Deal ─────────────────────────────────────────────────────────────

  const handleNewDeal = async (formData) => {
    try {
      const created = await createDeal({
        ...formData,
        pipelineType: activeTab,
        agentId: user?.id,
      })
      setDeals(prev => [created, ...prev])
      setShowNewModal(false)
      toast.success('Deal creado exitosamente')
    } catch (err) {
      console.error(err)
      toast.error('Error al crear deal')
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const tabConfig = TAB_CONFIG[activeTab]
  const TabIcon = tabConfig.icon

  return (
    <div className="space-y-5">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <div className={`p-2 bg-gradient-to-br ${tabConfig.gradient} rounded-xl shadow-lg`}>
              <TabIcon className="w-6 h-6 text-white" />
            </div>
            Pipeline de Negocios
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus negocios inmobiliarios paso a paso
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowNewModal(true)}
            className={`flex items-center gap-2 px-4 py-2.5 ${tabConfig.activeBg} text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all`}
          >
            <Plus className="w-4 h-4" />
            Nuevo Deal
          </button>

          <div className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm">
            <Users className="w-4 h-4 text-slate-400" />
            {filtered.length}
          </div>
        </div>
      </div>

      {/* ─── Pipeline Tabs ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-1 bg-slate-100/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
        {PIPELINE_TYPES.map(pipe => {
          const conf = TAB_CONFIG[pipe.id]
          const Icon = conf.icon
          const isActive = activeTab === pipe.id
          const count = deals.filter(d => d.pipeline_type === pipe.id).length // quick visual count

          return (
            <button
              key={pipe.id}
              onClick={() => toggleTab(pipe.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex-1 justify-center
                ${isActive
                  ? `${conf.activeBg} text-white shadow-lg`
                  : `text-slate-600 dark:text-slate-300 ${conf.hoverBg}`
                }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{pipe.label}</span>
              {isActive && filtered.length > 0 && (
                <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {filtered.filter(d => d.status === 'active').length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Filter Bar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-full sm:w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar contacto, propiedad, título..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasFilters && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
          </button>

          {/* Column visibility */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(!showColMenu)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${showColMenu
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Columns3 className="w-4 h-4" />
              Columnas
              {visibleCols.length < allColumns.length && (
                <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-full">
                  {visibleCols.length}/{allColumns.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showColMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 overflow-hidden"
                  >
                    <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Columnas visibles</span>
                      <button
                        onClick={() => {
                          const all = allColumns.map(c => c.id)
                          setVisibleCols(all)
                          saveVisibleCols(activeTab, all)
                        }}
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        Mostrar todas
                      </button>
                    </div>
                    <div className="py-1 max-h-64 overflow-y-auto">
                      {allColumns.map(col => {
                        const isVis = visibleCols.includes(col.id)
                        const colors = col.isTerminal
                          ? TERMINAL_COLUMN_STYLES[col.id]
                          : STAGE_COLUMN_STYLES[col.color] || {}
                        return (
                          <button key={col.id} onClick={() => toggleCol(col.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left ${!isVis ? 'opacity-50' : ''}`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${isVis ? 'bg-primary border-primary' : 'border-slate-300'}`}>
                              {isVis && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </div>
                            <span className={`w-2 h-2 rounded-full ${colors?.dot || 'bg-slate-400'}`} />
                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 font-medium">{col.label}</span>
                            <span className="text-[10px] text-slate-400 tabular-nums">{getColDeals(col.id).length}</span>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {hasFilters && (
            <button onClick={() => { setSearchTerm(''); setFilterAgent('all'); setFilterStatus('active') }}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200">
              <RotateCcw className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Expandable Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 shadow-sm">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Estado</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                  <option value="active">Activos</option>
                  <option value="won">Ganados</option>
                  <option value="lost">Perdidos</option>
                  <option value="all">Todos</option>
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Agente</label>
                  <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                    <option value="all">Todos los agentes</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Kanban Board ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-[3px] border-slate-200 border-t-primary rounded-full animate-spin" />
            <span className="text-muted-foreground text-sm">Cargando pipeline...</span>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x">
          {allColumns.filter(col => visibleCols.includes(col.id)).map(col => {
            const items = getColDeals(col.id)
            const colors = col.isTerminal
              ? TERMINAL_COLUMN_STYLES[col.id]
              : STAGE_COLUMN_STYLES[col.color] || STAGE_COLUMN_STYLES.slate
            const isOver = dragOverCol === col.id
            const ColIcon = col.id === 'won' ? Trophy : col.id === 'lost' ? XCircle : Zap

            return (
              <div
                key={col.id}
                className={`flex-shrink-0 w-[290px] snap-start rounded-2xl border transition-all duration-200 flex flex-col
                  ${colors.border || ''} ${colors.bg || ''} backdrop-blur-sm
                  ${isOver ? `ring-2 ${colors.ring || ''} border-dashed scale-[1.005]` : ''}`}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className={`${colors.headerBg || ''} rounded-t-[14px] px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <ColIcon className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-semibold text-white text-[13px]">{col.label}</span>
                  </div>
                  <span className="bg-white/25 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2.5 space-y-2 overflow-y-auto max-h-[calc(100vh-380px)] scrollbar-none min-h-[80px]">
                  <AnimatePresence mode="popLayout">
                    {items.length === 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-8 text-slate-300">
                        <div className={`p-3 rounded-full ${colors.iconBg || ''} mb-2`}>
                          <ColIcon className="w-6 h-6 opacity-50" />
                        </div>
                        <p className="text-xs font-medium text-slate-400">Sin deals</p>
                        <p className="text-[10px] text-slate-300 mt-0.5">Arrastra aquí</p>
                      </motion.div>
                    ) : items.map(deal => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        isDragged={draggedId === deal.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onOpenDetail={() => setShowDealDetail(deal)}
                        onNavigateContact={() => deal.contact?.id && navigate(`/crm/contact/${deal.contact.id}`)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── New Deal Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showNewModal && (
          <NewDealModal
            pipelineType={activeTab}
            onClose={() => setShowNewModal(false)}
            onSave={handleNewDeal}
          />
        )}
      </AnimatePresence>

      {/* ─── Deal Detail Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {showDealDetail && (
          <DealDetailDrawer
            deal={showDealDetail}
            pipelineType={activeTab}
            stages={stages}
            onClose={() => setShowDealDetail(null)}
            onUpdate={(updated) => {
              setDeals(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
              setShowDealDetail(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Deal Card ──────────────────────────────────────────────────────────────

function DealCard({ deal, isDragged, onDragStart, onDragEnd, onOpenDetail, onNavigateContact }) {
  const [expanded, setExpanded] = useState(false)
  const contactName = `${deal.contact?.first_name || ''} ${deal.contact?.last_name || ''}`.trim()
  const initials = `${(deal.contact?.first_name || '?')[0]}${(deal.contact?.last_name || '')[0] || ''}`.toUpperCase()
  const hue = contactName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360

  const daysInStage = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24))
  const skippedCount = (deal.skipped_stages || []).length

  const formatAmount = (n) => {
    if (!n) return null
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragged ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      draggable
      onDragStart={e => onDragStart(e, deal.id)}
      onDragEnd={onDragEnd}
      className={`group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700
        hover:shadow-md transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing
        ${isDragged ? 'shadow-lg ring-2 ring-primary/30 rotate-[1deg]' : 'shadow-sm hover:border-slate-300'}`}
    >
      <div className="p-3">
        {/* Title row */}
        {deal.title && (
          <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100 truncate mb-1.5 leading-tight">
            {deal.title}
          </p>
        )}

        {/* Contact */}
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 52%), hsl(${hue + 25}, 65%, 42%))` }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[13px] text-slate-900 dark:text-white truncate leading-tight">
              {contactName || 'Sin contacto'}
            </p>
            {deal.contact?.email && (
              <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                <Mail className="w-3 h-3 shrink-0 opacity-60" />
                {deal.contact.email}
              </p>
            )}
          </div>
          <GripVertical className="w-3.5 h-3.5 text-slate-200 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Property + badges */}
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {deal.property?.address && (
            <span className="text-[10px] font-medium px-1.5 py-[1px] rounded bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-0.5 truncate max-w-[180px]">
              <Building2 className="w-2.5 h-2.5 shrink-0" />
              {deal.property.address}
            </span>
          )}
          {deal.mandate && (
            <span className="text-[10px] font-medium px-1.5 py-[1px] rounded bg-violet-50 text-violet-600 border border-violet-200 flex items-center gap-0.5">
              <FileSignature className="w-2.5 h-2.5" />
              Mandato
            </span>
          )}
          {deal.amount && (
            <span className="text-[10px] font-medium px-1.5 py-[1px] rounded bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-0.5">
              <DollarSign className="w-2.5 h-2.5" />
              {formatAmount(deal.amount)}
            </span>
          )}
          {daysInStage > 0 && (
            <span className={`text-[10px] font-medium px-1.5 py-[1px] rounded border flex items-center gap-0.5
              ${daysInStage > 14 ? 'bg-red-50 text-red-600 border-red-200' : daysInStage > 7 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              <Clock className="w-2.5 h-2.5" />
              {daysInStage}d
            </span>
          )}
          {skippedCount > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-[1px] rounded bg-orange-50 text-orange-600 border border-orange-200 flex items-center gap-0.5">
              <SkipForward className="w-2.5 h-2.5" />
              {skippedCount} salto{skippedCount > 1 ? 's' : ''}
            </span>
          )}
          {deal.contact?.rating && (
            <span className="text-[10px] font-bold px-1.5 py-[1px] rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
              {deal.contact.rating}
            </span>
          )}
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-2 space-y-1 border-t border-slate-100 dark:border-slate-700 pt-2 text-[11px] text-slate-500">
              {deal.contact?.phone && (
                <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 opacity-50" />{deal.contact.phone}</p>
              )}
              {deal.property?.commune && (
                <p className="flex items-center gap-1.5"><Building2 className="w-3 h-3 opacity-50" />{deal.property.commune}</p>
              )}
              {deal.notes && (
                <p className="italic text-slate-400 line-clamp-2 mt-1">"{deal.notes}"</p>
              )}
              {deal.agent && (
                <p className="flex items-center gap-1.5"><User className="w-3 h-3 opacity-50" />Agente: <span className="font-medium text-slate-700 dark:text-slate-300">{deal.agent.first_name} {deal.agent.last_name}</span></p>
              )}
              <p className="text-[10px] text-slate-400 pt-0.5">Creado: {new Date(deal.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <button onClick={e => { e.stopPropagation(); setExpanded(!expanded) }} onPointerDown={e => e.stopPropagation()}
          className="flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors font-medium py-0.5">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Menos' : 'Más'}
        </button>
        <div className="flex items-center gap-1">
          {deal.contact?.id && (
            <button onClick={e => { e.stopPropagation(); onNavigateContact() }} onPointerDown={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 rounded-md transition-colors">
              <User className="w-3 h-3" /> Contacto
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onOpenDetail() }} onPointerDown={e => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-md transition-colors">
            Ver detalle <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── New Deal Modal ──────────────────────────────────────────────────────────

function NewDealModal({ pipelineType, onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [contactId, setContactId] = useState(null)
  const [propertyId, setPropertyId] = useState(null)
  const [saving, setSaving] = useState(false)

  const pipeLabel = PIPELINE_TYPES.find(p => p.id === pipelineType)?.label || ''
  const conf = TAB_CONFIG[pipelineType]
  const Icon = conf.icon

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!contactId) { toast.error('Selecciona un contacto'); return }
    setSaving(true)
    await onSave({ contactId, propertyId, title: title || null, amount: amount ? parseFloat(amount) : null, notes: notes || null })
    setSaving(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r ${conf.gradient}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Nuevo Deal — {pipeLabel}</h3>
              <p className="text-xs text-white/70">Crear nuevo negocio en el pipeline</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Contact picker */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Contacto *</label>
            <ContactPickerInline
              label="Seleccionar contacto"
              onSelectContact={(c) => setContactId(c?.id || null)}
            />
          </div>

          {/* Property picker */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Propiedad (opcional)</label>
            <PropertyPickerInline
              label="Seleccionar propiedad"
              onSelectProperty={(p) => setPropertyId(p?.id || null)}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Título del Deal</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="Ej: Venta Depto Las Condes — Juan Pérez" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Monto Estimado (CLP)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="Ej: 150000000" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Observaciones iniciales..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className={`px-6 py-2.5 rounded-xl ${conf.activeBg} text-white text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 transition-all`}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Creando...</> : 'Crear Deal'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Deal Detail Drawer ──────────────────────────────────────────────────────

function DealDetailDrawer({ deal, pipelineType, stages, onClose, onUpdate }) {
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    (async () => {
      setLoadingHistory(true)
      try {
        const data = await fetchDealHistory(deal.id)
        setHistory(data)
      } catch (err) {
        console.error(err)
      }
      setLoadingHistory(false)
    })()
  }, [deal.id])

  const contactName = `${deal.contact?.first_name || ''} ${deal.contact?.last_name || ''}`.trim()
  const stageLabelMap = {}
  stages.forEach(s => { stageLabelMap[s.id] = s.label })
  stageLabelMap['won'] = 'Ganado'
  stageLabelMap['lost'] = 'Perdido'
  stageLabelMap['reactivated'] = 'Reactivado'

  const currentStageLabel = stageLabelMap[deal.current_stage] || deal.current_stage

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ y: 50, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 50, scale: 0.97 }}
        className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Detalle del Deal</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {deal.title && <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{deal.title}</p>}

          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${deal.status === 'won' ? 'bg-emerald-100 text-emerald-700' : deal.status === 'lost' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
              {deal.status === 'won' ? 'Ganado' : deal.status === 'lost' ? 'Perdido' : currentStageLabel}
            </span>
            {deal.amount && (
              <span className="text-xs font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(deal.amount)}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Contact info */}
          {deal.contact && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase">Contacto</span>
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">{contactName}</p>
              {deal.contact.email && <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{deal.contact.email}</p>}
              {deal.contact.phone && <p className="text-sm text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{deal.contact.phone}</p>}
            </div>
          )}

          {/* Property info */}
          {deal.property && (
            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-blue-500 uppercase">Propiedad</span>
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">{deal.property.address}</p>
              {deal.property.commune && <p className="text-sm text-slate-500">{deal.property.commune}</p>}
            </div>
          )}

          {/* Mandate */}
          {deal.mandate && (
            <div className="bg-violet-50/50 dark:bg-violet-900/10 rounded-xl p-4 border border-violet-100 dark:border-violet-900/30">
              <div className="flex items-center gap-2 mb-2">
                <FileSignature className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-semibold text-violet-500 uppercase">Mandato Vinculado</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Tipo: <span className="font-medium">{deal.mandate.capture_type}</span> — Estado: <span className="font-medium">{deal.mandate.status}</span>
              </p>
              {deal.mandate.start_date && (
                <p className="text-xs text-slate-500 mt-1">
                  Fecha captación: {new Date(deal.mandate.start_date).toLocaleDateString('es-CL')}
                </p>
              )}
            </div>
          )}

          {/* Stage Progress */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase">Progreso de Etapas</span>
            </div>
            <div className="space-y-1">
              {stages.map((stage, i) => {
                const isSkipped = (deal.skipped_stages || []).includes(stage.id)
                const stageIndex = stages.findIndex(s => s.id === deal.current_stage)
                const thisIndex = i
                const isPast = thisIndex < stageIndex
                const isCurrent = stage.id === deal.current_stage
                const isFuture = thisIndex > stageIndex
                const colors = STAGE_COLUMN_STYLES[stage.color] || {}

                return (
                  <div key={stage.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all
                    ${isCurrent ? 'bg-primary/10 font-semibold text-primary ring-1 ring-primary/20' : ''}
                    ${isPast && !isSkipped ? 'text-slate-500' : ''}
                    ${isSkipped ? 'text-slate-300 line-through' : ''}
                    ${isFuture ? 'text-slate-400' : ''}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border
                      ${isCurrent ? 'bg-primary text-white border-primary' : ''}
                      ${isPast && !isSkipped ? `${colors.dot || 'bg-slate-400'} text-white border-transparent` : ''}
                      ${isSkipped ? 'bg-slate-100 text-slate-300 border-slate-200' : ''}
                      ${isFuture ? 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600' : ''}`}>
                      {isSkipped ? <SkipForward className="w-3 h-3" /> : isPast ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className="flex-1">{stage.label}</span>
                    {isSkipped && <span className="text-[10px] text-orange-500">Omitida</span>}
                    {isCurrent && <span className="text-[10px] text-primary font-bold">Actual</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* History */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase">Historial de Movimientos</span>
            </div>
            {loadingHistory ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Sin historial aún</p>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={h.id} className="flex items-start gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-slate-700 dark:text-slate-200">
                        {h.from_stage ? (
                          <><span className="text-slate-400">{stageLabelMap[h.from_stage] || h.from_stage}</span> → <span className="font-medium">{stageLabelMap[h.to_stage] || h.to_stage}</span></>
                        ) : (
                          <span className="font-medium">{stageLabelMap[h.to_stage] || h.to_stage}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(h.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {h.profiles && ` — ${h.profiles.first_name} ${h.profiles.last_name}`}
                      </p>
                      {h.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{h.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {deal.notes && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase">Notas</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border">{deal.notes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
