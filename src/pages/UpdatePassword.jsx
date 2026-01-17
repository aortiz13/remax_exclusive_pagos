import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../services/supabase'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui'
import { CardDescription } from '@/components/ui'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function UpdatePassword() {
    const [loading, setLoading] = useState(false)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const navigate = useNavigate()
    const { user } = useAuth()

    useEffect(() => {
        // Redirect if no user is found (meaning they didn't click the link or session expired)
        // Wait a bit to ensure auth state is loaded
        const timer = setTimeout(() => {
            if (!user) {
                // If we are on this page, Supabase should have recovered the session from the URL hash.
                // If not, maybe show an error or redirect.
                // For now, let's assume the session recovery works.
            }
        }, 1000)
        return () => clearTimeout(timer)
    }, [user])

    const handleUpdate = async (e) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            toast.error('Las contraseñas no coinciden')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })
            if (error) throw error
            toast.success('Contraseña actualizada exitosamente')
            navigate('/dashboard')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Nueva Contraseña</CardTitle>
                    <CardDescription className="text-center">
                        Ingresa tu nueva contraseña para acceder a tu cuenta.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleUpdate}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nueva Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                minLength={6}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
