import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription, Switch } from '@/components/ui'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Calendar, Upload, Trash2, PenTool, Bell } from 'lucide-react'

export default function Profile() {
    const { user, profile, refreshProfile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [connectingGoogle, setConnectingGoogle] = useState(false)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phone, setPhone] = useState('')
    const [signatureUrl, setSignatureUrl] = useState('')
    const [notificationPreferences, setNotificationPreferences] = useState({
        email: true,
        whatsapp: true,
        daily_summary: true
    })
    const [uploadingSignature, setUploadingSignature] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
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
            setSignatureUrl(profile.signature_image_url || '')
            if (profile.notification_preferences) {
                setNotificationPreferences({
                    email: profile.notification_preferences.email ?? true,
                    whatsapp: profile.notification_preferences.whatsapp ?? true,
                    daily_summary: profile.notification_preferences.daily_summary ?? true
                })
            }
        }
    }, [profile])

    // Handle Google OAuth Callback
    useEffect(() => {
        const code = searchParams.get('code')
        const googleError = searchParams.get('google_error')
        if (googleError) {
            toast.error(`Google rechazó la conexión: ${googleError}`)
            setSearchParams({})
            return
        }
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

            if (error) throw new Error(error.message || 'Error al vincular Google Calendar')

            if (data?.success) {
                toast.success('Google Calendar vinculado correctamente', { id: toastId })

                // Refresh profile first to ensure tokens are loaded
                await refreshProfile()

                // Trigger initial sync after profile is refreshed
                supabase.functions.invoke('google-calendar-sync', {
                    body: { agentId: user.id, action: 'sync_from_google' }
                }).then(({ data: syncData, error: syncError }) => {
                    if (syncError) console.warn('Initial sync skipped:', syncError.message)
                    else {
                        const totalSynced = (syncData?.results?.events || 0) + (syncData?.results?.tasks || 0)
                        toast.success(totalSynced > 0 ? `Sincronizados ${totalSynced} eventos de Google` : 'Google Calendar vinculado — sin cambios nuevos')
                    }
                })

                // Clear URL params
                setSearchParams({})
            } else {
                toast.error('No se pudo vincular Google Calendar', { id: toastId })
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

    const handleSignatureUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            toast.error('La imagen no debe superar 5MB')
            return
        }

        const validTypes = ['image/png', 'image/jpeg', 'image/webp']
        if (!validTypes.includes(file.type)) {
            toast.error('Solo se permiten imágenes PNG, JPG o WebP')
            return
        }

        setUploadingSignature(true)
        try {
            // Convert to base64 data URL (bypass broken storage service)
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.onerror = reject
                reader.readAsDataURL(file)
            })

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ signature_image_url: dataUrl, updated_at: new Date().toISOString() })
                .eq('id', user.id)

            if (updateError) throw updateError

            setSignatureUrl(dataUrl)
            await refreshProfile()
            toast.success('Firma de email actualizada')
        } catch (error) {
            console.error('Signature upload error:', error)
            toast.error(`Error al subir la firma: ${error?.message || 'desconocido'}`)
        } finally {
            setUploadingSignature(false)
        }
    }

    const handleDeleteSignature = async () => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ signature_image_url: null, updated_at: new Date().toISOString() })
                .eq('id', user.id)

            if (error) throw error

            setSignatureUrl('')
            await refreshProfile()
            toast.success('Firma eliminada')
        } catch (error) {
            console.error('Error deleting signature:', error)
            toast.error('Error al eliminar la firma')
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
                notification_preferences: notificationPreferences,
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

    const updatePreference = (key, value) => {
        setNotificationPreferences(prev => ({ ...prev, [key]: value }))
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

                        {/* Firma de Email — Opcional */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
                                <PenTool className="w-5 h-5 text-amber-500" />
                                Firma de Email
                                <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">(Opcional)</span>
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                Sube la imagen de tu firma profesional. Se incluirá automáticamente en todos los correos que envíes desde la plataforma.
                                <br />
                                <span className="text-slate-400 italic">Puedes agregar o cambiar tu firma en cualquier momento desde tu perfil.</span>
                            </p>

                            {signatureUrl ? (
                                <div className="space-y-3">
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900">
                                        <img
                                            src={signatureUrl}
                                            alt="Firma de email"
                                            className="max-w-full max-h-48 object-contain rounded"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                onChange={handleSignatureUpload}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={uploadingSignature}
                                            />
                                            <Button type="button" variant="outline" size="sm" disabled={uploadingSignature}>
                                                <Upload className="w-4 h-4 mr-1" />
                                                {uploadingSignature ? 'Subiendo...' : 'Cambiar'}
                                            </Button>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={handleDeleteSignature}
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Eliminar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                        isDragging
                                            ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20'
                                            : 'border-slate-300 dark:border-slate-600 hover:border-amber-400 hover:bg-amber-50/30 dark:hover:bg-amber-900/10'
                                    }`}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        setIsDragging(false)
                                        const file = e.dataTransfer.files?.[0]
                                        if (file) handleSignatureUpload({ target: { files: [file] } })
                                    }}
                                >
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={handleSignatureUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={uploadingSignature}
                                    />
                                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                                        {uploadingSignature ? 'Subiendo...' : isDragging ? 'Suelta aquí' : 'Haz clic o arrastra tu firma aquí'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">PNG, JPG o WebP — Máx. 5MB</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-blue-500" />
                                Preferencias de Notificaciones
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-medium">Recordatorios por Email</Label>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Recibe alertas de tus tareas en tu correo.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notificationPreferences.email}
                                        onCheckedChange={(val) => updatePreference('email', val)}
                                    />
                                </div>
                                
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-medium">Recordatorios por WhatsApp</Label>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Recibe alertas de tus tareas mediante mensajes de WhatsApp.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notificationPreferences.whatsapp}
                                        onCheckedChange={(val) => updatePreference('whatsapp', val)}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-medium">Resumen Diario a las 8:00 AM</Label>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Recibe un resumen con todas tus tareas del día y tareas atrasadas todas las mañanas.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notificationPreferences.daily_summary}
                                        onCheckedChange={(val) => updatePreference('daily_summary', val)}
                                    />
                                </div>
                            </div>
                        </div>

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
