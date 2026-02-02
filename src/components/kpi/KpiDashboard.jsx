
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, ClipboardList, Target } from 'lucide-react'
import KpiOverview from './KpiOverview'
import WeeklyKpiForm from './WeeklyKpiForm'
import AgentGoalsForm from './AgentGoalsForm'

const KpiDashboard = () => {
    const [activeTab, setActiveTab] = useState("overview")

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Indicadores Clave</h1>
                <p className="text-muted-foreground">Monitorea tu rendimiento, gestiona tus objetivos y registra tu avance semanal.</p>
            </div>

            <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-[500px] grid-cols-3">
                    <TabsTrigger value="overview" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="entry" className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Carga Semanal
                    </TabsTrigger>
                    <TabsTrigger value="goals" className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Mis Objetivos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 border-none p-0 outline-none">
                    <KpiOverview />
                </TabsContent>

                <TabsContent value="entry" className="mt-6 border-none p-0 outline-none">
                    <WeeklyKpiForm />
                </TabsContent>

                <TabsContent value="goals" className="mt-6 border-none p-0 outline-none">
                    <AgentGoalsForm />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default KpiDashboard
