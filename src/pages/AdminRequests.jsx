import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { KanbanBoard } from '../components/kanban/KanbanBoard'
import { RequestDetailModal } from '../components/kanban/RequestDetailModal'
import { toast } from 'sonner'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export default function AdminRequests() {
    const { profile, loading: authLoading, user } = useAuth()
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)

    const [selectedRequest, setSelectedRequest] = useState(null)

    useEffect(() => {
        if (profile?.role === 'admin') {
            fetchRequests()
        }
    }, [profile])


    const fetchRequests = async () => {
        try {
            setLoading(true)
            // Fetch all requests that are NOT draft (meaning they are submitted/pending, or already processed)
            const { data, error } = await supabase
                .from('requests')
                .select('*, user:user_id(first_name, last_name, email, phone)')
                .neq('status', 'draft') // We only want submitted requests
                .order('updated_at', { ascending: false })

            if (error) throw error
            setRequests(data)
        } catch (error) {
            console.error('Error fetching requests:', error)
            toast.error('Error al cargar solicitudes')
        } finally {
            setLoading(false)
        }
    }

    const handleStatusChange = async (requestId, newStatus) => {
        // Optimistic update
        const previousRequests = [...requests]
        const previousStatus = requests.find(r => r.id === requestId)?.status || 'submitted'

        setRequests(prev => prev.map(r =>
            r.id === requestId ? { ...r, status: newStatus } : r
        ))

        try {
            // 1. Update request status
            const { error: updateError } = await supabase
                .from('requests')
                .update({ status: newStatus })
                .eq('id', requestId)

            if (updateError) throw updateError

            // 2. Insert audit log
            const { error: auditError } = await supabase
                .from('request_audit_logs')
                .insert({
                    request_id: requestId,
                    actor_id: user.id,
                    previous_status: previousStatus,
                    new_status: newStatus
                })

            if (auditError) {
                console.error('Error saving audit log:', auditError)
                // We don't revert the status change just because audit log failed, but we log it.
            }

            toast.success(`Solicitud movida a ${newStatus}`)

        } catch (error) {
            console.error('Error updating status:', error)
            toast.error('Error al actualizar estado')
            // Revert optimistic update
            setRequests(previousRequests)
        }
    }

    // Protect: Only admin
    if (!authLoading && profile?.role !== 'admin') {
        return <Navigate to="/dashboard" />
    }

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-50 dark:bg-slate-950">
            <div className="container mx-auto px-4 py-6 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Tablero de Solicitudes</h1>
                        <p className="text-slate-500">Gestiona y mueve las solicitudes entre los diferentes estados.</p>
                    </div>
                    {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
                </div>

                <div className="flex-1 overflow-hidden">
                    {loading && requests.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <KanbanBoard
                            requests={requests}
                            onStatusChange={handleStatusChange}
                            onViewDetail={setSelectedRequest}
                        />
                    )}
                </div>
            </div>

            <RequestDetailModal
                request={selectedRequest}
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
            />
        </div>
    )
}
