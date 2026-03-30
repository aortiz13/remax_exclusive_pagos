
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, ClipboardList, List } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import KpiOverview from './KpiOverview'
import KpiDataEntry from './KpiDataEntry'
import AgentKpiRecords from './AgentKpiRecords'
import LeadKpiDashboard from './LeadKpiDashboard'

const LEAD_KPI_ROLES = ['comercial', 'legal', 'superadministrador', 'tecnico']

const KpiDashboard = () => {
    const { profile } = useAuth()
    const isAgent = profile?.role === 'agent'
    const showLeadKpis = LEAD_KPI_ROLES.includes(profile?.role)

    // Non-agents: render LeadKpiDashboard directly, no tabs
    if (!isAgent && showLeadKpis) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
                <LeadKpiDashboard />
            </div>
        )
    }

    // Agents: original tabbed layout
    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Indicadores Clave</h1>
                <p className="text-muted-foreground">Monitorea tu rendimiento, gestiona tus objetivos y registra tu avance semanal.</p>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full max-w-[680px] grid-cols-3">
                    <TabsTrigger value="overview" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="records" className="flex items-center gap-2">
                        <List className="h-4 w-4" />
                        Registros Detallados
                    </TabsTrigger>
                    <TabsTrigger value="entry" className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Carga de Datos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 border-none p-0 outline-none">
                    <KpiOverview />
                </TabsContent>

                <TabsContent value="records" className="mt-6 border-none p-0 outline-none">
                    <AgentKpiRecords />
                </TabsContent>

                <TabsContent value="entry" className="mt-6 border-none p-0 outline-none">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <KpiDataEntry />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default KpiDashboard
