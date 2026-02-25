import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, Button, Input, Label, Separator } from '@/components/ui'
import { User, CreditCard, Building, Wallet, MapPin, Search } from 'lucide-react'
import ContactPickerInline from '@/components/ui/ContactPickerInline'
import SyncFieldIndicator from '@/components/ui/SyncFieldIndicator'

// Mapping: form field → contact column (for owner fields)
const OWNER_FIELD_MAP = {
    dueñoNombre: 'first_name',
    dueñoRut: 'rut',
    dueñoEmail: 'email',
    dueñoTelefono: 'phone',
    dueñoDireccion: 'address',
    dueñoComuna: 'barrio_comuna',
}

// Mapping: form field → contact column (for bank fields)
const BANK_FIELD_MAP = {
    bancoNombre: 'bank_name',
    bancoTipoCuenta: 'bank_account_type',
    bancoNroCuenta: 'bank_account_number',
}

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

// ── OpenStreetMap Autocomplete Hook ──────────────────────────────────
function useAddressAutocomplete() {
    const [query, setQuery] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const timerRef = useRef(null)

    const search = useCallback((q) => {
        if (timerRef.current) clearTimeout(timerRef.current)
        if (!q || q.length < 3) {
            setSuggestions([])
            setShowDropdown(false)
            return
        }
        setIsLoading(true)
        timerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=cl&limit=5&q=${encodeURIComponent(q)}`,
                    { headers: { 'Accept-Language': 'es' } }
                )
                const data = await res.json()
                setSuggestions(data)
                setShowDropdown(data.length > 0)
            } catch (err) {
                console.error('OSM search error:', err)
                setSuggestions([])
            } finally {
                setIsLoading(false)
            }
        }, 400)
    }, [])

    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [])

    return { query, setQuery, suggestions, isLoading, showDropdown, setShowDropdown, search }
}

// Extract comuna from OSM address details
function extractComuna(address) {
    // Try multiple fields that could contain the comuna/city
    return address?.city || address?.town || address?.suburb || address?.municipality || address?.village || address?.county || ''
}

export default function StepDueñoBanco({ data, onUpdate, onNext, onBack }) {
    const isOwnerComplete = data.dueñoNombre && data.dueñoRut && data.dueñoEmail && data.dueñoTelefono && data.dueñoDireccion && data.dueñoComuna
    const isBankComplete = data.bancoNombre && data.bancoTipoCuenta && data.bancoNroCuenta && data.bancoRutTitular

    const autocomplete = useAddressAutocomplete()
    const dropdownRef = useRef(null)
    const [filledFromContact, setFilledFromContact] = useState(false)

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                autocomplete.setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

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

        // Mark as filled from contact to skip autocomplete pre-fill
        if (contact.address) setFilledFromContact(true)

        // Also pre-fill bank info if available
        if (contact.bank_name) onUpdate('bancoNombre', contact.bank_name)
        if (contact.bank_account_type) onUpdate('bancoTipoCuenta', contact.bank_account_type)
        if (contact.bank_account_number) onUpdate('bancoNroCuenta', contact.bank_account_number)
        if (contact.rut) onUpdate('bancoRutTitular', contact.rut)

        // Track which fields were empty in the original contact
        const emptyFields = []
        if (!contact.first_name && !contact.last_name) emptyFields.push('first_name')
        if (!contact.rut) emptyFields.push('rut')
        if (!contact.email) emptyFields.push('email')
        if (!contact.phone) emptyFields.push('phone')
        if (!contact.address) emptyFields.push('address')
        if (!contact.barrio_comuna) emptyFields.push('barrio_comuna')
        if (!contact.bank_name) emptyFields.push('bank_name')
        if (!contact.bank_account_type) emptyFields.push('bank_account_type')
        if (!contact.bank_account_number) emptyFields.push('bank_account_number')
        onUpdate('_crmDueñoEmptyFields', emptyFields)
        // Reset exclusions when new contact selected
        onUpdate('_syncExclude_dueño', [])
    }

    const handleAddressInput = (value) => {
        onUpdate('dueñoDireccion', value)
        setFilledFromContact(false)
        autocomplete.setQuery(value)
        autocomplete.search(value)
    }

    const handleSelectSuggestion = (item) => {
        const displayName = item.display_name || ''
        onUpdate('dueñoDireccion', displayName)
        const comuna = extractComuna(item.address)
        if (comuna) onUpdate('dueñoComuna', comuna)
        autocomplete.setShowDropdown(false)
        autocomplete.setQuery('')
    }

    // Sync indicator helpers
    const contactId = data._crmDueñoContactId
    const emptyFields = data._crmDueñoEmptyFields || []
    const excludedFields = data._syncExclude_dueño || []
    const handleExclude = (field) => {
        onUpdate('_syncExclude_dueño', [...excludedFields, field])
    }

    const SyncLabel = ({ formField, contactField, children }) => (
        <SyncFieldIndicator
            contactId={contactId}
            fieldName={contactField || OWNER_FIELD_MAP[formField] || BANK_FIELD_MAP[formField]}
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
                            <SyncLabel formField="dueñoNombre">
                                <Label>Nombre Completo <span className="text-red-500">*</span></Label>
                            </SyncLabel>
                            <Input
                                value={data.dueñoNombre}
                                onChange={e => onUpdate('dueñoNombre', e.target.value)}
                                placeholder="Nombre y Apellido"
                            />
                        </div>
                        <div className="space-y-2">
                            <SyncLabel formField="dueñoRut">
                                <Label>RUT <span className="text-red-500">*</span></Label>
                            </SyncLabel>
                            <Input
                                value={data.dueñoRut}
                                onChange={e => onUpdate('dueñoRut', e.target.value)}
                                placeholder="12.345.678-9"
                            />
                        </div>
                        <div className="space-y-2">
                            <SyncLabel formField="dueñoEmail">
                                <Label>Email <span className="text-red-500">*</span></Label>
                            </SyncLabel>
                            <Input
                                type="email"
                                value={data.dueñoEmail}
                                onChange={e => onUpdate('dueñoEmail', e.target.value)}
                                placeholder="email@ejemplo.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <SyncLabel formField="dueñoTelefono">
                                <Label>Teléfono <span className="text-red-500">*</span></Label>
                            </SyncLabel>
                            <Input
                                value={data.dueñoTelefono}
                                onChange={e => onUpdate('dueñoTelefono', e.target.value)}
                                placeholder="+56 9 1234 5678"
                            />
                        </div>
                    </div>

                    {/* Address fields with OSM Autocomplete */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 relative" ref={dropdownRef}>
                            <SyncLabel formField="dueñoDireccion">
                                <Label>Dirección Particular <span className="text-red-500">*</span></Label>
                            </SyncLabel>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <Input
                                    value={data.dueñoDireccion || ''}
                                    onChange={e => handleAddressInput(e.target.value)}
                                    placeholder="Buscar dirección..."
                                    className="pl-9"
                                />
                                {autocomplete.isLoading && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>

                            {/* Autocomplete Dropdown */}
                            {autocomplete.showDropdown && !filledFromContact && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                                    {autocomplete.suggestions.map((item, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleSelectSuggestion(item)}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-primary/5 border-b border-slate-50 last:border-0 flex items-start gap-2 transition-colors"
                                        >
                                            <Search className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-slate-800 font-medium leading-tight">{item.display_name}</p>
                                                {item.address && (
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Comuna: {extractComuna(item.address) || 'N/A'}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <SyncLabel formField="dueñoComuna">
                                <Label>Comuna <span className="text-red-500">*</span></Label>
                            </SyncLabel>
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
                            <SyncLabel formField="bancoNombre">
                                <Label>Banco <span className="text-red-500">*</span></Label>
                            </SyncLabel>
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
                            <SyncLabel formField="bancoTipoCuenta">
                                <Label>Tipo de Cuenta <span className="text-red-500">*</span></Label>
                            </SyncLabel>
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
                            <SyncLabel formField="bancoNroCuenta">
                                <Label>N° Cuenta <span className="text-red-500">*</span></Label>
                            </SyncLabel>
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
