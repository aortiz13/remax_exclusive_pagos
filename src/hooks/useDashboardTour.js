import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useAuth } from '../context/AuthContext'

export const useDashboardTour = () => {
    const { user } = useAuth()
    const driverObj = useRef(null)

    useEffect(() => {
        driverObj.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: 'Listo',
            nextBtnText: 'Siguiente',
            prevBtnText: 'Atrás',
            progressText: 'Paso {{current}} de {{total}}',
            steps: [
                {
                    element: '#tour-welcome',
                    popover: {
                        title: 'Bienvenido a tu Panel de Control',
                        description: 'Aquí podrás gestionar todas tus solicitudes de contratos y arriendos de forma centralizada.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#tour-new-request',
                    popover: {
                        title: 'Nueva Solicitud',
                        description: 'Haz clic aquí para iniciar una nueva solicitud de contrato de compraventa, arriendo o generar links de pago.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: '#tour-search',
                    popover: {
                        title: 'Buscador Inteligente',
                        description: 'Encuentra rápidamente tus solicitudes por dirección, nombre del cliente o tipo de operación.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#tour-requests-list',
                    popover: {
                        title: 'Tus Solicitudes',
                        description: 'Aquí aparecerán tus borradores y solicitudes enviadas. Haz clic en cualquiera para ver detalles o continuar editando.',
                        side: "top",
                        align: 'start'
                    }
                }
            ],
            onDestroyed: () => {
                if (user?.id) {
                    localStorage.setItem(`hasSeenDashboardTour_${user.id}`, 'true')
                }
            }
        })
    }, [user])

    const startTour = (force = false) => {
        if (!user?.id) return

        const hasSeen = localStorage.getItem(`hasSeenDashboardTour_${user.id}`)

        if (force || !hasSeen) {
            // setTimeout ensures DOM elements are ready if called immediately on mount
            setTimeout(() => {
                driverObj.current?.drive()
            }, 500)
        }
    }

    return { startTour }
}
