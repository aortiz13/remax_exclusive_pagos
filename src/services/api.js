const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/boleto_de_pago'
const N8N_LEGAL_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/legal'

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
