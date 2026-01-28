import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Profile() {
    const { user, profile, refreshProfile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phone, setPhone] = useState('')
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        if (location.state?.message) {
            toast.warning(location.state.message)
        }
    }, [location])

    useEffect(() => {
        if (profile) {
            setFirstName(profile.first_name || '')
            setLastName(profile.last_name || '')
            setPhone(profile.phone || '')
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
                updated_at: new Date(),
            }

            // Only set invitation_accepted_at if it's not already set
            if (!profile?.invitation_accepted_at) {
                updates.invitation_accepted_at = new Date()
            }

            const { error } = await supabase.from('profiles').upsert(updates)

            if (error) throw error

            await refreshProfile()
            toast.success('Perfil actualizado correctamente')

            // Redirect to dashboard if profile is complete
            if (firstName && lastName && phone) {
                navigate('/dashboard')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al actualizar perfil')
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
                        Completa tu información personal para continuar. Estos datos se usarán para autocompletar tus solicitudes.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={updateProfile}>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">Nombre</Label>
                                <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Apellido</Label>
                                <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
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
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                            {loading ? 'Guardando...' : 'Guardar y Continuar'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
