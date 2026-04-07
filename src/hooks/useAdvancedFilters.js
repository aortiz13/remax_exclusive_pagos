import { useState, useCallback, useMemo } from 'react'
import { OPERATORS_BY_TYPE, operatorNeedsValue } from '../components/crm/filterConfigs'

/**
 * Generate a unique ID for filter groups/conditions.
 */
let _fid = 0
function nextId() {
  return `f_${Date.now()}_${++_fid}`
}

/**
 * Create a new empty filter condition.
 */
export function createFilter() {
  return { id: nextId(), property: '', operator: '', value: '', value2: '' }
}

/**
 * Create a new filter group with one empty condition.
 */
export function createFilterGroup() {
  return { id: nextId(), filters: [createFilter()] }
}

/**
 * Resolve nested property access like "contact.source"
 */
function getNestedValue(item, key) {
  if (!key.includes('.')) return item[key]
  const parts = key.split('.')
  let val = item
  for (const p of parts) {
    if (val == null) return undefined
    val = val[p]
  }
  return val
}

/**
 * Evaluate a single filter condition against an item.
 */
function evaluateFilter(item, filter, filterConfig) {
  const { property, operator, value, value2 } = filter
  if (!property || !operator) return true // incomplete filter, pass through

  // Look up field config
  const fieldConfig = filterConfig.find(f => f.key === property)
  if (!fieldConfig) return true

  const rawVal = getNestedValue(item, property)

  // Handle empty/not-empty first (works for all types)
  if (operator === 'is_empty') {
    return rawVal == null || rawVal === '' || (Array.isArray(rawVal) && rawVal.length === 0)
  }
  if (operator === 'is_not_empty') {
    return rawVal != null && rawVal !== '' && !(Array.isArray(rawVal) && rawVal.length === 0)
  }

  // Boolean operators
  if (operator === 'is_true') return rawVal === true
  if (operator === 'is_false') return rawVal === false || rawVal == null

  // If operator needs value but none provided, pass through
  if (operatorNeedsValue(operator) && (value === '' || value == null)) return true

  const type = fieldConfig.type

  // ──── TEXT ────
  if (type === 'text') {
    const itemStr = String(rawVal ?? '').toLowerCase()
    const filterStr = String(value).toLowerCase()
    switch (operator) {
      case 'contains': return itemStr.includes(filterStr)
      case 'not_contains': return !itemStr.includes(filterStr)
      case 'equals': return itemStr === filterStr
      case 'not_equals': return itemStr !== filterStr
      case 'starts_with': return itemStr.startsWith(filterStr)
      default: return true
    }
  }

  // ──── SELECT ────
  if (type === 'select') {
    const itemStr = String(rawVal ?? '').toLowerCase()
    const filterVal = String(value).toLowerCase()
    // Support comma-separated multi-values (e.g. "Comprar, Vender")
    const isMultiValue = itemStr.includes(',')
    switch (operator) {
      case 'equals': return isMultiValue ? itemStr.includes(filterVal) : itemStr === filterVal
      case 'not_equals': return isMultiValue ? !itemStr.includes(filterVal) : itemStr !== filterVal
      case 'is_any_of': {
        const vals = Array.isArray(value) ? value : [value]
        return vals.some(v => itemStr.includes(String(v).toLowerCase()))
      }
      default: return true
    }
  }

  // ──── MULTISELECT (array fields like properties.status) ────
  if (type === 'multiselect') {
    const arr = Array.isArray(rawVal) ? rawVal.map(s => String(s).toLowerCase()) : []
    const filterStr = String(value).toLowerCase()
    switch (operator) {
      case 'contains': return arr.some(s => s.includes(filterStr))
      case 'not_contains': return !arr.some(s => s.includes(filterStr))
      case 'is_any_of': {
        const vals = Array.isArray(value) ? value.map(v => String(v).toLowerCase()) : [filterStr]
        return vals.some(v => arr.includes(v))
      }
      default: return true
    }
  }

  // ──── NUMBER ────
  if (type === 'number') {
    const num = parseFloat(rawVal)
    const filterNum = parseFloat(value)
    if (isNaN(num)) return operator === 'is_empty'
    if (isNaN(filterNum) && operator !== 'between') return true
    switch (operator) {
      case 'equals': return num === filterNum
      case 'not_equals': return num !== filterNum
      case 'greater_than': return num > filterNum
      case 'less_than': return num < filterNum
      case 'between': {
        const num2 = parseFloat(value2)
        if (isNaN(filterNum) || isNaN(num2)) return true
        return num >= filterNum && num <= num2
      }
      default: return true
    }
  }

  // ──── DATE ────
  if (type === 'date') {
    const itemDate = rawVal ? new Date(rawVal) : null
    if (!itemDate || isNaN(itemDate.getTime())) return operator === 'is_empty'

    switch (operator) {
      case 'equals': {
        const filterDate = new Date(value)
        return itemDate.toDateString() === filterDate.toDateString()
      }
      case 'before': {
        const filterDate = new Date(value)
        return itemDate < filterDate
      }
      case 'after': {
        const filterDate = new Date(value)
        return itemDate > filterDate
      }
      case 'between': {
        const d1 = new Date(value)
        const d2 = new Date(value2)
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return true
        return itemDate >= d1 && itemDate <= d2
      }
      case 'last_n_days': {
        const days = parseInt(value, 10)
        if (isNaN(days)) return true
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        return itemDate >= cutoff
      }
      default: return true
    }
  }

  return true
}

/**
 * useAdvancedFilters — custom hook for HubSpot-style multi-filter logic.
 *
 * @param {Array} filterConfig - from filterConfigs.js
 * @returns {Object} filter state, setters, and applyFilters function
 */
export default function useAdvancedFilters(filterConfig) {
  const [filterGroups, setFilterGroups] = useState([createFilterGroup()])

  /** Count non-empty (active) filters */
  const activeFilterCount = useMemo(() => {
    let count = 0
    for (const group of filterGroups) {
      for (const filter of group.filters) {
        if (filter.property && filter.operator) count++
      }
    }
    return count
  }, [filterGroups])

  /** Check if any filters are active */
  const hasActiveFilters = activeFilterCount > 0

  /** Add a new filter condition to a group */
  const addFilter = useCallback((groupId) => {
    setFilterGroups(groups =>
      groups.map(g =>
        g.id === groupId
          ? { ...g, filters: [...g.filters, createFilter()] }
          : g
      )
    )
  }, [])

  /** Remove a filter condition from a group */
  const removeFilter = useCallback((groupId, filterId) => {
    setFilterGroups(groups =>
      groups.map(g => {
        if (g.id !== groupId) return g
        const remaining = g.filters.filter(f => f.id !== filterId)
        // Keep at least one empty filter per group
        return { ...g, filters: remaining.length > 0 ? remaining : [createFilter()] }
      })
    )
  }, [])

  /** Update a filter condition */
  const updateFilter = useCallback((groupId, filterId, updates) => {
    setFilterGroups(groups =>
      groups.map(g => {
        if (g.id !== groupId) return g
        return {
          ...g,
          filters: g.filters.map(f => {
            if (f.id !== filterId) return f
            const updated = { ...f, ...updates }
            // When property changes, reset operator and value
            if ('property' in updates && updates.property !== f.property) {
              const fieldConfig = filterConfig.find(fc => fc.key === updates.property)
              const defaultOp = fieldConfig ? OPERATORS_BY_TYPE[fieldConfig.type]?.[0]?.value || '' : ''
              updated.operator = defaultOp
              updated.value = ''
              updated.value2 = ''
            }
            // When operator changes, reset value if switching to/from no-value operators
            if ('operator' in updates && updates.operator !== f.operator) {
              if (!operatorNeedsValue(updates.operator)) {
                updated.value = ''
                updated.value2 = ''
              }
            }
            return updated
          }),
        }
      })
    )
  }, [filterConfig])

  /** Add a new OR group */
  const addGroup = useCallback(() => {
    setFilterGroups(groups => [...groups, createFilterGroup()])
  }, [])

  /** Remove an OR group */
  const removeGroup = useCallback((groupId) => {
    setFilterGroups(groups => {
      const remaining = groups.filter(g => g.id !== groupId)
      return remaining.length > 0 ? remaining : [createFilterGroup()]
    })
  }, [])

  /** Clear all filters */
  const clearAll = useCallback(() => {
    setFilterGroups([createFilterGroup()])
  }, [])

  /**
   * Apply filter groups to an array of items.
   * Groups use OR logic. Filters within a group use AND logic.
   */
  const applyFilters = useCallback((items) => {
    if (!hasActiveFilters) return items

    return items.filter(item => {
      // OR across groups — item passes if it matches ANY group
      return filterGroups.some(group => {
        // AND within a group — item must match ALL filters in the group
        return group.filters.every(filter => {
          if (!filter.property || !filter.operator) return true // skip incomplete
          return evaluateFilter(item, filter, filterConfig)
        })
      })
    })
  }, [filterGroups, hasActiveFilters, filterConfig])

  /** Get flat list of active filters with their group info (for pills) */
  const activeFilters = useMemo(() => {
    const result = []
    for (const group of filterGroups) {
      for (const filter of group.filters) {
        if (filter.property && filter.operator) {
          const fieldConfig = filterConfig.find(f => f.key === filter.property)
          result.push({
            ...filter,
            groupId: group.id,
            fieldLabel: fieldConfig?.label || filter.property,
            fieldConfig,
          })
        }
      }
    }
    return result
  }, [filterGroups, filterConfig])

  return {
    filterGroups,
    setFilterGroups,
    activeFilterCount,
    hasActiveFilters,
    addFilter,
    removeFilter,
    updateFilter,
    addGroup,
    removeGroup,
    clearAll,
    applyFilters,
    activeFilters,
  }
}
