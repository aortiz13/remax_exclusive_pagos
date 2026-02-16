import React, { useState } from 'react'
import { toast } from 'sonner'
import { triggerWebhook } from '../../services/api'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { CheckCircle2, FileText, Send, ArrowLeft, Loader2, User, Building, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function StepResumen({ data, onUpdate, onBack, onComplete }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [fileArriendo, setFileArriendo] = useState(null)
  const [fileAdmin, setFileAdmin] = useState(null)
  const navigate = useNavigate()

  const calculations = data.calculations || {}
  const formatCurrency = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0)

  const isArriendo = data.tipoSolicitud === 'arriendo'

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  const handleFinish = async () => {
    setIsSubmitting(true)

    try {
      let payload = {}

      if (isArriendo) {
        // Validation
        if (!fileArriendo) {
          toast.error('Debes adjuntar el Contrato de Arriendo')
          setIsSubmitting(false)
          return
        }
        if (data.conAdministracion && !fileAdmin) {
          toast.error('Debes adjuntar el Contrato de Administración')
          setIsSubmitting(false)
          return
        }

        const base64Arriendo = await fileToBase64(fileArriendo)
        let base64Admin = null
        if (fileAdmin) {
          base64Admin = await fileToBase64(fileAdmin)
        }

        payload = {
          tipo_solicitud: 'arriendo', // Explicit Type
          contrato_arriendo_name: fileArriendo.name,
          contrato_arriendo: base64Arriendo,
          contrato_administracion_name: fileAdmin ? fileAdmin.name : '',
          contrato_administracion: base64Admin,
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
            telefono: data.arrendatarioTelefono,
            direccion: data.arrendatarioDireccion,
            comuna: data.arrendatarioComuna
          },
          dueño: {
            nombre: data.dueñoNombre,
            rut: data.dueñoRut,
            banco: data.bancoNombre,
            direccion: data.dueñoDireccion,
            comuna: data.dueñoComuna
          },
          financiero: {
            // General Totals (Legacy support + Summary)
            total_cancelar: calculations.totalCancelar,
            total_recibir: calculations.totalRecibir,
            honorarios_total: calculations.totalComisionA + calculations.totalComisionB, // Sum of both parts
            administracion: calculations.totalAdmin,
            uf_valor: calculations.ufUsed,

            // INDEPENDENT FEES (NEW)
            honorarios_propietario: calculations.totalComisionA || 0,
            honorarios_arrendatario: calculations.totalComisionB || 0,
            ingreso_manual_propietario: data.ingresoManualA || false,
            ingreso_manual_arrendatario: data.ingresoManualB || false,
            monto_manual_propietario: data.montoManualA || 0,
            monto_manual_arrendatario: data.montoManualB || 0,

            fee_alert_propietario: calculations.feeAlertA || false,
            fee_alert_arrendatario: calculations.feeAlertB || false,

            fee_alert: data.feeAlertTriggered // Global alert
          },
          condiciones_especiales: data.chkCondicionesEspeciales ? data.condicionesEspeciales : '', // ADDED
          fecha_envio_link: data.fechaEnvioLink || 'No especificada' // OPTIONAL DEFAULT
        }
      } else {

        // COMPRAVENTA Payload
        payload = {
          tipo_solicitud: 'compraventa',
          agente: {
            nombre: data.agenteNombre,
            apellido: data.agenteApellido,
            email: data.agenteEmail,
          },
          fecha: new Date().toISOString().split('T')[0],
          propiedad: {
            direccion: data.direccion,
            comuna: data.comuna,
            tipo: data.tipoPropiedad
          },
          vendedor: {
            nombre: data.vendedorNombre,
            rut: data.vendedorRut,
            email: data.vendedorEmail
          },
          comprador: {
            nombre: data.compradorNombre,
            rut: data.compradorRut,
            email: data.compradorEmail
          },
          financiero: {
            monto_comision_total: data.dividirComision
              ? (Number(data.comisionVendedor || 0) + Number(data.comisionComprador || 0))
              : Number(data.montoComision || 0),

            // SPLIT LOGIC
            dividir_comision: data.dividirComision || false,
            comision_vendedor: data.dividirComision ? Number(data.comisionVendedor || 0) : Number(data.montoComision || 0), // If not split, Seller pays all? Or just Total? Usually Seller.
            comision_comprador: data.dividirComision ? Number(data.comisionComprador || 0) : 0
          }
          // PDF logic for buy/sell if needed, currently omitted as per plan if not critical
        }
      }

      // 1. Trigger N8N Webhook
      await triggerWebhook(payload)

      // 2. Notify Parent (RequestForm) to update DB Status
      if (onComplete) {
        await onComplete()
      }

      setSuccess(true)
    } catch (err) {
      console.error(err)
      toast.error('Hubo un error al procesar la solicitud. Intente nuevamente.')
    } finally {
      setIsSubmitting(false)
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
            La solicitud ha sido registrada exitosamente.
            {isArriendo && " Hemos generado el documento PDF correspondiente."}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button onClick={() => navigate('/pages/Dashboard')} size="lg" className="w-full">
              Volver al Inicio
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
            <h2 className="text-2xl font-bold">Resumen Final ({isArriendo ? 'Arriendo' : 'Compraventa'})</h2>
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


            {isArriendo ? (
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
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-primary font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                  <User className="w-4 h-4" /> Partes
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs uppercase text-muted-foreground font-semibold block mb-1">Vendedor</span>
                    <p className="font-medium text-sm">{data.vendedorNombre}</p>
                    <p className="text-xs text-muted-foreground">{data.vendedorRut} · {data.vendedorEmail}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-muted-foreground font-semibold block mb-1">Comprador</span>
                    <p className="font-medium text-sm">{data.compradorNombre}</p>
                    <p className="text-xs text-muted-foreground">{data.compradorRut} · {data.compradorEmail}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Agent Details */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-primary font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                <User className="w-4 h-4" /> Agente
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-semibold">Nombre</span>
                  <p className="font-medium text-sm truncate">{data.agenteNombre} {data.agenteApellido}</p>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-semibold">Contacto</span>
                  <p className="text-xs text-muted-foreground truncate">{data.agenteEmail}</p>
                </div>
              </div>
            </div>

            {/* Detalles de Envío */}
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-5 space-y-4 border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-semibold border-b border-blue-200 dark:border-blue-800 pb-2 mb-2">
                <Send className="w-4 h-4" /> Detalles de Envío
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  ¿Cuándo enviar este link de pago? <span className="text-muted-foreground font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Inmediatamente, El próximo Lunes, 5 de Marzo..."
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={data.fechaEnvioLink || ''}
                  onChange={(e) => onUpdate('fechaEnvioLink', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Si se deja vacío, se asumirá envío inmediato.</p>
              </div>
            </div>

            {/* Documentación Requerida */}
            {isArriendo && (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-primary font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                  <FileText className="w-4 h-4" /> Documentación Requerida
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-arriendo" className="text-sm font-medium">
                      Contrato de Arriendo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="file-arriendo"
                      type="file"
                      accept=".pdf,image/*,.doc,.docx"
                      onChange={(e) => setFileArriendo(e.target.files[0])}
                      className="cursor-pointer file:text-primary file:font-semibold file:bg-primary/10 file:rounded-md file:border-0 file:mr-4 file:px-4 file:py-2 hover:file:bg-primary/20 transition-all"
                    />
                  </div>
                  {data.conAdministracion && (
                    <div className="space-y-2">
                      <Label htmlFor="file-admin" className="text-sm font-medium">
                        Contrato de Administración <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="file-admin"
                        type="file"
                        accept=".pdf,image/*,.doc,.docx"
                        onChange={(e) => setFileAdmin(e.target.files[0])}
                        className="cursor-pointer file:text-primary file:font-semibold file:bg-primary/10 file:rounded-md file:border-0 file:mr-4 file:px-4 file:py-2 hover:file:bg-primary/20 transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Condiciones Especiales Summary */}
            {data.chkCondicionesEspeciales && (
              <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-5 space-y-2 border border-yellow-100 dark:border-yellow-900/30">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300 font-semibold mb-1">
                  <FileText className="w-4 h-4" /> Condiciones Especiales
                </div>
                <p className="text-sm text-yellow-900/80 dark:text-yellow-100/80 italic">
                  "{data.condicionesEspeciales}"
                </p>
              </div>
            )}

          </div>

          {/* Financial Summary */}
          <div className="bg-white dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary font-semibold mb-6">
                <Wallet className="w-4 h-4" /> Desglose Financiero
              </div>

              {isArriendo ? (
                <div className="space-y-4 text-sm">
                  {/* Part A: Owner */}
                  <div className="bg-blue-50/50 dark:bg-blue-900/5 p-3 rounded-lg border border-blue-100/50">
                    <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Parte A (Propietario)</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Honorarios Neto:</span>
                        <span>{formatCurrency(calculations.honorariosNetoA)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IVA (19%):</span>
                        <span>{formatCurrency(calculations.ivaHonorariosA)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-blue-700 border-t pt-1 mt-1">
                        <span>Total:</span>
                        <span>{formatCurrency(calculations.totalComisionA)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Part B: Tenant */}
                  <div className="bg-green-50/50 dark:bg-green-900/5 p-3 rounded-lg border border-green-100/50">
                    <p className="text-[10px] font-bold text-green-600 uppercase mb-2">Parte B (Arrendatario)</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Honorarios Neto:</span>
                        <span>{formatCurrency(calculations.honorariosNetoB)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IVA (19%):</span>
                        <span>{formatCurrency(calculations.ivaHonorariosB)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-green-700 border-t pt-1 mt-1">
                        <span>Total:</span>
                        <span>{formatCurrency(calculations.totalComisionB)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Other Concepts */}
                  <div className="space-y-1 pt-2">
                    {data.chkProporcional && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Arriendo Prop. ({data.diasProporcionales} días)</span>
                        <span>{formatCurrency(calculations.montoProporcional)}</span>
                      </div>
                    )}
                    {data.chkMesAdelantado && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mes Adelantado</span>
                        <span>{formatCurrency(calculations.montoMesAdelantado)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Garantía</span>
                      <span>{formatCurrency(data.garantia)}</span>
                    </div>
                    {data.chkSeguro && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seguro Restitución</span>
                        <span>{formatCurrency(calculations.montoSeguro)}</span>
                      </div>
                    )}
                    {data.conAdministracion && (
                      <div className="flex justify-between text-indigo-600">
                        <span className="text-indigo-600/70">Administración</span>
                        <span className="font-medium">{formatCurrency(calculations.totalAdmin)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gastos Notariales</span>
                      <span>{formatCurrency(data.gastosNotariales)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  {!data.dividirComision ? (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-3 text-center">Comisión Total Acordada</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Neto:</span>
                          <span className="font-medium">{formatCurrency(data.montoComision || 0)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">IVA (19%):</span>
                          <span>{formatCurrency(Math.round((data.montoComision || 0) * 0.19))}</span>
                        </div>
                        <div className="flex justify-between font-black text-xl text-primary pt-2">
                          <span>TOTAL:</span>
                          <span>{formatCurrency(Math.round((data.montoComision || 0) * 1.19))}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {/* Vendedor */}
                      <div className="bg-blue-50/50 dark:bg-blue-900/5 p-3 rounded-lg border border-blue-100/50">
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Vendedor</p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Comisión Neto:</span>
                            <span>{formatCurrency(data.comisionVendedor || 0)}</span>
                          </div>
                          <div className="flex justify-between border-b pb-1">
                            <span className="text-muted-foreground">IVA (19%):</span>
                            <span>{formatCurrency(Math.round((data.comisionVendedor || 0) * 0.19))}</span>
                          </div>
                          <div className="flex justify-between font-bold text-blue-700 pt-1">
                            <span>Total Vendedor:</span>
                            <span>{formatCurrency(Math.round((data.comisionVendedor || 0) * 1.19))}</span>
                          </div>
                        </div>
                      </div>

                      {/* Comprador */}
                      <div className="bg-green-50/50 dark:bg-green-900/5 p-3 rounded-lg border border-green-100/50">
                        <p className="text-[10px] font-bold text-green-600 uppercase mb-2">Comprador</p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Comisión Neto:</span>
                            <span>{formatCurrency(data.comisionComprador || 0)}</span>
                          </div>
                          <div className="flex justify-between border-b pb-1">
                            <span className="text-muted-foreground">IVA (19%):</span>
                            <span>{formatCurrency(Math.round((data.comisionComprador || 0) * 0.19))}</span>
                          </div>
                          <div className="flex justify-between font-bold text-green-700 pt-1">
                            <span>Total Comprador:</span>
                            <span>{formatCurrency(Math.round((data.comisionComprador || 0) * 1.19))}</span>
                          </div>
                        </div>
                      </div>

                      {/* Total Global */}
                      <div className="bg-slate-900 text-white p-3 rounded-lg flex justify-between items-center mt-2">
                        <span className="text-xs font-bold uppercase">Total Operación Remax</span>
                        <span className="text-lg font-black">{formatCurrency(Math.round((Number(data.comisionVendedor || 0) + Number(data.comisionComprador || 0)) * 1.19))}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {isArriendo && (
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
            )}
          </div>
        </div>



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
