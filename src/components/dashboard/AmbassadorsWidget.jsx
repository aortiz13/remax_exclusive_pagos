import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { Star, ArrowUpRight, Crown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { withRetry } from '../../lib/fetchWithRetry'
import { motion, AnimatePresence } from 'framer-motion'

export default function AmbassadorsWidget() {
    const { user, profile } = useAuth()
    const [ambassadors, setAmbassadors] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    const isAdminRole = ['superadministrador', 'comercial', 'legal', 'tecnico', 'administracion'].includes(profile?.role)

    useEffect(() => {
        if (user) fetchAmbassadors()
    }, [user])

    const fetchAmbassadors = async () => {
        try {
            let query = supabase
                .from('contacts')
                .select('id, first_name, last_name, rating, status, last_contact_date, phone, email, source')
                .in('rating', ['A+', 'A'])
                .order('last_contact_date', { ascending: true, nullsFirst: true })

            if (!isAdminRole) {
                query = query.eq('agent_id', user.id)
            }

            const { data, error } = await withRetry(() => query)
            if (error) throw error
            setAmbassadors(data || [])
        } catch (err) {
            console.error('Error fetching ambassadors:', err)
        } finally {
            setLoading(false)
        }
    }

    const getContactStatus = (date) => {
        if (!date) return { emoji: '🔴', text: 'Sin contacto', color: 'text-red-500', dotColor: 'bg-red-500', needsAttention: true }
        const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
        if (days <= 30) return { emoji: '🟢', text: days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${days}d`, color: 'text-emerald-600', dotColor: 'bg-emerald-500', needsAttention: false }
        if (days <= 60) return { emoji: '🟡', text: `Hace ${days}d`, color: 'text-amber-600', dotColor: 'bg-amber-500', needsAttention: false }
        return { emoji: '🔴', text: `Hace ${days}d`, color: 'text-red-500', dotColor: 'bg-red-500', needsAttention: true }
    }

    const needsAttentionCount = ambassadors.filter(a => {
        if (!a.last_contact_date) return true
        return Math.floor((Date.now() - new Date(a.last_contact_date).getTime()) / (1000 * 60 * 60 * 24)) > 30
    }).length

    const attendedThisMonth = ambassadors.filter(a => {
        if (!a.last_contact_date) return false
        const d = new Date(a.last_contact_date)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    return (
        <Card className={`h-full border-slate-200/80 shadow-sm flex flex-col overflow-hidden transition-all ${needsAttentionCount > 0 ? 'ring-1 ring-amber-300/60' : ''}`}>
            {/* Premium gold gradient header */}
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-amber-50/80 via-yellow-50/50 to-transparent">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center shadow-sm">
                        <Crown className="w-5 h-5 text-amber-900" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                            Embajadores
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 shadow-sm">
                                {ambassadors.length}
                            </span>
                        </CardTitle>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {attendedThisMonth}/{ambassadors.length} contactados este mes
                        </p>
                    </div>
                </div>

                {needsAttentionCount > 0 && (
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200"
                    >
                        ⚠️ {needsAttentionCount} pendiente{needsAttentionCount > 1 ? 's' : ''}
                    </motion.div>
                )}
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200">
                {loading ? (
                    <div className="space-y-2.5">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : ambassadors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 text-sm py-10">
                        <Star className="w-8 h-8 mb-2 opacity-40" />
                        <p>Sin embajadores A/A+</p>
                        <p className="text-[11px] text-slate-400 mt-1">Clasifica contactos con rating A o A+ en el CRM</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {ambassadors.map((amb, idx) => {
                            const status = getContactStatus(amb.last_contact_date)
                            return (
                                <motion.div
                                    key={amb.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    onClick={() => navigate(`/crm/contact/${amb.id}`)}
                                    className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all group
                                        ${status.needsAttention
                                            ? 'border-red-100 bg-red-50/30 hover:border-red-200 hover:bg-red-50/60'
                                            : 'border-slate-100 bg-white hover:border-amber-200 hover:bg-amber-50/20'
                                        }
                                    `}
                                >
                                    {/* Avatar with gold ring for A+ */}
                                    <div className={`relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                        amb.rating === 'A+'
                                            ? 'bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-700 ring-2 ring-amber-300/60'
                                            : 'bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-1 ring-blue-200/50'
                                    }`}>
                                        {amb.first_name?.[0]}{amb.last_name?.[0]}
                                        {/* Status dot */}
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${status.dotColor}`} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-slate-800 truncate">
                                                {amb.first_name} {amb.last_name}
                                            </span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                amb.rating === 'A+'
                                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 shadow-sm'
                                                    : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {amb.rating}
                                            </span>
                                        </div>
                                        <p className={`text-[11px] font-medium mt-0.5 ${status.color}`}>
                                            {status.emoji} {status.text}
                                        </p>
                                    </div>

                                    <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors shrink-0" />
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </CardContent>

            {ambassadors.length > 0 && (
                <div className="pt-2 pb-3 px-4 mt-auto border-t border-slate-100 bg-gradient-to-r from-amber-50/30 to-transparent">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-slate-500 hover:text-amber-700" onClick={() => navigate('/crm')}>
                        Ver todos en CRM
                    </Button>
                </div>
            )}
        </Card>
    )
}
