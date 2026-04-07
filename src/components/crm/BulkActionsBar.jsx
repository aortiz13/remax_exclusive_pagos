import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui'
import {
  Download, Mail, ListTodo, Activity, Bookmark, Shuffle, X, CheckSquare
} from 'lucide-react'

/**
 * BulkActionsBar — Floating action bar that appears when rows are selected.
 *
 * @param {number}   count          - number of selected items
 * @param {Function} onDeselectAll  - clear selection
 * @param {Function} onExport       - export selected to Excel
 * @param {Function} onBulkEmail    - open bulk email modal (null to hide)
 * @param {Function} onBulkTask     - open bulk task modal (null to hide)
 * @param {Function} onBulkAction   - open bulk action modal (null to hide)
 * @param {Function} onSaveView     - open save view modal (null to hide)
 */
export default function BulkActionsBar({
  count = 0,
  onDeselectAll,
  onExport,
  onBulkEmail,
  onBulkTask,
  onBulkAction,
  onSaveView,
}) {
  if (count === 0) return null

  const actions = [
    { icon: Download, label: 'Exportar Excel', onClick: onExport, color: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
    onBulkEmail && { icon: Mail, label: 'Email Masivo', onClick: onBulkEmail, color: 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30' },
    onBulkTask && { icon: ListTodo, label: 'Tarea Masiva', onClick: onBulkTask, color: 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30' },
    onBulkAction && { icon: Activity, label: 'Acción Masiva', onClick: onBulkAction, color: 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30' },
    onSaveView && { icon: Bookmark, label: 'Guardar Vista', onClick: onSaveView, color: 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30' },
  ].filter(Boolean)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        // The wrapper spans the available space: from the sidebar (approx 260px) to the right edge (minus chat widget).
        // It uses flex justify-center to center intuitively within this space.
        className="fixed bottom-6 left-0 right-0 md:left-[260px] z-[100] pointer-events-none flex justify-center pr-4 md:pr-20"
      >
        <div className="flex flex-nowrap items-center gap-1 md:gap-2 px-3 py-2.5 md:px-4 md:py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 dark:shadow-slate-950/50 pointer-events-auto overflow-x-auto no-scrollbar">
          {/* Selection count */}
          <div className="flex items-center gap-2 pr-2 md:pr-3 border-r border-slate-200 dark:border-slate-700 shrink-0">
            <div className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-lg bg-blue-600 text-white">
              <CheckSquare className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">
                {count}
              </span>
              <span className="text-[9px] md:text-[10px] text-slate-500 leading-tight">
                seleccionado{count > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
            {actions.map((action, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                onClick={action.onClick}
                className={`h-8 md:h-9 gap-1.5 px-2 md:px-3 text-xs font-medium transition-all ${action.color}`}
              >
                <action.icon className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline">{action.label}</span>
              </Button>
            ))}
          </div>

          {/* Deselect */}
          <div className="pl-1 md:pl-2 border-l border-slate-200 dark:border-slate-700 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              title="Deseleccionar todo"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
