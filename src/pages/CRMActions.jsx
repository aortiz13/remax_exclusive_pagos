import ActionList from '../components/crm/ActionList'
import ErrorBoundary from '../components/ErrorBoundary'

const CRMActions = () => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Acciones</h1>
                <p className="text-muted-foreground">Historial de acciones de tu CRM.</p>
            </div>

            <ErrorBoundary fallbackMessage="Error al cargar las acciones. Intenta recargar la página.">
                <ActionList />
            </ErrorBoundary>
        </div>
    )
}

export default CRMActions
