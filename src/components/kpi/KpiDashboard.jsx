
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, ClipboardList, Target, UserCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import KpiOverview from './KpiOverview'
import KpiDataEntry from './KpiDataEntry'
import LeadKpiDashboard from './LeadKpiDashboard'

const LEAD_KPI_ROLES = ['comercial', 'legal', 'superadministrador', 'tecnico']

const KpiDashboard = () => {
    const { profile } = useAuth()
    const isAgent = profile?.role === 'agent'
    const showLeadKpis = LEAD_KPI_ROLES.includes(profile?.role)
    const [activeTab, setActiveTab] = useState(isAgent ? 'overview' : (showLeadKpis ? 'leads' : 'overview'))

    // Count visible tabs for grid layout
    const tabCount = (isAgent ? 2 : 0) + (showLeadKpis ? 1 : 0) + (isAgent ? 0 : 1)
    const effectiveTabCount = showLeadKpis && !isAgent ? 2 : 2

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {isAgent ? 'Indicadores Clave' : 'Leads'}
                </h1>
                <p className="text-muted-foreground">
                    {isAgent
                        ? 'Monitorea tu rendimiento, gestiona tus objetivos y registra tu avance semanal.'
                        : 'Seguimiento de leads derivados y rendimiento de agentes.'
                    }
                </p>
            </div>

            <Tabs defaultValue={isAgent ? 'overview' : (showLeadKpis ? 'leads' : 'overview')} className="w-full" onValueChange={setActiveTab}>
                <TabsList className={`grid w-full max-w-[500px] grid-cols-2`}>
                    {/* Agents: Dashboard + Carga de Datos */}
                    {isAgent && (
                        <>
                            <TabsTrigger value="overview" className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Dashboard
                            </TabsTrigger>
                            <TabsTrigger value="entry" className="flex items-center gap-2">
                                <ClipboardList className="h-4 w-4" />
                                Carga de Datos
                            </TabsTrigger>
                        </>
                    )}
                    {/* Non-agents: Leads Derivados + KPIs Agentes */}
                    {!isAgent && showLeadKpis && (
                        <>
                            <TabsTrigger value="leads" className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Leads Derivados
                            </TabsTrigger>
                            <TabsTrigger value="overview" className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                KPIs Agentes
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>

                <TabsContent value="overview" className="mt-6 border-none p-0 outline-none">
                    <KpiOverview />
                </TabsContent>

                {showLeadKpis && (
                    <TabsContent value="leads" className="mt-6 border-none p-0 outline-none">
                        <LeadKpiDashboard />
                    </TabsContent>
                )}

                {isAgent && (
                    <TabsContent value="entry" className="mt-6 border-none p-0 outline-none">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <KpiDataEntry />
                        </div>
                    </TabsContent>
                )}

            </Tabs>
        </div>
    )
}

export default KpiDashboard
