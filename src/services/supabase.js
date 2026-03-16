
import { createClient } from '@supabase/supabase-js'

// Self-hosted API Gateway (GoTrue + PostgREST + MinIO)
const supabaseUrl = 'https://remax-crm-remax-app.jzuuqr.easypanel.host'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWZlb2xidW9nb3luZ3J2eGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODIyMTUsImV4cCI6MjA4NDA1ODIxNX0.6wOgw7h9ZsnKIpkqYE7faXUlNHHdhSo7bIHMEdvIN1Y'

export const supabase = createClient(supabaseUrl, supabaseKey)

// =============================================
// Edge Function → Express API mapping
// Intercept supabase.functions.invoke() calls and route them
// to the self-hosted Express API endpoints
// =============================================
const FUNCTION_ROUTES = {
    'google-calendar-sync': { path: '/api/calendar/sync', method: 'POST' },
    'gmail-auth-url': { path: '/api/gmail/auth-url', method: 'GET' },
    'gmail-auth-callback': { path: '/api/gmail/callback', method: 'POST' },
    'gmail-send': { path: '/api/gmail/send', method: 'POST' },
    'invite-agent': { path: '/api/invite/agent', method: 'POST' },
    'admin-action': { path: '/api/admin/action', method: 'POST' },
    'import-remax-listings': { path: '/api/import/remax-listings', method: 'POST' },
    'google-auth': { path: '/api/auth/google', method: 'POST' },
    'slack-error-alert': { path: '/api/notifications/slack-alert', method: 'POST' },
    'generate-tts': { path: '/api/tts/generate', method: 'POST' },
    'send-notification': { path: '/api/notifications/send', method: 'POST' },
}

// Override supabase.functions.invoke to route to Express API
const originalInvoke = supabase.functions.invoke.bind(supabase.functions)
supabase.functions.invoke = async (functionName, options = {}) => {
    const route = FUNCTION_ROUTES[functionName]
    if (!route) {
        console.warn(`[API] Unknown function: ${functionName}, falling back to original invoke`)
        return originalInvoke(functionName, options)
    }

    try {
        const session = await supabase.auth.getSession()
        const token = session?.data?.session?.access_token

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'apikey': supabaseKey,
            // Forward any custom headers from the caller
            ...(options.headers || {}),
        }

        const fetchOptions = {
            method: route.method,
            headers,
        }

        // For GET requests, encode body as URL params
        let url = `${supabaseUrl}${route.path}`
        if (route.method === 'GET') {
            if (options.body && Object.keys(options.body).length > 0) {
                const params = new URLSearchParams()
                Object.entries(options.body).forEach(([k, v]) => params.set(k, v))
                url += `?${params.toString()}`
            }
        } else {
            fetchOptions.body = JSON.stringify(options.body || {})
        }

        const response = await fetch(url, fetchOptions)
        const data = await response.json().catch(() => null)

        if (!response.ok) {
            // Auto-log API errors to audit log → triggers Slack alerts
            try {
                const { auditLog } = await import('./auditLogService')
                auditLog.error('api', `http.${response.status}`, data?.error || `HTTP ${response.status} on ${functionName}`, {
                    module: functionName,
                    error_code: String(response.status),
                    details: { url: route.path, status: response.status, responseBody: typeof data === 'object' ? JSON.stringify(data)?.substring(0, 300) : data },
                })
            } catch { /* non-critical */ }
            return { data: null, error: { message: data?.error || `HTTP ${response.status}`, status: response.status } }
        }

        return { data, error: null }
    } catch (err) {
        // Auto-log network/fetch errors
        try {
            const { auditLog } = await import('./auditLogService')
            auditLog.error('api', 'fetch.exception', `${functionName}: ${err.message}`, {
                module: functionName,
                details: { url: `${supabaseUrl}${route.path}` },
            })
        } catch { /* non-critical */ }
        console.error(`[API] Error calling ${functionName}:`, err)
        return { data: null, error: { message: err.message } }
    }
}

// MinIO public URL for file access
const STORAGE_PUBLIC_URL = 'https://remax-crm-remax-storage.jzuuqr.easypanel.host'

export const getCustomPublicUrl = (bucket, path) => {
    if (!path) return null
    return `${STORAGE_PUBLIC_URL}/${bucket}/${path}`
}
