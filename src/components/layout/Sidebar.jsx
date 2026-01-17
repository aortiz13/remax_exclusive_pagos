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

    const menuItems = [
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
        {
            title: 'Mi Perfil',
            icon: User,
            path: '/profile',
        },
    ]

    if (profile?.role === 'admin') {
        menuItems.push({
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
            {/* Logo area */}
            <div className="p-6 h-[73px] flex items-center justify-between border-b border-slate-50 dark:border-slate-900 overflow-hidden">
                {!isCollapsed && (
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
                )}
                {isCollapsed && (
                    <div className="bg-primary/5 p-1.5 rounded-lg mx-auto">
                        <img
                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1765974550/ChatGPT_Image_11_dic_2025_03_45_43_p.m._oajwry.png"
                            alt="RE/MAX"
                            className="h-6 w-6 object-contain"
                        />
                    </div>
                )}
            </div>

            {/* User Profile Summary */}
            {!isCollapsed && (
                <div className="px-6 py-6 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 group transition-all duration-300 cursor-default">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white dark:ring-slate-800 transition-all shadow-sm">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <span className="font-bold text-primary">
                                    {profile?.first_name?.[0] || '?'}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0 overflow-hidden">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {profile?.first_name} {profile?.last_name}
                            </p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold truncate leading-tight mt-0.5">
                                {profile?.role === 'admin' ? 'Administrador' : 'Agente'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation items */}
            <nav className="flex-1 px-4 space-y-1.5 mt-2">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                        <Button
                            key={item.path}
                            variant="ghost"
                            className={cn(
                                "w-full justify-start gap-3 h-11 px-3 transition-all rounded-xl border border-transparent",
                                isActive
                                    ? "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20 border-primary"
                                    : "text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-primary/5",
                                isCollapsed && "justify-center px-0 h-12"
                            )}
                            onClick={() => navigate(item.path)}
                        >
                            <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "")} />
                            {!isCollapsed && (
                                <span className="font-medium animate-in slide-in-from-left-2 duration-300">
                                    {item.title}
                                </span>
                            )}
                        </Button>
                    )
                })}
            </nav>

            {/* Bottom section */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-900 space-y-2 bg-slate-50/10 dark:bg-slate-950/20">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 h-11 px-3 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors",
                        isCollapsed && "justify-center px-0"
                    )}
                    onClick={handleSignOut}
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span className="font-medium">Cerrar Sesión</span>}
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className="w-full h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 dark:hover:text-slate-400"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>
        </aside>
    )
}
