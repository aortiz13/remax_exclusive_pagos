import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Button, Label, Textarea, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'
import { X, Activity, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { toISOLocal } from '@/lib/utils'
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
 * BulkActionModal — Register a CRM action for multiple contacts.
 *
 * @param {boolean}  isOpen
 * @param {Function} onClose
 * @param {Array}    contacts - [{ id, first_name, last_name }]
 */
export default function BulkActionModal({ isOpen, onClose, contacts = [] }) {
  const { profile, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0, errorDetails: [] })

  const [formData, setFormData] = useState({
    action_type: '',
    note: '',
    action_date: toISOLocal().split('T')[0],
  })

  useEffect(() => {
    if (isOpen) {
      setComplete(false)
      setProgress({ done: 0, total: 0, errors: 0, errorDetails: [] })
      setFormData({
        action_type: '',
        note: '',
        action_date: toISOLocal().split('T')[0],
      })
    }
  }, [isOpen])

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
        let dateTime
        try {
          dateTime = new Date(`${formData.action_date}T12:00:00Z`).toISOString()
        } catch (err) {
          dateTime = new Date().toISOString()
        }

        // Create the CRM action
        const { data: actionRow, error: actionError } = await supabase
          .from('crm_actions')
          .insert({
            agent_id: agentId,
            action_type: formData.action_type,
            note: formData.note || null,
            action_date: dateTime,
            is_conversation_starter: formData.action_type.includes('(I.C)'),
            kpi_deferred: false
          })
          .select('id')
          .single()

        if (actionError) throw new Error(`[crm_actions]: ${actionError.message}`)

        // Link to contact via junction table
        const { error: linkError } = await supabase
          .from('crm_action_contacts')
          .insert({
            action_id: actionRow.id,
            contact_id: contact.id,
          })

        if (linkError) throw new Error(`[crm_action_contacts]: ${linkError.message}`)

        // Log Activity to Timeline
        try {
            await logActivity({
            action: 'Acción Masiva',
            entity_type: 'Actividad', 
            entity_id: actionRow.id,
            description: `Acción registrada: ${formData.action_type}`,
            details: { date: dateTime, note: formData.note },
            contact_id: contact.id
            })
        } catch (logErr) {
            console.error('Error logging activity but action created', logErr)
        }

      } catch (err) {
        console.error('Error creating bulk action:', err)
        errorsList.push({ contact: `${contact.first_name || ''} ${contact.last_name || ''}`, error: err.message || JSON.stringify(err) })
      }
      done++
      setProgress({ done, total, errors: errorsList.length, errorDetails: errorsList })
    }

    setComplete(true)
    setLoading(false)
    toast.success(`${done - errorsList.length} acción${done - errorsList.length > 1 ? 'es' : ''} registrada${done - errorsList.length > 1 ? 's' : ''}`)
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
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center">
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
                <Label className="text-sm font-medium">Tipo de Acción <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.action_type}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, action_type: val }))}
                >
                  <SelectTrigger className="h-10 border-orange-200 focus:ring-orange-500"><SelectValue placeholder="Seleccionar acción..." /></SelectTrigger>
                  <SelectContent className="z-[300] max-h-[300px]">
                    {ACTION_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Fecha de la acción</Label>
                <input
                  type="date"
                  value={formData.action_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, action_date: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nota <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Textarea
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Detalles de la acción..."
                  className="resize-none h-24 focus-visible:ring-orange-500"
                />
              </div>
            </div>

            {loading && (
              <div className="px-6 py-3 bg-orange-50 dark:bg-orange-950/20 border-t border-orange-100">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                  <div className="flex-1 bg-orange-200 rounded-full h-1.5">
                    <div className="bg-orange-600 h-1.5 rounded-full transition-all" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-orange-700 font-medium">{progress.done}/{progress.total}</span>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !formData.action_type}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</> : <><Activity className="w-4 h-4" /> Registrar {contacts.length} acciones</>}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  )
}
