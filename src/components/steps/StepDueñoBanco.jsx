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
    // Conditional Logic for "Puntas"
    const isOwnerRequired = data.arriendoRole !== 'Arrendatario' // If role is Arrendatario only, Owner is optional

    // Validation
    const isOwnerDataValid =
        !isOwnerRequired ||
        (data.dueñoNombre && data.dueñoRut && data.dueñoEmail && data.dueñoDireccion && data.dueñoComuna)

    const isBankComplete =
        !isOwnerRequired ||
        (data.bancoNombre && data.bancoTipoCuenta && data.bancoNroCuenta)

    const isComplete = isOwnerDataValid && isBankComplete

    // Check if initial value is "Other" (not in list and not empty)
    const [showOther, setShowOther] = React.useState(
        data.bancoNombre && !BANKS.includes(data.bancoNombre)
    )

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isComplete) onNext()
    }

    const handleRutChange = (field, val) => {
        onUpdate(field, val)
    }

    // Skip section if not required? Or just Show it as Optional?
    // "Flexibilidad en datos... permitir dejar en blanco" -> Show inputs but remove 'required' prop.

    return (
        <Card className="max-w-2xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="pt-6">
                {!isOwnerRequired && (
                    <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm border border-yellow-200">
                        <strong>Información Opcional:</strong> Has seleccionado "Punta Arrendatario", por lo que estos datos no son obligatorios.
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Owner Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <User className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold text-foreground">
                                Datos del Propietario
                                {!isOwnerRequired && <span className="text-sm font-normal text-muted-foreground ml-2">(Opcional)</span>}
                            </h2>
                        </div>

                        {/* ROW 1: Name, RUT */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo {isOwnerRequired && '*'}</Label>
                                <Input
                                    value={data.dueñoNombre}
                                    onChange={(e) => onUpdate('dueñoNombre', e.target.value)}
                                    required={isOwnerRequired}
                                    autoFocus
                                    placeholder="Nombre Apellido"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>RUT {isOwnerRequired && '*'}</Label>
                                <Input
                                    value={data.dueñoRut}
                                    onChange={(e) => handleRutChange('dueñoRut', e.target.value)}
                                    placeholder="12.345.678-9"
                                    required={isOwnerRequired}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Email {isOwnerRequired && '*'}</Label>
                                <Input
                                    type="email"
                                    value={data.dueñoEmail}
                                    onChange={(e) => onUpdate('dueñoEmail', e.target.value)}
                                    required={isOwnerRequired}
                                    placeholder="nombre@ejemplo.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Teléfono</Label>
                                <Input
                                    type="tel"
                                    value={data.dueñoTelefono}
                                    onChange={(e) => onUpdate('dueñoTelefono', e.target.value)}
                                    placeholder="56 9 ..."
                                />
                            </div>
                            {/* New Address Fields */}
                            <div className="space-y-2 md:col-span-2">
                                <Label>Dirección Particular {isOwnerRequired && '*'}</Label>
                                <Input
                                    value={data.dueñoDireccion}
                                    onChange={(e) => onUpdate('dueñoDireccion', e.target.value)}
                                    placeholder="Calle, Número, Depto"
                                    required={isOwnerRequired}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Comuna Particular {isOwnerRequired && '*'}</Label>
                                <Input
                                    value={data.dueñoComuna}
                                    onChange={(e) => onUpdate('dueñoComuna', e.target.value)}
                                    placeholder="Ej: Las Condes"
                                    required={isOwnerRequired}
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

                                    // If showOther is true, value is 'Otros'. 
                                    // If not, ensure value is in BANKS (or '' if empty). 
                                    // If data.bancoNombre is manually typed (custom) but we are hiding it? No, if custom, showOther must be true.
                                    value={showOther ? 'Otros' : (BANKS.includes(data.bancoNombre) ? data.bancoNombre : '')}

                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (val === 'Otros') {
                                            setShowOther(true)
                                            onUpdate('bancoNombre', '') // Clear to let user type
                                        } else {
                                            setShowOther(false)
                                            onUpdate('bancoNombre', val) // Set selected bank
                                        }
                                    }}
                                    required={isOwnerRequired}
                                >
                                    <option value="">Seleccionar...</option>
                                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>

                            {/* Conditional Other Bank Input */}
                            {showOther && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                    <Label>Nombre del Banco</Label>
                                    <Input
                                        value={data.bancoNombre}
                                        onChange={(e) => onUpdate('bancoNombre', e.target.value)}
                                        placeholder="Ingrese nombre del banco"
                                        required={isOwnerRequired}
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Tipo de Cuenta {isOwnerRequired && '*'}</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={data.bancoTipoCuenta}
                                    onChange={(e) => onUpdate('bancoTipoCuenta', e.target.value)}
                                    required={isOwnerRequired}
                                >
                                    <option value="">Seleccionar...</option>
                                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Número de Cuenta {isOwnerRequired && '*'}</Label>
                                <Input
                                    value={data.bancoNroCuenta}
                                    onChange={(e) => onUpdate('bancoNroCuenta', e.target.value)}
                                    required={isOwnerRequired}
                                    placeholder="12345678"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>RUT Titular</Label>
                                <Input
                                    value={data.bancoRutTitular}
                                    onChange={(e) => handleRutChange('bancoRutTitular', e.target.value)}
                                    placeholder="Si es distinto al dueño"
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
