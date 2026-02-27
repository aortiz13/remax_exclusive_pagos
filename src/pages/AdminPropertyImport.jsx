import { useState, useEffect } from 'react'
import { Button, Checkbox, Badge } from '@/components/ui'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { Loader2, Download, Search, CheckCircle, ExternalLink, Users, RefreshCw, History, TrendingDown, Eye, EyeOff, Handshake, Clock, Star } from 'lucide-react'

const STATUS_COLORS = {
    'Activa': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    'Retirada': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    'Concretada': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    'Pendiente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Pausada': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'Vendida': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'Arrendada': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
}

const STATUS_ICONS = {
    'Activa': <Eye className="w-3 h-3" />,
    'Retirada': <EyeOff className="w-3 h-3" />,
    'Concretada': <Handshake className="w-3 h-3" />,
    'Pendiente': <Clock className="w-3 h-3" />,
    'Vendida': <Handshake className="w-3 h-3" />,
    'Arrendada': <Handshake className="w-3 h-3" />,
}

const AdminPropertyImport = () => {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [agents, setAgents] = useState([])
    const [selectedAgents, setSelectedAgents] = useState([])
    const [scannedProperties, setScannedProperties] = useState([])
    const [selectedProperties, setSelectedProperties] = useState({})
    const [existingLinks, setExistingLinks] = useState(new Set())
    const [importing, setImporting] = useState(false)
    const [scanStats, setScanStats] = useState(null)

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, remax_agent_id, email')
                .not('remax_agent_id', 'is', null)
                .order('first_name')

            if (data) setAgents(data)
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
        e?.preventDefault()
        if (selectedAgents.length === 0) {
            toast.warning('Selecciona al menos un agente')
            return
        }

        setLoading(true)
        setScannedProperties([])
        setScanStats(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                toast.error('Sesión no válida. Por favor recarga la página.')
                return
            }

            let allProperties = []
            let totalListings = 0
            let errors = 0

            for (const agentId of selectedAgents) {
                try {
                    const { data, error } = await supabase.functions.invoke('import-remax-listings', {
                        body: { agentId },
                        headers: { Authorization: `Bearer ${session.access_token}` }
                    })

                    if (error) throw error

                    if (data.success && Array.isArray(data.properties)) {
                        const agentProfile = agents.find(a => a.remax_agent_id === agentId)
                        totalListings += data.total_listings || data.properties.length

                        const propsWithAgent = data.properties.map(p => ({
                            ...p,
                            agent_name: agentProfile ? `${agentProfile.first_name} ${agentProfile.last_name}` : 'Desconocido',
                            profile_id: agentProfile?.id
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

            // Check existing in DB
            const urls = allProperties.map(p => p.source_url).filter(Boolean)
            let foundLinks = new Set()
            if (urls.length > 0) {
                const { data: existingData } = await supabase
                    .from('properties')
                    .select('listing_link')
                    .in('listing_link', urls)
                if (existingData) {
                    existingData.forEach(item => foundLinks.add(item.listing_link))
                }
            }
            setExistingLinks(foundLinks)

            // Select all by default
            const allSelected = {}
            allProperties.forEach((_, idx) => { allSelected[idx] = true })
            setSelectedProperties(allSelected)

            const activeCount = allProperties.filter(p => p.is_viewable).length
            const closedCount = allProperties.filter(p => p.listing_status_uid === 167).length
            const withHistory = allProperties.filter(p => p.total_versions > 1).length

            setScanStats({
                total: allProperties.length,
                totalListings,
                active: activeCount,
                closed: closedCount,
                withHistory,
                duplicates: allProperties.filter(p => foundLinks.has(p.source_url)).length,
            })

            toast.success(`Escaneo completo: ${allProperties.length} propiedades físicas (${totalListings} listings totales)`)

        } catch (error) {
            console.error('Scan error:', error)
            toast.error('Error general al escanear propiedades')
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        setImporting(true)
        const errors = []
        let importedCount = 0

        try {
            const propertiesToImport = scannedProperties.filter((_, idx) => selectedProperties[idx])

            if (propertiesToImport.length === 0) {
                toast.warning('No hay propiedades seleccionadas')
                return
            }

            // Group selected properties by agent
            const propertiesByAgent = propertiesToImport.reduce((acc, p) => {
                if (!acc[p.agent_id]) acc[p.agent_id] = []
                acc[p.agent_id].push(p)
                return acc
            }, {})

            // Process agent by agent for better resilience
            for (const [remaxAgentId, props] of Object.entries(propertiesByAgent)) {
                const agentProfile = agents.find(a => a.remax_agent_id === remaxAgentId)
                if (!agentProfile) {
                    errors.push(`No se encontró el perfil para el agente ${remaxAgentId}`)
                    continue
                }

                try {
                    // 1. Delete existing RE/MAX properties for this specific agent
                    const { data: existingProps } = await supabase
                        .from('properties')
                        .select('id')
                        .eq('agent_id', agentProfile.id)
                        .eq('source', 'remax')

                    if (existingProps && existingProps.length > 0) {
                        const propIds = existingProps.map(p => p.id)
                        await supabase.from('mandates').update({ property_id: null }).in('property_id', propIds)
                        await supabase.from('crm_tasks').delete().in('property_id', propIds)
                        await supabase.from('crm_actions').delete().in('property_id', propIds)
                        await supabase.from('property_listing_history').delete().in('property_id', propIds)
                        await supabase.from('properties').delete().in('id', propIds)
                    }

                    // 2. Map and Insert properties
                    const dbProperties = props.map(p => ({
                        address: p.address,
                        commune: p.commune || p.address?.split(',')[1]?.trim() || '',
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
                        status: p.status || ['Publicada'],
                        source: 'remax',
                        agent_id: agentProfile.id,
                        image_url: p.image_url,
                        published_at: p.published_at,
                        last_updated_at: p.last_updated_at,
                        expires_at: p.expires_at,
                        sold_at: p.sold_at,
                        sold_price: p.sold_price,
                        listing_status_uid: p.listing_status_uid,
                        listing_reference: p.listing_reference,
                        remax_listing_id: p.listing_id,
                        transaction_type_uid: p.transaction_type_uid,
                        is_exclusive: p.is_exclusive || false,
                        year_built: p.year_built,
                        maintenance_fee: p.maintenance_fee,
                        virtual_tour_url: p.virtual_tour_url,
                        video_url: p.video_url,
                        parking_spaces: String(p.parking_spaces || ''), // Ensure string
                        floor_number: String(p.floor_number || ''), // Ensure string
                    }))

                    const { data: insertedProps, error: insertError } = await supabase
                        .from('properties')
                        .insert(dbProperties)
                        .select('id, listing_reference, agent_id')

                    if (insertError) throw insertError

                    // 3. Insert history
                    if (insertedProps) {
                        const historyRecords = []
                        for (const inserted of insertedProps) {
                            const original = props.find(p => p.listing_reference === inserted.listing_reference)
                            if (original?.history && original.history.length > 0) {
                                for (const h of original.history) {
                                    historyRecords.push({
                                        property_id: inserted.id,
                                        listing_reference: inserted.listing_reference,
                                        remax_listing_id: h.listing_id,
                                        published_at: h.published_at,
                                        expired_at: h.expires_at,
                                        price: h.price,
                                        currency: h.currency,
                                        listing_status_uid: h.listing_status_uid,
                                        status_label: h.status_label,
                                        agent_id: inserted.agent_id,
                                    })
                                }
                            }
                        }

                        if (historyRecords.length > 0) {
                            const { error: histErr } = await supabase
                                .from('property_listing_history')
                                .insert(historyRecords)
                            if (histErr) console.error(`Error history ${remaxAgentId}:`, histErr)
                        }
                    }

                    // 4. Update KPI
                    const INACTIVE_STATUSES = ['Vendida', 'Retirada', 'Pausada', 'Arrendada']
                    const todayStr = new Date().toISOString().split('T')[0]
                    const activeCount = dbProperties.filter(p =>
                        !(p.status || []).some(s => INACTIVE_STATUSES.includes(s))
                    ).length

                    if (activeCount > 0) {
                        const { data: existingKpi } = await supabase
                            .from('kpi_records')
                            .select('id')
                            .eq('agent_id', agentProfile.id)
                            .eq('period_type', 'daily')
                            .eq('date', todayStr)
                            .maybeSingle()

                        if (existingKpi) {
                            await supabase.from('kpi_records').update({ active_portfolio: activeCount }).eq('id', existingKpi.id)
                        } else {
                            await supabase.from('kpi_records').insert({
                                agent_id: agentProfile.id, period_type: 'daily', date: todayStr,
                                active_portfolio: activeCount,
                                new_listings: 0, conversations_started: 0, relational_coffees: 0,
                                sales_interviews: 0, buying_interviews: 0, commercial_evaluations: 0,
                                price_reductions: 0, portfolio_visits: 0, buyer_visits: 0,
                                offers_in_negotiation: 0, signed_promises: 0,
                                billing_primary: 0, referrals_count: 0, billing_secondary: 0,
                            })
                        }
                    }

                    importedCount += props.length

                } catch (agentError) {
                    console.error(`Error importing agent ${remaxAgentId}:`, agentError)
                    errors.push(`Agente ${agentProfile.first_name} ${agentProfile.last_name}: ${agentError.message}`)
                }
            }

            if (errors.length > 0) {
                toast.error(
                    <div>
                        <p className="font-bold">Importación finalizada con errores:</p>
                        <ul className="text-xs list-disc pl-4 mt-1">
                            {errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    </div>,
                    { duration: 8000 }
                )
            }

            if (importedCount > 0) {
                toast.success(`${importedCount} propiedades importadas correctamente 🎉`)
                setScannedProperties([])
                setSelectedProperties({})
                setScanStats(null)
            }

        } catch (error) {
            console.error('Import process fatal error:', error)
            toast.error(`Error crítico: ${error.message}`)
        } finally {
            setImporting(false)
        }
    }

    const formatDate = (iso) => {
        if (!iso) return '-'
        return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const formatPrice = (price, currency) => {
        if (!price) return '-'
        const prefix = currency === 'CLP' ? '$' : currency || ''
        return `${prefix} ${new Intl.NumberFormat('es-CL').format(price)}`
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Importar Propiedades RE/MAX
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Escanea e importa propiedades con historial completo de evolución
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
                        <RefreshCw className="w-3 h-3 inline mr-1" />
                        Auto-sync diario 00:00
                    </div>
                </div>
            </div>

            {/* Agent Selection */}
            <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm p-5 rounded-xl border shadow-sm">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        Agentes RE/MAX ({agents.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={toggleAllAgents}>
                            {selectedAgents.length === agents.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        </Button>
                        <Button onClick={handleScan} disabled={loading || selectedAgents.length === 0}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                            {loading ? 'Escaneando...' : `Escanear (${selectedAgents.length})`}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto p-1">
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedAgents.includes(agent.remax_agent_id)
                                ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700 shadow-sm'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                            onClick={() => toggleAgent(agent.remax_agent_id)}
                        >
                            <Checkbox checked={selectedAgents.includes(agent.remax_agent_id)} />
                            <div className="text-sm">
                                <p className="font-medium">{agent.first_name} {agent.last_name}</p>
                                <p className="text-xs text-muted-foreground">ID: {agent.remax_agent_id}</p>
                            </div>
                        </div>
                    ))}
                    {agents.length === 0 && (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                            No se encontraron agentes con ID RE/MAX configurado.
                        </div>
                    )}
                </div>
            </div>

            {/* Scan Stats */}
            {scanStats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{scanStats.total}</div>
                        <div className="text-xs text-blue-600/80 dark:text-blue-400/80">Propiedades Físicas</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{scanStats.totalListings} listings totales</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900">
                        <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{scanStats.active}</div>
                        <div className="text-xs text-emerald-600/80">Activas</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 p-4 rounded-xl border border-amber-100 dark:border-amber-900">
                        <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{scanStats.closed}</div>
                        <div className="text-xs text-amber-600/80">Concretadas</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 p-4 rounded-xl border border-purple-100 dark:border-purple-900">
                        <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{scanStats.withHistory}</div>
                        <div className="text-xs text-purple-600/80">Con Historial</div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{scanStats.duplicates}</div>
                        <div className="text-xs text-gray-600/80">Ya importadas</div>
                    </div>
                </div>
            )}

            {/* Results Table */}
            {scannedProperties.length > 0 && (
                <div className="bg-white dark:bg-gray-900/80 rounded-xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="p-4 border-b flex flex-wrap justify-between items-center gap-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50">
                        <div>
                            <h2 className="font-semibold">Propiedades Encontradas</h2>
                            <p className="text-xs text-muted-foreground">
                                {Object.keys(selectedProperties).filter(k => selectedProperties[k]).length} seleccionadas de {scannedProperties.length}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                                const all = {}
                                scannedProperties.forEach((_, i) => all[i] = true)
                                setSelectedProperties(all)
                            }}>
                                Seleccionar Todas
                            </Button>
                            <Button onClick={handleImport} disabled={importing}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white">
                                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                {importing ? 'Importando...' : 'Re-Importar Todo'}
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/80 dark:bg-gray-800/50 text-left font-medium border-b">
                                <tr>
                                    <th className="p-3 w-10">
                                        <Checkbox
                                            checked={Object.keys(selectedProperties).filter(k => selectedProperties[k]).length === scannedProperties.length}
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
                                    <th className="p-3">Img</th>
                                    <th className="p-3">Propiedad</th>
                                    <th className="p-3">Estado</th>
                                    <th className="p-3">Tipo / Op.</th>
                                    <th className="p-3">Precio</th>
                                    <th className="p-3">Publicada</th>
                                    <th className="p-3">Historial</th>
                                    <th className="p-3">Agente</th>
                                    <th className="p-3 w-10">Link</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {scannedProperties.map((p, idx) => {
                                    const statusLabel = p.status?.[0] || p.status_label || 'Desconocido'
                                    const colorClass = STATUS_COLORS[statusLabel] || STATUS_COLORS[p.status_label] || 'bg-gray-100 text-gray-600'
                                    const icon = STATUS_ICONS[statusLabel] || STATUS_ICONS[p.status_label]
                                    const isExisting = existingLinks.has(p.source_url)

                                    return (
                                        <tr key={idx} className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${isExisting ? 'opacity-50' : ''}`}>
                                            <td className="p-3">
                                                <Checkbox
                                                    checked={!!selectedProperties[idx]}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedProperties(prev => ({ ...prev, [idx]: !!checked }))
                                                    }}
                                                />
                                            </td>
                                            <td className="p-3">
                                                {p.image_url ? (
                                                    <img src={p.image_url} alt="" className="w-14 h-10 object-cover rounded-md shadow-sm border" />
                                                ) : (
                                                    <div className="w-14 h-10 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center text-gray-400 text-xs">N/A</div>
                                                )}
                                            </td>
                                            <td className="p-3 max-w-[220px]">
                                                <div className="font-medium truncate text-sm" title={p.title}>{p.title}</div>
                                                <div className="text-xs text-muted-foreground truncate">{p.commune}</div>
                                                {p.is_exclusive && (
                                                    <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900">
                                                        <Star className="w-2.5 h-2.5" /> Exclusiva
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
                                                    {icon} {statusLabel}
                                                </span>
                                                {p.sold_at && (
                                                    <div className="text-[10px] text-muted-foreground mt-1">
                                                        Cerró: {formatDate(p.sold_at)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="outline" className="text-xs">{p.property_type}</Badge>
                                                <div className="text-xs text-muted-foreground capitalize mt-0.5">{p.operation_type}</div>
                                            </td>
                                            <td className="p-3 font-medium whitespace-nowrap text-sm">
                                                {formatPrice(p.price, p.currency)}
                                                {p.history && p.history.length > 1 && (() => {
                                                    const oldest = p.history[p.history.length - 1]
                                                    if (oldest.price && p.price && oldest.price !== p.price) {
                                                        const diff = ((p.price - oldest.price) / oldest.price * 100).toFixed(0)
                                                        return (
                                                            <div className={`text-[10px] flex items-center gap-0.5 ${Number(diff) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                                <TrendingDown className={`w-3 h-3 ${Number(diff) >= 0 ? 'rotate-180' : ''}`} />
                                                                {diff}%
                                                            </div>
                                                        )
                                                    }
                                                    return null
                                                })()}
                                            </td>
                                            <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(p.first_published_at || p.published_at)}
                                            </td>
                                            <td className="p-3">
                                                {p.total_versions > 1 ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                                                        <History className="w-3 h-3" /> {p.total_versions}v
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">1v</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">{p.agent_name}</span>
                                            </td>
                                            <td className="p-3">
                                                <a href={p.source_url} target="_blank" rel="noopener noreferrer"
                                                    className="text-blue-500 hover:text-blue-700 transition-colors">
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminPropertyImport
