import React, { useState } from 'react'
import { toast } from 'sonner'
import { generatePDF } from '../../services/pdfGenerator'
import { triggerWebhook } from '../../services/api'
import { Card, CardContent, Button, Input, Label } from '@/components/ui'
import { CheckCircle2, FileText, Send, ArrowLeft, Loader2, User, Building, Wallet, Download, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function StepResumen({ data, onUpdate, onBack, onComplete }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [fileArriendo, setFileArriendo] = useState(null)
  const [fileAdmin, setFileAdmin] = useState(null)
  const [fileSeguro, setFileSeguro] = useState(null)
  const navigate = useNavigate()

  const calculations = data.calculations || {}
  const formatCurrency = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(val) || 0)

  const isArriendoLegacy = data.tipoSolicitud === 'arriendo'
  const isHonorariosFlow = data.tipoSolicitud === 'venta' || data.tipoSolicitud === 'honorarios_arriendo'
  const isVentaHonorarios = data.tipoSolicitud === 'venta'
  const isArriendo = isArriendoLegacy

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

      if (isArriendoLegacy) {
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
        if (data.chkSeguro && !fileSeguro) {
          toast.error('Debes adjuntar la Póliza de Seguro de Restitución')
          setIsSubmitting(false)
          return
        }

        const base64Arriendo = await fileToBase64(fileArriendo)
        let base64Admin = null
        if (fileAdmin) base64Admin = await fileToBase64(fileAdmin)
        let base64Seguro = null
        if (fileSeguro) base64Seguro = await fileToBase64(fileSeguro)

        const pdfRaw = generatePDF(data, calculations)
        payload = {
          tipo_solicitud: 'arriendo', // Legacy
          contrato_arriendo_name: fileArriendo.name,
          contrato_arriendo: base64Arriendo,
          contrato_administracion_name: fileAdmin ? fileAdmin.name : '',
          contrato_administracion: base64Admin,
          contrato_seguro_name: fileSeguro ? fileSeguro.name : '',
          contrato_seguro: base64Seguro,
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
            direccion: data.dueñoDireccion,
            comuna: data.dueñoComuna
          },
          financiero: {
            total_cancelar: calculations.totalCancelar,
            total_recibir: calculations.totalRecibir,
            honorarios_propietario: calculations.totalComisionA || 0,
            honorarios_arrendatario: calculations.totalComisionB || 0,
            gastos_notariales_arrendador: data.incluyeGastosNotarialesArrendador ? Number(data.montoGastosNotarialesArrendador) : 0,
            gastos_notariales_arrendatario: data.incluyeGastosNotarialesArrendatario ? Number(data.montoGastosNotarialesArrendatario) : 0,
            uf_valor: calculations.ufUsed,
            // Mapeo de opciones a SI/NO
            ...(data.chkProporcional && { mes_proporcional: "SI" }),
            ...(data.chkMesAdelantado && { mes_adelantado: "SI" }),
            seguro_restitucion: data.chkSeguro ? "SI" : "NO",
            con_administracion: data.conAdministracion ? "SI" : "NO",
            condiciones_especiales: data.chkCondicionesEspeciales ? "SI" : "NO",
            notaria_arrendador: data.incluyeGastosNotarialesArrendador ? "SI" : "NO",
            notaria_arrendatario: data.incluyeGastosNotarialesArrendatario ? "SI" : "NO"
          }
        }
      } else if (isHonorariosFlow) {
        // HONORARIOS Payload (New)
        const parteANombre = data.vendedorNombre || data.dueñoNombre
        const parteBNombre = data.compradorNombre || data.arrendatarioNombre

        payload = {
          tipo_solicitud: 'honorarios',
          tipo_solicitud_honorarios: isVentaHonorarios ? '[Venta]' : '[Arriendo]',
          agente: {
            nombre: data.agenteNombre,
            apellido: data.agenteApellido,
            email: data.agenteEmail,
            telefono: data.agenteTelefono
          },
          fecha: new Date().toISOString().split('T')[0],
          propiedad: {
            direccion: data.direccion,
            comuna: data.comuna,
            tipo: data.tipoPropiedad
          },
          financiero: {
            configuracion_punta: isVentaHonorarios ? data.ventaRole : data.arriendoRole,
            [isVentaHonorarios ? 'honorarios_vendedor_neto' : 'honorarios_arrendador_neto']: Number(data.montoHonorariosA || 0),
            [isVentaHonorarios ? 'honorarios_vendedor_total' : 'honorarios_arrendador_total']: Math.round(Number(data.montoHonorariosA || 0) * 1.19),
            [isVentaHonorarios ? 'honorarios_comprador_neto' : 'honorarios_arrendatario_neto']: Number(data.montoHonorariosB || 0),
            [isVentaHonorarios ? 'honorarios_comprador_total' : 'honorarios_arrendatario_total']: Math.round(Number(data.montoHonorariosB || 0) * 1.19),
            total_operacion_neto: Number(data.montoHonorariosA || 0) + Number(data.montoHonorariosB || 0),
            total_operacion_con_iva: Math.round((Number(data.montoHonorariosA || 0) + Number(data.montoHonorariosB || 0)) * 1.19),
            uf_valor: data.ufValue || 0
          },
          fecha_envio_link: data.fechaEnvioLink || 'No especificada'
        }

        if (parteANombre) {
          const keyA = isVentaHonorarios ? 'punta_vendedora' : 'punta_arrendadora'
          payload[keyA] = {
            nombre: parteANombre,
            rut: data.vendedorRut || data.dueñoRut,
            email: data.vendedorEmail || data.dueñoEmail,
            telefono: data.vendedorTelefono || data.dueñoTelefono,
            domicilio_particular: data.vendedorDireccion || data.dueñoDireccion,
            comuna_particular: data.vendedorComuna || data.dueñoComuna,
            rol: isVentaHonorarios ? 'Vendedor' : 'Arrendador'
          }
        }

        if (parteBNombre) {
          const keyB = isVentaHonorarios ? 'punta_compradora' : 'punta_arrendataria'
          payload[keyB] = {
            nombre: parteBNombre,
            rut: data.compradorRut || data.arrendatarioRut,
            email: data.compradorEmail || data.arrendatarioEmail,
            telefono: data.compradorTelefono || data.arrendatarioTelefono,
            domicilio_particular: data.compradorDireccion || data.arrendatarioDireccion,
            comuna_particular: data.compradorComuna || data.arrendatarioComuna,
            rol: isVentaHonorarios ? 'Comprador' : 'Arrendatario'
          }
        }
      } else {
        // COMPRAVENTA (Legacy fallback)
        payload = {
          tipo_solicitud: 'compraventa',
          agente: { nombre: data.agenteNombre, apellido: data.agenteApellido, email: data.agenteEmail },
          fecha: new Date().toISOString().split('T')[0],
          propiedad: { direccion: data.direccion, comuna: data.comuna, tipo: data.tipoPropiedad },
          financiero: {
            monto_comision_total: data.dividirComision
              ? (Number(data.comisionVendedor || 0) + Number(data.comisionComprador || 0))
              : Number(data.montoComision || 0)
          }
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
      toast.error('Error al descargar el PDF')
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
            {isArriendo && (
              <Button variant="outline" className="w-full" onClick={downloadPDF}>
                <Download className="w-4 h-4 mr-2" /> Descargar Comprobante
              </Button>
            )}
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
            <h2 className="text-2xl font-bold">Resumen Final ({isHonorariosFlow ? 'Honorarios' : 'Arriendo'})</h2>
            <p className="text-muted-foreground text-sm">
              Revise los datos de la operación {isHonorariosFlow ? (isVentaHonorarios ? '[Venta]' : '[Arriendo]') : ''} antes de enviar.
            </p>
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


            {isArriendoLegacy ? (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-primary font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                  <User className="w-4 h-4" /> Propietario
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
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-primary font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                  <User className="w-4 h-4" /> Partes de la Operación
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-bold block mb-1">{isVentaHonorarios ? 'Vendedor' : 'Arrendador'}</span>
                    <p className="font-medium">{data.vendedorNombre || data.dueñoNombre || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{(data.vendedorRut || data.dueñoRut) || ''}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-bold block mb-1">{isVentaHonorarios ? 'Comprador' : 'Arrendatario'}</span>
                    <p className="font-medium">{data.compradorNombre || data.arrendatarioNombre || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{(data.compradorRut || data.arrendatarioRut) || ''}</p>
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
                    <div className="flex items-center gap-3">
                      <Input
                        id="file-arriendo"
                        type="file"
                        accept=".pdf,image/*,.doc,.docx"
                        onChange={(e) => setFileArriendo(e.target.files[0])}
                        className="hidden"
                      />
                      <label
                        htmlFor="file-arriendo"
                        className="flex items-center justify-center gap-2 cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors border border-input shadow-sm whitespace-nowrap"
                      >
                        <Upload className="w-4 h-4" />
                        Seleccionar archivo
                      </label>
                      <span className="text-sm text-muted-foreground truncate flex-1 block min-w-0" title={fileArriendo ? fileArriendo.name : "Sin archivos seleccionados"}>
                        {fileArriendo ? fileArriendo.name : "Sin archivos seleccionados"}
                      </span>
                    </div>
                  </div>
                  {data.conAdministracion && (
                    <div className="space-y-2">
                      <Label htmlFor="file-admin" className="text-sm font-medium">
                        Contrato de Administración <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="file-admin"
                          type="file"
                          accept=".pdf,image/*,.doc,.docx"
                          onChange={(e) => setFileAdmin(e.target.files[0])}
                          className="hidden"
                        />
                        <label
                          htmlFor="file-admin"
                          className="flex items-center justify-center gap-2 cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors border border-input shadow-sm whitespace-nowrap"
                        >
                          <Upload className="w-4 h-4" />
                          Seleccionar archivo
                        </label>
                        <span className="text-sm text-muted-foreground truncate flex-1 block min-w-0" title={fileAdmin ? fileAdmin.name : "Sin archivos seleccionados"}>
                          {fileAdmin ? fileAdmin.name : "Sin archivos seleccionados"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.chkSeguro && (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-primary font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                  <FileText className="w-4 h-4" /> Seguro de Restitución
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file-seguro" className="text-sm font-medium">
                    Informe Comercial Arrendatario <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="file-seguro"
                      type="file"
                      accept=".pdf,image/*,.doc,.docx"
                      onChange={(e) => setFileSeguro(e.target.files[0])}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-seguro"
                      className="flex items-center justify-center gap-2 cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors border border-input shadow-sm whitespace-nowrap"
                    >
                      <Upload className="w-4 h-4" />
                      Seleccionar archivo
                    </label>
                    <span className="text-sm text-muted-foreground truncate flex-1 block min-w-0" title={fileSeguro ? fileSeguro.name : "Sin archivos seleccionados"}>
                      {fileSeguro ? fileSeguro.name : "Sin archivos seleccionados"}
                    </span>
                  </div>
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

              {isArriendoLegacy ? (
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
                    {data.incluyeGastosNotarialesArrendador && (
                      <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                        <span className="text-muted-foreground">Notaría (Propietario)</span>
                        <span>{formatCurrency(data.montoGastosNotarialesArrendador)}</span>
                      </div>
                    )}
                    {data.incluyeGastosNotarialesArrendatario && (
                      <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                        <span className="text-muted-foreground">Notaría (Arrendatario)</span>
                        <span>{formatCurrency(data.montoGastosNotarialesArrendatario)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Honorarios A */}
                  {(data.montoHonorariosA > 0) && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/5 p-3 rounded-lg border border-blue-100/50">
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Parte A ({isVentaHonorarios ? 'Vendedor' : 'Arrendador'})</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Neto:</span>
                          <span>{formatCurrency(data.montoHonorariosA)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">IVA (19%):</span>
                          <span>{formatCurrency(Math.round(data.montoHonorariosA * 0.19))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-blue-700 pt-1">
                          <span>Total:</span>
                          <span>{formatCurrency(Math.round(data.montoHonorariosA * 1.19))}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Honorarios B */}
                  {(data.montoHonorariosB > 0) && (
                    <div className="bg-green-50/50 dark:bg-green-900/5 p-3 rounded-lg border border-green-100/50">
                      <p className="text-[10px] font-bold text-green-600 uppercase mb-2">Parte B ({isVentaHonorarios ? 'Comprador' : 'Arrendatario'})</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Neto:</span>
                          <span>{formatCurrency(data.montoHonorariosB)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">IVA (19%):</span>
                          <span>{formatCurrency(Math.round(data.montoHonorariosB * 0.19))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-green-700 pt-1">
                          <span>Total:</span>
                          <span>{formatCurrency(Math.round(data.montoHonorariosB * 1.19))}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Total Global */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col items-center mt-4">
                    <span className="text-[10px] font-bold uppercase opacity-70 mb-1">Total a Recaudar Remax</span>
                    <span className="text-2xl font-black">{formatCurrency(Math.round((Number(data.montoHonorariosA || 0) + Number(data.montoHonorariosB || 0)) * 1.19))}</span>
                  </div>
                </div>
              )}
            </div>

            {isArriendoLegacy && (
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
    </Card >
  )
}
