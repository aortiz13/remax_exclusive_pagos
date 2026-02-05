import { useState } from 'react'
import { Button, Input, Checkbox } from '@/components/ui'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { Loader2, Download, Search, CheckCircle, ExternalLink } from 'lucide-react'

const AdminPropertyImport = () => {
    const { user } = useAuth()
    const [agentId, setAgentId] = useState('1028061013') // Default for easier testing
    const [loading, setLoading] = useState(false)
    const [scannedProperties, setScannedProperties] = useState([])
    const [selectedProperties, setSelectedProperties] = useState({})
    const [importing, setImporting] = useState(false)

    const handleScan = async (e) => {
        e.preventDefault()
        setLoading(true)
        setScannedProperties([])
        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                toast.error('Sesión no válida. Por favor recarga la página.')
                return
            }

            const { data, error } = await supabase.functions.invoke('import-remax-listings', {
                body: { agentId },
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            })

            if (error) throw error

            if (data.success) {
                setScannedProperties(data.properties)
                // Select all by default
                const allSelected = {}
                data.properties.forEach((p, idx) => {
                    allSelected[idx] = true
                })
                setSelectedProperties(allSelected)
                toast.success(`Se encontraron ${data.properties.length} propiedades`)
            } else {
                toast.error('No se pudieron obtener propiedades: ' + data.error)
            }

        } catch (error) {
            console.error('Scan error:', error)
            toast.error('Error al escanear propiedades')
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        setImporting(true)
        try {
            const propertiesToImport = scannedProperties.filter((_, idx) => selectedProperties[idx])

            if (propertiesToImport.length === 0) {
                toast.warning('No hay propiedades seleccionadas')
                return
            }

            // Transform data for DB if needed (schema matching)
            const dbProperties = propertiesToImport.map(p => ({
                address: p.address,
                commune: p.address.split(',')[1]?.trim() || 'Santiago', // Simple heuristic
                property_type: p.property_type,
                operation_type: 'Venta',
                price: p.price || 0,
                currency: p.currency || 'CLP',
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                m2_total: p.m2_total,
                m2_built: p.m2_built,
                notes: p.description,
                listing_link: p.source_url,
                latitude: p.latitude,
                longitude: p.longitude,
                status: ['Publicada', 'En Venta'],
                status: ['Publicada', 'En Venta'],
                source: 'remax',
                agent_id: user?.id,
                created_at: new Date().toISOString(),
                image_url: p.image_url // Save image url
            }))

            const { error } = await supabase
                .from('properties')
                .insert(dbProperties)

            if (error) throw error

            toast.success(`${dbProperties.length} propiedades importadas correctamente`)
            setScannedProperties([])
            setSelectedProperties({})

        } catch (error) {
            console.error('Import error:', error)
            toast.error('Error al importar propiedades')
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Importar Propiedades RE/MAX</h1>
                <p className="text-gray-500">Escanea el perfil público de un agente para importar sus propiedades automáticamente.</p>
            </div>

            {/* Scan Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
                <form onSubmit={handleScan} className="flex gap-4 items-end">
                    <div className="flex-1 max-w-xs">
                        <label className="block text-sm font-medium mb-1">ID Agente RE/MAX</label>
                        <Input
                            value={agentId}
                            onChange={(e) => setAgentId(e.target.value)}
                            placeholder="Ej: 1028061013"
                        />
                    </div>
                    <Button type="submit" disabled={loading} className="min-w-[120px]">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                        {loading ? 'Escaneando...' : 'Escanear'}
                    </Button>
                </form>
            </div>

            {/* Results */}
            {scannedProperties.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                        <h2 className="font-semibold">Propiedades Encontradas ({scannedProperties.length})</h2>
                        <Button onClick={handleImport} disabled={importing}>
                            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                            Importar Seleccionadas
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-sm font-medium">
                                <tr>
                                    <th className="p-4 w-10">
                                        <Checkbox
                                            checked={Object.keys(selectedProperties).length === scannedProperties.length}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    const all = {}
                                                    scannedProperties.forEach((_, i) => all[i] = true)
                                                    setSelectedProperties(all)
                                                } else {
                                                    setSelectedProperties({})
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="p-4">Img</th>
                                    <th className="p-4">Propiedad</th>
                                    <th className="p-4">Tipo</th>
                                    <th className="p-4">Características</th>
                                    <th className="p-4">Coords</th>
                                    <th className="p-4">Link</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {scannedProperties.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="p-4">
                                            <Checkbox
                                                checked={!!selectedProperties[idx]}
                                                onCheckedChange={(checked) => {
                                                    setSelectedProperties(prev => ({
                                                        ...prev,
                                                        [idx]: !!checked
                                                    }))
                                                }}
                                            />
                                        </td>
                                        <td className="p-4">
                                            {p.image_url && (
                                                <img src={p.image_url} alt="Portada" className="w-16 h-12 object-cover rounded shadow-sm border" />
                                            )}
                                        </td>
                                        <td className="p-4 font-medium max-w-[300px] truncate" title={p.title}>
                                            {p.title}
                                            <div className="text-xs text-gray-500 truncate">{p.description?.substring(0, 50)}...</div>
                                        </td>
                                        <td className="p-4 text-sm">{p.property_type}</td>
                                        <td className="p-4 text-sm">
                                            <div className="flex gap-2">
                                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{p.m2_total} m²</span>
                                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">{p.bedrooms} Dorm</span>
                                                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">{p.bathrooms} Baños</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm">
                                            {p.latitude ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span className="text-red-400">-</span>}
                                        </td>
                                        <td className="p-4">
                                            <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminPropertyImport
