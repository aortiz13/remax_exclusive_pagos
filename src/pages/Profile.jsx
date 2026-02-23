import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Calendar } from 'lucide-react'

export default function Profile() {
    const { user, profile, refreshProfile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [connectingGoogle, setConnectingGoogle] = useState(false)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phone, setPhone] = useState('')
    const [searchParams, setSearchParams] = useSearchParams()
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

    // Handle Google OAuth Callback
    useEffect(() => {
        const code = searchParams.get('code')
        if (code) {
            handleGoogleCallback(code)
        }
    }, [searchParams])

    const handleGoogleCallback = async (code) => {
        setConnectingGoogle(true)
        const toastId = toast.loading('Finalizando conexión con Google...')
        try {
            const { data, error } = await supabase.functions.invoke('google-auth', {
                method: 'POST',
                body: { action: 'callback', code }
            })

            if (data?.success) {
                toast.success('Google Calendar vinculado correctamente', { id: toastId })

                // Trigger initial sync
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'sync_from_google' }
                }).then(({ data: syncData, error: syncError }) => {
                    if (syncError) console.error('Initial sync error:', syncError)
                    else toast.success(`Sincronizados ${syncData?.count || 0} eventos de Google`)
                })

                await refreshProfile()
                // Clear URL params
                setSearchParams({})
            }
        } catch (error) {
            console.error(error)
            toast.error(error.message || 'Error al vincular Google Calendar', { id: toastId })
        } finally {
            setConnectingGoogle(false)
        }
    }

    const connectGoogleCalendar = async () => {
        setConnectingGoogle(true)
        try {
            const { data, error } = await supabase.functions.invoke('google-auth', {
                method: 'POST',
                body: { action: 'authorize' }
            })

            if (error) throw error
            if (data?.url) window.location.href = data.url
        } catch (error) {
            console.error(error)
            toast.error('Error al iniciar vinculación con Google')
        } finally {
            setConnectingGoogle(false)
        }
    }

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

                        {profile?.remax_agent_id && (
                            <div className="space-y-2">
                                <Label htmlFor="remaxId">ID Agente REMAX</Label>
                                <Input
                                    id="remaxId"
                                    value={profile.remax_agent_id}
                                    disabled
                                    className="bg-slate-50 dark:bg-slate-800 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 font-semibold"
                                />
                                <p className="text-[10px] text-muted-foreground">Este ID es asignado por administración.</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-500" />
                                Integraciones
                            </h3>
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Google Calendar</p>
                                    <p className="text-xs text-slate-500">
                                        {profile?.google_refresh_token
                                            ? 'Tu calendario está sincronizado bidireccionalmente.'
                                            : 'Sincroniza tus tareas con tu calendario de Google.'}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant={profile?.google_refresh_token ? "outline" : "default"}
                                    size="sm"
                                    onClick={connectGoogleCalendar}
                                    disabled={connectingGoogle}
                                >
                                    {connectingGoogle ? 'Conectando...' : profile?.google_refresh_token ? 'Reconectar' : 'Conectar'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                            {loading ? 'Guardando Perfil...' : 'Guardar y Continuar'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
