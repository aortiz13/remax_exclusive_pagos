import { useState, useCallback, useMemo } from 'react'

/**
 * useRowSelection — Manages multi-row selection state for CRM tables.
 * Works with any entity that has an `id` field.
 */
export default function useRowSelection() {
  const [selectedIds, setSelectedIds] = useState(new Set())

  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds])

  const toggle = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((ids) => {
    setSelectedIds(new Set(ids))
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const toggleAll = useCallback((ids) => {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }, [])

  const isAllSelected = useCallback((ids) => {
    if (ids.length === 0) return false
    return ids.every(id => selectedIds.has(id))
  }, [selectedIds])

  const count = useMemo(() => selectedIds.size, [selectedIds])

  return {
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    toggleAll,
    isAllSelected,
    count,
  }
}
