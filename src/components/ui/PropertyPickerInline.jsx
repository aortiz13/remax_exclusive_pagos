import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Search, Building2 } from 'lucide-react'

export default function PropertyPickerInline({ onSelectProperty, label = 'Pre-llenar desde CRM', value, disabled = false }) {
    const { user } = useAuth()
    const [properties, setProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [selectedId, setSelectedId] = useState(value || '')

    useEffect(() => {
        if (value) setSelectedId(value)
    }, [value])

    useEffect(() => {
        const fetchProperties = async () => {
            if (!user?.id) return
            const { data, error } = await supabase
                .from('properties')
                .select('id, property_type, address, commune, unit_number')
                .order('created_at', { ascending: false })
                .limit(500)

            if (error) {
                console.error('Error fetching properties from CRM:', error)
            } else if (data) {
                setProperties(data)
            }
            setLoading(false)
        }
        fetchProperties()
    }, [user])

    const filtered = searchTerm
        ? properties.filter(p => {
            const text = `${p.address} ${p.commune} ${p.property_type}`.toLowerCase()
            return text.includes(searchTerm.toLowerCase())
        })
        : properties

    const handleSelect = (propertyId) => {
        if (!propertyId) {
            setSelectedId('')
            setIsOpen(false)
            return
        }
        const property = properties.find(p => p.id === propertyId)
        if (property) {
            setSelectedId(propertyId)
            onSelectProperty(property)
            setIsOpen(false)
            setSearchTerm('')
        }
    }

    const selectedProperty = properties.find(p => p.id === selectedId)

    return (
        <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {label}
            </label>
            <div className="relative">
                <div
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors ring-offset-background focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <span className={selectedProperty ? 'text-foreground' : 'text-muted-foreground'}>
                        {loading
                            ? 'Cargando propiedades...'
                            : selectedProperty
                                ? `${selectedProperty.address}${selectedProperty.commune ? `, ${selectedProperty.commune}` : ''}`
                                : 'Seleccionar propiedad del CRM...'
                        }
                    </span>
                    <Search className="h-4 w-4 opacity-50" />
                </div>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-border">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar por dirección o comuna..."
                                className="w-full h-8 px-2 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => handleSelect('')}
                                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
                            >
                                — Ingresar manualmente —
                            </button>
                            {filtered.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                    No se encontraron propiedades
                                </div>
                            ) : (
                                filtered.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleSelect(p.id)}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2 ${selectedId === p.id ? 'bg-accent/70 font-medium' : ''}`}
                                    >
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">{p.address}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {[p.property_type, p.commune].filter(Boolean).join(' · ')}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Backdrop to close */}
            {isOpen && (
                <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setSearchTerm('') }} />
            )}
        </div>
    )
}
