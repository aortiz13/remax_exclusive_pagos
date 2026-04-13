/**
 * Google Meet — Join Flow
 * Handles joining a Google Meet as an anonymous user
 */

import { config } from '../config.js';

// Selectors grouped for easy maintenance when Google updates their UI
const SELECTORS = {
    // Pre-join screen
    nameInput: [
        'input[aria-label="Tu nombre"]',
        'input[aria-label="Your name"]',
        'input[placeholder*="nombre"]',
        'input[placeholder*="name"]',
        'input[type="text"][jsname]',
    ],

    // Join button variants
    joinButton: [
        'button[data-is-touch-wrapper] span',
        '[aria-label*="Solicitar unirse"]',
        '[aria-label*="Ask to join"]',
        '[aria-label*="Unirme"]',
        '[aria-label*="Join now"]',
        'button:has-text("Solicitar unirse")',
        'button:has-text("Pedir unirse")',
        'button:has-text("Ask to join")',
        'button:has-text("Join now")',
        'button:has-text("Unirme")',
    ],

    // Waiting / admitted indicators
    inMeeting: [
        '[data-self-name]',
        '[aria-label*="Presentación"]',
        '[aria-label*="Presentation"]',
        'div[data-allocation-index]',
        '[data-meeting-title]',
    ],

    // Meeting ended
    meetingEnded: [
        'div:has-text("has salido de la reunión")',
        'div:has-text("You left the meeting")',
        'div:has-text("La videollamada ha finalizado")',
        'div:has-text("The video call has ended")',
        'div:has-text("Regresa a la pantalla de inicio")',
        'div:has-text("Return to home screen")',
    ],

    // Camera/Mic toggle buttons
    micToggle: [
        '[aria-label*="micrófono"]',
        '[aria-label*="microphone"]',
        '[data-tooltip*="micrófono"]',
        '[data-tooltip*="microphone"]',
    ],
    camToggle: [
        '[aria-label*="cámara"]',
        '[aria-label*="camera"]',
        '[data-tooltip*="cámara"]',
        '[data-tooltip*="camera"]',
    ],

    // Participant count
    participantCount: [
        '[aria-label*="participante"]',
        '[aria-label*="participant"]',
        'span[jsname]:has-text(" / ")',
    ],
};

/**
 * Find the first matching element from a list of selectors
 */
async function findElement(page, selectorList, timeout = 5000) {
    for (const selector of selectorList) {
        try {
            const el = await page.waitForSelector(selector, { timeout: Math.min(timeout, 2000) });
            if (el) return el;
        } catch {
            // Try next selector
        }
    }
    return null;
}

/**
 * Join a Google Meet meeting
 * @param {import('playwright').Page} page - Playwright page
 * @param {string} meetingUrl - Google Meet URL
 * @param {string} botName - Display name for the bot
 * @returns {{ success: boolean, error?: string }}
 */
export async function joinGoogleMeet(page, meetingUrl, botName = config.BOT_DISPLAY_NAME) {
    console.log(`[GoogleMeet] Navigating to ${meetingUrl}...`);

    try {
        // Navigate to the meeting
        await page.goto(meetingUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000); // Let the page fully render

        // Check if we need to dismiss any "Sign in" or "Continue without signing in" prompts
        const continueWithoutSignIn = await page.$('button:has-text("Continue without signing in")');
        const continuarSinCuenta = await page.$('button:has-text("Continuar sin cuenta")');
        if (continueWithoutSignIn) {
            await continueWithoutSignIn.click();
            await page.waitForTimeout(2000);
        } else if (continuarSinCuenta) {
            await continuarSinCuenta.click();
            await page.waitForTimeout(2000);
        }

        // Try to turn off camera and mic BEFORE joining
        console.log('[GoogleMeet] Turning off camera and microphone...');
        const micBtn = await findElement(page, SELECTORS.micToggle, 3000);
        if (micBtn) {
            const isOn = await micBtn.getAttribute('data-is-muted');
            if (isOn !== 'true') {
                await micBtn.click();
                await page.waitForTimeout(500);
            }
        }

        const camBtn = await findElement(page, SELECTORS.camToggle, 3000);
        if (camBtn) {
            const isOn = await camBtn.getAttribute('data-is-muted');
            if (isOn !== 'true') {
                await camBtn.click();
                await page.waitForTimeout(500);
            }
        }

        // Enter the bot name
        console.log(`[GoogleMeet] Entering name: "${botName}"`);
        const nameInput = await findElement(page, SELECTORS.nameInput, 10000);
        if (nameInput) {
            await nameInput.click({ clickCount: 3 }); // Select all
            await nameInput.fill(botName);
            await page.waitForTimeout(500);
        } else {
            console.log('[GoogleMeet] Name input not found — may already have a name set');
        }

        // Click join button
        console.log('[GoogleMeet] Clicking join button...');
        const joinBtn = await findElement(page, SELECTORS.joinButton, 10000);
        if (!joinBtn) {
            // Try clicking any button that looks like join
            const allButtons = await page.$$('button');
            let clicked = false;
            for (const btn of allButtons) {
                const text = await btn.textContent();
                if (text && (text.includes('Unir') || text.includes('Join') || text.includes('Solicitar') || text.includes('Pedir'))) {
                    await btn.click();
                    clicked = true;
                    break;
                }
            }
            if (!clicked) {
                return { success: false, error: 'Join button not found' };
            }
        } else {
            await joinBtn.click();
        }

        console.log('[GoogleMeet] Waiting to be admitted...');

        // Wait to be admitted (up to JOIN_TIMEOUT)
        const joinTimeout = config.BOT_JOIN_TIMEOUT * 1000;
        const startWait = Date.now();

        while (Date.now() - startWait < joinTimeout) {
            // Check if we're in the meeting
            const inMeeting = await findElement(page, SELECTORS.inMeeting, 3000);
            if (inMeeting) {
                console.log('[GoogleMeet] ✅ Successfully joined the meeting!');
                return { success: true };
            }

            // Check if meeting has ended or been rejected
            const ended = await findElement(page, SELECTORS.meetingEnded, 1000);
            if (ended) {
                return { success: false, error: 'Meeting has ended or request was denied' };
            }

            await page.waitForTimeout(2000);
        }

        return { success: false, error: `Timed out waiting to be admitted (${config.BOT_JOIN_TIMEOUT}s)` };

    } catch (err) {
        console.error('[GoogleMeet] Join error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Check if the meeting has ended
 */
export async function isMeetingEnded(page) {
    try {
        const ended = await findElement(page, SELECTORS.meetingEnded, 1000);
        return !!ended;
    } catch {
        return false;
    }
}

/**
 * Get the number of participants currently in the meeting
 */
export async function getParticipantCount(page) {
    try {
        // Try to extract participant count from the UI
        const countEl = await findElement(page, SELECTORS.participantCount, 2000);
        if (countEl) {
            const text = await countEl.textContent();
            const match = text?.match(/(\d+)/);
            return match ? parseInt(match[1]) : -1;
        }
        return -1;
    } catch {
        return -1;
    }
}
