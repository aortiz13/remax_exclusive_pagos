
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '@/components/ui'
import {
    LayoutDashboard,
    User,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    PlusCircle,
    FileText,
    BarChart3,
    Target,
    ClipboardList,
    CreditCard,
    Users,
    MessageSquare,
    Box,
    FileBarChart,
    Zap,
    Shield,
    Calendar,
    MapPin,
    Download,
    GraduationCap,
    Folder,
    Camera,
    Kanban,
    Activity
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function Sidebar() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [isCollapsed, setIsCollapsed] = useState(false)

    // Expose sidebar width as CSS variable for fixed-position modals
    useEffect(() => {
        document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '80px' : '280px')
    }, [isCollapsed])

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const role = profile?.role
    const isPostulante = role === 'postulantes'

    // ─── Build sections ───────────────────────────────────────────────────────

    const general = {
        title: 'GENERAL',
        items: [
            { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
            { title: 'Calendario', icon: Calendar, path: '/calendar' },
            { title: 'Casilla', icon: MessageSquare, path: '/casilla' },
        ]
    }

    const indicadores = {
        title: 'INDICADORES',
        items: [
            { title: 'Mis KPIs', icon: BarChart3, path: '/kpis/dashboard' },
            { title: 'Mi Plan de Negocio', icon: Target, path: '/kpis/business-plan' },
            ...(['superadministrador', 'legal'].includes(role) ? [{
                title: 'Dashboard CEO', icon: FileBarChart, path: '/admin/kpis'
            }] : [])
        ]
    }

    const crm = {
        title: 'CRM',
        items: [
            { title: 'Contactos & Tareas', icon: Users, path: '/crm' },
            { title: 'Acciones', icon: Activity, path: '/crm/actions' },
            { title: 'Pipeline Ventas', icon: Kanban, path: '/crm/pipeline' },
            ...(!isPostulante ? [{ title: 'Mapa Propiedades', icon: MapPin, path: '/crm/map' }] : []),
        ]
    }

    const tools = {
        title: 'TOOLS',
        items: [
            { title: 'Nueva Solicitud', icon: PlusCircle, path: '/new-request' },
            { title: 'Nueva Captación / Mandato', icon: Zap, path: '/new-mandate' },
        ]
    }

    const aulaVirtual = {
        title: 'AULA VIRTUAL',
        items: [{ title: 'Aula Virtual', icon: GraduationCap, path: '/aula-virtual' }]
    }

    const documentos = {
        title: 'DOCUMENTOS',
        items: [
            { title: 'Documentos Remax', icon: FileText, path: '/documents' },
            { title: 'Mis Documentos', icon: Folder, path: '/my-documents' }
        ]
    }

    // Admin section per role
    const adminSectionByRole = {
        superadministrador: {
            title: 'ADMIN',
            items: [
                { title: 'Administración', icon: Users, path: '/admin/invites' },
                { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                { title: 'Captaciones', icon: ClipboardList, path: '/admin/captaciones' },
                { title: 'Importar Propiedades', icon: Download, path: '/admin/import' },
                { title: 'Config. Aula Virtual', icon: Settings, path: '/admin/aula-virtual' },
                { title: 'Agenda Cámara 360°', icon: Camera, path: '/admin/camera-schedule' },
            ]
        },
        legal: {
            title: 'ADMIN',
            items: [
                { title: 'Administración', icon: Users, path: '/admin/invites' },
                { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                { title: 'Captaciones', icon: ClipboardList, path: '/admin/captaciones' },
                { title: 'Importar Propiedades', icon: Download, path: '/admin/import' },
                { title: 'Config. Aula Virtual', icon: Settings, path: '/admin/aula-virtual' },
            ]
        },
        comercial: {
            title: 'ADMIN',
            items: [
                { title: 'Administración', icon: Users, path: '/admin/invites' },
                { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                { title: 'Captaciones', icon: ClipboardList, path: '/admin/captaciones' },
                { title: 'Agenda Cámara 360°', icon: Camera, path: '/admin/camera-schedule' },
            ]
        },
        administracion: {
            title: 'ADMIN',
            items: [
                { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
            ]
        },
        postulantes: {
            title: 'ADMIN',
            items: [
                { title: 'Administración', icon: Users, path: '/admin/invites' },
            ]
        }
    }

    // Assemble sections based on role
    let sections
    if (isPostulante) {
        // Postulantes: no INDICADORES, no TOOLS, no Mapa, solo invite en ADMIN
        sections = [general, crm, aulaVirtual, documentos]
    } else {
        sections = [general, indicadores, crm, tools, aulaVirtual, documentos]
    }

    const adminSection = adminSectionByRole[role]
    if (adminSection) {
        sections.push(adminSection)
    }

    // ─────────────────────────────────────────────────────────────────────────

    const MenuItem = ({ item }) => {
        const isActive = location.pathname === item.path

        return (
            <button
                onClick={() => navigate(item.path)}
                className={cn(
                    "w-full flex items-center gap-3 relative px-3 py-2.5 rounded-xl transition-all duration-300 group outline-none",
                    isCollapsed ? "justify-center" : "justify-start"
                )}
            >
                {/* Active Background with Glow */}
                {isActive && (
                    <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-xl"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                )}

                {/* Left Accent Bar for Active State */}
                {isActive && (
                    <motion.div
                        layoutId="activeBar"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_12px_rgba(var(--primary),0.5)]"
                    />
                )}

                <div className={cn(
                    "relative z-10 flex items-center justify-center transition-colors duration-300 p-1.5 rounded-lg",
                    isActive ? "text-primary bg-white/50 dark:bg-black/20 shadow-sm" : "text-slate-500 dark:text-slate-400 group-hover:text-primary group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50"
                )}>
                    <item.icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                </div>

                {!isCollapsed && (
                    <span className={cn(
                        "relative z-10 text-sm font-medium transition-colors duration-300 truncate",
                        isActive ? "text-slate-900 dark:text-white font-semibold" : "text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200"
                    )}>
                        {item.title}
                    </span>
                )}
            </button>
        )
    }

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 80 : 280 }}
            className="hidden md:flex flex-col h-full z-40 relative border-r border-white/20 dark:border-white/5 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl shadow-2xl"
        >
            {/* Glossy Overlay for extra depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            {/* Logo area */}
            <div className={cn("h-20 flex items-center relative z-10 transition-all duration-300", isCollapsed ? "justify-center px-0" : "px-6")}>
                <div className={cn("flex items-center gap-3 overflow-hidden", isCollapsed ? "w-auto" : "w-full")}>

                    <motion.div
                        className="shrink-0 flex items-center justify-center p-2 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-lg border border-white/50"
                        whileHover={{ scale: 1.05 }}
                    >
                        <img
                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1770205777/Globo_REMAX_sin_fondo_PNG_xiqr1a.png"
                            alt="RE/MAX Exclusive"
                            className="h-8 w-auto object-contain"
                        />
                    </motion.div>

                    <AnimatePresence>
                        {!isCollapsed && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col"
                            >
                                <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight leading-none font-display">
                                    Exclusive
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-widest uppercase mt-1">
                                    Workspace
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Collapse Button */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={cn(
                            "absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all",
                            isCollapsed && "translate-x-[200%] opacity-0 pointer-events-none" // Hide when collapsed to avoid weird positioning
                        )}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Collapsed expansion button */}
            <AnimatePresence>
                {isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full flex justify-center py-2 relative z-10"
                    >
                        <button
                            onClick={() => setIsCollapsed(false)}
                            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-6 px-4 scrollbar-none space-y-8 relative z-10">
                {sections.map((section, idx) => (
                    <div key={idx}>
                        {!isCollapsed && (
                            <motion.h4
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * idx }}
                                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-3"
                            >
                                {section.title}
                            </motion.h4>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item) => (
                                <MenuItem key={item.path} item={item} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Card - User Profile */}
            <div className="p-4 relative z-10">
                <div
                    className={cn(
                        "bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-2xl flex items-center border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-300",
                        isCollapsed ? "p-2 justify-center aspect-square" : "p-3 gap-3"
                    )}
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 text-white">
                        <Users className="w-5 h-5" />
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {profile?.first_name || 'Usuario'}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium truncate capitalize">
                                {profile?.role || 'Agente'}
                            </p>
                        </div>
                    )}

                    {!isCollapsed && (
                        <button
                            onClick={handleSignOut}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {isCollapsed && (
                    <div className="mt-2 flex justify-center">
                        <button
                            onClick={handleSignOut}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </motion.aside>
    )
}

