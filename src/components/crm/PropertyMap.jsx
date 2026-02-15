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

const getMarkerIcon = (statusArray) => {
    const statusStr = (statusArray || []).join(', ').toLowerCase()
    let color = '#3b82f6' // Default Blue (RE/MAX Blue-ish)

    if (statusStr.includes('venta')) {
        color = '#ef4444' // Red (RE/MAX Red)
    } else if (statusStr.includes('arriendo')) {
        color = '#22c55e' // Green
    } else if (statusStr.includes('administr')) {
        color = '#f97316' // Orange
    }

    return divIcon({
        html: `<div style="
            background-color: ${color}; 
            width: 14px; 
            height: 14px; 
            border-radius: 50%; 
            border: 2px solid white; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        className: 'custom-marker-pin',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -7],
    })
}

const PropertyMap = () => {
    const [properties, setProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetchProperties()
    }, [])

    const fetchProperties = async () => {
        try {
            // Only fetch properties that have coordinates
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

    // Calculate center based on first property or default to Santiago
    const center = properties.length > 0
        ? [properties[0].latitude, properties[0].longitude]
        : [-33.4489, -70.6693]

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-semibold text-lg">Mapa de Propiedades</h3>
                <Badge variant="outline">{properties.length} Ubicaciones</Badge>
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
                    {properties.map(property => (
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
                                        <Badge className="w-fit mb-1">{property.property_type}</Badge>
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
