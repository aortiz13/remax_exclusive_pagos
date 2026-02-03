import { useState } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Label } from '@/components/ui'
import { UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function QuickContactWidget({ onComplete, isModal = false }) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: ''
    })

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.firstName || !formData.lastName) {
            toast.error('Nombre y apellido son obligatorios')
            return
        }

        try {
            setLoading(true)
            const { error } = await supabase
                .from('contacts')
                .insert([{
                    agent_id: user.id,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    phone: formData.phone,
                    email: formData.email,
                    status: 'new', // Default status
                    source: 'dashboard_quick_add'
                }])

            if (error) throw error

            toast.success('Contacto creado exitosamente')
            setFormData({ firstName: '', lastName: '', phone: '', email: '' })

            if (onComplete) {
                onComplete()
            }
        } catch (error) {
            console.error('Error creating contact:', error)
            toast.error('Error al crear contacto')
        } finally {
            setLoading(false)
        }
    }

    const FormContent = (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label htmlFor="firstName" className="text-xs">Nombre *</Label>
                    <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder="Ej: Juan"
                        className="h-8"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="lastName" className="text-xs">Apellido *</Label>
                    <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        placeholder="Ej: Pérez"
                        className="h-8"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs">Teléfono</Label>
                <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+56 9..."
                    className="h-8"
                />
            </div>

            <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="juan@ejemplo.com"
                    className="h-8"
                />
            </div>

            <Button type="submit" disabled={loading} className="w-full h-8" size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Crear Contacto
            </Button>
        </form>
    )

    if (isModal) {
        return FormContent
    }

    return (
        <Card className="h-full border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-blue-500" />
                    Nuevo Contacto Rápido
                </CardTitle>
            </CardHeader>
            <CardContent>
                {FormContent}
            </CardContent>
        </Card>
    )
}
