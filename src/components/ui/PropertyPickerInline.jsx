import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Search, Building2, Plus, ChevronDown } from 'lucide-react'
import PropertyForm from '../crm/PropertyForm'

const PROPERTY_TYPES = [
    { key: 'all', label: 'Todos' },
    { key: 'Departamento', label: 'Depto' },
    { key: 'Casa', label: 'Casa' },
    { key: 'Comercial', label: 'Comercial' },
    { key: 'Oficina', label: 'Oficina' },
    { key: 'Terreno', label: 'Terreno' },
]

const MAX_VISIBLE = 20

/** Highlight matching fragments in text */
function HighlightText({ text, searchWords }) {
    if (!text || !searchWords.length) return <>{text}</>

    // Build regex from all search words
    const escaped = searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
    const parts = text.split(regex)

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part)
                    ? <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5 font-semibold">{part}</mark>
                    : <span key={i}>{part}</span>
            )}
        </>
    )
}

export default function PropertyPickerInline({ onSelectProperty, label = 'Pre-llenar desde CRM', value, disabled = false }) {
    const { user } = useAuth()
    const [properties, setProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [selectedId, setSelectedId] = useState(value || '')
    const [isAddingNew, setIsAddingNew] = useState(false)
    const [activeType, setActiveType] = useState('all')
    const [highlightedIndex, setHighlightedIndex] = useState(-1)

    const inputRef = useRef(null)
    const listRef = useRef(null)
    const itemRefs = useRef({})

    useEffect(() => {
        if (value) setSelectedId(value)
    }, [value])

    const fetchProperties = async () => {
        if (!user?.id) return
        const { data, error } = await supabase
            .from('properties')
            .select('id, property_type, address, commune, unit_number, rol_number')
            .order('created_at', { ascending: false })
            .limit(500)

        if (error) {
            console.error('Error fetching properties from CRM:', error)
        } else if (data) {
            setProperties(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchProperties()
    }, [user])

    // Multi-word fuzzy-lite search + type filter
    const searchWords = useMemo(() =>
        searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean),
        [searchTerm]
    )

    const filtered = useMemo(() => {
        let list = properties

        // Filter by property type
        if (activeType !== 'all') {
            list = list.filter(p => p.property_type === activeType)
        }

        // Multi-word search: every word must match somewhere
        if (searchWords.length > 0) {
            list = list.filter(p => {
                const text = `${p.address || ''} ${p.commune || ''} ${p.property_type || ''} ${p.unit_number || ''}`.toLowerCase()
                return searchWords.every(word => text.includes(word))
            })
        }

        return list
    }, [properties, activeType, searchWords])

    // Limited visible items for performance
    const visibleItems = useMemo(() => filtered.slice(0, MAX_VISIBLE), [filtered])

    // Reset highlighted index when filter changes
    useEffect(() => {
        setHighlightedIndex(-1)
    }, [searchTerm, activeType])

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' })
        }
    }, [highlightedIndex])

    const handleSelect = (propertyId) => {
        if (!propertyId) {
            setSelectedId('')
            setIsOpen(false)
            setSearchTerm('')
            setActiveType('all')
            return
        }
        const property = properties.find(p => p.id === propertyId)
        if (property) {
            setSelectedId(propertyId)
            onSelectProperty(property)
            setIsOpen(false)
            setSearchTerm('')
            setActiveType('all')
        }
    }

    const handleKeyDown = useCallback((e) => {
        // Total selectable items: 2 fixed (add new + manual) + visibleItems
        const totalItems = 2 + visibleItems.length

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedIndex(prev => (prev + 1) % totalItems)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedIndex(prev => prev <= 0 ? totalItems - 1 : prev - 1)
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault()
            if (highlightedIndex === 0) {
                // "Agregar nueva propiedad"
                setIsAddingNew(true)
                setIsOpen(false)
            } else if (highlightedIndex === 1) {
                // "Ingresar manualmente"
                handleSelect('')
            } else {
                // Property item
                const item = visibleItems[highlightedIndex - 2]
                if (item) handleSelect(item.id)
            }
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setIsOpen(false)
            setSearchTerm('')
            setActiveType('all')
        }
    }, [visibleItems, highlightedIndex])

    const openDropdown = () => {
        if (disabled) return
        setIsOpen(true)
        setHighlightedIndex(-1)
        setTimeout(() => inputRef.current?.focus(), 50)
    }

    const selectedProperty = properties.find(p => p.id === selectedId)

    // Count per type for chip badges
    const typeCounts = useMemo(() => {
        const counts = { all: properties.length }
        properties.forEach(p => {
            counts[p.property_type] = (counts[p.property_type] || 0) + 1
        })
        return counts
    }, [properties])

    /** Extract just "Street Number, Street Name" from geocoded address */
    const formatAddress = (p) => {
        const raw = p.address || ''
        // Split by comma and trim
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean)

        // Filter out noise: postal codes, "Chile", "Provincia de...", "Región...", commune (shown separately)
        const noiseParts = parts.filter(part => {
            if (/^\d{5,}$/.test(part)) return true // postal code
            if (/^chile$/i.test(part)) return true
            if (/^(provincia|regi[oó]n)\s/i.test(part)) return true
            if (p.commune && part.toLowerCase() === p.commune.toLowerCase()) return true
            return false
        })
        const noiseSet = new Set(noiseParts.map(n => n.toLowerCase()))

        const clean = parts.filter(part => !noiseSet.has(part.toLowerCase()))

        // Take only the first 2 meaningful parts (number + street or street + extra)
        let addr = clean.slice(0, 2).join(' ') || raw
        if (p.unit_number) addr += `, ${p.unit_number}`
        return addr
    }

    return (
        <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {label}
            </label>
            <div className="relative">
                <div
                    onClick={openDropdown}
                    className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/50 hover:border-accent'}`}
                >
                    <span className={`truncate flex-1 min-w-0 ${selectedProperty ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {loading
                            ? 'Cargando propiedades...'
                            : selectedProperty
                                ? formatAddress(selectedProperty) + (selectedProperty.commune ? `, ${selectedProperty.commune}` : '')
                                : 'Seleccionar propiedad del CRM...'
                        }
                    </span>
                    <ChevronDown className={`h-4 w-4 opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                {isOpen && (
                    <div
                        className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
                        onKeyDown={handleKeyDown}
                    >
                        {/* Search input */}
                        <div className="p-2 border-b border-border">
                            <div className="flex items-center gap-2 px-2 bg-muted/50 rounded-md">
                                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Buscar dirección, comuna, tipo..."
                                    className="w-full h-8 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Filter chips */}
                        <div className="px-2 py-1.5 border-b border-border flex gap-1 flex-wrap">
                            {PROPERTY_TYPES.map(type => {
                                const count = typeCounts[type.key] || 0
                                if (type.key !== 'all' && count === 0) return null
                                const isActive = activeType === type.key
                                return (
                                    <button
                                        key={type.key}
                                        type="button"
                                        onClick={() => setActiveType(type.key)}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${isActive
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                    >
                                        {type.label}
                                        <span className={`text-[10px] ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                                            {count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Scrollable list */}
                        <div ref={listRef} className="max-h-52 overflow-y-auto">
                            {/* Add new */}
                            <button
                                ref={el => itemRefs.current[0] = el}
                                type="button"
                                onClick={() => {
                                    setIsAddingNew(true)
                                    setIsOpen(false)
                                }}
                                className={`w-full text-left px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/5 transition-colors flex items-center gap-2 border-b border-border/50 sticky top-0 bg-popover z-10 ${highlightedIndex === 0 ? 'bg-accent' : ''}`}
                            >
                                <Plus className="w-4 h-4" />
                                Agregar nueva propiedad
                            </button>

                            {/* Manual entry */}
                            <button
                                ref={el => itemRefs.current[1] = el}
                                type="button"
                                onClick={() => handleSelect('')}
                                className={`w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors ${highlightedIndex === 1 ? 'bg-accent' : ''}`}
                            >
                                — Ingresar manualmente —
                            </button>

                            {/* Results */}
                            {filtered.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                    No se encontraron propiedades
                                </div>
                            ) : (
                                <>
                                    {visibleItems.map((p, idx) => {
                                        const itemIndex = idx + 2
                                        return (
                                            <button
                                                key={p.id}
                                                ref={el => itemRefs.current[itemIndex] = el}
                                                type="button"
                                                onClick={() => handleSelect(p.id)}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2 ${selectedId === p.id ? 'bg-accent/70 font-medium' : ''
                                                    } ${highlightedIndex === itemIndex ? 'bg-accent' : ''}`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium truncate">
                                                        <HighlightText
                                                            text={formatAddress(p)}
                                                            searchWords={searchWords}
                                                        />
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        <HighlightText
                                                            text={[p.property_type, p.commune].filter(Boolean).join(' · ')}
                                                            searchWords={searchWords}
                                                        />
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}

                                    {/* Show count indicator */}
                                    {filtered.length > MAX_VISIBLE && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border/50 bg-muted/30">
                                            Mostrando {MAX_VISIBLE} de {filtered.length} — escribe para filtrar más
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Backdrop to close */}
            {isOpen && (
                <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setSearchTerm(''); setActiveType('all') }} />
            )}

            {isAddingNew && (
                <PropertyForm
                    isOpen={isAddingNew}
                    isSimplified={false}
                    onClose={async (newProperty) => {
                        setIsAddingNew(false)
                        if (newProperty) {
                            // If it was a successful creation, refresh the list and select it
                            await fetchProperties()
                            setSelectedId(newProperty.id)
                            onSelectProperty(newProperty)
                        }
                    }}
                />
            )}
        </div>
    )
}
