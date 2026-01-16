import React from 'react'
import { Card, CardContent, Button, Input, Label, Separator } from '@/components/ui'
import { User, CreditCard, Building, Wallet } from 'lucide-react'

const BANKS = [
    'Banco de Chile',
    'Banco Santander',
    'Banco Estado',
    'BCI',
    'Scotiabank',
    'Itaú',
    'Banco Bice',
    'Banco Security',
    'Banco Falabella',
    'Banco Ripley',
    'Banco Consorcio',
    'Banco Internacional',
    'HSBC',
    'Coopeuch'
]

const ACCOUNT_TYPES = [
    'Cuenta Corriente',
    'Cuenta Vista / RUT',
    'Cuenta de Ahorro'
]

export default function StepDueñoBanco({ data, onUpdate, onNext, onBack }) {
    const isOwnerComplete = data.dueñoNombre && data.dueñoRut && data.dueñoEmail
    const isBankComplete = data.bancoNombre && data.bancoTipoCuenta && data.bancoNroCuenta && data.bancoRutTitular
    const isComplete = isOwnerComplete && isBankComplete

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    const handleRutChange = (field, val) => {
        onUpdate(field, val)
    }

    return (
        <Card className="max-w-2xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Owner Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <User className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold text-foreground">Datos del Propietario</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo</Label>
                                <Input
                                    value={data.dueñoNombre}
                                    onChange={(e) => onUpdate('dueñoNombre', e.target.value)}
                                    required
                                    autoFocus
                                    placeholder="Nombre Apellido"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>RUT</Label>
                                <Input
                                    value={data.dueñoRut}
                                    onChange={(e) => handleRutChange('dueñoRut', e.target.value)}
                                    placeholder="12.345.678-9"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={data.dueñoEmail}
                                    onChange={(e) => onUpdate('dueñoEmail', e.target.value)}
                                    required
                                    placeholder="nombre@ejemplo.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Teléfono <span className="text-muted-foreground font-normal text-xs">(Opcional)</span></Label>
                                <Input
                                    type="tel"
                                    value={data.dueñoTelefono}
                                    onChange={(e) => onUpdate('dueñoTelefono', e.target.value)}
                                    placeholder="56 9 ..."
                                />
                            </div>
                        </div>
                    </div>


                    {/* Bank Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <Building className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold text-foreground">Datos Bancarios</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Banco</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={data.bancoNombre}
                                    onChange={(e) => onUpdate('bancoNombre', e.target.value)}
                                    required
                                >
                                    <option value="">Seleccionar...</option>
                                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo de Cuenta</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={data.bancoTipoCuenta}
                                    onChange={(e) => onUpdate('bancoTipoCuenta', e.target.value)}
                                    required
                                >
                                    <option value="">Seleccionar...</option>
                                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Número de Cuenta</Label>
                                <Input
                                    value={data.bancoNroCuenta}
                                    onChange={(e) => onUpdate('bancoNroCuenta', e.target.value)}
                                    required
                                    placeholder="12345678"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>RUT Titular</Label>
                                <Input
                                    value={data.bancoRutTitular}
                                    onChange={(e) => handleRutChange('bancoRutTitular', e.target.value)}
                                    placeholder="Si es distinto al dueño"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between pt-6">
                        <Button type="button" variant="outline" onClick={onBack}>
                            Atrás
                        </Button>
                        <Button type="submit" disabled={!isComplete}>
                            Siguiente
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
