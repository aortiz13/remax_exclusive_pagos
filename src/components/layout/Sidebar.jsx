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
    FileText
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

    const topMenuItems = [
        {
            title: 'Mis Solicitudes',
            icon: LayoutDashboard,
            path: '/dashboard',
        },
        {
            title: 'Nueva Solicitud',
            icon: PlusCircle,
            path: '/new-request',
        },
    ]

    const bottomMenuItems = [
        {
            title: 'Mi Perfil',
            icon: User,
            path: '/profile',
        },
    ]

    if (profile?.role === 'admin') {
        bottomMenuItems.push({
            title: 'Administración',
            icon: Settings,
            path: '/admin/invites',
        })
    }

    return (
        <aside
            className={cn(
                "hidden md:flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 sticky top-0 h-screen z-40 shadow-sm",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            {/* Logo area with Collapse Toggle */}
            <div className="p-6 h-[73px] flex items-center justify-between border-b border-slate-50 dark:border-slate-900 overflow-hidden relative">
                {!isCollapsed ? (
                    <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-primary/5 p-1.5 rounded-lg flex items-center justify-center">
                            <img
                                src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1765974550/ChatGPT_Image_11_dic_2025_03_45_43_p.m._oajwry.png"
                                alt="RE/MAX"
                                className="h-6 w-auto object-contain"
                            />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap tracking-tight text-lg">
                            Exclusive
                        </span>
                    </div>
                ) : (
                    <div className="bg-primary/5 p-1.5 rounded-lg mx-auto">
                        <img
                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1765974550/ChatGPT_Image_11_dic_2025_03_45_43_p.m._oajwry.png"
                            alt="RE/MAX"
                            className="h-6 w-6 object-contain"
                        />
                    </div>
                )}

                {/* Collapse Toggle - Top Position */}
                {!isCollapsed && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-primary transition-colors hover:bg-primary/5 rounded-lg"
                        onClick={() => setIsCollapsed(true)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
                {isCollapsed && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm z-50 hover:text-primary transition-all scale-0 group-hover:scale-100 opacity-0 group-hover:opacity-100"
                        onClick={() => setIsCollapsed(false)}
                    >
                        <ChevronRight className="h-3 w-3" />
                    </Button>
                )}
            </div>

            {/* Navigation items - TOP */}
            <nav className="flex-1 px-4 space-y-1.5 mt-6">
                {topMenuItems.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                        <Button
                            key={item.path}
                            variant="ghost"
                            className={cn(
                                "w-full justify-start gap-3 h-11 px-3 transition-all rounded-xl border border-transparent group",
                                isActive
                                    ? "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20 border-primary"
                                    : "text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-primary/5",
                                isCollapsed && "justify-center px-0 h-12"
                            )}
                            onClick={() => navigate(item.path)}
                        >
                            <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "")} />
                            {!isCollapsed && (
                                <span className="font-medium animate-in slide-in-from-left-2 duration-300">
                                    {item.title}
                                </span>
                            )}
                        </Button>
                    )
                })}
            </nav>

            {/* User Profile Summary & Bottom Navigation */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-900 space-y-4 bg-slate-50/10 dark:bg-slate-950/20">

                {/* Bottom Menu Items */}
                <nav className="space-y-1">
                    {bottomMenuItems.map((item) => {
                        const isActive = location.pathname === item.path
                        return (
                            <Button
                                key={item.path}
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 h-10 px-3 transition-all rounded-xl border border-transparent group",
                                    isActive
                                        ? "bg-slate-100 dark:bg-slate-800 text-primary border-slate-200 dark:border-slate-700"
                                        : "text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/5",
                                    isCollapsed && "justify-center px-0 h-10"
                                )}
                                onClick={() => navigate(item.path)}
                            >
                                <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-primary" : "")} />
                                {!isCollapsed && (
                                    <span className="text-sm font-medium animate-in slide-in-from-left-2 duration-300">
                                        {item.title}
                                    </span>
                                )}
                            </Button>
                        )
                    })}
                </nav>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-900">
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start gap-3 h-10 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors",
                            isCollapsed && "justify-center px-0"
                        )}
                        onClick={handleSignOut}
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium">Cerrar Sesión</span>}
                    </Button>
                </div>

                {/* Improved Collapse Toggle for Collapsed State */}
                {isCollapsed && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-full h-8 flex items-center justify-center text-slate-300 hover:text-primary mt-2"
                        onClick={() => setIsCollapsed(false)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </aside>
    )
}
