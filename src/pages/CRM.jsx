import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, ClipboardList, Home } from 'lucide-react'
import ContactList from '../components/crm/ContactList'
import PropertyList from '../components/crm/PropertyList'
import TaskBoard from '../components/crm/TaskBoard'

const CRM = () => {
    const [activeTab, setActiveTab] = useState("contacts")

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">CRM</h1>
                <p className="text-muted-foreground">Gestiona tus contactos y tareas en un solo lugar.</p>
            </div>

            <Tabs defaultValue="contacts" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-[600px] grid-cols-3">
                    <TabsTrigger value="contacts" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Contactos
                    </TabsTrigger>
                    <TabsTrigger value="properties" className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Propiedades
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Tareas
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="contacts" className="mt-6">
                    <ContactList />
                </TabsContent>

                <TabsContent value="properties" className="mt-6">
                    <PropertyList />
                </TabsContent>

                <TabsContent value="tasks" className="mt-6">
                    <TaskBoard />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default CRM
