import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    Button,
    Avatar,
    AvatarFallback,
    AvatarImage,
    DropdownMenuSeparator,
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle
} from '@/components/ui'
import { 
    LogOut, User, FileText, Settings, Menu, PlusCircle, LayoutDashboard, 
    ClipboardCheck, Zap, Users, MessageSquare, Calendar, ClipboardList
} from 'lucide-react'

export default function Header() {
    const { user, profile, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const role = profile?.role
    const isPostulante = role === 'postulantes'
    const isReclutamiento = role === 'reclutamiento'

    const menuItems = [
        { title: 'Mis Solicitudes / Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    ]

    if (isReclutamiento) {
        menuItems.push(
            { title: 'Casilla', icon: MessageSquare, path: '/casilla' }
        )
    } else if (isPostulante) {
        // Just the basics for postulantes
    } else {
        // Agents and admins
        menuItems.push(
            { title: 'Contactos & Tareas', icon: Users, path: '/crm' },
            { title: 'Calendario', icon: Calendar, path: '/calendar' },
            { title: 'Casilla', icon: MessageSquare, path: '/casilla' },
            { title: 'Informes de Gestión', icon: ClipboardCheck, path: '/informes-gestion' },
            { title: 'Inspecciones', icon: ClipboardList, path: '/inspecciones' },
            { title: 'Nueva Solicitud', icon: PlusCircle, path: '/new-request' },
            { title: 'Nueva Captación', icon: Zap, path: '/new-mandate' }
        )
    }

    if (['superadministrador', 'legal', 'tecnico'].includes(role)) {
        menuItems.push({ title: 'Dashboard CEO', icon: FileText, path: '/admin/kpis' })
        menuItems.push({ title: 'Administración', icon: Settings, path: '/admin/invites' })
    } else if (role === 'comercial') {
        menuItems.push({ title: 'Administración', icon: Settings, path: '/admin/invites' })
    }

    return (
        <header className="sticky top-0 z-30 w-full backdrop-blur-sm transition-all duration-300 md:hidden">
            <div className="flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    {user && (
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="-ml-2">
                                    <Menu className="h-6 w-6 text-slate-600" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[280px] p-0 border-r-0 flex flex-col">
                                <SheetHeader className="p-6 border-b border-slate-100 shrink-0">
                                    <SheetTitle className="flex items-center gap-3">
                                        <div className="shrink-0 flex items-center justify-center p-1.5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                                            <img
                                                src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1770205777/Globo_REMAX_sin_fondo_PNG_xiqr1a.png"
                                                alt="RE/MAX Exclusive"
                                                className="h-6 w-auto object-contain"
                                            />
                                        </div>
                                        <div className="flex flex-col items-start text-left">
                                            <span className="font-display font-bold text-lg leading-none text-slate-900">Exclusive</span>
                                            <span className="text-[9px] text-slate-400 font-semibold tracking-widest uppercase mt-0.5">Workspace</span>
                                        </div>
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="p-4 flex-1 flex flex-col overflow-y-auto">
                                    <div className="space-y-2">
                                        {menuItems.map((item) => (
                                            <Button
                                                key={item.path}
                                                variant={location.pathname === item.path ? "secondary" : "ghost"}
                                                className="w-full justify-start gap-4 h-12 font-medium"
                                                onClick={() => {
                                                    navigate(item.path)
                                                }}
                                            >
                                                <item.icon className="h-5 w-5" />
                                                {item.title}
                                            </Button>
                                        ))}
                                    </div>
                                    <div className="mt-auto pt-4 pb-2 space-y-2">
                                        <Button
                                            variant={location.pathname === '/profile' ? "secondary" : "ghost"}
                                            className="w-full justify-start gap-4 h-12 font-medium"
                                            onClick={() => navigate('/profile')}
                                        >
                                            <User className="h-5 w-5" />
                                            Mi Perfil
                                        </Button>
                                        <DropdownMenuSeparator />
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start gap-4 h-12 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={handleSignOut}
                                        >
                                            <LogOut className="h-5 w-5" />
                                            Cerrar Sesión
                                        </Button>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}
                    <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
                        <div className="shrink-0 flex items-center justify-center p-1.5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-sm border border-white/50">
                            <img
                                src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1770205777/Globo_REMAX_sin_fondo_PNG_xiqr1a.png"
                                alt="RE/MAX Exclusive"
                                className="h-6 w-auto object-contain"
                            />
                        </div>
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    {user && (
                        <div className="flex items-center gap-3 p-1 pr-4 pl-1 bg-white/50 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/40 dark:border-white/10 shadow-sm hover:bg-white/80 transition-all cursor-pointer" onClick={() => navigate('/profile')}>
                            <Avatar className="h-8 w-8 ring-2 ring-white dark:ring-slate-800">
                                <AvatarImage src={profile?.avatar_url} />
                                <AvatarFallback className="bg-gradient-to-tr from-primary to-blue-400 text-white text-xs">
                                    {profile?.first_name?.charAt(0) || user.email.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start mr-1">
                                <p className="text-xs font-bold leading-none text-slate-800 dark:text-slate-100">{profile?.first_name}</p>
                                <p className="text-[10px] leading-none text-slate-500 dark:text-slate-400 capitalize mt-1">{profile?.role}</p>
                            </div>
                        </div>
                    )}
                    {!user && (
                        <Button variant="default" className="rounded-full px-6 shadow-lg shadow-primary/20" onClick={() => navigate('/login')}>Ingresar</Button>
                    )}
                </div>
            </div>
        </header>
    )
}

