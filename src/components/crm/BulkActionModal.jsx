import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Button, Label, Textarea, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Input } from '@/components/ui'
import { 
  X, Activity, Loader2, CheckCircle2, AlertTriangle, 
  ChevronsUpDown, Check, Link2, Plus, Calendar, 
  Clock, Save, Trash2, DollarSign, Briefcase, 
  TrendingUp, Receipt, Info
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { toISOLocal, cn } from '@/lib/utils'
import { logActivity } from '../../services/activityService'
import { fetchUFValue } from '../../services/ufService'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

const ACTION_TYPES = [
  "Café relacional",
  "Entrevista Venta (Pre-listing)",
  "Entrevista Compra (Pre-Buying)",
  "Evaluación Comercial",
  "Visita Propiedad",
  "Visita comprador/arrendatario (Canje)",
  "Carta Oferta",
  "Baja de Precio",
  "Facturación",
  "Contrato de arriendo firmado",
  "Promesa Firmada",
  "Llamada en frío (I.C)",
  "Llamada vendedor/arrendador (I.C)",
  "Llamada comprador/arrendatario (I.C)",
  "Llamada a base relacional (I.C)",
  "Visita a Conserjes (IC)",
  "Otra (I.C)"
]

const CALL_RESULTS = [
  "Ocupado",
  "Conectado",
  "Dejó mensaje de voz",
  "Sin respuesta",
  "Número Incorrecto",
  "Otra"
]

const FOLLOW_UP_DELAYS = [
  { label: "Hoy", value: "today" },
  { label: "Mañana", value: "tomorrow" },
  { label: "En 2 días laborables", value: "2_business_days" },
  { label: "En 3 días laborables", value: "3_business_days" },
  { label: "En 2 semanas", value: "2_weeks" },
  { label: "En 1 mes", value: "1_month" },
  { label: "En 3 meses", value: "3_months" },
  { label: "Fecha personalizada", value: "custom" }
]

/**
 * BulkActionModal — Register a CRM action for multiple contacts.
 */
export default function BulkActionModal({ isOpen, onClose, contacts = [] }) {
  const { profile, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0, errorDetails: [] })

  // Form state
  const [formData, setFormData] = useState({
    action_type: '',
    note: '',
    action_date: toISOLocal(), // Changed to full datetime
    property_id: '',
    is_canje: false,
    call_result: '',
    other_call_result: '',
    deal_type: '', // 'Venta' | 'Arriendo'
    closing_value: '',
    gross_fees: '',
    closing_currency: 'CLP',
    fees_currency: 'CLP',
  })

  // Options & Logic state
  const [properties, setProperties] = useState([])
  const [openPropertySelect, setOpenPropertySelect] = useState(false)
  const [propTypeFilter, setPropTypeFilter] = useState('all')
  const [ufValue, setUfValue] = useState(38000) // Default fallback
  const [createFollowUp, setCreateFollowUp] = useState(false)
  const [followUpTasks, setFollowUpTasks] = useState([
    {
      id: Date.now(),
      delay: '2_business_days',
      customDate: toISOLocal().split('T')[0],
      useSpecificTime: false,
      specificTime: '09:00',
      action: '',
      description: '',
      reminder_minutes: 'none',
      linkedActionType: 'none'
    }
  ])

  useEffect(() => {
    if (isOpen) {
      setComplete(false)
      setProgress({ done: 0, total: 0, errors: 0, errorDetails: [] })
      setFormData({
        action_type: '',
        note: '',
        action_date: toISOLocal(),
        property_id: '',
        is_canje: false,
        call_result: '',
        other_call_result: '',
        deal_type: '',
        closing_value: '',
        gross_fees: '',
        closing_currency: 'CLP',
        fees_currency: 'CLP',
      })
      setPropTypeFilter('all')
      setCreateFollowUp(false)
      fetchProperties()
      fetchUFValue().then(res => res && setUfValue(res.valor))
    }
  }, [isOpen])

  const fetchProperties = async () => {
    const { data } = await supabase.from('properties').select('id, address, property_type').order('address')
    setProperties(data || [])
  }

  const PROP_TYPES = [
    { key: 'all', label: 'Todos' },
    { key: 'Departamento', label: 'Depto' },
    { key: 'Casa', label: 'Casa' },
    { key: 'Comercial', label: 'Comercial' },
    { key: 'Oficina', label: 'Oficina' },
    { key: 'Terreno', label: 'Terreno' },
  ]

  const filteredProperties = useMemo(() => {
    if (propTypeFilter === 'all') return properties
    return properties.filter(p => p.property_type === propTypeFilter)
  }, [properties, propTypeFilter])

  const toCLP = (amount, currency) => {
    const n = parseFloat(amount)
    if (!amount || isNaN(n)) return null
    if (currency === 'CLP') return n
    return ufValue > 0 ? Math.round(n * ufValue) : n
  }

  const addBusinessDays = (date, days) => {
    let added = 0
    const result = new Date(date)
    while (added < days) {
      result.setDate(result.getDate() + 1)
      const dayOfWeek = result.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) added++
    }
    return result
  }

  const calculateFollowUpDate = (delay, baseDate = new Date(), customDateStr = null) => {
    let date = new Date(baseDate)
    switch (delay) {
      case 'today': break
      case 'tomorrow': date.setDate(date.getDate() + 1); break
      case '2_business_days': date = addBusinessDays(date, 2); break
      case '3_business_days': date = addBusinessDays(date, 3); break
      case '2_weeks': date.setDate(date.getDate() + 14); break
      case '1_month': date.setMonth(date.getMonth() + 1); break
      case '3_months': date.setMonth(date.getMonth() + 3); break
      case 'custom':
        if (customDateStr) {
          const [y, m, d] = customDateStr.split('-').map(Number)
          return new Date(y, m - 1, d, 12, 0, 0)
        }
        break
    }
    return date
  }

  const handleSubmit = async () => {
    if (!formData.action_type) {
      toast.error('Seleccione un tipo de acción')
      return
    }

    setLoading(true)
    setComplete(false)
    const total = contacts.length
    let done = 0
    let errorsList = []
    const agentId = profile?.id || user?.id

    for (const contact of contacts) {
      try {
        const dateTime = formData.action_date.includes('T') 
          ? formData.action_date 
          : `${formData.action_date}T12:00:00Z`

        // Create the CRM action
        const { data: actionRow, error: actionError } = await supabase
          .from('crm_actions')
          .insert({
            agent_id: agentId,
            action_type: formData.action_type,
            note: formData.note || null,
            action_date: dateTime,
            property_id: formData.property_id || null,
            is_conversation_starter: formData.action_type.includes('(I.C)'),
            is_canje: formData.action_type === 'Visita Propiedad' ? formData.is_canje : false,
            call_result: formData.action_type.startsWith('Llamada') 
              ? (formData.call_result === 'Otra' ? formData.other_call_result : formData.call_result) 
              : null,
            deal_type: formData.action_type === 'Facturación' ? formData.deal_type : null,
            closing_value: formData.action_type === 'Facturación' ? toCLP(formData.closing_value, formData.closing_currency) : null,
            gross_fees: formData.action_type === 'Facturación' ? toCLP(formData.gross_fees, formData.fees_currency) : null,
            kpi_deferred: false
          })
          .select('id')
          .single()

        if (actionError) throw new Error(`[crm_actions]: ${actionError.message}`)

        // Link to contact
        const { error: linkError } = await supabase
          .from('crm_action_contacts')
          .insert({ action_id: actionRow.id, contact_id: contact.id })

        if (linkError) throw new Error(`[crm_action_contacts]: ${linkError.message}`)

        // Create Follow-up Tasks if requested
        if (createFollowUp) {
          for (const task of followUpTasks) {
            let followUpDate = calculateFollowUpDate(task.delay, dateTime, task.customDate)
            if (task.useSpecificTime && task.specificTime) {
              const [h, m] = task.specificTime.split(':')
              followUpDate.setHours(parseInt(h), parseInt(m), 0, 0)
            } else {
              followUpDate.setHours(12, 0, 0, 0)
            }

            let futureActionId = null
            if (task.linkedActionType && task.linkedActionType !== 'none') {
              const { data: futAct, error: futErr } = await supabase.from('crm_actions').insert({
                agent_id: agentId,
                action_type: task.linkedActionType,
                action_date: followUpDate.toISOString(),
                property_id: formData.property_id || null,
                note: `Seguimiento automático: ${formData.action_type}`,
                is_conversation_starter: task.linkedActionType.includes('(I.C)'),
                kpi_deferred: true
              }).select('id').single()
              if (!futErr) {
                futureActionId = futAct.id
                await supabase.from('crm_action_contacts').insert({ action_id: futAct.id, contact_id: contact.id })
              }
            }

            await supabase.from('crm_tasks').insert({
              agent_id: agentId,
              contact_id: contact.id,
              property_id: formData.property_id || null,
              action: task.action || `Seguimiento: ${formData.action_type}`,
              description: task.description || null,
              reminder_minutes: (task.useSpecificTime && task.reminder_minutes !== 'none') ? parseInt(task.reminder_minutes) : null,
              execution_date: followUpDate.toISOString(),
              action_id: futureActionId || actionRow.id,
              task_type: 'task',
              is_all_day: !task.useSpecificTime
            })
          }
        }

        // Timeline log
        await logActivity({
          action: 'Acción Masiva',
          entity_type: formData.property_id ? 'Propiedad' : 'Contacto',
          entity_id: formData.property_id || contact.id,
          description: `Acción registrada: ${formData.action_type}`,
          details: { date: dateTime, note: formData.note },
          contact_id: contact.id,
          property_id: formData.property_id || null
        }).catch(() => {})

      } catch (err) {
        errorsList.push({ contact: `${contact.first_name || ''} ${contact.last_name || ''}`, error: err.message })
      }
      done++
      setProgress({ done, total, errors: errorsList.length, errorDetails: errorsList })
    }

    setComplete(true)
    setLoading(false)
    toast.success(`${done - errorsList.length} registros exitosos`)
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative z-50 border border-slate-200 dark:border-slate-700"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-none">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Acción Masiva</h2>
                <p className="text-xs text-slate-500">
                  Se registrará una acción para {contacts.length} contacto{contacts.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={loading}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {complete ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold shrink-0">¡Acciones registradas!</h3>
            <p className="text-sm text-slate-500 shrink-0">
              {progress.done - progress.errors} de {progress.total} acciones registradas
              {progress.errors > 0 && <span className="text-red-500 ml-1">({progress.errors} errores)</span>}
            </p>

            {progress.errors > 0 && progress.errorDetails && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 max-w-md w-full shrink-0">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Errores detallados
                </p>
                <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {progress.errorDetails.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400 mb-1 leading-tight border-b border-red-100 dark:border-red-900/30 last:border-0 pb-1">
                      <span className="font-semibold">{err.contact}:</span> {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={onClose} className="mt-4 shrink-0 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              
              {/* Individual Record Warning */}
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                  <strong>Nota Importante:</strong> Esta acción creará un registro individual en el historial de cada uno de los {contacts.length} contactos seleccionados.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Action Type */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Tipo de Acción <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.action_type}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, action_type: val }))}
                  >
                    <SelectTrigger className="h-9 border-slate-200 dark:border-slate-700 focus:ring-orange-500">
                      <SelectValue placeholder="Seleccionar acción..." />
                    </SelectTrigger>
                    <SelectContent className="z-[300] max-h-[300px]">
                      {ACTION_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Property Selection */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Propiedad (Opcional)</Label>
                  <Popover open={openPropertySelect} onOpenChange={setOpenPropertySelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPropertySelect}
                        className="w-full justify-between h-9 text-sm font-normal border-slate-200 dark:border-slate-700"
                      >
                        <span className="truncate">
                          {formData.property_id
                            ? properties.find(p => p.id === formData.property_id)?.address || "Dirección no encontrada"
                            : "Buscar una propiedad..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[300]" align="start">
                      <Command>
                        <div className="flex items-center gap-1 p-2 border-b bg-slate-50 dark:bg-slate-900 overflow-x-auto no-scrollbar">
                          {PROP_TYPES.map(type => (
                            <button
                              key={type.key}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setPropTypeFilter(type.key)
                              }}
                              className={cn(
                                "px-2.5 py-1 text-[10px] rounded-md border transition-all whitespace-nowrap font-medium",
                                propTypeFilter === type.key
                                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                              )}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                        <CommandInput placeholder="Buscar por dirección..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron propiedades.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => {
                                setFormData(prev => ({ ...prev, property_id: '' }))
                                setOpenPropertySelect(false)
                              }}
                              className="text-slate-500 italic cursor-pointer"
                            >
                              <X className="mr-2 h-4 w-4" /> Ninguna propiedad
                            </CommandItem>
                            {filteredProperties.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.address}
                                onSelect={() => {
                                  setFormData(prev => ({ ...prev, property_id: p.id }))
                                  setOpenPropertySelect(false)
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.property_id === p.id ? "opacity-100" : "opacity-0")} />
                                {p.address}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Call Result (Conditional) */}
              {formData.action_type.startsWith('Llamada') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-orange-700 dark:text-orange-400">Resultado de la llamada</Label>
                    <Select
                      value={formData.call_result}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, call_result: val }))}
                    >
                      <SelectTrigger className="h-9 border-orange-200 dark:border-orange-800 focus:ring-orange-500">
                        <SelectValue placeholder="Seleccionar resultado..." />
                      </SelectTrigger>
                      <SelectContent className="z-[300]">
                        {CALL_RESULTS.map(res => (
                          <SelectItem key={res} value={res}>{res}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.call_result === 'Otra' && (
                    <div className="space-y-1.5 focus-within:animate-pulse">
                      <Label className="text-sm font-medium">Especificar resultado</Label>
                      <Input
                        value={formData.other_call_result}
                        onChange={(e) => setFormData(prev => ({ ...prev, other_call_result: e.target.value }))}
                        placeholder="Describa el resultado..."
                        className="h-9"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Is Canje (Conditional for Property Visit) */}
              {formData.action_type === 'Visita Propiedad' && (
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <input
                    type="checkbox"
                    id="is_canje"
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    checked={formData.is_canje}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_canje: e.target.checked }))}
                  />
                  <Label htmlFor="is_canje" className="text-sm text-blue-800 dark:text-blue-300 cursor-pointer font-medium">
                    Visita por Canje (con colega externo)
                  </Label>
                </div>
              )}

              {/* Billing Fields (Conditional) */}
              {formData.action_type === 'Facturación' && (
                <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" /> Datos de la Operación
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-emerald-800">Operación</Label>
                      <Select value={formData.deal_type} onValueChange={(val) => setFormData(prev => ({ ...prev, deal_type: val }))}>
                        <SelectTrigger className="h-9 border-emerald-200 bg-white dark:bg-slate-900"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                        <SelectContent className="z-[300]">
                          <SelectItem value="Venta">Venta</SelectItem>
                          <SelectItem value="Arriendo">Arriendo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-[11px] font-bold text-emerald-800">Valor de Cierre</Label>
                        <div className="flex gap-2">
                           <Input
                             type="number"
                             value={formData.closing_value}
                             onChange={(e) => setFormData(prev => ({ ...prev, closing_value: e.target.value }))}
                             placeholder="Monto"
                             className="h-9 flex-1 border-emerald-200"
                           />
                           <Select value={formData.closing_currency} onValueChange={(val) => setFormData(prev => ({ ...prev, closing_currency: val }))}>
                             <SelectTrigger className="w-20 h-9 border-emerald-200"><SelectValue /></SelectTrigger>
                             <SelectContent className="z-[300]">
                               <SelectItem value="CLP">CLP</SelectItem>
                               <SelectItem value="UF">UF</SelectItem>
                             </SelectContent>
                           </Select>
                        </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-emerald-800">Honorarios Brutos (GCI)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={formData.gross_fees}
                        onChange={(e) => setFormData(prev => ({ ...prev, gross_fees: e.target.value }))}
                        placeholder="Comisión total"
                        className="h-9 flex-1 border-emerald-200"
                      />
                      <Select value={formData.fees_currency} onValueChange={(val) => setFormData(prev => ({ ...prev, fees_currency: val }))}>
                        <SelectTrigger className="w-20 h-9 border-emerald-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[300]">
                          <SelectItem value="CLP">CLP</SelectItem>
                          <SelectItem value="UF">UF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.gross_fees && (formData.closing_currency === 'UF' || formData.fees_currency === 'UF') && (
                        <p className="text-[10px] text-emerald-600 italic">
                          Conversión estimada a CLP: ${toCLP(formData.gross_fees, formData.fees_currency)?.toLocaleString('es-CL')} (UF: ${ufValue})
                        </p>
                    )}
                  </div>
                </div>
              )}

              {/* Date & Note Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Fecha de la acción</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="datetime-local"
                      value={formData.action_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, action_date: e.target.value }))}
                      className="flex h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-background pl-10 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 font-medium"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex-1 h-9">
                    <input
                      type="checkbox"
                      id="create_follow_up"
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                      checked={createFollowUp}
                      onChange={(e) => setCreateFollowUp(e.target.checked)}
                    />
                    <Label htmlFor="create_follow_up" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Programar seguimiento
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pb-2">
                <Label className="text-sm font-medium">Nota <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Textarea
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Describa brevemente lo ocurrido..."
                  className="resize-none h-16 min-h-[64px] border-slate-200 dark:border-slate-700 focus-visible:ring-orange-500"
                />
              </div>

              {/* Follow-up Tasks List */}
              {createFollowUp && (
                <div className="border-t pt-4 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" /> Tareas de Seguimiento Individuales
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFollowUpTasks(prev => [...prev, {
                        id: Date.now(),
                        delay: '2_business_days',
                        customDate: toISOLocal().split('T')[0],
                        useSpecificTime: false,
                        specificTime: '09:00',
                        action: '',
                        description: '',
                        reminder_minutes: 'none',
                        linkedActionType: 'none'
                      }])}
                      className="h-7 text-[10px] gap-1"
                    >
                      <Plus className="w-3 h-3" /> Añadir otra tarea
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {followUpTasks.map((task, idx) => (
                      <div key={task.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 relative group shadow-sm">
                        {followUpTasks.length > 1 && (
                          <button
                            onClick={() => setFollowUpTasks(prev => prev.filter(t => t.id !== task.id))}
                            className="absolute -right-2 -top-2 w-7 h-7 bg-red-100 text-red-600 border border-red-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white shadow-lg z-10"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cuándo realizar la tarea</Label>
                            <Select
                              value={task.delay}
                              onValueChange={(val) => {
                                const newTasks = [...followUpTasks];
                                newTasks[idx].delay = val;
                                setFollowUpTasks(newTasks);
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent className="z-[300]">
                                {FOLLOW_UP_DELAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Título de la tarea</Label>
                            <Input
                              value={task.action}
                              onChange={(e) => {
                                const newTasks = [...followUpTasks];
                                newTasks[idx].action = e.target.value;
                                setFollowUpTasks(newTasks);
                              }}
                              placeholder={`Seguimiento: ${formData.action_type || 'Acción'}`}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>

                        {/* Additional Task Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acción vinculada (Opcional)</Label>
                            <Select
                              value={task.linkedActionType}
                              onValueChange={(val) => {
                                const newTasks = [...followUpTasks];
                                newTasks[idx].linkedActionType = val;
                                setFollowUpTasks(newTasks);
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent className="z-[300]">
                                <SelectItem value="none">Sin acción vinculada</SelectItem>
                                {ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-3 pt-6">
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex-1 h-9">
                              <input
                                type="checkbox"
                                id={`time-${task.id}`}
                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                                checked={task.useSpecificTime}
                                onChange={(e) => {
                                  const newTasks = [...followUpTasks];
                                  newTasks[idx].useSpecificTime = e.target.checked;
                                  setFollowUpTasks(newTasks);
                                }}
                              />
                              <Label htmlFor={`time-${task.id}`} className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                Definir hora
                              </Label>
                            </div>

                            {task.useSpecificTime && (
                              <input
                                type="time"
                                value={task.specificTime}
                                onChange={(e) => {
                                  const newTasks = [...followUpTasks];
                                  newTasks[idx].specificTime = e.target.value;
                                  setFollowUpTasks(newTasks);
                                }}
                                className="h-9 w-24 rounded-md border border-slate-200 dark:border-slate-700 bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 font-medium"
                              />
                            )}
                          </div>
                        </div>

                        {task.useSpecificTime && (
                          <div className="space-y-1.5 animate-in fade-in duration-300">
                             <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Recordatorio</Label>
                             <Select
                                value={task.reminder_minutes}
                                onValueChange={(val) => {
                                  const newTasks = [...followUpTasks];
                                  newTasks[idx].reminder_minutes = val;
                                  setFollowUpTasks(newTasks);
                                }}
                             >
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent className="z-[300]">
                                  <SelectItem value="none">Sin recordatorio</SelectItem>
                                  <SelectItem value="0">A la hora del vencimiento</SelectItem>
                                  <SelectItem value="5">5 minutos antes</SelectItem>
                                  <SelectItem value="15">15 minutos antes</SelectItem>
                                  <SelectItem value="30">30 minutos antes</SelectItem>
                                  <SelectItem value="60">1 hora antes</SelectItem>
                                  <SelectItem value="1440">1 día antes</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descripción de la tarea</Label>
                          <Textarea
                            value={task.description}
                            onChange={(e) => {
                              const newTasks = [...followUpTasks];
                              newTasks[idx].description = e.target.value;
                              setFollowUpTasks(newTasks);
                            }}
                            placeholder="Instrucciones adicionales para el seguimiento..."
                            className="h-16 resize-none text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {loading && (
              <div className="px-6 py-3 bg-orange-50 dark:bg-orange-950/20 border-t border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                  <div className="flex-1 bg-orange-200 dark:bg-orange-900/30 rounded-full h-1.5">
                    <div className="bg-orange-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[11px] text-orange-700 dark:text-orange-400 font-bold whitespace-nowrap">{progress.done} / {progress.total}</span>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
              <Button variant="outline" onClick={onClose} disabled={loading} className="h-10 px-6 border-slate-200 dark:border-slate-700">Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !formData.action_type}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-2 h-10 px-6 shadow-lg shadow-orange-200 dark:shadow-none"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> : <><Save className="w-4 h-4" /> Registrar {contacts.length} acciones</>}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  )
}
