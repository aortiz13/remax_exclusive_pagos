import { supabase } from '../../services/supabase.js'

const BASE = 'https://remax-crm-remax-app.jzuuqr.easypanel.host'

async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return {
        'Content-Type': 'application/json',
        'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
    }
}

export async function voiceFetch(path, options = {}) {
    const headers = await authHeaders()
    const res = await fetch(`${BASE}/api/voice${path}`, { ...options, headers: { ...headers, ...options.headers } })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}

export async function voiceUpload(path, formData) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${BASE}/api/voice${path}`, {
        method: 'POST',
        headers: { 'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' },
        body: formData,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}
