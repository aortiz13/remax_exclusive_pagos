import React, { useState, useEffect } from 'react'
import { Button, Badge } from '@/components/ui'
import {
  Bookmark, Plus, X, MoreHorizontal, Star, Trash2, Pencil
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'

/**
 * SavedViewsTabs — Horizontal tabs for saved filter views.
 *
 * @param {string}   module          - 'contacts' | 'properties' | 'leads'
 * @param {Function} onLoadView      - (filterGroups, sortOrder) => void — called when a view is selected
 * @param {Function} onSaveView      - () => void — opens save modal
 * @param {boolean}  hasActiveFilters - whether there are active (unsaved) filters
 */
export default function SavedViewsTabs({
  module,
  onLoadView,
  onSaveView,
  hasActiveFilters,
}) {
  const { profile, user } = useAuth()
  const [views, setViews] = useState([])
  const [activeViewId, setActiveViewId] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchViews = async () => {
    const agentId = profile?.id || user?.id
    if (!agentId) return

    const { data, error } = await supabase
      .from('crm_saved_views')
      .select('*')
      .eq('agent_id', agentId)
      .eq('module', module)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching views:', error)
      setLoading(false)
      return
    }

    setViews(data || [])
    setLoading(false)

    // Auto-load default view if no filters active
    if (!hasActiveFilters) {
      const defaultView = (data || []).find(v => v.is_default)
      if (defaultView) {
        setActiveViewId(defaultView.id)
        onLoadView(defaultView.filter_groups, defaultView.sort_order)
      }
    }
  }

  useEffect(() => {
    fetchViews()
  }, [module, profile?.id])

  const handleSelectView = (view) => {
    if (activeViewId === view.id) {
      // Deselect - reset to no view
      setActiveViewId(null)
      onLoadView(null, null)
      return
    }
    setActiveViewId(view.id)
    onLoadView(view.filter_groups, view.sort_order)
  }

  const handleDelete = async (viewId) => {
    const { error } = await supabase.from('crm_saved_views').delete().eq('id', viewId)
    if (error) {
      toast.error('Error al eliminar vista')
      return
    }
    toast.success('Vista eliminada')
    if (activeViewId === viewId) {
      setActiveViewId(null)
      onLoadView(null, null)
    }
    setViews(prev => prev.filter(v => v.id !== viewId))
  }

  const handleSetDefault = async (viewId) => {
    const agentId = profile?.id || user?.id
    // Unset all defaults
    await supabase
      .from('crm_saved_views')
      .update({ is_default: false })
      .eq('agent_id', agentId)
      .eq('module', module)

    // Set this one
    await supabase
      .from('crm_saved_views')
      .update({ is_default: true })
      .eq('id', viewId)

    toast.success('Vista predeterminada actualizada')
    fetchViews()
  }

  if (loading || views.length === 0) {
    // Only show save button if there are active filters
    if (hasActiveFilters) {
      return (
        <div className="flex items-center">
          <button
            onClick={onSaveView}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 px-2 py-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Guardar vista
          </button>
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mr-1">Vistas:</span>

      {views.map(view => (
        <div key={view.id} className="group relative">
          <button
            onClick={() => handleSelectView(view)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
              activeViewId === view.id
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            {view.is_default && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
            {view.name}
          </button>

          {/* Hover actions */}
          <div className="absolute -top-1 -right-1 hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleSetDefault(view.id) }}
              className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 flex items-center justify-center shadow-sm"
              title="Hacer predeterminada"
            >
              <Star className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(view.id) }}
              className="w-5 h-5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center shadow-sm"
              title="Eliminar vista"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      ))}

      {/* Save current filters button */}
      {hasActiveFilters && (
        <button
          onClick={onSaveView}
          className="flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 px-2 py-1.5 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Guardar
        </button>
      )}
    </div>
  )
}
