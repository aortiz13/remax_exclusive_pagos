/**
 * Centralized UF (Unidad de Fomento) fetching service.
 * Uses retry logic + dual-endpoint fallback to handle network/CORS issues.
 */

let cachedUF = null     // { valor, fecha, fetchedAt }
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

/**
 * Fetch the current UF value with retries and fallback endpoints.
 * Returns { valor: number, fecha: string } or null on total failure.
 */
export async function fetchUFValue() {
    // Return cache if fresh
    if (cachedUF && Date.now() - cachedUF.fetchedAt < CACHE_TTL) {
        return { valor: cachedUF.valor, fecha: cachedUF.fecha }
    }

    const endpoints = [
        {
            url: 'https://mindicador.cl/api/uf',
            extract: (data) => {
                if (data?.serie?.[0]?.valor) {
                    return {
                        valor: data.serie[0].valor,
                        fecha: (data.serie[0].fecha || '').split('T')[0]
                    }
                }
                return null
            }
        },
        {
            url: 'https://mindicador.cl/api',
            extract: (data) => {
                if (data?.uf?.valor) {
                    return {
                        valor: data.uf.valor,
                        fecha: (data.uf.fecha || '').split('T')[0]
                    }
                }
                return null
            }
        }
    ]

    const MAX_RETRIES = 2

    for (const endpoint of endpoints) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout

                const res = await fetch(endpoint.url, { signal: controller.signal })
                clearTimeout(timeout)

                if (!res.ok) throw new Error(`HTTP ${res.status}`)

                const data = await res.json()
                const result = endpoint.extract(data)

                if (result) {
                    cachedUF = { ...result, fetchedAt: Date.now() }
                    return result
                }
            } catch (err) {
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1))) // backoff
                }
                // On last attempt of last endpoint, fall through
            }
        }
    }

    // Total failure — return cached value if we have any (even stale)
    if (cachedUF) {
        return { valor: cachedUF.valor, fecha: cachedUF.fecha }
    }

    console.error('UF Service: All endpoints failed after retries')
    return null
}
