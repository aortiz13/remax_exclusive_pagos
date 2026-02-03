import { useState, useEffect, useRef } from 'react'
import { Search, User, FileText, Calendar, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

export default function GlobalSearch() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState({ contacts: [], tasks: [], requests: [] })
    const [loading, setLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const containerRef = useRef(null)
    const navigate = useNavigate()
    const { user } = useAuth()

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowResults(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const search = async () => {
            if (!query.trim() || !user) {
                setResults({ contacts: [], tasks: [], requests: [] })
                return
            }

            setLoading(true)
            try {
                const searchTerm = `%${query}%`

                // Parallel queries for better performance
                const [contactsRes, tasksRes, requestsRes] = await Promise.all([
                    supabase
                        .from('contacts')
                        .select('id, first_name, last_name, email')
                        .eq('agent_id', user.id)
                        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
                        .limit(3),
                    supabase
                        .from('crm_tasks')
                        .select('id, action, description, execution_date')
                        .eq('agent_id', user.id)
                        .or(`action.ilike.${searchTerm},description.ilike.${searchTerm}`)
                        .limit(3),
                    supabase
                        .from('requests')
                        .select('id, tipo_propiedad, direccion, comuna, status')
                        .or(`direccion.ilike.${searchTerm},comuna.ilike.${searchTerm},tipo_propiedad.ilike.${searchTerm}`)
                        .limit(3)
                ])

                setResults({
                    contacts: contactsRes.data || [],
                    tasks: tasksRes.data || [],
                    requests: requestsRes.data || []
                })
            } catch (error) {
                console.error('Search error:', error)
            } finally {
                setLoading(false)
            }
        }

        const debounce = setTimeout(search, 300)
        return () => clearTimeout(debounce)
    }, [query, user])

    const handleSelect = (type, item) => {
        setShowResults(false)
        setQuery('')

        switch (type) {
            case 'contact':
                navigate(`/contacts/${item.id}`)
                break
            case 'task':
                // For tasks, we might ideally open the modal in the calendar page.
                // Since that's complex to deep link, let's navigate to calendar for now.
                navigate('/calendar')
                break
            case 'request':
                // Navigate to request details (Assuming route exists or modal logic)
                // For now, staying on dashboard but maybe we can focus the table item?
                // Or if there is a detail view: navigate(`/requests/${item.id}`)
                // Given current dashboard structure:
                navigate('/dashboard') // Placeholder if no explicit detail route
                break
        }
    }

    const hasResults = results.contacts.length > 0 || results.tasks.length > 0 || results.requests.length > 0

    return (
        <div className="relative w-full max-w-xl mx-auto" ref={containerRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                    placeholder="Buscar en todo..."
                    className="pl-9 bg-white/50 backdrop-blur-sm border-slate-200 focus:bg-white transition-all rounded-full"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setShowResults(true)
                    }}
                    onFocus={() => setShowResults(true)}
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                )}
            </div>

            {showResults && query && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 p-2 z-50 max-h-[80vh] overflow-y-auto">
                    {!hasResults && !loading ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                            No se encontraron resultados
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {results.contacts.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1">
                                        <User className="w-3 h-3" /> Contactos
                                    </h3>
                                    {results.contacts.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => handleSelect('contact', c)}
                                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-xs">
                                                {c.first_name[0]}{c.last_name[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">{c.first_name} {c.last_name}</div>
                                                <div className="text-xs text-slate-500">{c.email}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {results.tasks.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Tareas
                                    </h3>
                                    {results.tasks.map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => handleSelect('task', t)}
                                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center text-purple-600">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-900 truncate">{t.action}</div>
                                                <div className="text-xs text-slate-500 truncate">{t.description || 'Sin descripción'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {results.requests.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1">
                                        <FileText className="w-3 h-3" /> Solicitudes
                                    </h3>
                                    {results.requests.map(r => (
                                        <div
                                            key={r.id}
                                            onClick={() => handleSelect('request', r)}
                                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center text-green-600">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">{r.tipo_propiedad} en {r.comuna}</div>
                                                <div className="text-xs text-slate-500">{r.direccion}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
