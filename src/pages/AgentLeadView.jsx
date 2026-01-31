import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { Card, CardContent } from "@/components/ui" // Verify import path
import { Loader2, AlertCircle } from "lucide-react"

// Reuse JSONViewer from LeadDetail or extract to separate component? 
// For now, I'll duplicate the simple version or the refined one used in LeadDetail.
// To keep it consistent with the "Refined" version in LeadDetail.

const JSONViewer = ({ data, level = 0 }) => {
    if (!data) return <span className="text-muted-foreground italic">Sin datos</span>

    if (typeof data !== 'object') {
        return <span className="font-mono text-slate-700 dark:text-slate-300">{String(data)}</span>
    }

    if (Array.isArray(data)) {
        return (
            <div className="space-y-2">
                {data.map((item, index) => (
                    <div key={index} className="pl-4 border-l-2 border-slate-100 dark:border-slate-800">
                        <JSONViewer data={item} level={level + 1} />
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className={`space-y-2 ${level > 0 ? 'mt-2' : ''}`}>
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
                        {key.replace(/_/g, ' ')}
                    </span>
                    <div className="pl-1">
                        <JSONViewer data={value} level={level + 1} />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function AgentLeadView() {
    const { id } = useParams()
    const [lead, setLead] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchLead = async () => {
            try {
                // Support both UUID and Short ID
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

                let query = supabase
                    .from('external_leads')
                    .select('*')

                if (isUUID) {
                    query = query.eq('id', id)
                } else {
                    query = query.eq('short_id', id)
                }

                const { data, error } = await query.single()

                if (error) throw error
                setLead(data)
            } catch (error) {
                console.error('Error fetching lead:', error)
            } finally {
                setLoading(false)
            }
        }

        if (id) {
            fetchLead()
        }
    }, [id])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!lead) {
        return (
            <div className="flex h-screen items-center justify-center flex-col gap-4 p-4 text-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h1 className="text-2xl font-bold">Solicitud no encontrada</h1>
                <p className="text-muted-foreground">La solicitud que buscas no existe o ha sido eliminada.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Detalles del Lead</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        ID: <span className="font-mono">{lead.short_id || lead.id}</span>
                    </p>
                </div>

                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-100">
                    ℹ️ Esta es una vista exclusiva para el agente asignado.
                </div>

                <Card>
                    <CardContent className="p-6">
                        <JSONViewer data={lead.raw_data} />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
