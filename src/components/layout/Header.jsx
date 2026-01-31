import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    Button,
    Avatar,
    AvatarFallback,
    AvatarImage,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle
} from '@/components/ui'
import { LogOut, User, FileText, Settings, Menu, PlusCircle, LayoutDashboard } from 'lucide-react'

export default function Header() {
    const { user, profile, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const menuItems = [
        { title: 'Mis Solicitudes', icon: LayoutDashboard, path: '/dashboard' },
        { title: 'Nueva Solicitud', icon: PlusCircle, path: '/new-request' },
        { title: 'Mi Perfil', icon: User, path: '/profile' },
    ]

    if (profile?.role === 'admin') {
        menuItems.push({ title: 'Administración', icon: Settings, path: '/admin/invites' })
    }

    return (
        <header className="sticky top-0 z-30 w-full backdrop-blur-sm transition-all duration-300">
            <div className="flex h-16 items-center justify-between px-4 md:px-8">
                <div className="flex items-center gap-2 md:hidden">
                    {user && (
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="md:hidden -ml-2">
                                    <Menu className="h-6 w-6 text-slate-600" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[280px] p-0 border-r-0">
                                <SheetHeader className="p-6 border-b border-slate-100">
                                    <SheetTitle className="flex items-center gap-3">
                                        <img
                                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1769611638/ChatGPT_Image_28_ene_2026_11_47_11_a.m._n41jc4.png"
                                            alt="RE/MAX"
                                            className="h-8 w-auto object-contain"
                                        />
                                        <span className="font-display font-bold text-xl">Exclusive</span>
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="p-4 space-y-2">
                                    <div className="px-2 py-4">
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 truncate">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <span className="font-bold text-primary">{profile?.first_name?.[0]}</span>
                                            </div>
                                            <div className="truncate">
                                                <p className="text-sm font-bold truncate text-slate-900">{profile?.first_name} {profile?.last_name}</p>
                                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                            </div>
                                        </div>
                                    </div>

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
                            </SheetContent>
                        </Sheet>
                    )}
                    <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-3">
                        <img
                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1769611638/ChatGPT_Image_28_ene_2026_11_47_11_a.m._n41jc4.png"
                            alt="RE/MAX Exclusive"
                            className="h-8 w-auto object-contain"
                        />
                    </Link>
                </div>

                {/* Breadcrumbs or Page Title Placeholder */}
                <div className="hidden md:flex flex-1 items-center px-4">
                    {/* Future Breadcrumbs */}
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
                            <div className="hidden sm:flex flex-col items-start mr-1">
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

