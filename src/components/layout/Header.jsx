import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button, Avatar, AvatarFallback, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui'
import { LogOut, User, FileText, Settings } from 'lucide-react'

export default function Header() {
    const { user, profile, signOut } = useAuth()
    const navigate = useNavigate()

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
            <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-3">
                        <img
                            src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1765974550/ChatGPT_Image_11_dic_2025_03_45_43_p.m._oajwry.png"
                            alt="RE/MAX Exclusive"
                            className="h-10 w-auto object-contain"
                        />
                        <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 hidden sm:block">
                            Generador de Solicitudes
                        </h1>
                    </Link>
                </div>

                {user ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={profile?.avatar_url} />
                                    <AvatarFallback>{profile?.first_name?.charAt(0) || user.email.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{profile?.first_name} {profile?.last_name}</p>
                                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Mis Solicitudes</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate('/profile')}>
                                <User className="mr-2 h-4 w-4" />
                                <span>Mi Perfil</span>
                            </DropdownMenuItem>
                            {profile?.role === 'admin' && (
                                <DropdownMenuItem onClick={() => navigate('/admin/invites')}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Administración</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSignOut} className="text-red-500">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Cerrar Sesión</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => navigate('/login')}>Ingresar</Button>
                    </div>
                )}
            </div>
        </header>
    )
}

