import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, ClipboardList, Home, Target } from 'lucide-react'
import ContactList from '../components/crm/ContactList'
import PropertyList from '../components/crm/PropertyList'
import TaskBoard from '../components/crm/TaskBoard'
import LeadList from '../components/crm/LeadList'

const CRM = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || 'contacts'
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)')
        const handler = (e) => setIsMobile(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const handleTabChange = (value) => {
        setSearchParams({ tab: value })
    }

    const tabs = [
        { value: 'contacts', label: 'Contactos', icon: Users },
        { value: 'properties', label: 'Propiedades', icon: Home },
        { value: 'leads', label: 'Leads', icon: Target },
        { value: 'tasks', label: 'Tareas', icon: ClipboardList },
    ]

    return (
        <div className={isMobile ? "space-y-3" : "space-y-6"}>
            {/* Header — compact on mobile */}
            <div className="flex flex-col gap-1">
                <h1 className={`font-bold tracking-tight text-gray-900 dark:text-white ${isMobile ? 'text-xl' : 'text-3xl'}`}>
                    CRM
                </h1>
                {!isMobile && (
                    <p className="text-muted-foreground">Gestiona tus contactos, propiedades y leads en un solo lugar.</p>
                )}
            </div>

            <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
                {/* Mobile: fixed bottom-style tab bar at top */}
                {isMobile ? (
                    <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 gap-0.5">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.value
                            return (
                                <button
                                    key={tab.value}
                                    onClick={() => handleTabChange(tab.value)}
                                    className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium transition-all ${
                                        isActive
                                            ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <TabsList className="grid w-full max-w-[800px] grid-cols-4">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            return (
                                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                </TabsTrigger>
                            )
                        })}
                    </TabsList>
                )}

                <TabsContent value="contacts" className={isMobile ? "mt-3" : "mt-6"}>
                    <ContactList />
                </TabsContent>

                <TabsContent value="properties" className={isMobile ? "mt-3" : "mt-6"}>
                    <PropertyList />
                </TabsContent>

                <TabsContent value="leads" className={isMobile ? "mt-3" : "mt-6"}>
                    <LeadList />
                </TabsContent>

                <TabsContent value="tasks" className={isMobile ? "mt-3" : "mt-6"}>
                    <TaskBoard />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default CRM
