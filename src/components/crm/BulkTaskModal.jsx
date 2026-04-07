import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Button, Input, Label, Textarea, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'
import { X, ListTodo, Loader2, CheckCircle2, Calendar, Clock, ChevronsUpDown, Check, AlertTriangle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { toISOLocal, cn } from '@/lib/utils'
import { logActivity } from '../../services/activityService'

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

/**
 * BulkTaskModal — Create one task per selected contact.
 *
 * @param {boolean}  isOpen
 * @param {Function} onClose
 * @param {Array}    contacts - [{ id, first_name, last_name }]
 */
export default function BulkTaskModal({ isOpen, onClose, contacts = [] }) {
  const { profile, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 })

  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState('')
  const [openPropertySelect, setOpenPropertySelect] = useState(false)
  const [linkedActionType, setLinkedActionType] = useState('')

  const [formData, setFormData] = useState({
    action: '',
    description: '',
    execution_date: toISOLocal().split('T')[0],
    execution_time: '09:00',
    reminder_minutes: 'none',
    is_all_day: true,
  })

  useEffect(() => {
    if (isOpen) {
      fetchProperties()
      setComplete(false)
      setProgress({ done: 0, total: 0, errors: 0 })
      setFormData({
        action: '',
        description: '',
        execution_date: toISOLocal().split('T')[0],
        execution_time: '09:00',
        reminder_minutes: 'none',
        is_all_day: true,
      })
      setLinkedActionType('')
      setPropertyId('')
    }
  }, [isOpen])

  const fetchProperties = async () => {
    const { data } = await supabase.from('properties').select('id, address').order('address')
    setProperties(data || [])
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.action.trim()) {
      toast.error('Debe ingresar un título para la tarea')
      return
    }
    if (!formData.execution_date) {
      toast.error('Debe seleccionar una fecha')
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
        let dateTime
        if (formData.is_all_day) {
          dateTime = new Date(`${formData.execution_date}T12:00:00Z`)
        } else {
          dateTime = new Date(`${formData.execution_date}T${formData.execution_time || '00:00'}`)
        }

        let actionId = null

        // 1. If linked action is selected, create it first
        if (linkedActionType && linkedActionType !== 'none') {
          const { data: actionRow, error: actionError } = await supabase
            .from('crm_actions')
            .insert({
              agent_id: agentId,
              action_type: linkedActionType,
              action_date: dateTime.toISOString(),
              property_id: propertyId || null,
              note: `Acción vinculada a tarea grupal: ${formData.action}`,
              is_conversation_starter: linkedActionType.includes('(I.C)'),
              kpi_deferred: true
            })
            .select()
            .single()

          if (!actionError && actionRow) {
            actionId = actionRow.id
            try {
              await supabase.from('crm_action_contacts').insert({
                action_id: actionId,
                contact_id: contact.id
              })
            } catch (err) {}
          } else {
             if (actionError) throw new Error(`[crm_actions]: ${actionError.message}`);
          }
        }

        // 2. Create the task
        const { data: taskRow, error: taskError } = await supabase
          .from('crm_tasks')
          .insert({
            contact_id: contact.id,
            property_id: propertyId || null,
            agent_id: agentId,
            action: formData.action,
            description: formData.description || null,
            execution_date: dateTime.toISOString(),
            reminder_minutes: formData.reminder_minutes === 'none' ? null : parseInt(formData.reminder_minutes),
            task_type: 'task',
            is_all_day: !!formData.is_all_day,
            action_id: actionId
          }).select().single()

        if (taskError) throw new Error(`[crm_tasks]: ${taskError.message}`)

        // 3. Log Activity to Timeline
        try {
            await logActivity({
            action: 'Tarea Masiva',
            entity_type: 'Tarea', 
            entity_id: taskRow.id,
            description: `Tarea creada: ${formData.action}`,
            details: { date: dateTime.toISOString(), linked_action: linkedActionType },
            contact_id: contact.id,
            property_id: propertyId || null
            })
        } catch (logErr) {
            console.error('Error logging activity but task created', logErr)
        }

      } catch (err) {
        console.error('Error creating bulk task:', err)
        errorsList.push({ contact: `${contact.first_name || ''} ${contact.last_name || ''}`, error: err.message || JSON.stringify(err) })
      }
      done++
      setProgress({ done, total, errors: errorsList.length, errorDetails: errorsList })
    }

    setComplete(true)
    setLoading(false)
    toast.success(`${done - errors} tarea${done - errors > 1 ? 's' : ''} creada${done - errors > 1 ? 's' : ''}`)
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col relative z-50 border border-slate-200 dark:border-slate-700"
      >
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <ListTodo className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Tarea Masiva</h2>
                <p className="text-xs text-slate-500">
                  Se creará una tarea para {contacts.length} contacto{contacts.length > 1 ? 's' : ''}
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
            <h3 className="text-xl font-bold text-slate-800 dark:text-white shrink-0">¡Acciones registradas!</h3>
            <p className="text-sm text-slate-500 shrink-0">
              {progress.done - progress.errors} de {progress.total} tareas creadas exitosamente
              {progress.errors > 0 && <span className="text-red-500 ml-1">({progress.errors} errores)</span>}
            </p>
            
            {progress.errors > 0 && progress.errorDetails && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 max-w-md w-full shrink-0">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Errores detallados
                </p>
                <div className="max-h-32 overflow-y-auto pr-2">
                  {progress.errorDetails.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400 mb-1 leading-tight border-b border-red-100 last:border-0 pb-1">
                      <span className="font-semibold">{err.contact}:</span> {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
            
            <Button onClick={onClose} className="mt-4 shrink-0">Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Título de la tarea <span className="text-red-500">*</span></Label>
                <Input
                  name="action"
                  value={formData.action}
                  onChange={handleChange}
                  placeholder="Ej: Llamar para seguimiento"
                  className="h-10 border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Linked KPI Action */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Acción a registrar (KPI)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn("w-full justify-between h-9", !linkedActionType && "text-slate-500")}
                    >
                      {linkedActionType && linkedActionType !== 'none'
                        ? linkedActionType
                        : "Seleccione una acción (opcional)"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Buscar acción..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron acciones.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => setLinkedActionType('none')}
                            className="text-slate-500 italic"
                          >
                            <Check className={cn("mr-2 h-4 w-4", !linkedActionType || linkedActionType === 'none' ? "opacity-100" : "opacity-0")} />
                            Ninguna acción
                          </CommandItem>
                          {ACTION_TYPES.map((type) => (
                            <CommandItem
                              key={type}
                              value={type}
                              onSelect={() => setLinkedActionType(type)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", linkedActionType === type ? "opacity-100" : "opacity-0")} />
                              {type}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {linkedActionType && linkedActionType !== 'none' && (
                  <div className="flex items-start gap-2 mt-2 bg-amber-50 p-2.5 rounded-md border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      Se registrará <strong>1 acción diferida</strong> de forma individual para cada uno de los {contacts.length} contactos.
                    </p>
                  </div>
                )}
              </div>

              {/* Linked Property */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Propiedad Relacionada</Label>
                <div className="flex gap-2">
                  <Popover open={openPropertySelect} onOpenChange={setOpenPropertySelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPropertySelect}
                        className="flex-1 justify-between shrink-0 h-9"
                      >
                        {propertyId
                          ? properties.find((p) => p.id === propertyId)?.address || "Dirección no encontrada"
                          : "Busca una propiedad..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full sm:w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar propiedad..." />
                        <CommandList>
                          <CommandEmpty>No se encontró la propiedad.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => {
                                setPropertyId('')
                                setOpenPropertySelect(false)
                              }}
                              className="text-slate-500 italic"
                            >
                              Ninguna propiedad
                            </CommandItem>
                            {properties.map((property) => (
                              <CommandItem
                                key={property.id}
                                value={property.address}
                                onSelect={() => {
                                  setPropertyId(property.id)
                                  setOpenPropertySelect(false)
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", propertyId === property.id ? "opacity-100" : "opacity-0")} />
                                {property.address}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Descripción <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Detalles adicionales..."
                  className="resize-none h-20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Fecha</Label>
                  <Input
                    type="date"
                    name="execution_date"
                    value={formData.execution_date}
                    onChange={handleChange}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Hora</Label>
                  <Input
                    type="time"
                    name="execution_time"
                    value={formData.execution_time}
                    onChange={handleChange}
                    disabled={formData.is_all_day}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Recordatorio</Label>
                  <Select
                    value={formData.reminder_minutes}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, reminder_minutes: val }))}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[300]">
                      <SelectItem value="none">Sin recordatorio</SelectItem>
                      <SelectItem value="10">10 min antes</SelectItem>
                      <SelectItem value="30">30 min antes</SelectItem>
                      <SelectItem value="60">1 hora antes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_all_day}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_all_day: e.target.checked }))}
                  className="rounded border-slate-300"
                  id="allDay"
                />
                <label htmlFor="allDay" className="text-sm text-slate-600">Todo el día</label>
              </div>
            </div>

            {loading && (
              <div className="px-6 py-3 bg-blue-50 dark:bg-blue-950/20 border-t border-blue-100">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <div className="flex-1 bg-blue-200 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-blue-700 font-medium">{progress.done}/{progress.total}</span>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !formData.action.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : <><ListTodo className="w-4 h-4" /> Crear {contacts.length} tareas</>}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  )
}
