import { useState, useEffect } from 'react'
import { Button, Checkbox, Badge } from '@/components/ui'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { Loader2, Download, Search, CheckCircle, ExternalLink, Users } from 'lucide-react'

const AdminPropertyImport = () => {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [agents, setAgents] = useState([])
    const [selectedAgents, setSelectedAgents] = useState([])
    const [scannedProperties, setScannedProperties] = useState([])
    const [selectedProperties, setSelectedProperties] = useState({})
    const [existingLinks, setExistingLinks] = useState(new Set())
    const [importing, setImporting] = useState(false)

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, remax_agent_id, email')
                .not('remax_agent_id', 'is', null)
                .order('first_name')

            if (data) {
                setAgents(data)
            }
        } catch (error) {
            console.error('Error fetching agents:', error)
        }
    }

    const toggleAgent = (agentId) => {
        setSelectedAgents(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        )
    }

    const toggleAllAgents = () => {
        if (selectedAgents.length === agents.length) {
            setSelectedAgents([])
        } else {
            setSelectedAgents(agents.map(a => a.remax_agent_id))
        }
    }

    const handleScan = async (e) => {
        e.preventDefault()
        if (selectedAgents.length === 0) {
            toast.warning('Selecciona al menos un agente')
            return
        }

        setLoading(true)
        setScannedProperties([])

        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                toast.error('Sesión no válida. Por favor recarga la página.')
                return
            }

            let allProperties = []
            let errors = 0

            // Process sequentially to be nice to the API/Edge Function
            for (const agentId of selectedAgents) {
                try {
                    const { data, error } = await supabase.functions.invoke('import-remax-listings', {
                        body: { agentId },
                        headers: {
                            Authorization: `Bearer ${session.access_token}`
                        }
                    })

                    if (error) throw error

                    if (data.success && Array.isArray(data.properties)) {
                        // Find the agent profile to attach name if needed (optional context)
                        const agentProfile = agents.find(a => a.remax_agent_id === agentId)

                        const propsWithAgent = data.properties.map(p => ({
                            ...p,
                            agent_name: agentProfile ? `${agentProfile.first_name} ${agentProfile.last_name}` : 'Desconocido',
                            // Ensure agent_id is correctly set from the function or fallback
                            agent_id: data.agentId || agentProfile?.id
                        }))

                        allProperties = [...allProperties, ...propsWithAgent]
                    } else {
                        console.error(`Error scanning agent ${agentId}:`, data.error)
                        errors++
                    }
                } catch (err) {
                    console.error(`Failed to scan agent ${agentId}`, err)
                    errors++
                }
            }

            if (allProperties.length === 0) {
                if (errors > 0) toast.error('No se pudieron obtener propiedades. Revisa la consola.')
                else toast.info('No se encontraron propiedades para los agentes seleccionados.')
                setLoading(false)
                return
            }

            setScannedProperties(allProperties)

            // Check for duplicates in DB
            const urls = allProperties.map(p => p.source_url).filter(Boolean)
            let foundLinks = new Set()

            if (urls.length > 0) {
                // Batch check might be too large, strictly we might want to chunk this
                // But generally 100-200 urls is fine for supabase `in` query
                const { data: existingData } = await supabase
                    .from('properties')
                    .select('listing_link')
                    .in('listing_link', urls)

                if (existingData) {
                    existingData.forEach(item => foundLinks.add(item.listing_link))
                }
            }
            setExistingLinks(foundLinks)

            // Select only non-duplicates by default
            const allSelected = {}
            allProperties.forEach((p, idx) => {
                if (!foundLinks.has(p.source_url)) {
                    allSelected[idx] = true
                }
            })
            setSelectedProperties(allSelected)

            const duplicateCount = allProperties.filter(p => foundLinks.has(p.source_url)).length
            toast.success(`Escaneo completo: ${allProperties.length} propiedades encontradas (${duplicateCount} ya existen)`)

        } catch (error) {
            console.error('Scan error:', error)
            toast.error('Error general al escanear propiedades')
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
            const dbProperties = propertiesToImport.map(p => {
                // IMPORTANT: We must map the RE/MAX Agent ID back to our internal User/Profile ID
                // The edge function returns 'agent_id' as the RE/MAX ID (e.g. 1028061013)
                // We need to find the UUID of that user in our profiles table.

                // Note: In handleScan I added logic to try and attach info. 
                // Let's ensure we find the correct internal UUID.
                const profile = agents.find(a => a.remax_agent_id == p.agent_id)

                return {
                    address: p.address,
                    commune: p.address.split(',')[1]?.trim() || 'Santiago',
                    property_type: p.property_type,
                    operation_type: p.operation_type || 'venta',
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
                    status: p.status || ['Publicada', 'En Venta'],
                    source: 'remax',
                    agent_id: profile ? profile.id : user?.id, // Fallback to current user if mapped profile not found
                    created_at: new Date().toISOString(),
                    image_url: p.image_url
                }
            })

            const { error } = await supabase
                .from('properties')
                .insert(dbProperties)

            if (error) throw error

            // --- Send Notifications ---
            try {
                // Group by agent_id
                const agentGroups = dbProperties.reduce((acc, prop) => {
                    const id = prop.agent_id; // UUID
                    if (!acc[id]) acc[id] = [];
                    acc[id].push(prop);
                    return acc;
                }, {});

                console.log("Groups to notify:", Object.keys(agentGroups));

                // Send email to each agent
                for (const agentId of Object.keys(agentGroups)) {
                    const count = agentGroups[agentId].length;
                    const agentProfile = agents.find(a => a.id === agentId);

                    console.log(`Matching agentId: ${agentId}`, { found: !!agentProfile, email: agentProfile?.email });

                    if (agentProfile && agentProfile.email) {
                        console.log(`Sending email to ${agentProfile.email}...`);
                        const { data, error: notifyError } = await supabase.functions.invoke('send-notification', {
                            body: {
                                recipientEmail: agentProfile.email,
                                recipientName: `${agentProfile.first_name} ${agentProfile.last_name}`,
                                count: count,
                                type: 'import_summary'
                            }
                        });
                        if (notifyError) {
                            console.error(`Failed to notify ${agentProfile.email}`, notifyError);
                        } else {
                            console.log(`Notification result for ${agentProfile.email}:`, data);
                        }
                    } else {
                        console.warn(`No notification sent for agent ${agentId} because profile or email is missing. Profile found: ${!!agentProfile}`);
                    }
                }
            } catch (notifyErr) {
                console.error("Error processing notifications:", notifyErr);
                // Don't block the UI success state
            }
            // --------------------------

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
                <p className="text-gray-500">Selecciona los agentes para escanear sus propiedades públicas e importarlas masivamente.</p>
            </div>

            {/* Agent Selection */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Agentes RE/MAX Disponibles ({agents.length})
                    </h3>
                    <div className="space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleAllAgents}
                        >
                            {selectedAgents.length === agents.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        </Button>
                        <Button onClick={handleScan} disabled={loading || selectedAgents.length === 0}>
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                            {loading ? 'Escaneando...' : `Escanear Seleccionados (${selectedAgents.length})`}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${selectedAgents.includes(agent.remax_agent_id) ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                            onClick={() => toggleAgent(agent.remax_agent_id)}
                        >
                            <Checkbox
                                checked={selectedAgents.includes(agent.remax_agent_id)}
                                onCheckedChange={() => toggleAgent(agent.remax_agent_id)}
                            />
                            <div className="text-sm">
                                <p className="font-medium">{agent.first_name} {agent.last_name}</p>
                                <p className="text-xs text-gray-500">ID: {agent.remax_agent_id}</p>
                            </div>
                        </div>
                    ))}
                    {agents.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            No se encontraron agentes con ID RE/MAX configurado.
                        </div>
                    )}
                </div>
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
                                    <th className="p-4">Agente</th>
                                    <th className="p-4">Propiedad</th>
                                    <th className="p-4">Tipo</th>
                                    <th className="p-4">Precio</th>
                                    <th className="p-4">Características</th>
                                    <th className="p-4">Coords</th>
                                    <th className="p-4">Link</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {scannedProperties.map((p, idx) => (
                                    <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${existingLinks.has(p.source_url) ? 'opacity-60 bg-gray-50' : ''}`}>
                                        <td className="p-4">
                                            <Checkbox
                                                checked={!!selectedProperties[idx]}
                                                disabled={existingLinks.has(p.source_url)}
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
                                        <td className="p-4">
                                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                                                {p.agent_name}
                                            </Badge>
                                        </td>
                                        <td className="p-4 font-medium max-w-[250px] truncate" title={p.title}>
                                            {p.title}
                                            {existingLinks.has(p.source_url) && (
                                                <span className="ml-2 inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20">
                                                    Ya importada
                                                </span>
                                            )}
                                            <div className="text-xs text-gray-500 truncate">{p.description?.substring(0, 40)}...</div>
                                        </td>
                                        <td className="p-4 text-sm whitespace-nowrap">
                                            {p.property_type}<br />
                                            <span className="text-xs text-gray-500 capitalize">{p.operation_type}</span>
                                        </td>
                                        <td className="p-4 text-sm whitespace-nowrap font-medium">
                                            {p.price ? (
                                                <span>
                                                    {p.currency === 'CLP' ? '$' : p.currency} {new Intl.NumberFormat('es-CL').format(p.price)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded w-fit">{p.m2_total} m²</span>
                                                <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded w-fit">{p.bedrooms}D / {p.bathrooms}B</span>
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
