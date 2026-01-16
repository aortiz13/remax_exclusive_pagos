import React, { useState } from 'react'
import { generatePDF } from '../../services/pdfGenerator'
import { supabase } from '../../services/supabase'
import { triggerWebhook } from '../../services/api'
import { Card, CardContent, Button } from '@/components/ui'
import { CheckCircle2, FileText, Send, ArrowLeft, Loader2, User, Building, Wallet, Download } from 'lucide-react'

export default function StepResumen({ data, onBack }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const calculations = data.calculations || {}
  const formatCurrency = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0)

  const handleFinish = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const pdfRaw = generatePDF(data, calculations)

      const payload = {
        agente: {
          nombre: data.agenteNombre,
          apellido: data.agenteApellido,
          email: data.agenteEmail,
          telefono: data.agenteTelefono
        },
        fecha: new Date().toISOString().split('T')[0],
        propiedad: { direccion: data.direccion, comuna: data.comuna, tipo: data.tipoPropiedad },
        arrendatario: {
          nombre: data.arrendatarioNombre,
          apellido: data.arrendatarioApellido,
          rut: data.arrendatarioRut,
          email: data.arrendatarioEmail,
          telefono: data.arrendatarioTelefono
        },
        dueño: { nombre: data.dueñoNombre, rut: data.dueñoRut, banco: data.bancoNombre },
        financiero: { total_cancelar: calculations.totalCancelar, total_recibir: calculations.totalRecibir },
        pdf_base64: pdfRaw // Send raw base64
      }

      // Optimistic success for demo purposes if no supabase credentials
      // const { error: dbError } = await supabase.from('solicitudes_pago').insert({...})
      // if (dbError) throw dbError

      // Simulating network request
      await new Promise(resolve => setTimeout(resolve, 1500))

      await triggerWebhook(payload)
      setSuccess(true)
    } catch (err) {
      console.error(err)
      setError('Hubo un error al procesar la solicitud. Intente nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const downloadPDF = () => {
    try {
      const rawBase64 = generatePDF(data, calculations)
      const linkSource = `data:application/pdf;base64,${rawBase64}`;
      const downloadLink = document.createElement("a");
      const fileName = `solicitud_${data.dueñoNombre || 'cliente'}.pdf`;
      downloadLink.href = linkSource;
      downloadLink.download = fileName;
      downloadLink.click();
    } catch (e) {
      console.error("Download failed", e)
    }
  }

  if (success) {
    return (
      <Card className="max-w-lg mx-auto border-dashed border-2 border-green-500/20 bg-green-50/50 dark:bg-green-900/10 shadow-none animate-in zoom-in-95 duration-500">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">¡Solicitud Enviada!</h2>
          <p className="text-muted-foreground mt-2 mb-8 max-w-xs mx-auto">
            La solicitud ha sido registrada exitosamente. Hemos generado el documento PDF correspondiente.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button onClick={() => window.location.reload()} size="lg" className="w-full">
              Nueva Solicitud
            </Button>
            <Button variant="outline" className="w-full" onClick={downloadPDF}>
              <Download className="w-4 h-4 mr-2" /> Descargar Comprobante
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-4xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
      <CardContent className="pt-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Resumen Final</h2>
            <p className="text-muted-foreground text-sm">Revise los datos antes de enviar la solicitud.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Operaion Details */}
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-primary font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                <Building className="w-4 h-4" /> Propiedad
              </div>
              <div className="space-y-1">
                <p className="font-medium text-lg">{data.direccion}</p>
                <p className="text-muted-foreground">{data.comuna}</p>
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground mt-2">
                  {data.tipoPropiedad}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-primary font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                <User className="w-4 h-4" /> Propietario & Banco
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-semibold">Nombre</span>
                  <p className="font-medium text-sm truncate">{data.dueñoNombre}</p>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-semibold">RUT</span>
                  <p className="font-medium text-sm">{data.dueñoRut}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs uppercase text-muted-foreground font-semibold">Cuenta Bancaria</span>
                  <p className="font-medium text-sm">{data.bancoNombre}</p>
                  <p className="text-sm text-muted-foreground">{data.bancoTipoCuenta} · {data.bancoNroCuenta}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-white dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary font-semibold mb-6">
                <Wallet className="w-4 h-4" /> Desglose Financiero
              </div>

              <div className="space-y-3 text-sm">
                {data.chkProporcional && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Prop. ({data.diasProporcionales} días)</span>
                    <span className="font-medium">{formatCurrency(data.calculations?.montoProporcional)}</span>
                  </div>
                )}
                {data.chkMesAdelantado && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Mes Adelantado</span>
                    <span className="font-medium">{formatCurrency(data.calculations?.montoMesAdelantado)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Garantía</span>
                  <span className="font-medium">{formatCurrency(data.garantia)}</span>
                </div>
                {data.chkSeguro && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Seguro Restitución</span>
                    <span className="font-medium">{formatCurrency(data.calculations?.montoSeguro)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Comisión Total</span>
                  <span className="font-medium">{formatCurrency(data.calculations?.totalComision)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Gastos Notariales</span>
                  <span className="font-medium">{formatCurrency(data.gastosNotariales)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total a Pagar</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(calculations.totalCancelar)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/30">
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">Total a Recibir Owner</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(calculations.totalRecibir)}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
          <Button onClick={handleFinish} disabled={isSubmitting} size="lg" className="px-8 shadow-lg shadow-primary/20">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Confirmar Envío
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
