
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
    ChevronDown,
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
    Activity,
    Video,
    ClipboardCheck,
    ScrollText,
    FileSpreadsheet,
    UserPlus,
    ArrowLeftRight,
    Receipt,
    Mic
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const STORAGE_KEY = 'sidebar-collapsed-sections'
const WORKSPACE_KEY = 'sidebar-active-workspace'

function loadCollapsedSections() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : {}
    } catch {
        return {}
    }
}

function saveCollapsedSections(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch { /* ignore */ }
}

export default function Sidebar() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [collapsedSections, setCollapsedSections] = useState(loadCollapsedSections)
    const [activeWorkspace, setActiveWorkspace] = useState(() => {
        try { return localStorage.getItem(WORKSPACE_KEY) || 'crm' } catch { return 'crm' }
    })

    // Expose sidebar width as CSS variable for fixed-position modals
    useEffect(() => {
        document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '80px' : '280px')
    }, [isCollapsed])

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const toggleSection = useCallback((sectionTitle) => {
        setCollapsedSections(prev => {
            const next = { ...prev, [sectionTitle]: !prev[sectionTitle] }
            saveCollapsedSections(next)
            return next
        })
    }, [])

    const role = profile?.role
    const isPostulante = role === 'postulantes'
    const isReclutamiento = role === 'reclutamiento'
    const canSeeRecruitment = ['superadministrador', 'tecnico', 'administracion', 'comercial', 'legal', 'reclutamiento'].includes(role)
    const canSwitchWorkspace = canSeeRecruitment && !isReclutamiento

    // Force reclutamiento role to always be in recruitment workspace
    const effectiveWorkspace = isReclutamiento ? 'reclutamiento' : activeWorkspace

    const handleWorkspaceSwitch = (ws) => {
        setActiveWorkspace(ws)
        try { localStorage.setItem(WORKSPACE_KEY, ws) } catch { /* ignore */ }
    }

    // ─── Build sections ───────────────────────────────────────────────────────

    const general = {
        title: 'GENERAL',
        items: [
            { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
            { title: 'Calendario', icon: Calendar, path: '/calendar' },
            { title: 'Casilla', icon: MessageSquare, path: '/casilla' },
        ]
    }

    const isAgent = role === 'agent'
    const indicadores = {
        title: 'INDICADORES',
        items: [
            { title: isAgent ? 'Mis KPIs' : 'Leads', icon: BarChart3, path: '/kpis/dashboard' },
            ...(isAgent ? [{ title: 'Mi Plan de Negocio', icon: Target, path: '/kpis/business-plan' }] : []),
            ...(['superadministrador', 'legal', 'tecnico', 'comercial'].includes(role) ? [{
                title: 'Planes de Negocio', icon: Target, path: '/admin/business-plans'
            }] : []),
            ...(['superadministrador', 'legal', 'tecnico'].includes(role) ? [{
                title: 'KPIs Agentes', icon: FileBarChart, path: '/admin/kpis'
            }] : [])
        ]
    }

    const crm = {
        title: 'CRM',
        items: [
            { title: 'Contactos & Tareas', icon: Users, path: '/crm' },
            { title: 'Acciones', icon: Activity, path: '/crm/actions' },
            { title: 'Pipeline Negocios', icon: Kanban, path: '/crm/pipeline' },
            { title: 'Informes de Gestión', icon: ClipboardCheck, path: '/informes-gestion' },
            { title: 'Inspecciones', icon: ClipboardList, path: '/inspecciones' },
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

    // Merged section: Aula Virtual + Documentos → FORMACIÓN Y DOCS
    const formacionYDocs = {
        title: 'FORMACIÓN Y DOCS',
        items: [
            { title: 'Aula Virtual', icon: GraduationCap, path: '/aula-virtual' },
            { title: 'Documentos Remax', icon: FileText, path: '/documents' },
            { title: 'Mis Documentos', icon: Folder, path: '/my-documents' },
        ]
    }

    // Admin section per role — now with sub-groups for superadmin/legal
    const adminSectionByRole = {
        superadministrador: {
            title: 'ADMIN',
            subgroups: [
                {
                    label: 'Gestión',
                    items: [
                        { title: 'Administración', icon: Users, path: '/admin/invites' },
                        { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                        { title: 'Captaciones', icon: ClipboardList, path: '/admin/captaciones' },
                        { title: 'Importar Propiedades', icon: Download, path: '/admin/import' },
                        { title: 'Importar Administradas', icon: FileSpreadsheet, path: '/admin/import-administradas' },
                        { title: 'Liquidación Comisiones', icon: CreditCard, path: '/admin/comisiones' },
                        { title: 'Cobranza Cuotas', icon: Receipt, path: '/admin/cuotas-pendientes' },
                    ]
                },
                {
                    label: 'Contenido',
                    items: [
                        { title: 'Config. Aula Virtual', icon: Settings, path: '/admin/aula-virtual' },
                        { title: 'Video Tutoriales', icon: Video, path: '/admin/video-generator' },
                    ]
                },
                {
                    label: 'Agendas',
                    items: [
                        { title: 'Agenda Cámara 360°', icon: Camera, path: '/admin/camera-schedule' },
                        { title: 'Agenda Turnos', icon: Shield, path: '/admin/shift-schedule' },
                    ]
                },
                {
                    label: 'Comunicaciones',
                    items: [
                        { title: 'Agente de Voz', icon: Mic, path: '/voice-agent' },
                    ]
                },
                {
                    label: 'Operaciones',
                    items: [
                        { title: 'Leads Asignados', icon: FileText, path: '/guard-leads' },
                    ]
                }
            ]
        },
        tecnico: {
            title: 'ADMIN',
            subgroups: [
                {
                    label: 'Gestión',
                    items: [
                        { title: 'Administración', icon: Users, path: '/admin/invites' },
                        { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                        { title: 'Captaciones', icon: ClipboardList, path: '/admin/captaciones' },
                        { title: 'Importar Propiedades', icon: Download, path: '/admin/import' },
                        { title: 'Importar Administradas', icon: FileSpreadsheet, path: '/admin/import-administradas' },
                        { title: 'Liquidación Comisiones', icon: CreditCard, path: '/admin/comisiones' },
                        { title: 'Cobranza Cuotas', icon: Receipt, path: '/admin/cuotas-pendientes' },
                    ]
                },
                {
                    label: 'Contenido',
                    items: [
                        { title: 'Config. Aula Virtual', icon: Settings, path: '/admin/aula-virtual' },
                        { title: 'Video Tutoriales', icon: Video, path: '/admin/video-generator' },
                    ]
                },
                {
                    label: 'Agendas',
                    items: [
                        { title: 'Agenda Cámara 360°', icon: Camera, path: '/admin/camera-schedule' },
                        { title: 'Agenda Turnos', icon: Shield, path: '/admin/shift-schedule' },
                    ]
                },
                {
                    label: 'Comunicaciones',
                    items: [
                        { title: 'Agente de Voz', icon: Mic, path: '/voice-agent' },
                    ]
                },
                {
                    label: 'Operaciones',
                    items: [
                        { title: 'Leads Asignados', icon: FileText, path: '/guard-leads' },
                    ]
                },
                {
                    label: 'Sistema',
                    items: [
                        { title: 'Auditoría / Logs', icon: ScrollText, path: '/admin/audit-logs' },
                    ]
                }
            ]
        },
        legal: {
            title: 'ADMIN',
            subgroups: [
                {
                    label: 'Gestión',
                    items: [
                        { title: 'Administración', icon: Users, path: '/admin/invites' },
                        { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                        { title: 'Captaciones', icon: ClipboardList, path: '/admin/captaciones' },
                        { title: 'Importar Propiedades', icon: Download, path: '/admin/import' },
                        { title: 'Importar Administradas', icon: FileSpreadsheet, path: '/admin/import-administradas' },
                        { title: 'Liquidación Comisiones', icon: CreditCard, path: '/admin/comisiones' },
                        { title: 'Cobranza Cuotas', icon: Receipt, path: '/admin/cuotas-pendientes' },
                    ]
                },
                {
                    label: 'Contenido',
                    items: [
                        { title: 'Config. Aula Virtual', icon: Settings, path: '/admin/aula-virtual' },
                    ]
                },
                {
                    label: 'Agendas',
                    items: [
                        { title: 'Agenda Turnos', icon: Shield, path: '/admin/shift-schedule' },
                    ]
                },
                {
                    label: 'Comunicaciones',
                    items: [
                        { title: 'Agente de Voz', icon: Mic, path: '/voice-agent' },
                    ]
                },
                {
                    label: 'Operaciones',
                    items: [
                        { title: 'Leads Asignados', icon: FileText, path: '/guard-leads' },
                    ]
                }
            ]
        },
        comercial: {
            title: 'ADMIN',
            subgroups: [
                {
                    label: 'Gestión',
                    items: [
                        { title: 'Administración', icon: Users, path: '/admin/invites' },
                        { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                        { title: 'Captaciones', icon: ClipboardList, path: '/admin/captaciones' },
                        { title: 'Importar Administradas', icon: FileSpreadsheet, path: '/admin/import-administradas' },
                        { title: 'Liquidación Comisiones', icon: CreditCard, path: '/admin/comisiones' },
                        { title: 'Cobranza Cuotas', icon: Receipt, path: '/admin/cuotas-pendientes' },
                    ]
                },
                {
                    label: 'Agendas',
                    items: [
                        { title: 'Agenda Cámara 360°', icon: Camera, path: '/admin/camera-schedule' },
                        { title: 'Agenda Turnos', icon: Shield, path: '/admin/shift-schedule' },
                    ]
                },
                {
                    label: 'Comunicaciones',
                    items: [
                        { title: 'Agente de Voz', icon: Mic, path: '/voice-agent' },
                    ]
                },
                {
                    label: 'Operaciones',
                    items: [
                        { title: 'Leads Asignados', icon: FileText, path: '/guard-leads' },
                    ]
                }
            ]
        },
        administracion: {
            title: 'ADMIN',
            subgroups: [
                {
                    label: 'Gestión',
                    items: [
                        { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                        { title: 'Importar Administradas', icon: FileSpreadsheet, path: '/admin/import-administradas' },
                        { title: 'Liquidación Comisiones', icon: CreditCard, path: '/admin/comisiones' },
                        { title: 'Cobranza Cuotas', icon: Receipt, path: '/admin/cuotas-pendientes' },
                    ]
                },
                {
                    label: 'Agendas',
                    items: [
                        { title: 'Agenda Turnos', icon: Shield, path: '/admin/shift-schedule' },
                    ]
                },
                {
                    label: 'Comunicaciones',
                    items: [
                        { title: 'Agente de Voz', icon: Mic, path: '/voice-agent' },
                    ]
                },
                {
                    label: 'Operaciones',
                    items: [
                        { title: 'Leads Asignados', icon: FileText, path: '/guard-leads' },
                    ]
                }
            ]
        },
        postulantes: {
            title: 'ADMIN',
            items: [
                { title: 'Administración', icon: Users, path: '/admin/invites' },
            ]
        }
    }

    // ─── Recruitment section ──────────────────────────────────────────────────

    const recruitmentSection = {
        title: 'RECLUTAMIENTO',
        items: [
            { title: 'Dashboard', icon: Kanban, path: '/recruitment/dashboard' },
            { title: 'Workflow', icon: Zap, path: '/recruitment/workflow' },
            { title: 'Pipeline Candidatos', icon: Kanban, path: '/recruitment/pipeline' },
            { title: 'Lista Candidatos', icon: UserPlus, path: '/recruitment/candidates' },
            { title: 'Tareas', icon: ClipboardList, path: '/recruitment/tasks' },
            { title: 'Plantillas Email', icon: MessageSquare, path: '/recruitment/templates' },
            { title: 'Automatización', icon: Kanban, path: '/recruitment/automation' },
            { title: 'Calendario', icon: Calendar, path: '/recruitment/calendar' },
            { title: 'Grabadora', icon: Mic, path: '/recruitment/recorder' },
            { title: 'Casilla', icon: MessageSquare, path: '/casilla' },
        ]
    }

    // Assemble sections based on role & workspace
    let sections
    if (isReclutamiento) {
        // Reclutamiento role only sees recruitment
        sections = [recruitmentSection]
    } else if (isPostulante) {
        sections = [general, crm, formacionYDocs]
    } else if (effectiveWorkspace === 'reclutamiento' && canSeeRecruitment) {
        // Non-agent roles viewing recruitment workspace
        sections = [recruitmentSection]
    } else {
        sections = [general, indicadores, crm, tools, formacionYDocs]
    }

    const adminSection = adminSectionByRole[role]
    if (adminSection && effectiveWorkspace !== 'reclutamiento') {
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

    const SectionHeader = ({ title, isExpanded, onToggle }) => {
        if (isCollapsed) return null

        return (
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-3 mb-2 group cursor-pointer"
            >
                <motion.h4
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none"
                >
                    {title}
                </motion.h4>
                <motion.div
                    animate={{ rotate: isExpanded ? 0 : -90 }}
                    transition={{ duration: 0.2 }}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors"
                >
                    <ChevronDown className="w-3.5 h-3.5" />
                </motion.div>
            </button>
        )
    }

    const SubgroupLabel = ({ label }) => {
        if (isCollapsed) return null

        return (
            <div className="px-3 pt-2 pb-1 first:pt-0">
                <span className="text-[9px] font-semibold text-slate-300 dark:text-slate-600 uppercase tracking-wider">
                    {label}
                </span>
            </div>
        )
    }

    const renderSection = (section, idx) => {
        const isExpanded = !collapsedSections[section.title]
        const hasSubgroups = section.subgroups && section.subgroups.length > 0

        // Get all items (flat or from subgroups) for collapsed icon mode
        const allItems = hasSubgroups
            ? section.subgroups.flatMap(sg => sg.items)
            : (section.items || [])

        return (
            <div key={idx}>
                <SectionHeader
                    title={section.title}
                    isExpanded={isExpanded}
                    onToggle={() => toggleSection(section.title)}
                />

                <AnimatePresence initial={false}>
                    {(isExpanded || isCollapsed) && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            {hasSubgroups ? (
                                <div className="space-y-0.5">
                                    {section.subgroups.map((subgroup, sgIdx) => (
                                        <div key={sgIdx}>
                                            <SubgroupLabel label={subgroup.label} />
                                            {subgroup.items.map((item) => (
                                                <MenuItem key={item.path} item={item} />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {allItems.map((item) => (
                                        <MenuItem key={item.path} item={item} />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
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

            {/* Logo area with integrated workspace switcher */}
            <div className={cn("flex items-center relative z-10 transition-all duration-300", isCollapsed ? "justify-center px-2 py-4" : "px-4 py-4")}>
                <div className={cn("flex items-center gap-3 overflow-hidden", isCollapsed ? "w-auto" : "w-full")}>

                    <motion.div
                        className={cn(
                            "shrink-0 flex items-center justify-center p-2 rounded-xl shadow-lg border transition-all duration-200 cursor-pointer relative group",
                            canSwitchWorkspace
                                ? 'bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border-primary/20 hover:border-primary/40 hover:shadow-primary/10 hover:shadow-xl'
                                : 'bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border-white/50'
                        )}
                        whileHover={canSwitchWorkspace ? { scale: 1.08 } : { scale: 1.05 }}
                        whileTap={canSwitchWorkspace ? { scale: 0.95 } : {}}
                        onClick={canSwitchWorkspace ? () => handleWorkspaceSwitch(effectiveWorkspace === 'crm' ? 'reclutamiento' : 'crm') : undefined}
                        title={canSwitchWorkspace ? (effectiveWorkspace === 'crm' ? 'Cambiar a Reclutamiento' : 'Cambiar a CRM') : undefined}
                    >
                        <img
                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1770205777/Globo_REMAX_sin_fondo_PNG_xiqr1a.png"
                            alt="RE/MAX Exclusive"
                            className="h-8 w-auto object-contain"
                        />
                        {/* Swap badge on logo */}
                        {canSwitchWorkspace && (
                            <motion.div
                                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                initial={false}
                            >
                                <ArrowLeftRight className="w-3 h-3" />
                            </motion.div>
                        )}
                    </motion.div>

                    <AnimatePresence>
                        {!isCollapsed && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col flex-1 min-w-0"
                            >
                                <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight leading-none font-display">
                                    Exclusive
                                </span>
                                {canSwitchWorkspace ? (
                                    <button
                                        onClick={() => handleWorkspaceSwitch(effectiveWorkspace === 'crm' ? 'reclutamiento' : 'crm')}
                                        className="flex items-center gap-1 mt-1 group/ws cursor-pointer"
                                    >
                                        <span className={cn(
                                            "text-[10px] font-bold tracking-widest uppercase transition-colors duration-200",
                                            effectiveWorkspace === 'crm'
                                                ? 'text-primary'
                                                : 'text-amber-500'
                                        )}>
                                            {effectiveWorkspace === 'crm' ? 'CRM' : 'Reclutamiento'}
                                        </span>
                                        <ArrowLeftRight className="w-3 h-3 text-slate-300 group-hover/ws:text-primary transition-colors" />
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-widest uppercase mt-1">
                                        {effectiveWorkspace === 'reclutamiento' ? 'Reclutamiento' : 'Workspace'}
                                    </span>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Collapse Button */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={cn(
                            "absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all",
                            isCollapsed && "translate-x-[200%] opacity-0 pointer-events-none"
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
            <div className="flex-1 overflow-y-auto py-6 px-4 scrollbar-none space-y-6 relative z-10">

                {sections.map((section, idx) => renderSection(section, idx))}
            </div>

            {/* Bottom Card - User Profile */}
            <div className="p-4 relative z-10">
                <div
                    className={cn(
                        "bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-2xl flex items-center border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md hover:border-primary/20",
                        isCollapsed ? "p-2 justify-center aspect-square" : "p-3 gap-3"
                    )}
                    onClick={() => navigate('/profile')}
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 text-white font-bold text-sm">
                        {profile?.first_name?.charAt(0) || 'U'}
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
                            onClick={(e) => { e.stopPropagation(); handleSignOut() }}
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
