import React from 'react'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { UserPlus } from 'lucide-react'
import ContactPickerInline from '@/components/ui/ContactPickerInline'
import SyncFieldIndicator from '@/components/ui/SyncFieldIndicator'

// Mapping: formField → contact column name
const FIELD_MAP = {
    arrendatarioNombre: 'first_name',
    arrendatarioApellido: 'last_name',
    arrendatarioRut: 'rut',
    arrendatarioEmail: 'email',
    arrendatarioTelefono: 'phone',
    arrendatarioDireccion: 'address',
    arrendatarioComuna: 'barrio_comuna',
}

export default function StepArrendatario({ data, onUpdate, onNext, onBack }) {
    // Conditional Logic for "Puntas"
    const isTenantRequired = data.arriendoRole !== 'Arrendador' // If Arrendador role, Tenant is optional

    // Validation
    const isTenantComplete =
        !isTenantRequired ||
        (data.arrendatarioNombre &&
            data.arrendatarioApellido &&
            data.arrendatarioRut &&
            data.arrendatarioEmail &&
            data.arrendatarioTelefono)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (isTenantComplete) onNext()
    }

    const handleContactSelect = (contact) => {
        onUpdate('arrendatarioNombre', contact.first_name || '')
        onUpdate('arrendatarioApellido', contact.last_name || '')
        onUpdate('arrendatarioRut', contact.rut || '')
        onUpdate('arrendatarioEmail', contact.email || '')
        onUpdate('arrendatarioTelefono', contact.phone || '')
        onUpdate('arrendatarioDireccion', contact.address || '')
        onUpdate('arrendatarioComuna', contact.barrio_comuna || '')
        // Store the CRM contact ID for auto-linking
        onUpdate('_crmArrendatarioContactId', contact.id)

        // Track which fields were empty in the original contact
        const emptyFields = []
        if (!contact.first_name) emptyFields.push('first_name')
        if (!contact.last_name) emptyFields.push('last_name')
        if (!contact.rut) emptyFields.push('rut')
        if (!contact.email) emptyFields.push('email')
        if (!contact.phone) emptyFields.push('phone')
        if (!contact.address) emptyFields.push('address')
        if (!contact.barrio_comuna) emptyFields.push('barrio_comuna')
        onUpdate('_crmArrendatarioEmptyFields', emptyFields)
        // Reset exclusions when new contact selected
        onUpdate('_syncExclude_arrendatario', [])
    }

    const contactId = data._crmArrendatarioContactId
    const emptyFields = data._crmArrendatarioEmptyFields || []
    const excludedFields = data._syncExclude_arrendatario || []
    const handleExclude = (field) => {
        onUpdate('_syncExclude_arrendatario', [...excludedFields, field])
    }

    // Helper to render a label with sync indicator
    const SyncLabel = ({ formField, children }) => (
        <SyncFieldIndicator
            contactId={contactId}
            fieldName={FIELD_MAP[formField]}
            emptyFields={emptyFields}
            currentValue={data[formField]}
            excludedFields={excludedFields}
            onExclude={handleExclude}
        >
            {children}
        </SyncFieldIndicator>
    )

    return (
        <Card className="max-w-xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
                        <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Datos del Arrendatario</h2>
                        <p className="text-sm text-muted-foreground">
                            {isTenantRequired
                                ? 'Información de la persona que arrendará la propiedad'
                                : 'Opcional — usted representa al Arrendador'}
                        </p>
                    </div>
                </div>

                {isTenantRequired && (
                    <ContactPickerInline
                        onSelectContact={handleContactSelect}
                        label="Pre-llenar datos del arrendatario"
                    />
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {isTenantRequired && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <SyncLabel formField="arrendatarioNombre">
                                    <Label>Nombre <span className="text-red-500">*</span></Label>
                                </SyncLabel>
                                <Input
                                    value={data.arrendatarioNombre}
                                    onChange={e => onUpdate('arrendatarioNombre', e.target.value)}
                                    placeholder="Nombre"
                                />
                            </div>
                            <div className="space-y-2">
                                <SyncLabel formField="arrendatarioApellido">
                                    <Label>Apellido <span className="text-red-500">*</span></Label>
                                </SyncLabel>
                                <Input
                                    value={data.arrendatarioApellido}
                                    onChange={e => onUpdate('arrendatarioApellido', e.target.value)}
                                    placeholder="Apellido"
                                />
                            </div>
                            <div className="space-y-2">
                                <SyncLabel formField="arrendatarioRut">
                                    <Label>RUT <span className="text-red-500">*</span></Label>
                                </SyncLabel>
                                <Input
                                    value={data.arrendatarioRut}
                                    onChange={e => onUpdate('arrendatarioRut', e.target.value)}
                                    placeholder="12.345.678-9"
                                />
                            </div>
                            <div className="space-y-2">
                                <SyncLabel formField="arrendatarioEmail">
                                    <Label>Email <span className="text-red-500">*</span></Label>
                                </SyncLabel>
                                <Input
                                    type="email"
                                    value={data.arrendatarioEmail}
                                    onChange={e => onUpdate('arrendatarioEmail', e.target.value)}
                                    placeholder="email@ejemplo.com"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <SyncLabel formField="arrendatarioTelefono">
                                    <Label>Teléfono <span className="text-red-500">*</span></Label>
                                </SyncLabel>
                                <Input
                                    value={data.arrendatarioTelefono}
                                    onChange={e => onUpdate('arrendatarioTelefono', e.target.value)}
                                    placeholder="+56 9 1234 5678"
                                />
                            </div>
                        </div>
                    )}

                    {!isTenantRequired && (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No se requiere arrendatario en este flujo.</p>
                            <p className="text-sm mt-1">Puede continuar al siguiente paso.</p>
                        </div>
                    )}

                    <div className="flex justify-between pt-4">
                        <Button type="button" variant="outline" onClick={onBack}>← Atrás</Button>
                        <Button type="submit" disabled={!isTenantComplete}>Siguiente →</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
