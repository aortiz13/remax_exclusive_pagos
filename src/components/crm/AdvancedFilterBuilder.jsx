import React, { useState } from 'react'
import { Filter, Plus, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from '@/components/ui'
import { OPERATORS_BY_TYPE, operatorNeedsValue, operatorNeedsTwoValues } from './filterConfigs'

/**
 * AdvancedFilterBuilder — HubSpot-style filter builder with AND/OR groups.
 *
 * @param {Object} props
 * @param {Array}  props.filterConfig      - field definitions from filterConfigs.js
 * @param {Array}  props.filterGroups      - current filter groups state
 * @param {Function} props.addFilter       - add filter to group
 * @param {Function} props.removeFilter    - remove filter from group
 * @param {Function} props.updateFilter    - update filter condition
 * @param {Function} props.addGroup        - add OR group
 * @param {Function} props.removeGroup     - remove OR group
 * @param {Function} props.clearAll        - clear all filters
 * @param {number}   props.activeFilterCount
 */
export default function AdvancedFilterBuilder({
  filterConfig,
  filterGroups,
  addFilter,
  removeFilter,
  updateFilter,
  addGroup,
  removeGroup,
  clearAll,
  activeFilterCount,
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      {/* Trigger Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={`border-dashed bg-white dark:bg-slate-950 gap-2 transition-all ${
          activeFilterCount > 0
            ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20'
            : ''
        }`}
      >
        <Filter className="h-4 w-4" />
        Filtros
        {activeFilterCount > 0 && (
          <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] bg-blue-600 text-white hover:bg-blue-600 rounded-full">
            {activeFilterCount}
          </Badge>
        )}
        {isOpen ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
      </Button>

      {/* Filter Builder Panel */}
      {isOpen && (
        <div className="fixed md:absolute inset-0 md:inset-auto md:top-full md:left-0 md:mt-2 z-50 flex items-end md:items-start justify-center md:justify-start">
          {/* Backdrop (mobile only) */}
          <div className="fixed inset-0 bg-black/30 md:hidden" onClick={() => setIsOpen(false)} />
          <div className="relative w-full md:w-[680px] max-h-[80dvh] md:max-h-none bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-700 rounded-t-2xl md:rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom md:slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Filtros Avanzados</span>
              {activeFilterCount > 0 && (
                <span className="text-[10px] text-slate-400">({activeFilterCount} activo{activeFilterCount > 1 ? 's' : ''})</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                  Limpiar todos
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Groups */}
          <div className="px-4 py-3 max-h-[60vh] overflow-y-auto space-y-3">
            {filterGroups.map((group, groupIndex) => (
              <div key={group.id}>
                {/* OR separator between groups */}
                {groupIndex > 0 && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent dark:via-amber-700" />
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">O</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent dark:via-amber-700" />
                  </div>
                )}

                {/* Group card */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-100/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Grupo {groupIndex + 1}
                    </span>
                    {filterGroups.length > 1 && (
                      <button
                        onClick={() => removeGroup(group.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-colors"
                        title="Eliminar grupo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filters in group */}
                  <div className="p-3 space-y-2">
                    {group.filters.map((filter, filterIndex) => (
                      <div key={filter.id}>
                        {/* AND separator between filters */}
                        {filterIndex > 0 && (
                          <div className="flex items-center gap-2 py-1 pl-2">
                            <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest">Y</span>
                            <div className="flex-1 h-px bg-blue-100 dark:bg-blue-900" />
                          </div>
                        )}

                        <FilterRow
                          filter={filter}
                          filterConfig={filterConfig}
                          onUpdate={(updates) => updateFilter(group.id, filter.id, updates)}
                          onRemove={() => removeFilter(group.id, filter.id)}
                          canRemove={group.filters.length > 1}
                        />
                      </div>
                    ))}

                    {/* Add AND filter */}
                    <button
                      onClick={() => addFilter(group.id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 mt-1 pl-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar condición
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
            <button
              onClick={addGroup}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar grupo OR
            </button>
            <Button size="sm" onClick={() => setIsOpen(false)} className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              Aplicar
            </Button>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}


/**
 * Single filter row: Property → Operator → Value
 */
function FilterRow({ filter, filterConfig, onUpdate, onRemove, canRemove }) {
  const selectedField = filterConfig.find(f => f.key === filter.property)
  const fieldType = selectedField?.type || 'text'
  const operators = OPERATORS_BY_TYPE[fieldType] || []
  const needsValue = filter.operator ? operatorNeedsValue(filter.operator) : false
  const needsTwoValues = filter.operator ? operatorNeedsTwoValues(filter.operator) : false

  return (
    <div className="flex flex-wrap items-start gap-2">
      {/* Property selector */}
      <Select value={filter.property} onValueChange={(val) => onUpdate({ property: val })}>
        <SelectTrigger className="w-full md:w-[160px] h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shrink-0">
          <SelectValue placeholder="Propiedad..." />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {filterConfig.map(field => (
            <SelectItem key={field.key} value={field.key} className="text-xs">
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      {filter.property && (
        <Select value={filter.operator} onValueChange={(val) => onUpdate({ operator: val })}>
          <SelectTrigger className="w-full md:w-[140px] h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shrink-0">
            <SelectValue placeholder="Condición..." />
          </SelectTrigger>
          <SelectContent>
            {operators.map(op => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Value input(s) */}
      {filter.property && filter.operator && needsValue && (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <ValueInput
            fieldConfig={selectedField}
            value={filter.value}
            onChange={(val) => onUpdate({ value: val })}
          />
          {needsTwoValues && (
            <>
              <span className="text-[10px] text-slate-400 shrink-0">y</span>
              <ValueInput
                fieldConfig={selectedField}
                value={filter.value2}
                onChange={(val) => onUpdate({ value2: val })}
              />
            </>
          )}
        </div>
      )}

      {/* Remove button */}
      {canRemove && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-950/30 text-slate-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}


/**
 * Dynamic value input based on field type.
 */
function ValueInput({ fieldConfig, value, onChange }) {
  if (!fieldConfig) return null

  const type = fieldConfig.type

  // Select / Multiselect → dropdown
  if ((type === 'select' || type === 'multiselect') && fieldConfig.options) {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex-1 min-w-[120px]">
          <SelectValue placeholder="Valor..." />
        </SelectTrigger>
        <SelectContent className="max-h-[250px]">
          {fieldConfig.options.map(opt => (
            <SelectItem key={opt} value={opt} className="text-xs">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Number
  if (type === 'number') {
    return (
      <Input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Valor..."
        className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex-1 min-w-[80px]"
      />
    )
  }

  // Date
  if (type === 'date') {
    return (
      <Input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex-1 min-w-[130px]"
      />
    )
  }

  // Default: text
  return (
    <Input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Valor..."
      className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex-1 min-w-[100px]"
    />
  )
}
