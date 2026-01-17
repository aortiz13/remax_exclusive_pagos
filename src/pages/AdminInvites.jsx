import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../services/supabase'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription, Alert, AlertDescription, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { Trash2, Shield, User, Loader2 } from 'lucide-react'

export default function AdminInvites() {
    const { profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [role, setRole] = useState('agent')

    // Users list state
    const [users, setUsers] = useState([])
    const [usersLoading, setUsersLoading] = useState(true)
    const [deleteLoading, setDeleteLoading] = useState(null) // ID of user being deleted
    const [userToDelete, setUserToDelete] = useState(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

    useEffect(() => {
        if (profile?.role === 'admin') {
            fetchUsers()
        }
    }, [profile])


    const fetchUsers = async () => {
        try {
            setUsersLoading(true)
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setUsers(data)
        } catch (error) {
            console.error('Error fetching users:', error)
            toast.error('Error al cargar usuarios')
        } finally {
            setUsersLoading(false)
        }
    }


    // Protect: Only admin
    if (!authLoading && profile?.role !== 'admin') {
        return <Navigate to="/dashboard" />
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data, error } = await supabase.functions.invoke('invite-agent', {
                body: { email, firstName, lastName, role }
            })

            if (error) throw error

            toast.success('Invitación enviada correctamente')
            setEmail('')
            setFirstName('')
            setLastName('')
            setRole('agent')
            fetchUsers() // Refresh list just in case (though invited users might not appear until they accept/login first time, depending on flow. For now, profile is created on login usually, unless invite script inserts it. The invite script uses inviteUserByEmail but doesn't insert profile directly usually unless meta data is handled by trigger. Assuming standard flow.)

        } catch (error) {
            console.error('Error sending invite:', error)
            toast.error('Error al enviar invitación: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const confirmDelete = async () => {
        if (!userToDelete) return
        const userId = userToDelete.id

        setIsDeleteDialogOpen(false)
        setDeleteLoading(userId)
        try {
            const { data, error } = await supabase.functions.invoke('admin-action', {
                body: { action: 'delete', userId }
            })

            if (error) throw error

            setUsers(users.filter(u => u.id !== userId))
            toast.success('Usuario eliminado correctamente')

        } catch (error) {
            console.error('Error deleting user:', error)
            toast.error('Error al eliminar usuario')
        } finally {
            setDeleteLoading(null)
            setUserToDelete(null)
        }
    }

    const handleDeleteClick = (user) => {
        setUserToDelete(user)
        setIsDeleteDialogOpen(true)
    }

    return (
        <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                {/* Invite Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Invitar Agente</CardTitle>
                        <CardDescription>
                            Envía una invitación por correo a un nuevo agente.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleInvite}>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">Nombre</Label>
                                    <Input
                                        id="firstName"
                                        required
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Apellido</Label>
                                    <Input
                                        id="lastName"
                                        required
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="agente@remax-exclusive.cl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Rol</Label>
                                <Select value={role} onValueChange={setRole}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="agent">Agente</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Enviando...' : 'Enviar Invitación'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                {/* Instructions / Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Administración</CardTitle>
                        <CardDescription>
                            Gestiona el acceso y los usuarios de la plataforma.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                        <p>
                            Los usuarios invitados recibirán un correo electrónico con un enlace para establecer su contraseña e ingresar a la aplicación.
                        </p>
                        <Alert>
                            <AlertDescription>
                                Si eliminas un usuario, perderá acceso inmediatamente y todos sus datos de perfil serán borrados.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>


            {/* Users List Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Usuarios Registrados</CardTitle>
                    <CardDescription>
                        Lista de todos los agentes y administradores registrados.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {usersLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No hay usuarios registrados aun.</div>
                    ) : (
                        <div className="space-y-4">
                            {users.map((u) => (
                                <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {u.avatar_url ? (
                                                <img src={u.avatar_url} alt={u.first_name} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-lg font-bold text-slate-500">
                                                    {(u.first_name?.[0] || u.email?.[0] || '?').toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">
                                                {u.first_name} {u.last_name || ''}
                                                {u.id === profile?.id && <span className="ml-2 text-xs text-muted-foreground">(Tú)</span>}
                                            </p>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span>{u.email}</span>
                                                {u.role === 'admin' && (
                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                        Admin
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {u.id !== profile?.id && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                            onClick={() => handleDeleteClick(u)}
                                            disabled={deleteLoading === u.id}
                                        >
                                            {deleteLoading === u.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Eliminarás a <strong>{userToDelete?.first_name} {userToDelete?.last_name || ''}</strong> ({userToDelete?.email}) permanentemente de la plataforma.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Eliminar Usuario
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
