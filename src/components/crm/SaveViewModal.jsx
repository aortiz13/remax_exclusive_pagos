import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Button, Input, Label } from '@/components/ui'
import { X, Bookmark, Loader2, CheckCircle2  } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'

/**
 * SaveViewModal — Save current filter/sort/column state as a named view.
 *
 * @param {boolean}  isOpen
 * @param {Function} onClose
 * @param {string}   module        - 'contacts' | 'properties' | 'leads'
 * @param {Array}    filterGroups  - current filter groups from useAdvancedFilters
 * @param {string}   sortOrder     - current sort order
 * @param {Array}    columnConfig  - current column visibility config (optional)
 * @param {Function} onSaved       - callback when save succeeds
 */
export default function SaveViewModal({
  isOpen,
  onClose,
  module,
  filterGroups,
  sortOrder,
  columnConfig,
  onSaved,
}) {
  const { profile, user } = useAuth()
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Ingrese un nombre para la vista')
      return
    }

    setSaving(true)
    try {
      const agentId = profile?.id || user?.id

      // If is_default, unset any existing default for this module
      if (isDefault) {
        await supabase
          .from('crm_saved_views')
          .update({ is_default: false })
          .eq('agent_id', agentId)
          .eq('module', module)
          .eq('is_default', true)
      }

      const { error } = await supabase
        .from('crm_saved_views')
        .insert({
          agent_id: agentId,
          name: name.trim(),
          module,
          filter_groups: filterGroups,
          sort_order: sortOrder || 'newest',
          column_config: columnConfig || null,
          is_default: isDefault,
        })

      if (error) throw error

      toast.success('Vista guardada exitosamente')
      if (onSaved) onSaved()
      onClose()
    } catch (err) {
      console.error('Error saving view:', err)
      toast.error(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative z-50 border border-slate-200 dark:border-slate-700"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center">
                <Bookmark className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">Guardar Vista</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nombre de la vista</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Contactos activos en Ñuñoa"
              className="h-10"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-300"
              id="defaultView"
            />
            <label htmlFor="defaultView" className="text-sm text-slate-600 dark:text-slate-400">
              Vista predeterminada para {module === 'contacts' ? 'Contactos' : module === 'properties' ? 'Propiedades' : 'Leads'}
            </label>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Se guardarán los filtros y orden actuales. Al seleccionar esta vista, se restaurarán automáticamente.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
            Guardar
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
