/**
 * Microsoft Teams — Join Flow (Browser)
 * Joins Teams meetings via the web browser (no desktop app)
 */

import { config } from '../config.js';

const SELECTORS = {
    // "Continue on this browser" button
    continueOnBrowser: [
        'button:has-text("Continue on this browser")',
        'button:has-text("Continuar en este explorador")',
        'a:has-text("Continue on this browser")',
        'a:has-text("Join on the web instead")',
        'a:has-text("Unirse a la web")',
        '[data-tid="joinOnWeb"]',
    ],

    // Name input
    nameInput: [
        '#username',
        'input[data-tid="prejoin-display-name-input"]',
        'input[placeholder*="name"]',
        'input[placeholder*="nombre"]',
        'input[aria-label*="name"]',
    ],

    // Join button
    joinButton: [
        'button[data-tid="prejoin-join-button"]',
        'button:has-text("Join now")',
        'button:has-text("Unirse ahora")',
        '#prejoin-join-button',
    ],

    // Toggle controls
    micToggle: [
        '[data-tid="toggle-mute"]',
        'button[aria-label*="mic"]',
        'button[aria-label*="micrófono"]',
    ],
    camToggle: [
        '[data-tid="toggle-video"]',
        'button[aria-label*="camera"]',
        'button[aria-label*="cámara"]',
    ],

    // In meeting
    inMeeting: [
        '[data-tid="call-composite"]',
        '#roster-button',
        '.calling-screen',
        '[data-tid="calling-roster"]',
    ],

    // Meeting ended
    meetingEnded: [
        'div:has-text("You left the meeting")',
        'div:has-text("Saliste de la reunión")',
        'div:has-text("The meeting has ended")',
        'div:has-text("La reunión ha finalizado")',
        '[data-tid="post-call"]',
    ],

    // Lobby/waiting
    lobby: [
        'div:has-text("Someone in the meeting should let you in soon")',
        'div:has-text("Alguien de la reunión te dejará entrar pronto")',
        '[data-tid="lobby"]',
    ],
};

async function findElement(page, selectorList, timeout = 5000) {
    for (const selector of selectorList) {
        try {
            const el = await page.waitForSelector(selector, { timeout: Math.min(timeout, 2000) });
            if (el) return el;
        } catch {
            // Try next
        }
    }
    return null;
}

/**
 * Join a Microsoft Teams meeting
 */
export async function joinTeams(page, meetingUrl, botName = config.BOT_DISPLAY_NAME) {
    console.log(`[Teams] Navigating to ${meetingUrl}...`);

    try {
        await page.goto(meetingUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(4000);

        // Step 1: Click "Continue on this browser" to avoid desktop app prompt
        console.log('[Teams] Looking for "Continue on browser" button...');
        const continueBtn = await findElement(page, SELECTORS.continueOnBrowser, 15000);
        if (continueBtn) {
            await continueBtn.click();
            await page.waitForTimeout(3000);
        } else {
            console.log('[Teams] No browser prompt found — may already be on web client');
        }

        // Step 2: Turn off camera and mic
        console.log('[Teams] Turning off camera and microphone...');
        const micBtn = await findElement(page, SELECTORS.micToggle, 5000);
        if (micBtn) {
            await micBtn.click();
            await page.waitForTimeout(500);
        }
        const camBtn = await findElement(page, SELECTORS.camToggle, 3000);
        if (camBtn) {
            await camBtn.click();
            await page.waitForTimeout(500);
        }

        // Step 3: Enter name
        console.log(`[Teams] Entering name: "${botName}"`);
        const nameInput = await findElement(page, SELECTORS.nameInput, 10000);
        if (nameInput) {
            await nameInput.click({ clickCount: 3 });
            await nameInput.fill(botName);
            await page.waitForTimeout(500);
        }

        // Step 4: Click "Join now"
        console.log('[Teams] Clicking join button...');
        const joinBtn = await findElement(page, SELECTORS.joinButton, 10000);
        if (joinBtn) {
            await joinBtn.click();
        } else {
            const btns = await page.$$('button');
            for (const btn of btns) {
                const text = await btn.textContent();
                if (text && (text.includes('Join') || text.includes('Unirse'))) {
                    await btn.click();
                    break;
                }
            }
        }

        // Step 5: Wait to be admitted
        console.log('[Teams] Waiting to be admitted...');
        const joinTimeout = config.BOT_JOIN_TIMEOUT * 1000;
        const startWait = Date.now();

        while (Date.now() - startWait < joinTimeout) {
            const inMeeting = await findElement(page, SELECTORS.inMeeting, 3000);
            if (inMeeting) {
                console.log('[Teams] ✅ Successfully joined the meeting!');
                return { success: true };
            }

            const lobby = await findElement(page, SELECTORS.lobby, 1000);
            if (lobby) {
                console.log('[Teams] In lobby, waiting...');
            }

            const ended = await findElement(page, SELECTORS.meetingEnded, 1000);
            if (ended) {
                return { success: false, error: 'Meeting ended or access denied' };
            }

            await page.waitForTimeout(2000);
        }

        return { success: false, error: `Timed out waiting to join (${config.BOT_JOIN_TIMEOUT}s)` };

    } catch (err) {
        console.error('[Teams] Join error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function isMeetingEnded(page) {
    try {
        const ended = await findElement(page, SELECTORS.meetingEnded, 1000);
        return !!ended;
    } catch {
        return false;
    }
}

export async function getParticipantCount(page) {
    return -1;
}
