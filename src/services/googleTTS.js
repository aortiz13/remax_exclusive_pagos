/**
 * Google Cloud Text-to-Speech Service
 * Calls the Supabase Edge Function `generate-tts` which handles:
 * - Service Account JWT authentication
 * - Google Cloud TTS API calls with SSML word timestamps
 * 
 * Free tier: 4M chars/month (standard), 1M chars/month (WaveNet)
 */

import { supabase } from './supabase'

/**
 * Generate speech with word-level timestamps via Edge Function
 * @param {string} text - Plain text to synthesize
 * @param {object} voiceConfig - Optional voice override { languageCode, name, ssmlGender }
 * @returns {{ audioBase64: string, timepoints: Array, wordMap: Array<{word: string, time: number}> }}
 */
export async function generateSpeechWithTimestamps(text, voiceConfig = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Debes estar autenticado para generar audio')

    const response = await fetch(
        `https://wdyfeolbuogoyngrvxkc.supabase.co/functions/v1/generate-tts`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWZlb2xidW9nb3luZ3J2eGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODIyMTUsImV4cCI6MjA4NDA1ODIxNX0.6wOgw7h9ZsnKIpkqYE7faXUlNHHdhSo7bIHMEdvIN1Y'
            },
            body: JSON.stringify({ text, voiceConfig })
        }
    )

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(err.error || `Error del servidor TTS (${response.status})`)
    }

    return await response.json()
}

/**
 * Generate speech for multiple segments with continuity context
 * @param {Array<{text: string, label: string}>} segments
 * @param {object} voiceConfig
 * @returns {Array<{label: string, audioBase64: string, timepoints: Array, wordMap: Array}>}
 */
export async function generateMultiSegmentSpeech(segments, voiceConfig = {}) {
    const results = []

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        const result = await generateSpeechWithTimestamps(segment.text, voiceConfig)
        results.push({
            label: segment.label,
            ...result
        })
        // Small delay to respect rate limits
        if (i < segments.length - 1) {
            await new Promise(r => setTimeout(r, 300))
        }
    }

    return results
}

/**
 * Convert base64 audio to Blob for upload
 */
export function base64ToBlob(base64, mimeType = 'audio/mp3') {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
}

/**
 * List available Spanish voices via Edge Function
 */
export async function listSpanishVoices() {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return []

        const response = await fetch(
            `https://wdyfeolbuogoyngrvxkc.supabase.co/functions/v1/generate-tts`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWZlb2xidW9nb3luZ3J2eGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODIyMTUsImV4cCI6MjA4NDA1ODIxNX0.6wOgw7h9ZsnKIpkqYE7faXUlNHHdhSo7bIHMEdvIN1Y'
                },
                body: JSON.stringify({ action: 'list_voices' })
            }
        )

        if (!response.ok) return []
        const data = await response.json()
        return (data.voices || []).map(v => ({
            name: v.name,
            gender: v.ssmlGender,
            languageCodes: v.languageCodes
        }))
    } catch {
        return []
    }
}
