import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { Users, TrendingUp, Phone, ArrowUpRight, Flame } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { withRetry } from '../../lib/fetchWithRetry'
import { motion, AnimatePresence } from 'framer-motion'

const TARGET_CONTACTS = 50

export default function ActiveContactsWidget() {
    const { user, profile } = useAuth()
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    const isAdminRole = ['superadministrador', 'comercial', 'legal', 'tecnico', 'administracion'].includes(profile?.role)

    useEffect(() => {
        if (user) fetchActiveContacts()
    }, [user])

    const fetchActiveContacts = async () => {
        try {
            // Step 1: Get contact IDs with most CRM activity (actions + tasks)
            // Count activity from crm_action_contacts junction table
            let actionsQuery = supabase
                .from('crm_action_contacts')
                .select('contact_id, action:crm_actions!inner(agent_id)')

            if (!isAdminRole) {
                actionsQuery = actionsQuery.eq('action.agent_id', user.id)
            }

            const { data: actionLinks } = await withRetry(() => actionsQuery)

            // Count activity from crm_tasks
            let tasksQuery = supabase
                .from('crm_tasks')
                .select('contact_id')
                .not('contact_id', 'is', null)

            if (!isAdminRole) {
                tasksQuery = tasksQuery.eq('agent_id', user.id)
            }

            const { data: taskLinks } = await withRetry(() => tasksQuery)

            // Aggregate activity counts per contact
            const activityMap = {}
            for (const a of (actionLinks || [])) {
                if (!a.contact_id) continue
                activityMap[a.contact_id] = (activityMap[a.contact_id] || 0) + 1
            }
            for (const t of (taskLinks || [])) {
                if (!t.contact_id) continue
                activityMap[t.contact_id] = (activityMap[t.contact_id] || 0) + 1
            }

            // Sort by activity count desc, take top 50
            const sortedIds = Object.entries(activityMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, TARGET_CONTACTS)
                .map(([id, count]) => ({ id, count }))

            if (sortedIds.length === 0) {
                setContacts([])
                setLoading(false)
                return
            }

            // Step 2: Fetch contact details for the top IDs
            const { data: contactDetails } = await withRetry(() =>
                supabase
                    .from('contacts')
                    .select('id, first_name, last_name, rating, status, last_contact_date, phone, email')
                    .in('id', sortedIds.map(s => s.id))
            )

            // Merge activity counts
            const merged = sortedIds.map(s => {
                const detail = (contactDetails || []).find(c => c.id === s.id)
                return detail ? { ...detail, activity_count: s.count } : null
            }).filter(Boolean)

            setContacts(merged)
        } catch (err) {
            console.error('Error fetching active contacts:', err)
        } finally {
            setLoading(false)
        }
    }

    const getActivityLevel = (count) => {
        if (count >= 10) return { label: 'Alta', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
        if (count >= 5) return { label: 'Media', color: 'bg-amber-100 text-amber-700 border-amber-200' }
        return { label: 'Baja', color: 'bg-slate-100 text-slate-600 border-slate-200' }
    }

    const getLastContactLabel = (date) => {
        if (!date) return { text: 'Sin contacto', color: 'text-red-500' }
        const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
        if (days === 0) return { text: 'Hoy', color: 'text-emerald-600' }
        if (days === 1) return { text: 'Ayer', color: 'text-emerald-600' }
        if (days <= 7) return { text: `Hace ${days}d`, color: 'text-emerald-600' }
        if (days <= 14) return { text: `Hace ${days}d`, color: 'text-amber-600' }
        if (days <= 30) return { text: `Hace ${days}d`, color: 'text-amber-600' }
        return { text: `Hace ${days}d`, color: 'text-red-500' }
    }

    const ratingBadge = (rating) => {
        const map = {
            'A+': 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 shadow-sm',
            'A': 'bg-blue-100 text-blue-700',
            'B': 'bg-emerald-100 text-emerald-700',
            'C': 'bg-slate-100 text-slate-600',
            'D': 'bg-red-100 text-red-600',
        }
        return map[rating] || 'bg-slate-100 text-slate-500'
    }

    // Progress ring SVG
    const progress = Math.min(contacts.length / TARGET_CONTACTS, 1)
    const circumference = 2 * Math.PI * 18
    const strokeDashoffset = circumference * (1 - progress)
    const ringColor = progress >= 0.8 ? '#10b981' : progress >= 0.5 ? '#f59e0b' : '#ef4444'

    return (
        <Card className="h-full border-slate-200/80 shadow-sm flex flex-col overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                    {/* Mini progress ring */}
                    <div className="relative w-11 h-11 shrink-0">
                        <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                            <circle cx="20" cy="20" r="18" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                            <circle
                                cx="20" cy="20" r="18" fill="none"
                                stroke={ringColor}
                                strokeWidth="3"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-700"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-700">{contacts.length}</span>
                        </div>
                    </div>
                    <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                            Contactos Activos
                        </CardTitle>
                        <p className="text-[11px] text-slate-400 mt-0.5">Top {TARGET_CONTACTS} con más actividad CRM</p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200">
                {loading ? (
                    <div className="space-y-2.5">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 text-sm py-10">
                        <Users className="w-8 h-8 mb-2 opacity-40" />
                        <p>Sin contactos activos aún.</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {contacts.map((contact, idx) => {
                            const lastContact = getLastContactLabel(contact.last_contact_date)
                            const activity = getActivityLevel(contact.activity_count)
                            return (
                                <motion.div
                                    key={contact.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    onClick={() => navigate(`/crm/contact/${contact.id}`)}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 bg-white hover:bg-indigo-50/30 cursor-pointer transition-all group"
                                >
                                    {/* Avatar initials */}
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 border border-indigo-200/50">
                                        {contact.first_name?.[0]}{contact.last_name?.[0]}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-slate-800 truncate">
                                                {contact.first_name} {contact.last_name}
                                            </span>
                                            {contact.rating && (
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ratingBadge(contact.rating)}`}>
                                                    {contact.rating}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[10px] font-medium ${lastContact.color}`}>{lastContact.text}</span>
                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${activity.color}`}>
                                                <Flame className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />{contact.activity_count}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </CardContent>

            {contacts.length > 0 && (
                <div className="pt-2 pb-3 px-4 mt-auto border-t border-slate-100">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-slate-500 hover:text-indigo-600" onClick={() => navigate('/crm')}>
                        Ver todos en CRM
                    </Button>
                </div>
            )}
        </Card>
    )
}
