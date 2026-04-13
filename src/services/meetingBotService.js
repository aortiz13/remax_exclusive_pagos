import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'https://remax-crm-remax-app.jzuuqr.easypanel.host'

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
}

async function apiRequest(path, options = {}) {
    const token = await getToken()
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`API Error ${res.status}: ${text}`)
    }
    return res.json()
}

/**
 * Send bot to a meeting
 * @param {string} meetingUrl - Meeting URL (Google Meet, Zoom, or Teams)
 * @param {string|null} candidateId - Optional candidate to associate
 * @param {string|null} botName - Custom name for the bot
 */
export async function sendBotToMeeting(meetingUrl, candidateId = null, botName = null) {
    return apiRequest('/api/meeting-bot/send', {
        method: 'POST',
        body: JSON.stringify({
            meeting_url: meetingUrl,
            candidate_id: candidateId,
            bot_name: botName,
        }),
    })
}

/**
 * Get all bot sessions for current user
 */
export async function fetchBotSessions(limit = 20) {
    return apiRequest(`/api/meeting-bot/sessions?limit=${limit}`)
}

/**
 * Get bot session details
 */
export async function fetchBotSession(sessionId) {
    return apiRequest(`/api/meeting-bot/sessions/${sessionId}`)
}

/**
 * Get bot session status (lightweight polling)
 */
export async function fetchBotSessionStatus(sessionId) {
    return apiRequest(`/api/meeting-bot/sessions/${sessionId}/status`)
}

/**
 * Cancel a pending/joining bot session
 */
export async function cancelBotSession(sessionId) {
    return apiRequest(`/api/meeting-bot/sessions/${sessionId}/cancel`, {
        method: 'POST',
    })
}

/**
 * Detect the platform from a meeting URL
 */
export async function detectMeetingPlatform(url) {
    return apiRequest(`/api/meeting-bot/detect-platform?url=${encodeURIComponent(url)}`)
}
