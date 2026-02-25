import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { Badge } from '@/components/ui'
import {
    Calendar, TrendingDown, TrendingUp, Clock, Eye, EyeOff, Handshake,
    RefreshCw, DollarSign, MapPin, Video, Compass, Car, Layers, Star, ExternalLink
} from 'lucide-react'

const STATUS_CONFIG = {
    160: { label: 'Activa', color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', icon: Eye },
    162: { label: 'Retirada', color: 'bg-gray-400', textColor: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-800', icon: EyeOff },
    167: { label: 'Concretada', color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-950/30', icon: Handshake },
    168: { label: 'Pendiente', color: 'bg-yellow-400', textColor: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950/30', icon: Clock },
    169: { label: 'Pausada', color: 'bg-orange-400', textColor: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-50 dark:bg-orange-950/30', icon: Clock },
}

const PropertyTimeline = ({ propertyId, property }) => {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (propertyId) fetchHistory()
    }, [propertyId])

    const fetchHistory = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('property_listing_history')
                .select('*')
                .eq('property_id', propertyId)
                .order('published_at', { ascending: true })

            if (!error && data) setHistory(data)
        } catch (err) {
            console.error('Error fetching history:', err)
        } finally {
            setLoading(false)
        }
    }

    const stats = useMemo(() => {
        if (!property && history.length === 0) return null

        const prices = history.filter(h => h.price).map(h => Number(h.price))
        const firstPrice = prices[0]
        const lastPrice = prices[prices.length - 1]
        const priceChange = firstPrice && lastPrice && firstPrice !== lastPrice
            ? ((lastPrice - firstPrice) / firstPrice * 100).toFixed(1)
            : null

        const publishedDates = history.filter(h => h.published_at).map(h => new Date(h.published_at))
        const firstDate = publishedDates.length > 0 ? publishedDates[0] : (property?.published_at ? new Date(property.published_at) : null)
        const daysOnMarket = firstDate ? Math.ceil((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) : null

        const closedDeals = history.filter(h => h.listing_status_uid === 167).length

        return {
            totalVersions: history.length,
            priceChange,
            daysOnMarket,
            closedDeals,
            firstPrice,
            lastPrice,
        }
    }, [history, property])

    const formatDate = (iso) => {
        if (!iso) return '-'
        return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const formatPrice = (price, currency) => {
        if (!price) return '-'
        const c = currency || property?.currency || ''
        const prefix = c === 'CLP' ? '$' : c
        return `${prefix} ${new Intl.NumberFormat('es-CL').format(price)}`
    }

    // If no RE/MAX data
    if (!loading && history.length === 0 && !property?.listing_reference) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Esta propiedad no tiene datos de historial RE/MAX.</p>
                <p className="text-xs mt-1">Solo las propiedades importadas desde RE/MAX muestran la línea de tiempo.</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const PriceMiniChart = () => {
        const prices = history.filter(h => h.price).map(h => Number(h.price))
        if (prices.length < 2) return null

        const max = Math.max(...prices)
        const min = Math.min(...prices)
        const range = max - min || 1
        const width = 200
        const height = 50
        const padding = 4

        const points = prices.map((p, i) => {
            const x = padding + (i / (prices.length - 1)) * (width - padding * 2)
            const y = height - padding - ((p - min) / range) * (height - padding * 2)
            return `${x},${y}`
        }).join(' ')

        const lastPoint = points.split(' ').pop()
        const isDown = prices[prices.length - 1] < prices[0]

        return (
            <div className="relative">
                <svg width={width} height={height} className="overflow-visible">
                    <defs>
                        <linearGradient id="priceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={isDown ? '#ef4444' : '#22c55e'} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={isDown ? '#ef4444' : '#22c55e'} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon
                        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
                        fill="url(#priceGrad)"
                    />
                    <polyline
                        points={points}
                        fill="none"
                        stroke={isDown ? '#ef4444' : '#22c55e'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle
                        cx={lastPoint?.split(',')[0]}
                        cy={lastPoint?.split(',')[1]}
                        r="3"
                        fill={isDown ? '#ef4444' : '#22c55e'}
                    />
                </svg>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Quick Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/50">
                        <div className="flex items-center gap-2 mb-1">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Publicaciones</span>
                        </div>
                        <div className="text-xl font-bold text-blue-800 dark:text-blue-200">{stats.totalVersions}</div>
                    </div>

                    {stats.daysOnMarket !== null && (
                        <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 p-3.5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                            <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-3.5 h-3.5 text-purple-500" />
                                <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">Días en Mercado</span>
                            </div>
                            <div className="text-xl font-bold text-purple-800 dark:text-purple-200">{stats.daysOnMarket}</div>
                        </div>
                    )}

                    {stats.priceChange !== null && (
                        <div className={`p-3.5 rounded-xl border ${Number(stats.priceChange) < 0
                            ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 border-red-100 dark:border-red-900/50'
                            : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 border-green-100 dark:border-green-900/50'
                            }`}>
                            <div className="flex items-center gap-2 mb-1">
                                {Number(stats.priceChange) < 0
                                    ? <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                    : <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
                                <span className={`text-[10px] font-medium uppercase tracking-wider ${Number(stats.priceChange) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>Var. Precio</span>
                            </div>
                            <div className={`text-xl font-bold ${Number(stats.priceChange) < 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                {stats.priceChange}%
                            </div>
                        </div>
                    )}

                    {stats.closedDeals > 0 && (
                        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                            <div className="flex items-center gap-2 mb-1">
                                <Handshake className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Cierres</span>
                            </div>
                            <div className="text-xl font-bold text-amber-800 dark:text-amber-200">{stats.closedDeals}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Price Mini Chart */}
            <div className="flex items-center gap-4 flex-wrap">
                <PriceMiniChart />
                {/* Extra info badges */}
                <div className="flex flex-wrap gap-2">
                    {property?.is_exclusive && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 shadow-sm">
                            <Star className="w-3 h-3" /> Exclusiva
                        </span>
                    )}
                    {property?.virtual_tour_url && (
                        <a href={property.virtual_tour_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 hover:bg-cyan-200 transition-colors">
                            <Compass className="w-3 h-3" /> Tour 360°
                        </a>
                    )}
                    {property?.video_url && (
                        <a href={property.video_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 hover:bg-rose-200 transition-colors">
                            <Video className="w-3 h-3" /> Video
                        </a>
                    )}
                    {property?.parking_spaces > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Car className="w-3 h-3" /> {property.parking_spaces} Est.
                        </span>
                    )}
                    {property?.floor_number && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Layers className="w-3 h-3" /> Piso {property.floor_number}
                        </span>
                    )}
                </div>
            </div>

            {/* Key Dates Row */}
            <div className="flex flex-wrap gap-3 text-xs">
                {property?.published_at && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300">
                        <Calendar className="w-3 h-3" />
                        <span className="font-medium">Publicada:</span> {formatDate(property.published_at)}
                    </div>
                )}
                {property?.last_updated_at && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                        <RefreshCw className="w-3 h-3" />
                        <span className="font-medium">Última act.:</span> {formatDate(property.last_updated_at)}
                    </div>
                )}
                {property?.expires_at && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/50 text-orange-700 dark:text-orange-300">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">Expira:</span> {formatDate(property.expires_at)}
                    </div>
                )}
                {property?.sold_at && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 text-amber-700 dark:text-amber-300">
                        <Handshake className="w-3 h-3" />
                        <span className="font-medium">Cerrada:</span> {formatDate(property.sold_at)}
                        {property?.sold_price && <span className="ml-1">({formatPrice(property.sold_price, property.currency)})</span>}
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-indigo-300 to-purple-300 dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700 rounded-full" />

                <div className="space-y-4">
                    {history.map((entry, idx) => {
                        const isFirst = idx === 0
                        const isLast = idx === history.length - 1
                        const config = STATUS_CONFIG[entry.listing_status_uid] || STATUS_CONFIG[162]
                        const Icon = config.icon

                        // Price change from previous
                        let priceChangeEl = null
                        if (idx > 0) {
                            const prevPrice = history[idx - 1].price
                            if (prevPrice && entry.price && prevPrice !== entry.price) {
                                const diff = ((entry.price - prevPrice) / prevPrice * 100).toFixed(1)
                                priceChangeEl = (
                                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ml-2 ${Number(diff) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {Number(diff) < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                        {diff}%
                                    </span>
                                )
                            }
                        }

                        return (
                            <div key={entry.id} className="relative pl-10 animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 80}ms` }}>
                                {/* Dot */}
                                <div className={`absolute left-[11px] top-3 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${config.color} ${isLast ? 'ring-2 ring-offset-1 ring-indigo-300 dark:ring-indigo-700' : ''}`} />

                                <div className={`p-3.5 rounded-xl border transition-all hover:shadow-md ${config.bgColor} ${isLast ? 'ring-1 ring-indigo-200 dark:ring-indigo-800' : ''}`}>
                                    {/* Header Row */}
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${config.bgColor} ${config.textColor} border`}>
                                                <Icon className="w-3 h-3" /> {config.label}
                                            </span>
                                            {isFirst && <Badge variant="outline" className="text-[10px] h-5">Primera publicación</Badge>}
                                            {isLast && !isFirst && <Badge className="bg-indigo-600 text-white text-[10px] h-5">Versión Actual</Badge>}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            ID: {entry.remax_listing_id || '—'}
                                        </span>
                                    </div>

                                    {/* Details Row */}
                                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="font-medium">{formatDate(entry.published_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="font-semibold">{formatPrice(entry.price, entry.currency)}</span>
                                            {priceChangeEl}
                                        </div>
                                        {entry.expired_at && (
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span className="text-xs">Exp: {formatDate(entry.expired_at)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default PropertyTimeline
