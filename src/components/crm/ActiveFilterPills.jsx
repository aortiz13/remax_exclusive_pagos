import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui'
import { OPERATORS_BY_TYPE } from './filterConfigs'

/**
 * Renders active filter pills with remove buttons.
 */
export default function ActiveFilterPills({ activeFilters, onRemove, onClearAll }) {
  if (!activeFilters || activeFilters.length === 0) return null

  const getOperatorLabel = (filter) => {
    const fieldType = filter.fieldConfig?.type || 'text'
    const ops = OPERATORS_BY_TYPE[fieldType] || []
    const op = ops.find(o => o.value === filter.operator)
    return op?.label || filter.operator
  }

  const getValueLabel = (filter) => {
    if (['is_empty', 'is_not_empty'].includes(filter.operator)) return ''
    if (filter.operator === 'is_true') {
      return filter.fieldConfig?.trueLabel || 'Sí'
    }
    if (filter.operator === 'is_false') {
      return filter.fieldConfig?.falseLabel || 'No'
    }
    if (filter.operator === 'between') {
      return `${filter.value} - ${filter.value2}`
    }
    if (filter.operator === 'last_n_days') {
      return `${filter.value} días`
    }
    if (Array.isArray(filter.value)) {
      return filter.value.join(', ')
    }
    return String(filter.value || '')
  }

  return (
    <div className="flex items-center gap-2 flex-wrap px-1">
      {activeFilters.map((filter) => {
        const opLabel = getOperatorLabel(filter)
        const valLabel = getValueLabel(filter)
        return (
          <span
            key={filter.id}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-all hover:bg-blue-100 dark:hover:bg-blue-950/60"
          >
            <span className="font-semibold">{filter.fieldLabel}</span>
            <span className="text-blue-400 dark:text-blue-500">{opLabel}</span>
            {valLabel && (
              <span className="text-blue-600 dark:text-blue-200 max-w-[120px] truncate">"{valLabel}"</span>
            )}
            <button
              onClick={() => onRemove(filter.groupId, filter.id)}
              className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )
      })}
      {activeFilters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 px-2"
        >
          Limpiar todos
        </Button>
      )}
    </div>
  )
}
