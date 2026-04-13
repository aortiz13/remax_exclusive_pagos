/**
 * Post-Processor — Handles transcription, form extraction, and saving after meeting ends
 */

import { readFileSync, unlinkSync, statSync } from 'fs';
import crypto from 'crypto';
import pool from '../lib/db.js';
import { uploadFile } from '../lib/storage.js';
import { config } from '../config.js';
import { convertToWebm } from './audioCapture.js';

/**
 * Process a completed recording: transcribe, extract, save
 * @param {string} sessionId - Bot session UUID
 * @param {string} audioPath - Path to the WAV file
 * @param {object} sessionData - { candidate_id, requested_by, meeting_platform, meeting_url }
 * @param {(status: string) => void} updateStatus - Status callback
 */
export async function processRecording(sessionId, audioPath, sessionData, updateStatus) {
    const { candidate_id, requested_by, meeting_platform, meeting_url } = sessionData;

    try {
        // 1. Check file exists and has content
        const stat = statSync(audioPath);
        if (stat.size < 1000) {
            throw new Error(`Recording too small (${stat.size} bytes) — likely no audio captured`);
        }
        console.log(`[PostProcess] Audio file: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

        // 2. Convert WAV to WebM for smaller storage
        updateStatus('processing');
        const finalPath = await convertToWebm(audioPath);
        const finalBuffer = readFileSync(finalPath);
        const isWebm = finalPath.endsWith('.webm');
        const fileExt = isWebm ? 'webm' : 'wav';
        const contentType = isWebm ? 'audio/webm' : 'audio/wav';

        // 3. Upload to MinIO
        const meetingId = crypto.randomUUID();
        const storagePath = `recruitment-recordings/${candidate_id || 'unassigned'}/${meetingId}.${fileExt}`;
        console.log(`[PostProcess] Uploading to ${storagePath}...`);
        const recordingUrl = await uploadFile(storagePath, finalBuffer, contentType);

        // Update session with recording URL
        const durationSeconds = Math.round(stat.size / (16000 * 2)); // 16kHz, 16-bit
        await pool.query(
            `UPDATE meeting_bot_sessions SET recording_url = $1, recording_duration_seconds = $2, updated_at = NOW() WHERE id = $3`,
            [recordingUrl, durationSeconds, sessionId]
        );

        // 4. Transcribe with OpenAI Whisper
        updateStatus('transcribing');
        console.log('[PostProcess] Transcribing with OpenAI Whisper...');

        let transcriptText = '';
        let transcriptJson = null;
        try {
            const whisperResult = await transcribeWithWhisper(finalBuffer, fileExt);
            transcriptText = whisperResult.text || '';
            transcriptJson = whisperResult.segments || null;
            console.log(`[PostProcess] ✅ Transcription: ${transcriptText.length} chars`);
        } catch (err) {
            console.error('[PostProcess] Transcription error:', err.message);
            transcriptText = `[Error en transcripción: ${err.message}]`;
        }

        // 5. Extract form with GPT-4o
        let extractedForm = null;
        let aiSummary = null;
        if (transcriptText.length > 20 && !transcriptText.startsWith('[Error')) {
            updateStatus('extracting');
            console.log('[PostProcess] Extracting form with GPT-4o...');

            try {
                extractedForm = await extractFormFromTranscript(transcriptText);
            } catch (err) {
                console.error('[PostProcess] Form extraction error:', err.message);
            }

            // 6. Generate AI summary
            try {
                aiSummary = await generateSummary(transcriptText);
            } catch (err) {
                console.error('[PostProcess] Summary error:', err.message);
            }
        }

        // 7. Insert recruitment_meeting record
        const { rows } = await pool.query(
            `INSERT INTO recruitment_meetings
             (id, candidate_id, recording_url, recording_duration_seconds, recording_format,
              transcript_text, transcript_json, extracted_form, meeting_type, meeting_platform,
              recorded_by, bot_session_id, ai_summary, started_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW())
             RETURNING id`,
            [
                meetingId, candidate_id, recordingUrl, durationSeconds, fileExt,
                transcriptText, JSON.stringify(transcriptJson),
                extractedForm ? JSON.stringify(extractedForm) : null,
                'recruitment_interview', meeting_platform,
                requested_by, sessionId, aiSummary,
            ]
        );

        // 8. Update bot session as completed
        await pool.query(
            `UPDATE meeting_bot_sessions
             SET status = 'completed', meeting_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [meetingId, sessionId]
        );

        // 9. Create notification for the user
        await pool.query(
            `INSERT INTO notifications (id, user_id, title, body, type, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
                crypto.randomUUID(),
                requested_by,
                '✅ Reunión procesada',
                `La transcripción de la reunión está lista (${formatDuration(durationSeconds)})`,
                'meeting_bot_completed',
                JSON.stringify({ session_id: sessionId, meeting_id: meetingId, candidate_id }),
            ]
        );

        // 10. Auto-extract form if candidate exists
        if (candidate_id && extractedForm) {
            try {
                await applyFormToCandidate(meetingId, candidate_id, extractedForm, requested_by);
            } catch (err) {
                console.error('[PostProcess] Auto-apply form error:', err.message);
            }
        }

        // Cleanup temp files
        try { unlinkSync(audioPath); } catch { }
        try { if (finalPath !== audioPath) unlinkSync(finalPath); } catch { }

        console.log(`[PostProcess] ✅ Complete! Meeting: ${meetingId}`);
        return { meetingId, transcriptText, extractedForm, aiSummary };

    } catch (err) {
        console.error('[PostProcess] Fatal error:', err);

        await pool.query(
            `UPDATE meeting_bot_sessions SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
            [err.message, sessionId]
        );

        // Notify user of failure
        await pool.query(
            `INSERT INTO notifications (id, user_id, title, body, type, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
                crypto.randomUUID(),
                requested_by,
                '❌ Error procesando reunión',
                `No se pudo procesar la grabación: ${err.message.substring(0, 100)}`,
                'meeting_bot_failed',
                JSON.stringify({ session_id: sessionId }),
            ]
        );

        throw err;
    }
}

// ─── Whisper Transcription ─────────────────────────────────────
async function transcribeWithWhisper(audioBuffer, format = 'webm') {
    if (!config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    const blob = new Blob([audioBuffer], { type: `audio/${format}` });
    const formData = new FormData();
    formData.append('file', blob, `recording.${format}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.OPENAI_API_KEY}` },
        body: formData,
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Whisper API error (${response.status}): ${errText}`);
    }

    return await response.json();
}

// ─── GPT-4o Form Extraction ────────────────────────────────────
async function extractFormFromTranscript(transcriptText) {
    if (!config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    const maxChars = 30000;
    const truncated = transcriptText.length > maxChars
        ? transcriptText.substring(0, maxChars) + '\n\n[... transcripción truncada ...]'
        : transcriptText;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente de reclutamiento de RE/MAX Exclusive en Chile. Analiza transcripciones de entrevistas y extrae información del candidato. Solo extrae lo que el candidato dijo sobre sí mismo.`,
                },
                {
                    role: 'user',
                    content: `Extrae la información del candidato:\n\n---\n${truncated}\n---`,
                },
            ],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'candidate_extraction',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            first_name: { type: ['string', 'null'] },
                            last_name: { type: ['string', 'null'] },
                            age: { type: ['integer', 'null'] },
                            current_occupation: { type: ['string', 'null'] },
                            is_available_full_time: { type: ['boolean', 'null'] },
                            confidence_notes: { type: 'string' },
                            additional_insights: { type: ['string', 'null'] },
                        },
                        required: ['first_name', 'last_name', 'age', 'current_occupation', 'is_available_full_time', 'confidence_notes'],
                        additionalProperties: false,
                    },
                },
            },
            temperature: 0.1,
            max_tokens: 1000,
        }),
    });

    if (!response.ok) throw new Error(`GPT-4o error (${response.status})`);

    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
}

// ─── AI Summary ────────────────────────────────────────────────
async function generateSummary(transcriptText) {
    if (!config.OPENAI_API_KEY) return null;

    const maxChars = 20000;
    const truncated = transcriptText.length > maxChars
        ? transcriptText.substring(0, maxChars) + '\n\n[... truncado ...]'
        : transcriptText;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente de reclutamiento. Genera un resumen ejecutivo de la entrevista en español. Incluye: puntos clave discutidos, impresión general del candidato, próximos pasos si se mencionaron. Máximo 300 palabras.`,
                },
                {
                    role: 'user',
                    content: `Resume esta entrevista:\n\n${truncated}`,
                },
            ],
            temperature: 0.3,
            max_tokens: 500,
        }),
    });

    if (!response.ok) return null;
    const result = await response.json();
    return result.choices?.[0]?.message?.content || null;
}

// ─── Apply Form to Candidate ──────────────────────────────────
async function applyFormToCandidate(meetingId, candidateId, form, userId) {
    const updates = [];
    const values = [];
    let idx = 1;

    if (form.first_name) { updates.push(`first_name = $${idx++}`); values.push(form.first_name); }
    if (form.last_name) { updates.push(`last_name = $${idx++}`); values.push(form.last_name); }
    if (form.age) { updates.push(`age = $${idx++}`); values.push(Number(form.age)); }
    if (form.current_occupation) { updates.push(`job_title = $${idx++}`); values.push(form.current_occupation); }

    updates.push('updated_at = NOW()');

    if (updates.length > 1) {
        values.push(candidateId);
        await pool.query(
            `UPDATE recruitment_candidates SET ${updates.join(', ')} WHERE id = $${idx}`,
            values
        );
    }

    await pool.query(
        `UPDATE recruitment_meetings SET form_applied = true, form_applied_at = NOW(), form_applied_by = $1, updated_at = NOW() WHERE id = $2`,
        [userId, meetingId]
    );
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
