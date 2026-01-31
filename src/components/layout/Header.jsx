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
        <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-50">
            <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 md:hidden">
                    {user && (
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="md:hidden">
                                    <Menu className="h-6 w-6" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[280px] p-0">
                                <SheetHeader className="p-6 border-b">
                                    <SheetTitle className="flex items-center gap-3">
                                        <img
                                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1765974550/ChatGPT_Image_11_dic_2025_03_45_43_p.m._oajwry.png"
                                            alt="RE/MAX"
                                            className="h-8 w-auto object-contain"
                                        />
                                        <span>Exclusive</span>
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="p-4 space-y-2">
                                    <div className="px-2 py-4">
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border truncate">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <span className="font-bold text-primary">{profile?.first_name?.[0]}</span>
                                            </div>
                                            <div className="truncate">
                                                <p className="text-sm font-bold truncate">{profile?.first_name} {profile?.last_name}</p>
                                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {menuItems.map((item) => (
                                        <Button
                                            key={item.path}
                                            variant={location.pathname === item.path ? "secondary" : "ghost"}
                                            className="w-full justify-start gap-4 h-12"
                                            onClick={() => {
                                                navigate(item.path)
                                                // SheetClose is handled by Radix automatically if we use SheetClose as wrapper, 
                                                // but Button click just navigates. Usually we wrap items in SheetClose.
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
                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1765974550/ChatGPT_Image_11_dic_2025_03_45_43_p.m._oajwry.png"
                            alt="RE/MAX Exclusive"
                            className="h-8 w-auto object-contain"
                        />
                    </Link>
                </div>

                {/* Empty spacer for desktop header to keep user menu on the right */}
                <div className="hidden md:block flex-1">
                    {/* You can add breadcrumbs here later */}
                </div>

                <div className="flex items-center gap-4">
                    {user && (
                        <Link
                            to="/profile"
                            className="flex items-center gap-3 px-3 py-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition-colors"
                        >
                            <div className="hidden sm:flex flex-col items-end mr-1">
                                <p className="text-xs font-bold leading-none">{profile?.first_name}</p>
                                <p className="text-[10px] leading-none text-muted-foreground capitalize">{profile?.role}</p>
                            </div>
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={profile?.avatar_url} />
                                <AvatarFallback className="bg-primary text-white text-xs">
                                    {profile?.first_name?.charAt(0) || user.email.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                        </Link>
                    )}
                    {!user && (
                        <Button variant="ghost" onClick={() => navigate('/login')}>Ingresar</Button>
                    )}
                </div>
            </div>
        </header>
    )
}

