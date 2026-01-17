
import { useState } from 'react'
import { supabase } from '../services/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

export default function AdminInvites() {
    const { profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')

    // Protect: Only admin
    if (!authLoading && profile?.role !== 'admin') {
        return <Navigate to="/dashboard" />
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Option 1: Call Edge Function (Recommended for Custom Email)
            const { data, error } = await supabase.functions.invoke('invite-agent', {
                body: { email, firstName, lastName }
            })

            if (error) throw error

            alert('Invitación enviada correctamente')
            setEmail('')
            setFirstName('')
            setLastName('')

        } catch (error) {
            console.error('Error sending invite:', error)
            alert('Error al enviar invitación: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container max-w-md mx-auto px-4 py-8">
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
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar Invitación'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <div className="mt-8 text-center text-sm text-muted-foreground">
                <p>Nota: Asegúrate de tener configurado el envío de correos.</p>
            </div>
        </div>
    )
}
