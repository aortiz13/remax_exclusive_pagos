import { useState } from 'react'
import PropertyMap from '../components/crm/PropertyMap'

const PropertyMapPage = () => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Mapa de Propiedades</h1>
                <p className="text-muted-foreground">Visualiza las propiedades de tu cartera en el mapa.</p>
            </div>

            <div className="h-[calc(100vh-200px)] min-h-[500px]">
                <PropertyMap />
            </div>
        </div>
    )
}

export default PropertyMapPage
