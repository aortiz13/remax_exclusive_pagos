import { auditLog } from './auditLogService'

const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/pagos'
const N8N_LEGAL_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/legal'
const N8N_EVALUACION_COMERCIAL_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/evaluacion_comercial'

export const triggerWebhook = async (payload) => {
  console.log('Sending payload to n8n:', payload)

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errMsg = `Webhook Failed: ${response.statusText}`
      auditLog.error('api', 'webhook.pagos.failed', errMsg, {
        module: 'api.triggerWebhook',
        error_code: String(response.status),
        details: { url: N8N_WEBHOOK_URL, status: response.status, statusText: response.statusText }
      })
      throw new Error(errMsg)
    }

    auditLog.info('api', 'webhook.pagos.sent', 'Webhook de pagos enviado exitosamente', {
      module: 'api.triggerWebhook',
      details: { url: N8N_WEBHOOK_URL }
    })
    return await response.text()
  } catch (error) {
    console.error('Webhook Error:', error)
    auditLog.error('api', 'webhook.pagos.exception', error.message, {
      module: 'api.triggerWebhook',
      details: { url: N8N_WEBHOOK_URL, error: error.message }
    })
    throw error
  }
}

export const triggerLegalWebhook = async (formData) => {
  console.log('Sending formData to legal webhook:', N8N_LEGAL_WEBHOOK_URL)

  try {
    const response = await fetch(N8N_LEGAL_WEBHOOK_URL, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errMsg = `Legal Webhook Failed: ${response.statusText}`
      auditLog.error('api', 'webhook.legal.failed', errMsg, {
        module: 'api.triggerLegalWebhook',
        error_code: String(response.status),
        details: { url: N8N_LEGAL_WEBHOOK_URL, status: response.status }
      })
      throw new Error(errMsg)
    }

    auditLog.info('api', 'webhook.legal.sent', 'Webhook legal enviado exitosamente', {
      module: 'api.triggerLegalWebhook',
      details: { url: N8N_LEGAL_WEBHOOK_URL }
    })
    return await response.text()
  } catch (error) {
    console.error('Legal Webhook Error:', error)
    auditLog.error('api', 'webhook.legal.exception', error.message, {
      module: 'api.triggerLegalWebhook',
      details: { url: N8N_LEGAL_WEBHOOK_URL, error: error.message }
    })
    throw error
  }
}

export const triggerEvaluacionComercialWebhook = async (payload) => {
  console.log('Sending payload to evaluacion comercial webhook:', payload)

  try {
    const response = await fetch(N8N_EVALUACION_COMERCIAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errMsg = `Evaluación Comercial Webhook Failed: ${response.statusText}`
      auditLog.error('api', 'webhook.evaluacion_comercial.failed', errMsg, {
        module: 'api.triggerEvaluacionComercialWebhook',
        error_code: String(response.status),
        details: { url: N8N_EVALUACION_COMERCIAL_WEBHOOK_URL, status: response.status }
      })
      throw new Error(errMsg)
    }

    auditLog.info('api', 'webhook.evaluacion_comercial.sent', 'Webhook evaluación comercial enviado', {
      module: 'api.triggerEvaluacionComercialWebhook',
      details: { url: N8N_EVALUACION_COMERCIAL_WEBHOOK_URL }
    })
    return await response.text()
  } catch (error) {
    console.error('Evaluación Comercial Webhook Error:', error)
    auditLog.error('api', 'webhook.evaluacion_comercial.exception', error.message, {
      module: 'api.triggerEvaluacionComercialWebhook',
      details: { url: N8N_EVALUACION_COMERCIAL_WEBHOOK_URL, error: error.message }
    })
    throw error
  }
}

export const triggerEvaluacionComercialCompletionWebhook = async (payload) => {
  console.log('Sending payload to evaluacion comercial completion webhook:', payload)

  try {
    const response = await fetch('https://workflow.remax-exclusive.cl/webhook/evaluacion_comercial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errMsg = `Evaluación Comercial Completion Webhook Failed: ${response.statusText}`
      auditLog.error('api', 'webhook.evaluacion_comercial_completion.failed', errMsg, {
        module: 'api.triggerEvaluacionComercialCompletionWebhook',
        error_code: String(response.status),
        details: { status: response.status }
      })
      throw new Error(errMsg)
    }

    auditLog.info('api', 'webhook.evaluacion_comercial_completion.sent', 'Webhook evaluación comercial completado', {
      module: 'api.triggerEvaluacionComercialCompletionWebhook'
    })
    return await response.text()
  } catch (error) {
    console.error('Evaluación Comercial Completion Webhook Error:', error)
    auditLog.error('api', 'webhook.evaluacion_comercial_completion.exception', error.message, {
      module: 'api.triggerEvaluacionComercialCompletionWebhook',
      details: { error: error.message }
    })
    throw error
  }
}
