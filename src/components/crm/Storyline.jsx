
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { User, Home, Link as LinkIcon, Edit, PlusCircle, FileText, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const ACTION_ICONS = {
    'Creó': <PlusCircle className="w-4 h-4 text-green-500" />,
    'Editó': <Edit className="w-4 h-4 text-blue-500" />,
    'Vinculó': <LinkIcon className="w-4 h-4 text-purple-500" />,
    'Tarea': <CheckCircle2 className="w-4 h-4 text-orange-500" />,
    'Nota': <FileText className="w-4 h-4 text-yellow-500" />
}

const Storyline = ({ propertyId, contactId }) => {
    const navigate = useNavigate()
    const [activities, setActivities] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchActivities()

        // Subscribe to changes
        const channel = supabase
            .channel('activity_logs_feed')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
                const newLog = payload.new
                // Filter client side to avoid complexity or just re-fetch
                if ((propertyId && newLog.property_id === propertyId) || (contactId && newLog.contact_id === contactId)) {
                    fetchActivities()
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [propertyId, contactId])

    const fetchActivities = async () => {
        try {
            let query = supabase
                .from('activity_logs')
                .select('*')

            // Note: Since actor_id is FK to auth.users, supabase standard client can't always join it directly depending on permissions.
            // Let's just fetch logs for now.

            if (propertyId) {
                query = query.eq('property_id', propertyId)
            } else if (contactId) {
                query = query.eq('contact_id', contactId)
            }

            const { data, error } = await query.order('created_at', { ascending: false })

            if (error) throw error
            setActivities(data || [])
        } catch (error) {
            console.error('Error fetching storyline:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="text-sm text-gray-400 p-4">Cargando actividad...</div>

    return (
        <div className="space-y-4">
            {activities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    No hay actividad registrada aún.
                </div>
            )}

            <div className="relative border-l border-gray-200 dark:border-gray-800 ml-3 space-y-6">
                {activities.map((activity) => (
                    <div key={activity.id} className="mb-8 ml-6 relative group">
                        <span className="absolute flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-900 rounded-full -left-9 ring-4 ring-white dark:ring-gray-900 border border-gray-200 dark:border-gray-700">
                            {ACTION_ICONS[activity.action] || <User className="w-3 h-3 text-gray-500" />}
                        </span>

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] px-1 h-5">{activity.action}</Badge>
                                <span className="text-xs text-muted-foreground capitalize">
                                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: es })}
                                </span>
                            </div>

                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {activity.description}
                            </h4>

                            {/* Detailed Context if Any */}
                            {activity.details && Object.keys(activity.details).length > 0 && (
                                <div className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded border text-gray-600 dark:text-gray-300">
                                    {/* Simple key-value rendering or specifically formatting changes */}
                                    {JSON.stringify(activity.details).slice(0, 100)}
                                </div>
                            )}

                            {/* Entity Link/Chip */}
                            {/* Entity Link/Chip */}
                            <div className="mt-1 flex flex-wrap gap-2">
                                {activity.property_id && (
                                    <span
                                        className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 cursor-pointer hover:bg-blue-100 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            navigate(`/crm/property/${activity.property_id}`)
                                        }}
                                        title="Ver Propiedad"
                                    >
                                        <Home className="w-3 h-3" />
                                        Propiedad
                                    </span>
                                )}

                                {activity.contact_id && (
                                    <span
                                        className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer hover:bg-emerald-100 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            navigate(`/crm/contact/${activity.contact_id}`)
                                        }}
                                        title="Ver Contacto"
                                    >
                                        <User className="w-3 h-3" />
                                        Contacto
                                    </span>
                                )}

                                {/* Fallback if no specific IDs but entity_type is set (e.g. legacy or other types) */}
                                {!activity.property_id && !activity.contact_id && activity.entity_type && (
                                    <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                                        {activity.entity_type === 'Propiedad' ? <Home className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                        {activity.entity_type}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Storyline
