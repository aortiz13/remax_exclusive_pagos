
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Profile() {
    const { user, profile, refreshProfile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phone, setPhone] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')

    useEffect(() => {
        if (profile) {
            setFirstName(profile.first_name || '')
            setLastName(profile.last_name || '')
            setPhone(profile.phone || '')
            setAvatarUrl(profile.avatar_url || '')
        }
    }, [profile])

    const updateProfile = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const updates = {
                id: user.id,
                first_name: firstName,
                last_name: lastName,
                phone,
                avatar_url: avatarUrl,
                updated_at: new Date(),
            }

            const { error } = await supabase.from('profiles').upsert(updates)

            if (error) throw error

            await refreshProfile()
            alert('Perfil actualizado correctamente')
        } catch (error) {
            console.error(error)
            alert('Error al actualizar perfil')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container max-w-2xl mx-auto px-4 py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Mi Perfil</CardTitle>
                    <CardDescription>
                        Gestiona tu información personal. Estos datos se usarán para autocompletar tus solicitudes.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={updateProfile}>
                    <CardContent className="space-y-6">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={avatarUrl} alt="Avatar" />
                                <AvatarFallback>{firstName?.charAt(0)}{lastName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="avatar">URL de Avatar</Label>
                                <Input
                                    id="avatar"
                                    placeholder="https://example.com/photo.jpg"
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">Nombre</Label>
                                <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Apellido</Label>
                                <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input
                                id="email"
                                value={user?.email || ''}
                                disabled
                                className="bg-slate-100 dark:bg-slate-800"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input
                                id="phone"
                                placeholder="+56 9 1234 5678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
