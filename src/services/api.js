const N8N_WEBHOOK_URL = 'https://workflow.remax-exclusive.cl/webhook/boleto_de_pago'

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

    return await response.text() // n8n webhooks might return text or json
  } catch (error) {
    console.error('Webhook Error:', error)
    throw error
  }
}
