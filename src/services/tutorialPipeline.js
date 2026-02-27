/**
 * Tutorial Pipeline Orchestrator
 * Coordinates: script → TTS generation → audio upload → status tracking
 */

import { supabase, getCustomPublicUrl } from './supabase'
import { generateSpeechWithTimestamps, base64ToBlob } from './googleTTS'

/**
 * Generate TTS audio for all segments of a tutorial
 * @param {string} tutorialId - UUID of the tutorial
 * @param {object} voiceConfig - Optional voice config override
 */
export async function generateTutorialAudio(tutorialId, voiceConfig = {}) {
    // 1. Update status to generating
    await supabase
        .from('video_tutorials')
        .update({ status: 'generating_audio', error_message: null, updated_at: new Date().toISOString() })
        .eq('id', tutorialId)

    try {
        // 2. Fetch segments ordered
        const { data: segments, error } = await supabase
            .from('tutorial_segments')
            .select('*')
            .eq('tutorial_id', tutorialId)
            .order('segment_order', { ascending: true })

        if (error) throw error
        if (!segments?.length) throw new Error('No hay segmentos definidos para este tutorial')

        // 3. Generate TTS for each segment
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i]

            // Generate speech with timestamps
            const result = await generateSpeechWithTimestamps(
                segment.narration_text,
                voiceConfig
            )

            // Convert to blob and upload
            const audioBlob = base64ToBlob(result.audioBase64)
            const audioPath = `tutorials/${tutorialId}/segment_${segment.segment_order}.mp3`

            const { error: uploadError } = await supabase.storage
                .from('tutorial-assets')
                .upload(audioPath, audioBlob, {
                    contentType: 'audio/mp3',
                    upsert: true
                })

            if (uploadError) throw uploadError

            // Get public URL
            const publicUrl = getCustomPublicUrl('tutorial-assets', audioPath)

            // Update segment with audio URL and alignment data
            await supabase
                .from('tutorial_segments')
                .update({
                    audio_url: publicUrl,
                    alignment_data: {
                        timepoints: result.timepoints,
                        wordMap: result.wordMap
                    }
                })
                .eq('id', segment.id)

            // Small delay between segments
            if (i < segments.length - 1) {
                await new Promise(r => setTimeout(r, 300))
            }
        }

        // 4. Update tutorial status to ready for rendering
        await supabase
            .from('video_tutorials')
            .update({
                status: 'rendering',
                updated_at: new Date().toISOString()
            })
            .eq('id', tutorialId)

        return { success: true, segmentsProcessed: segments.length }

    } catch (err) {
        // Update status to error
        await supabase
            .from('video_tutorials')
            .update({
                status: 'error',
                error_message: err.message || 'Error desconocido',
                updated_at: new Date().toISOString()
            })
            .eq('id', tutorialId)

        throw err
    }
}

/**
 * Generate Remotion input props for rendering
 * @param {string} tutorialId
 * @returns {object} Props object for Remotion composition
 */
export async function generateRemotionProps(tutorialId) {
    const { data: tutorial } = await supabase
        .from('video_tutorials')
        .select('*')
        .eq('id', tutorialId)
        .single()

    const { data: segments } = await supabase
        .from('tutorial_segments')
        .select('*')
        .eq('tutorial_id', tutorialId)
        .order('segment_order', { ascending: true })

    return {
        title: tutorial.title,
        description: tutorial.description,
        recordingUrl: tutorial.recording_url,
        segments: segments.map(s => ({
            label: s.label,
            narrationText: s.narration_text,
            startTime: s.start_time,
            endTime: s.end_time,
            audioUrl: s.audio_url,
            alignmentData: s.alignment_data
        })),
        branding: {
            logo: 'https://res.cloudinary.com/dhzmkxbek/image/upload/v1770205777/Globo_REMAX_sin_fondo_PNG_xiqr1a.png',
            primaryColor: '#003DA5',
            secondaryColor: '#DC1E35'
        }
    }
}

/**
 * Mark tutorial as completed with video URL
 * @param {string} tutorialId
 * @param {string} videoUrl - Public URL of rendered video
 * @param {string} thumbnailUrl - Optional thumbnail URL
 * @param {string} duration - Video duration string
 */
export async function completeTutorial(tutorialId, videoUrl, thumbnailUrl = null, duration = null) {
    const { error } = await supabase
        .from('video_tutorials')
        .update({
            status: 'completed',
            output_video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            duration: duration,
            error_message: null,
            updated_at: new Date().toISOString()
        })
        .eq('id', tutorialId)

    if (error) throw error
}

/**
 * Publish completed tutorial to Aula Virtual
 * Copies the tutorial data into the virtual_classroom_videos table
 */
export async function publishToAulaVirtual(tutorialId) {
    const { data: tutorial, error: fetchError } = await supabase
        .from('video_tutorials')
        .select('*')
        .eq('id', tutorialId)
        .single()

    if (fetchError) throw fetchError
    if (tutorial.status !== 'completed') throw new Error('El tutorial debe estar completado antes de publicar')

    const { error } = await supabase
        .from('virtual_classroom_videos')
        .insert({
            title: tutorial.title,
            description: tutorial.description,
            video_url: tutorial.output_video_url,
            thumbnail_url: tutorial.thumbnail_url,
            category: 'tutoriales',
            duration: tutorial.duration,
            video_date: new Date().toISOString()
        })

    if (error) throw error
    return { success: true }
}

/**
 * Delete a tutorial and all its assets
 */
export async function deleteTutorial(tutorialId) {
    // Delete storage assets
    const { data: files } = await supabase.storage
        .from('tutorial-assets')
        .list(`tutorials/${tutorialId}`)

    if (files?.length) {
        const paths = files.map(f => `tutorials/${tutorialId}/${f.name}`)
        await supabase.storage.from('tutorial-assets').remove(paths)
    }

    // Delete from DB (cascades to segments)
    const { error } = await supabase
        .from('video_tutorials')
        .delete()
        .eq('id', tutorialId)

    if (error) throw error
}
