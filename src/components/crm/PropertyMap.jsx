import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../../services/supabase'
import { Loader2, ExternalLink } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { useNavigate } from 'react-router-dom'

// Fix for default marker icon missing in React Leaflet
import markerIconPng from "leaflet/dist/images/marker-icon.png"
import markerIcon2xPng from "leaflet/dist/images/marker-icon-2x.png"
import markerShadowPng from "leaflet/dist/images/marker-shadow.png"

// Status → color mapping for pins and legend
const STATUS_PIN_COLORS = {
    'Publicada':    '#3b82f6', // Blue
    'En Venta':     '#ef4444', // Red
    'En Arriendo':  '#8b5cf6', // Violet
    'Vendida':      '#a855f7', // Purple
    'Arrendada':    '#06b6d4', // Cyan
    'Administrada': '#f97316', // Orange
    'Pendiente':    '#eab308', // Yellow
    'Pausada':      '#f59e0b', // Amber
    'Retirada':     '#6b7280', // Gray
    'Por Captar':   '#14b8a6', // Teal
    'Visitas':      '#ec4899', // Pink
}

const getStatusColor = (statusArray) => {
    if (!statusArray || statusArray.length === 0) return '#9ca3af'
    // Priority: pick the first status that has a defined color
    for (const s of statusArray) {
        if (STATUS_PIN_COLORS[s]) return STATUS_PIN_COLORS[s]
    }
    return '#9ca3af' // Fallback gray
}

const getMarkerIcon = (statusArray) => {
    const color = getStatusColor(statusArray)

    return divIcon({
        html: `<div style="display: flex; justify-content: center; align-items: center;">
            <svg width="24" height="34" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.4));">
                <path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 34 12 34C12 34 24 21 24 12C24 5.37 18.63 0 12 0Z" fill="${color}"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>
        </div>`,
        className: 'custom-marker-pin',
        iconSize: [24, 34],
        iconAnchor: [12, 34],
        popupAnchor: [0, -34],
    })
}

const PropertyMap = () => {
    const [properties, setProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeFilters, setActiveFilters] = useState(new Set(Object.keys(STATUS_PIN_COLORS)))
    const navigate = useNavigate()

    useEffect(() => {
        fetchProperties()
    }, [])

    const fetchProperties = async () => {
        try {
            const { data, error } = await supabase
                .from('properties')
                .select('*')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)

            if (error) throw error
            setProperties(data || [])
        } catch (error) {
            console.error('Error fetching map properties:', error)
        } finally {
            setLoading(false)
        }
    }

    // Count properties per status
    const statusCounts = {}
    for (const s of Object.keys(STATUS_PIN_COLORS)) statusCounts[s] = 0
    properties.forEach(p => {
        (p.status || []).forEach(s => {
            if (statusCounts[s] !== undefined) statusCounts[s]++
        })
    })

    // Filter properties based on active filters
    const allActive = activeFilters.size === Object.keys(STATUS_PIN_COLORS).length
    const filteredProperties = allActive
        ? properties
        : properties.filter(p =>
            (p.status || []).some(s => activeFilters.has(s))
        )

    const toggleFilter = (status) => {
        setActiveFilters(prev => {
            const next = new Set(prev)
            if (next.has(status)) {
                next.delete(status)
            } else {
                next.add(status)
            }
            return next
        })
    }

    const resetFilters = () => {
        setActiveFilters(new Set(Object.keys(STATUS_PIN_COLORS)))
    }

    const clearFilters = () => {
        setActiveFilters(new Set())
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[400px] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (properties.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-muted-foreground">
                <p>No hay propiedades geolocalizadas para mostrar en el mapa.</p>
                <p className="text-xs mt-2">Asegúrate de editar las propiedades y seleccionar una dirección válida.</p>
            </div>
        )
    }

    const center = properties.length > 0
        ? [properties[0].latitude, properties[0].longitude]
        : [-33.4489, -70.6693]

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <h3 className="font-semibold text-lg">Mapa de Propiedades</h3>
                    <div className="flex items-center gap-2">
                        {activeFilters.size > 0 && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={clearFilters}>
                                Deseleccionar todos
                            </Button>
                        )}
                        {!allActive && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={resetFilters}>
                                Seleccionar todos
                            </Button>
                        )}
                        <Badge variant="outline">
                            {filteredProperties.length}{!allActive ? ` / ${properties.length}` : ''} Ubicaciones
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(STATUS_PIN_COLORS).map(([label, color]) => {
                        const isActive = activeFilters.has(label)
                        const count = statusCounts[label] || 0
                        return (
                            <button
                                key={label}
                                onClick={() => toggleFilter(label)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-all cursor-pointer select-none
                                    ${isActive
                                        ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-offset-1 dark:ring-offset-slate-900'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 opacity-40'
                                    }`}
                                style={isActive ? { ringColor: color } : {}}
                            >
                                <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
                                <span className="whitespace-nowrap text-foreground">{label}</span>
                                {count > 0 && (
                                    <span className="text-[10px] font-semibold text-muted-foreground ml-0.5">({count})</span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
            <div className="h-[500px] w-full relative z-0">
                <MapContainer
                    center={center}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                    className="z-0"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {filteredProperties.map(property => (
                        <Marker
                            key={property.id}
                            position={[property.latitude, property.longitude]}
                            icon={getMarkerIcon(property.status)}
                        >
                            <Popup>
                                <div className="min-w-[200px]">
                                    <div className="flex flex-col gap-1">
                                        {property.image_url && (
                                            <div className="w-full h-32 mb-2 rounded-md overflow-hidden bg-gray-100">
                                                <img
                                                    src={property.image_url}
                                                    alt={property.address}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="flex gap-1.5 flex-wrap mb-1">
                                            <Badge className="w-fit">{property.property_type}</Badge>
                                            {property.status?.map(s => (
                                                <Badge key={s} className="w-fit text-white text-[10px]" style={{ backgroundColor: getStatusColor(property.status) }}>{s}</Badge>
                                            ))}
                                        </div>
                                        <h4 className="font-bold text-sm leading-tight">{property.address}</h4>
                                        <p className="text-xs text-muted-foreground">{property.commune}</p>

                                        <div className="flex gap-2 mt-2">
                                            {property.bedrooms > 0 && (
                                                <Badge variant="secondary" className="text-[10px] px-1 h-5">{property.bedrooms} Dorm</Badge>
                                            )}
                                            {property.m2_total > 0 && (
                                                <Badge variant="secondary" className="text-[10px] px-1 h-5">{property.m2_total} m²</Badge>
                                            )}
                                        </div>

                                        <Button
                                            size="sm"
                                            className="mt-3 w-full h-8 text-xs"
                                            onClick={() => navigate(`/crm/property/${property.id}`)}
                                        >
                                            Ver Detalles <ExternalLink className="w-3 h-3 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    )
}

export default PropertyMap
