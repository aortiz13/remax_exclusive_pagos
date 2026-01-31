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
    Shield
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function Sidebar() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [isCollapsed, setIsCollapsed] = useState(false)

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const sections = [
        {
            title: 'GENERAL',
            items: [
                {
                    title: 'Dashboard',
                    icon: LayoutDashboard,
                    path: '/dashboard',
                },
                {
                    title: 'Analisis KPI',
                    icon: BarChart3,
                    path: '/kpis/dashboard',
                },
                {
                    title: 'Mis Objetivos',
                    icon: Target,
                    path: '/kpis/goals',
                },
            ]
        },
        {
            title: 'TOOLS',
            items: [
                {
                    title: 'Carga Semanal',
                    icon: ClipboardList,
                    path: '/kpis/entry',
                },
                {
                    title: 'Nueva Solicitud',
                    icon: PlusCircle,
                    path: '/new-request',
                },
                {
                    title: 'Mi Perfil',
                    icon: User,
                    path: '/profile',
                },
            ]
        }
    ]

    // Admin sections additions would go here in a real implementation
    if (profile?.role === 'admin') {
        sections.push({
            title: 'ADMIN',
            items: [
                { title: 'Administración', icon: Users, path: '/admin/invites' },
                { title: 'Solicitudes', icon: FileText, path: '/admin/requests' },
                { title: 'KPIs Agentes', icon: BarChart3, path: '/admin/kpis' },
            ]
        })
    }

    const MenuItem = ({ item }) => {
        const isActive = location.pathname === item.path
        return (
            <Button
                variant="ghost"
                className={cn(
                    "w-full justify-start gap-3 h-10 px-3 transition-all rounded-lg mb-1 group relative",
                    isActive
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 font-semibold"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                    isCollapsed && "justify-center px-0"
                )}
                onClick={() => navigate(item.path)}
            >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-md" />}
                <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600")} />
                {!isCollapsed && (
                    <span className="truncate">
                        {item.title}
                    </span>
                )}
            </Button>
        )
    }

    return (
        <aside
            className={cn(
                "hidden md:flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 h-full z-40",
                isCollapsed ? "w-[80px]" : "w-[260px]"
            )}
        >
            {/* Logo area */}
            <div className="h-16 flex items-center px-6 border-b border-transparent">
                <div className="flex items-center gap-3 w-full">
                    <div className="bg-primary/10 p-1.5 rounded-lg shrink-0">
                        {/* Placeholder logo matching style */}
                        <div className="w-5 h-5 bg-primary rounded-sm flex items-center justify-center">
                            <Zap className="w-3 h-3 text-white fill-white" />
                        </div>
                    </div>
                    {!isCollapsed && (
                        <span className="font-bold text-slate-900 text-lg tracking-tight">Exclusive</span>
                    )}

                    {/* Collapse Button - Top Right of Header or Bottom */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("ml-auto h-6 w-6 text-slate-400 hover:text-slate-600", isCollapsed && "hidden")}
                        onClick={() => setIsCollapsed(true)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isCollapsed && (
                <div className="w-full flex justify-center py-2">
                    <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)}>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                    </Button>
                </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-6 px-4 scrollbar-none">
                {sections.map((section, idx) => (
                    <div key={idx} className="mb-6">
                        {!isCollapsed && (
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
                                {section.title}
                            </h4>
                        )}
                        <div className="space-y-0.5">
                            {section.items.map((item) => (
                                <MenuItem key={item.path} item={item} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Card - "Team Marketing" style */}
            <div className="p-4 border-t border-slate-100">
                {!isCollapsed ? (
                    <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{profile?.first_name || 'Usuario'}</p>
                            <p className="text-xs text-slate-500 truncate capitalize">{profile?.role || 'Agente'}</p>
                        </div>

                        {/* Logout Small Button */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={handleSignOut}>
                            <LogOut className="h-3 w-3" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={handleSignOut}>
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {!isCollapsed && (
                    <div className="mt-4 px-1">
                        <p className="text-[10px] text-slate-300">
                            @ 2026 RE/MAX Exclusive.
                        </p>
                    </div>
                )}
            </div>

        </aside>
    )
}

