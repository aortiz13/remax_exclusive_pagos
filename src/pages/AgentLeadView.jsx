import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui"
import {
    Loader2, AlertCircle, Phone, Mail, MessageCircle, MapPin,
    Home, DollarSign, User, ChevronDown, ChevronUp, Copy, UserCheck
} from "lucide-react"
import { toast } from 'sonner'

// Extraction Helpers
const extractContactInfo = (data) => {
    // Helper to find key efficiently in shallow or 1-level deep
    // Strategy: Look for specific blocks first, then fall back to root

    // Normalize data to handle array wrapper if present
    const root = Array.isArray(data) ? data[0] : data || {};

    // Try to find a specific contact block
    let contactBlock = root["Datos Contacto"] || root["Contacto"] || root["Cliente"];

    // If no block found, maybe the keys are at the root?
    if (!contactBlock) contactBlock = root;

    return {
        name: contactBlock?.nombre_apellido || contactBlock?.nombre || "Cliente Potencial",
        phone: contactBlock?.telefono || contactBlock?.celular || contactBlock?.movil,
        email: contactBlock?.correo || contactBlock?.email,
        details: contactBlock?.info_adicional || ""
    }
}

const extractPropertyInfo = (data) => {
    const root = Array.isArray(data) ? data[0] : data || {};
    const propBlock = root["Datos Propiedad"] || root["Propiedad"] || root;

    return {
        type: propBlock?.tipo_inmueble || propBlock?.tipo || "Propiedad",
        transaction: propBlock?.tipo_transaccion || propBlock?.operacion || "Transacción",
        address: propBlock?.direccion_propiedad || propBlock?.direccion || propBlock?.ubicacion,
        price: propBlock?.valor_maximo || propBlock?.precio || propBlock?.presupuesto,
        beds: propBlock?.habitaciones || propBlock?.dormitorios,
        baths: propBlock?.banos || propBlock?.banos,
        amenities: propBlock?.caracteristicas_adicionales || []
    }
}

const JSONViewer = ({ data }) => (
    <pre className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-96">
        {JSON.stringify(data, null, 2)}
    </pre>
)

export default function AgentLeadView() {
    const { id } = useParams()
    const [lead, setLead] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showRaw, setShowRaw] = useState(false)

    useEffect(() => {
        const fetchLead = async () => {
            try {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
                let query = supabase.from('external_leads').select('*')

                if (isUUID) query = query.eq('id', id)
                else query = query.eq('short_id', id)

                const { data, error } = await query.single()
                if (error) throw error
                setLead(data)
            } catch (error) {
                console.error('Error:', error)
            } finally {
                setLoading(false)
            }
        }
        if (id) fetchLead()
    }, [id])

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text)
        toast.success("Copiado al portapapeles")
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
    if (!lead) return (
        <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-slate-800">Solicitud no encontrada</h1>
        </div>
    )

    const contact = extractContactInfo(lead.raw_data)
    const property = extractPropertyInfo(lead.raw_data)
    const cleanPhone = contact?.phone?.replace(/\D/g, '')

    return (
        <div className="min-h-screen bg-slate-50 pb-20 font-sans">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20 px-4 py-3 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        RE
                    </div>
                    <span className="font-bold text-slate-800 tracking-tight">RE/MAX Exclusive</span>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Lead
                </Badge>
            </div>

            <div className="max-w-md mx-auto p-4 space-y-6">

                {/* Hero / Summary */}
                <div className="text-center space-y-2 py-4">
                    <h1 className="text-2xl font-bold text-slate-900">{contact.name}</h1>
                    <p className="text-slate-500 text-sm">{new Date(lead.created_at).toLocaleDateString()}</p>
                </div>

                {/* Quick Actions - Floating or Top */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center gap-4">
                            <a
                                href={cleanPhone ? `tel:${cleanPhone}` : '#'}
                                className={`flex flex-col items-center gap-2 flex-1 ${!cleanPhone && 'opacity-50 pointer-events-none'}`}
                            >
                                <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                                    <Phone className="h-6 w-6" />
                                </div>
                                <span className="text-xs font-medium">Llamar</span>
                            </a>

                            <a
                                href={contact.email ? `mailto:${contact.email}` : '#'}
                                className={`flex flex-col items-center gap-2 flex-1 ${!contact.email && 'opacity-50 pointer-events-none'}`}
                            >
                                <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <span className="text-xs font-medium">Email</span>
                            </a>
                        </div>
                    </CardContent>
                </Card>

                {/* Assignment Info */}
                {lead.status === 'assigned' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="h-10 text-blue-600 bg-white rounded-lg flex items-center justify-center px-3 border border-blue-100 shadow-sm">
                                <UserCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Asignación</p>
                                <p className="text-sm font-bold text-slate-800">
                                    {lead.assigned_agent_id ? 'Asignado Directamente' : 'Gestionado por RE/MAX Chile'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Contact Details */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-700">
                            <User className="h-4 w-4" /> Datos de Contacto
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 pt-0">
                        {contact.phone && (
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium">{contact.phone}</span>
                                </div>
                                <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" onClick={() => handleCopy(contact.phone)}>
                                    <Copy className="h-3 w-3 text-slate-500" />
                                </button>
                            </div>
                        )}
                        {contact.email && (
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium break-all">{contact.email}</span>
                                </div>
                                <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" onClick={() => handleCopy(contact.email)}>
                                    <Copy className="h-3 w-3 text-slate-500" />
                                </button>
                            </div>
                        )}
                        {!contact.phone && !contact.email && (
                            <p className="text-sm text-muted-foreground italic">No se encontraron datos de contacto.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Property Details */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-700">
                            <Home className="h-4 w-4" /> Interés: {property.type}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                        <div className="flex gap-2">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                                {property.transaction}
                            </Badge>
                            {property.price && (
                                <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" /> {property.price}
                                </Badge>
                            )}
                        </div>

                        {property.address && (
                            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                <span className="text-sm">{property.address}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 rounded-lg text-center">
                                <span className="block text-xs text-slate-500 uppercase">Habitaciones</span>
                                <span className="text-lg font-bold text-slate-700">{property.beds || "-"}</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg text-center">
                                <span className="block text-xs text-slate-500 uppercase">Baños</span>
                                <span className="text-lg font-bold text-slate-700">{property.baths || "-"}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>


            </div>
        </div>
    )
}
