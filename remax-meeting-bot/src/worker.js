/**
 * Meeting Bot Worker — Main BullMQ Worker (v2 - with Google auth)
 * Uses saved Google session cookies to join meetings as authenticated user
 */

import { Worker } from 'bullmq';
import { chromium } from 'playwright';
import { redisConnection } from './lib/redis.js';
import pool from './lib/db.js';
import { config } from './config.js';
import { detectPlatform, normalizeUrl } from './platforms/index.js';
import { joinGoogleMeet } from './platforms/googleMeet.js';
import { joinZoom } from './platforms/zoom.js';
import { joinTeams } from './platforms/teams.js';
import { getLaunchOptions, applyStealthToPage } from './utils/browserConfig.js';
import { startAudioCapture } from './services/audioCapture.js';
import { monitorMeeting } from './services/meetingMonitor.js';
import { processRecording } from './services/postProcessor.js';
import { takeScreenshot } from './services/screenshotDiag.js';
import { hasAuthState, getAuthState } from './setupAuth.js';

// Platform join functions
const JOIN_FUNCTIONS = {
    google_meet: joinGoogleMeet,
    zoom: joinZoom,
    teams: joinTeams,
};

console.log('╔══════════════════════════════════════════════╗');
console.log('║  🤖 RE/MAX Meeting Bot Worker v2            ║');
console.log(`║  Concurrency: ${config.BOT_CONCURRENCY}                            ║`);
console.log(`║  Max duration: ${config.BOT_MAX_MEETING_DURATION}s                        ║`);
console.log('╚══════════════════════════════════════════════╝');

// Check auth state on startup
const authInfo = hasAuthState();
if (authInfo.exists) {
    console.log(`[Worker] ✅ Google auth detected (${authInfo.ageDays} days old)`);
} else {
    console.log('[Worker] ⚠️ No Google auth found. Bot will join as anonymous (may be blocked by Workspace).');
    console.log('[Worker]    Run: node src/setupAuth.js — to login and save session.');
}

// ─── Update Session Status Helper ───────────────────────────────
async function updateSessionStatus(sessionId, status, extra = {}) {
    const sets = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let idx = 2;

    for (const [key, value] of Object.entries(extra)) {
        sets.push(`${key} = $${idx++}`);
        values.push(value);
    }

    values.push(sessionId);
    await pool.query(
        `UPDATE meeting_bot_sessions SET ${sets.join(', ')} WHERE id = $${idx}`,
        values
    );
}

// ─── Main Worker ────────────────────────────────────────────────
const worker = new Worker('meeting-bot', async (job) => {
    const { sessionId, meetingUrl, platform, candidateId, requestedBy, botName } = job.data;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🤖 Processing meeting bot job: ${sessionId}`);
    console.log(`   Platform: ${platform}`);
    console.log(`   URL: ${meetingUrl}`);
    console.log(`   Bot: ${botName || config.BOT_DISPLAY_NAME}`);
    console.log(`${'═'.repeat(60)}\n`);

    let browser = null;
    let audioCapture = null;

    try {
        // 1. Update status to "joining"
        await updateSessionStatus(sessionId, 'joining');

        // 2. Launch browser
        console.log('[Worker] Launching Chromium...');
        browser = await chromium.launch(getLaunchOptions());

        // 3. Create context WITH or WITHOUT auth state
        const contextOptions = {
            viewport: { width: 1920, height: 1080 },
            permissions: ['microphone', 'camera'],
            locale: 'es-CL',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        };

        // Load saved Google session if available
        const authState = getAuthState();
        if (authState) {
            contextOptions.storageState = authState;
            console.log('[Worker] 🔐 Using saved Google session (authenticated)');
        } else {
            console.log('[Worker] ⚠️ No saved session — joining as anonymous');
        }

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        await applyStealthToPage(page);

        // 4. Normalize URL
        const normalizedUrl = normalizeUrl(meetingUrl, platform);
        console.log(`[Worker] Normalized URL: ${normalizedUrl}`);

        // 5. Join the meeting
        const joinFn = JOIN_FUNCTIONS[platform];
        if (!joinFn) {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        const joinResult = await joinFn(page, normalizedUrl, botName || config.BOT_DISPLAY_NAME);

        if (!joinResult.success) {
            const screenshotUrl = await takeScreenshot(page, sessionId, 'join_failed');

            await updateSessionStatus(sessionId, 'failed', {
                error_message: joinResult.error || 'Failed to join meeting',
                error_screenshot_url: screenshotUrl,
            });

            throw new Error(`Failed to join: ${joinResult.error}`);
        }

        // 6. Successfully joined — start recording
        console.log('[Worker] 🎙️ Starting audio capture...');
        await updateSessionStatus(sessionId, 'in_meeting', {
            joined_at: new Date().toISOString(),
        });

        audioCapture = startAudioCapture(sessionId);

        // 7. Monitor the meeting
        const monitorResult = await monitorMeeting(page, platform, async (status) => {
            await updateSessionStatus(sessionId, 'in_meeting', {
                recording_duration_seconds: status.elapsed,
            });
        });

        console.log(`[Worker] Meeting ended. Reason: ${monitorResult.reason}, Duration: ${monitorResult.duration}s`);

        // 8. Stop recording
        const audioPath = await audioCapture.stop();
        audioCapture = null;

        await updateSessionStatus(sessionId, 'processing', {
            left_at: new Date().toISOString(),
            recording_duration_seconds: monitorResult.duration,
        });

        // 9. Close browser
        await browser.close();
        browser = null;

        // 10. Post-process: transcribe, extract, save
        console.log('[Worker] Starting post-processing...');
        const result = await processRecording(
            sessionId,
            audioPath,
            {
                candidate_id: candidateId,
                requested_by: requestedBy,
                meeting_platform: platform,
                meeting_url: meetingUrl,
            },
            async (status) => {
                await updateSessionStatus(sessionId, status);
            }
        );

        console.log(`[Worker] ✅ Job complete! Meeting ID: ${result.meetingId}`);
        return result;

    } catch (err) {
        console.error(`[Worker] ❌ Job failed:`, err.message);

        try {
            if (audioCapture) await audioCapture.stop();
        } catch { }

        try {
            if (browser) await browser.close();
        } catch { }

        try {
            const { rows } = await pool.query(
                'SELECT status FROM meeting_bot_sessions WHERE id = $1',
                [sessionId]
            );
            if (rows[0] && rows[0].status !== 'failed') {
                await updateSessionStatus(sessionId, 'failed', {
                    error_message: err.message,
                });
            }
        } catch { }

        throw err;
    }

}, {
    connection: redisConnection,
    concurrency: config.BOT_CONCURRENCY,
    lockDuration: config.BOT_MAX_MEETING_DURATION * 1000 + 300000,
});

// ─── Worker Events ──────────────────────────────────────────────
worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
    console.error('[Worker] Error:', err.message);
});

// ─── Graceful Shutdown ──────────────────────────────────────────
process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...');
    await worker.close();
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Worker] Interrupted, shutting down...');
    await worker.close();
    await pool.end();
    process.exit(0);
});

console.log(`[Worker] 🟢 Ready — listening for "meeting-bot" jobs (concurrency: ${config.BOT_CONCURRENCY})`);
