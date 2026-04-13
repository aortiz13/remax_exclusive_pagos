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
 * Fetch all meetings for a candidate
 */
export async function fetchMeetingsByCandidate(candidateId) {
    return apiRequest(`/api/meetings/candidate/${candidateId}`)
}

/**
 * Fetch a single meeting by ID
 */
export async function fetchMeeting(meetingId) {
    return apiRequest(`/api/meetings/${meetingId}`)
}

/**
 * Extract form fields from a meeting transcript using GPT-4o
 */
export async function extractFormFromMeeting(meetingId) {
    return apiRequest(`/api/meetings/${meetingId}/extract-form`, {
        method: 'POST',
    })
}

/**
 * Apply extracted form data to the candidate profile
 * @param {string} meetingId
 * @param {object} overrides - Optional field overrides from manual edits
 */
export async function applyFormToCandidate(meetingId, overrides = {}) {
    return apiRequest(`/api/meetings/${meetingId}/apply-form`, {
        method: 'POST',
        body: JSON.stringify({ overrides }),
    })
}
