import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Button, Input, Label, Textarea, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'
import { 
  X, ListTodo, Loader2, CheckCircle2, Calendar, 
  Clock, ChevronsUpDown, Check, AlertTriangle, Link2,
  Search, Flag, Info
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { logActivity } from '../../services/activityService'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

/**
 * BulkTaskModal — Create tasks for multiple contacts.
 */
export default function BulkTaskModal({ isOpen, onClose, contacts = [] }) {
  const { profile, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0, errorDetails: [] })

  // Form state
  const [formData, setFormData] = useState({
    action: '',
    description: '',
    execution_date: new Date().toISOString().split('T')[0],
    execution_time: '09:00',
    useSpecificTime: false,
    reminder_minutes: 'none'
  })

  const [propertyId, setPropertyId] = useState('')
  const [linkedActionType, setLinkedActionType] = useState('none')
  const [properties, setProperties] = useState([])
  const [openPropertySelect, setOpenPropertySelect] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setComplete(false)
      setProgress({ done: 0, total: 0, errors: 0, errorDetails: [] })
      setFormData({
        action: '',
        description: '',
        execution_date: new Date().toISOString().split('T')[0],
        execution_time: '09:00',
        useSpecificTime: false,
        reminder_minutes: 'none'
      })
      setPropertyId('')
      setLinkedActionType('none')
      fetchProperties()
    }
  }, [isOpen])

  const fetchProperties = async () => {
    const { data } = await supabase.from('properties').select('id, address').order('address')
    setProperties(data || [])
  }

  const handleSubmit = async () => {
    if (!formData.action) {
      toast.error('Describa la tarea')
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
        const dateTime = new Date(`${formData.execution_date}T${formData.useSpecificTime ? formData.execution_time : '12:00'}:00`)
        
        let futureActionId = null
        if (linkedActionType !== 'none') {
             const { data: futAct, error: futErr } = await supabase.from('crm_actions').insert({
               agent_id: agentId,
               action_type: linkedActionType,
               action_date: dateTime.toISOString(),
               property_id: propertyId || null,
               note: `Tarea programada: ${formData.action}`,
               is_conversation_starter: linkedActionType.includes('(I.C)'),
               kpi_deferred: true
             }).select('id').single()
             if (!futErr) {
               futureActionId = futAct.id
               await supabase.from('crm_action_contacts').insert({ action_id: futAct.id, contact_id: contact.id })
             }
        }

        const { data: taskRow, error } = await supabase
          .from('crm_tasks')
          .insert({
            agent_id: agentId,
            contact_id: contact.id,
            property_id: propertyId || null,
            action: formData.action,
            description: formData.description || null,
            execution_date: dateTime.toISOString(),
            reminder_minutes: formData.reminder_minutes === 'none' ? null : parseInt(formData.reminder_minutes),
            action_id: futureActionId,
            task_type: 'task',
            is_all_day: !formData.useSpecificTime
          })
          .select('id')
          .single()

        if (error) throw error

        // Timeline log
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
    toast.success(`${done - errorsList.length} registros exitosos`)
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col relative z-50 border border-slate-200 dark:border-slate-700"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-none">
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
            <h3 className="text-xl font-bold shrink-0">¡Tareas creadas!</h3>
            <p className="text-sm text-slate-500 shrink-0">
              {progress.done - progress.errors} de {progress.total} tareas generadas
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
              
              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">¿Qué tarea hay que hacer?</Label>
                  <Input 
                    placeholder="Ej: Llamar para seguimiento" 
                    value={formData.action}
                    onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    className="focus:ring-orange-500 h-10"
                  />
                </div>

                {/* Linked Property */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Propiedad (Opcional)</Label>
                  <Popover open={openPropertySelect} onOpenChange={setOpenPropertySelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPropertySelect}
                        className="w-full justify-between font-normal h-9 text-sm border-slate-200 dark:border-slate-700"
                      >
                        <span className="truncate">
                          {propertyId
                            ? properties.find((p) => p.id === propertyId)?.address || "Dirección no encontrada"
                            : "Seleccionar propiedad..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[300]" align="start">
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
                              className="text-slate-500 italic cursor-pointer"
                            >
                              <X className="mr-2 h-4 w-4" />
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

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                       <Calendar className="w-3.5 h-3.5 text-slate-400" /> Fecha de ejecución
                    </Label>
                    <Input 
                      type="date"
                      value={formData.execution_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, execution_date: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                       <Clock className="w-3.5 h-3.5 text-slate-400" /> Hora (Opcional)
                    </Label>
                    <div className="flex items-center gap-2">
                       <input 
                         type="checkbox"
                         id="use_time"
                         checked={formData.useSpecificTime}
                         onChange={(e) => setFormData(prev => ({ ...prev, useSpecificTime: e.target.checked }))}
                         className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                       />
                       <Input 
                         type="time" 
                         disabled={!formData.useSpecificTime}
                         value={formData.execution_time}
                         onChange={(e) => setFormData(prev => ({ ...prev, execution_time: e.target.value }))}
                         className="h-9 flex-1 disabled:opacity-30"
                       />
                    </div>
                  </div>
                </div>

                {/* Extra Options */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Recordatorio</Label>
                    <Select value={formData.reminder_minutes} onValueChange={(val) => setFormData(prev => ({...prev, reminder_minutes: val}))}>
                       <SelectTrigger className="h-9">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="z-[300]">
                         <SelectItem value="none">Sin recordatorio</SelectItem>
                         <SelectItem value="0">A la hora del vencimiento</SelectItem>
                         <SelectItem value="15">15 minutos antes</SelectItem>
                         <SelectItem value="30">30 minutos antes</SelectItem>
                         <SelectItem value="60">1 hora antes</SelectItem>
                         <SelectItem value="1440">1 día antes</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Nota / Descripción <span className="text-slate-400 font-normal">(opcional)</span></Label>
                  <Textarea
                    placeholder="Detalles adicionales..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="resize-none h-20 focus:ring-orange-500"
                  />
                </div>
              </div>
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
                disabled={loading || !formData.action}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-2 h-10 px-6 shadow-lg shadow-orange-200 dark:shadow-none"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : <><CheckCircle2 className="w-4 h-4" /> Crear {contacts.length} tareas</>}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  )
}
