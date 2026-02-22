const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/boleto_de_pago'
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
      throw new Error(`Webhook Failed: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    console.error('Webhook Error:', error)
    throw error
  }
}

export const triggerLegalWebhook = async (formData) => {
  console.log('Sending formData to legal webhook:', N8N_LEGAL_WEBHOOK_URL)

  try {
    // Note: Do NOT set Content-Type header when sending FormData.
    // The browser automatically sets it with the boundary.
    const response = await fetch(N8N_LEGAL_WEBHOOK_URL, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Legal Webhook Failed: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    console.error('Legal Webhook Error:', error)
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
      throw new Error(`Evaluación Comercial Webhook Failed: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    console.error('Evaluación Comercial Webhook Error:', error)
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
      throw new Error(`Evaluación Comercial Completion Webhook Failed: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    console.error('Evaluación Comercial Completion Webhook Error:', error)
    throw error
  }
}
