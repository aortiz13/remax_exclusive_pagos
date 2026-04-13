/**
 * Meeting Monitor — Watches for meeting end and tracks participants
 */

import * as googleMeet from '../platforms/googleMeet.js';
import * as zoom from '../platforms/zoom.js';
import * as teams from '../platforms/teams.js';
import { config } from '../config.js';

const platformModules = {
    google_meet: googleMeet,
    zoom: zoom,
    teams: teams,
};

/**
 * Monitor a meeting until it ends or max duration is reached
 * @param {import('playwright').Page} page
 * @param {string} platform
 * @param {(status: object) => void} onStatusUpdate - Callback for status changes
 * @returns {Promise<{ reason: string, duration: number }>}
 */
export async function monitorMeeting(page, platform, onStatusUpdate) {
    const mod = platformModules[platform];
    if (!mod) throw new Error(`Unknown platform: ${platform}`);

    const startTime = Date.now();
    const maxDuration = config.BOT_MAX_MEETING_DURATION * 1000;
    let checkCount = 0;
    let lastParticipantCount = -1;
    let emptyRoomCount = 0; // Consecutive checks with 0-1 participants

    console.log(`[Monitor] Starting meeting monitor (max ${config.BOT_MAX_MEETING_DURATION}s)...`);

    return new Promise((resolve) => {
        const interval = setInterval(async () => {
            try {
                checkCount++;
                const elapsed = Date.now() - startTime;
                const elapsedSeconds = Math.round(elapsed / 1000);

                // Max duration check
                if (elapsed >= maxDuration) {
                    clearInterval(interval);
                    console.log('[Monitor] ⏰ Max meeting duration reached');
                    resolve({ reason: 'max_duration', duration: elapsedSeconds });
                    return;
                }

                // Check if meeting ended
                const ended = await mod.isMeetingEnded(page);
                if (ended) {
                    clearInterval(interval);
                    console.log('[Monitor] 🔴 Meeting has ended');
                    resolve({ reason: 'meeting_ended', duration: elapsedSeconds });
                    return;
                }

                // Check participant count
                const participantCount = await mod.getParticipantCount(page);
                if (participantCount !== -1 && participantCount !== lastParticipantCount) {
                    lastParticipantCount = participantCount;
                    console.log(`[Monitor] 👥 Participants: ${participantCount}`);
                }

                // If only the bot is left (1 or 0 participants), start countdown
                if (participantCount !== -1 && participantCount <= 1) {
                    emptyRoomCount++;
                    if (emptyRoomCount >= 6) { // 60 seconds of empty room (6 × 10s)
                        clearInterval(interval);
                        console.log('[Monitor] 🔴 Meeting room empty for 60s');
                        resolve({ reason: 'empty_room', duration: elapsedSeconds });
                        return;
                    }
                } else {
                    emptyRoomCount = 0;
                }

                // Check if page disconnected or crashed
                if (page.isClosed()) {
                    clearInterval(interval);
                    console.log('[Monitor] 🔴 Page was closed');
                    resolve({ reason: 'page_closed', duration: elapsedSeconds });
                    return;
                }

                // Status update callback (every 30 seconds)
                if (checkCount % 3 === 0) {
                    onStatusUpdate?.({
                        elapsed: elapsedSeconds,
                        participants: participantCount,
                        status: 'in_meeting',
                    });
                }

            } catch (err) {
                console.error('[Monitor] Check error:', err.message);
                // Don't stop on transient errors — might be a DOM glitch
            }
        }, 10000); // Check every 10 seconds
    });
}
