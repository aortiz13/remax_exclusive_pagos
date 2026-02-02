
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Building2, Wallet, FileBarChart } from 'lucide-react'
import DocumentRepository from './DocumentRepository'

/**
 * DocumentsHub
 * 
 * Central hub for all document categories using a tabbed interface.
 * Replaces individual routes for simpler navigation.
 */
const DocumentsHub = () => {
    // Determine default tab? Could read from URL query param if needed, 
    // but defaulting to 'purchase' is fine for now.
    const [activeTab, setActiveTab] = useState("purchase")

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Centro de Documentos</h1>
                <p className="text-muted-foreground">Accede a todos los formularios, contratos y plantillas oficiales.</p>
            </div>

            <Tabs defaultValue="purchase" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full h-auto flex-wrap md:flex-nowrap gap-2 bg-slate-100/50 p-1 mb-6">
                    <TabsTrigger value="purchase" className="flex items-center gap-2 py-2">
                        <Wallet className="h-4 w-4" />
                        <span className="hidden md:inline">Compraventa</span>
                        <span className="md:hidden">Compra</span>
                    </TabsTrigger>

                    <TabsTrigger value="rental" className="flex items-center gap-2 py-2">
                        <Building2 className="h-4 w-4" />
                        Arriendo
                    </TabsTrigger>

                    <TabsTrigger value="evaluations" className="flex items-center gap-2 py-2">
                        <FileBarChart className="h-4 w-4" />
                        <span className="hidden md:inline">Evaluaciones Comerciales</span>
                        <span className="md:hidden">Evals</span>
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Purchase */}
                <TabsContent value="purchase" className="border-none p-0 outline-none animate-in fade-in-50 duration-300">
                    <DocumentRepository category="purchase" />
                </TabsContent>

                {/* Tab: Rental */}
                <TabsContent value="rental" className="border-none p-0 outline-none animate-in fade-in-50 duration-300">
                    <DocumentRepository category="rental" />
                </TabsContent>

                {/* Tab: Evaluations */}
                <TabsContent value="evaluations" className="border-none p-0 outline-none animate-in fade-in-50 duration-300">
                    <DocumentRepository category="evaluations" />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default DocumentsHub
