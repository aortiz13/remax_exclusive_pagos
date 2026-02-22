import React from 'react'
import { Card, CardContent, Button, Input, Label, Separator } from '@/components/ui'
import { User, CreditCard, Building, Wallet } from 'lucide-react'
import ContactPickerInline from '@/components/ui/ContactPickerInline'

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
    'Cuenta Vista',
    'Cuenta de Ahorro',
    'Cuenta RUT'
]

export default function StepDueñoBanco({ data, onUpdate, onNext, onBack }) {
    const isOwnerComplete = data.dueñoNombre && data.dueñoRut && data.dueñoEmail && data.dueñoTelefono
    const isBankComplete = data.bancoNombre && data.bancoTipoCuenta && data.bancoNroCuenta && data.bancoRutTitular

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isOwnerComplete && isBankComplete) onNext()
    }

    const handleContactSelect = (contact) => {
        onUpdate('dueñoNombre', `${contact.first_name || ''} ${contact.last_name || ''}`.trim())
        onUpdate('dueñoRut', contact.rut || '')
        onUpdate('dueñoEmail', contact.email || '')
        onUpdate('dueñoTelefono', contact.phone || '')
        onUpdate('dueñoDireccion', contact.address || '')
        onUpdate('dueñoComuna', contact.barrio_comuna || '')
        // Store the CRM contact ID for auto-linking
        onUpdate('_crmDueñoContactId', contact.id)

        // Also pre-fill bank info if available
        if (contact.bank_name) onUpdate('bancoNombre', contact.bank_name)
        if (contact.bank_account_type) onUpdate('bancoTipoCuenta', contact.bank_account_type)
        if (contact.bank_account_number) onUpdate('bancoNroCuenta', contact.bank_account_number)
        if (contact.rut) onUpdate('bancoRutTitular', contact.rut)
    }

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-6">
                {/* Owner Section */}
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Datos del Propietario</h2>
                        <p className="text-sm text-muted-foreground">Información del dueño de la propiedad</p>
                    </div>
                </div>

                <ContactPickerInline
                    onSelectContact={handleContactSelect}
                    label="Pre-llenar datos del propietario"
                />

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nombre Completo <span className="text-red-500">*</span></Label>
                            <Input
                                value={data.dueñoNombre}
                                onChange={e => onUpdate('dueñoNombre', e.target.value)}
                                placeholder="Nombre y Apellido"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>RUT <span className="text-red-500">*</span></Label>
                            <Input
                                value={data.dueñoRut}
                                onChange={e => onUpdate('dueñoRut', e.target.value)}
                                placeholder="12.345.678-9"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email <span className="text-red-500">*</span></Label>
                            <Input
                                type="email"
                                value={data.dueñoEmail}
                                onChange={e => onUpdate('dueñoEmail', e.target.value)}
                                placeholder="email@ejemplo.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Teléfono <span className="text-red-500">*</span></Label>
                            <Input
                                value={data.dueñoTelefono}
                                onChange={e => onUpdate('dueñoTelefono', e.target.value)}
                                placeholder="+56 9 1234 5678"
                            />
                        </div>
                    </div>

                    {/* Address fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Dirección</Label>
                            <Input
                                value={data.dueñoDireccion || ''}
                                onChange={e => onUpdate('dueñoDireccion', e.target.value)}
                                placeholder="Dirección particular"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Comuna</Label>
                            <Input
                                value={data.dueñoComuna || ''}
                                onChange={e => onUpdate('dueñoComuna', e.target.value)}
                                placeholder="Comuna"
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Bank Section */}
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold tracking-tight">Datos Bancarios</h3>
                            <p className="text-sm text-muted-foreground">Para transferencias al propietario</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Banco <span className="text-red-500">*</span></Label>
                            <select
                                value={data.bancoNombre}
                                onChange={e => onUpdate('bancoNombre', e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Seleccionar...</option>
                                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo de Cuenta <span className="text-red-500">*</span></Label>
                            <select
                                value={data.bancoTipoCuenta}
                                onChange={e => onUpdate('bancoTipoCuenta', e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Seleccionar...</option>
                                {ACCOUNT_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>N° Cuenta <span className="text-red-500">*</span></Label>
                            <Input
                                value={data.bancoNroCuenta}
                                onChange={e => onUpdate('bancoNroCuenta', e.target.value)}
                                placeholder="Número de cuenta"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>RUT Titular <span className="text-red-500">*</span></Label>
                            <Input
                                value={data.bancoRutTitular}
                                onChange={e => onUpdate('bancoRutTitular', e.target.value)}
                                placeholder="12.345.678-9"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between pt-4">
                        <Button type="button" variant="outline" onClick={onBack}>← Atrás</Button>
                        <Button type="submit" disabled={!isOwnerComplete || !isBankComplete}>Siguiente →</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
