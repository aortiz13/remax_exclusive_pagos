/**
 * Retry wrapper for async operations (e.g. Supabase queries).
 * Retries on network-level errors ("Failed to fetch") with exponential backoff.
 *
 * @param {Function} fn  - Async function to execute
 * @param {Object} opts
 * @param {number} opts.retries - Max retries (default: 2)
 * @param {number} opts.baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise<*>} Result of fn()
 */
export async function withRetry(fn, { retries = 2, baseDelay = 1000 } = {}) {
    let lastError
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err
            const isNetworkError =
                err.message?.includes('Failed to fetch') ||
                err.message?.includes('NetworkError') ||
                err.message?.includes('Load failed') ||
                err.name === 'AbortError'

            if (!isNetworkError || attempt >= retries) {
                throw err
            }

            // Exponential backoff
            await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)))
        }
    }
    throw lastError
}
