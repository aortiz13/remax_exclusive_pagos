/**
 * Zoom — Join Flow (Web Client)
 * Joins Zoom meetings via the web client (no desktop app needed)
 */

import { config } from '../config.js';

const SELECTORS = {
    // Join form
    nameInput: [
        '#input-for-name',
        'input[id*="name"]',
        'input[placeholder*="nombre"]',
        'input[placeholder*="name"]',
        'input[type="text"]',
    ],

    // Join button
    joinButton: [
        '.btn-join',
        'button.btn-join',
        '#joinBtn',
        'button:has-text("Join")',
        'button:has-text("Unirse")',
        'button:has-text("Join Meeting")',
    ],

    // Passcode input (just in case)
    passcodeInput: [
        '#input-for-pwd',
        'input[id*="pwd"]',
        'input[type="password"]',
        'input[placeholder*="passcode"]',
        'input[placeholder*="contraseña"]',
    ],

    // Waiting room indicators
    waitingRoom: [
        'div:has-text("waiting for the host")',
        'div:has-text("esperando al anfitrión")',
        'div:has-text("Please wait")',
        '.waiting-room',
    ],

    // In meeting indicators
    inMeeting: [
        '#wc-footer',
        '.meeting-app',
        '[class*="meeting-client"]',
        '#wc-content',
        '.meeting-info-container',
    ],

    // Meeting ended
    meetingEnded: [
        'div:has-text("meeting has been ended")',
        'div:has-text("la reunión ha finalizado")',
        'div:has-text("This meeting has ended")',
        'div:has-text("host has ended")',
        '.meeting-ended',
    ],

    // Audio/Video controls
    muteButton: [
        '[aria-label*="mute"]',
        '[aria-label*="silenciar"]',
        'button.join-audio-by-voip__join-btn',
    ],
    videoButton: [
        '[aria-label*="video"]',
        '[aria-label*="cámara"]',
    ],

    // Web client iframe
    webClientFrame: '#webclient',
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
 * Join a Zoom meeting via web client
 * @param {import('playwright').Page} page
 * @param {string} meetingUrl
 * @param {string} botName
 */
export async function joinZoom(page, meetingUrl, botName = config.BOT_DISPLAY_NAME) {
    console.log(`[Zoom] Navigating to ${meetingUrl}...`);

    try {
        // Extract meeting ID and convert to web client URL
        const match = meetingUrl.match(/(?:zoom\.us\/(?:j|s|wc\/join)\/)(\d+)/i);
        const meetingId = match ? match[1] : null;

        // Parse passcode if present
        const urlObj = new URL(meetingUrl);
        const pwd = urlObj.searchParams.get('pwd');

        // Use web client URL
        let webUrl = meetingId
            ? `https://app.zoom.us/wc/join/${meetingId}`
            : meetingUrl;
        if (pwd) webUrl += `?pwd=${pwd}`;

        await page.goto(webUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Check if there's a "Launch Meeting" page — click "Join from Your Browser"
        const joinFromBrowser = await page.$('a:has-text("Join from Your Browser")');
        const unirseDesdeNavegador = await page.$('a:has-text("Unirse desde el navegador")');
        if (joinFromBrowser) {
            await joinFromBrowser.click();
            await page.waitForTimeout(3000);
        } else if (unirseDesdeNavegador) {
            await unirseDesdeNavegador.click();
            await page.waitForTimeout(3000);
        }

        // Enter name
        console.log(`[Zoom] Entering name: "${botName}"`);
        const nameInput = await findElement(page, SELECTORS.nameInput, 10000);
        if (nameInput) {
            await nameInput.click({ clickCount: 3 });
            await nameInput.fill(botName);
            await page.waitForTimeout(500);
        }

        // Click join
        console.log('[Zoom] Clicking join button...');
        const joinBtn = await findElement(page, SELECTORS.joinButton, 10000);
        if (joinBtn) {
            await joinBtn.click();
        } else {
            // Fallback: find any button with "Join" text
            const btns = await page.$$('button');
            for (const btn of btns) {
                const text = await btn.textContent();
                if (text && (text.includes('Join') || text.includes('Unirse'))) {
                    await btn.click();
                    break;
                }
            }
        }

        await page.waitForTimeout(3000);

        // Handle iframe — Zoom web client uses #webclient iframe
        let meetingFrame = page;
        try {
            const frameEl = await page.waitForSelector(SELECTORS.webClientFrame, { timeout: 5000 });
            if (frameEl) {
                const frame = await frameEl.contentFrame();
                if (frame) meetingFrame = frame;
            }
        } catch {
            // No iframe, continue on main page
        }

        // Wait for meeting to start or waiting room
        console.log('[Zoom] Waiting to join meeting...');
        const joinTimeout = config.BOT_JOIN_TIMEOUT * 1000;
        const startWait = Date.now();

        while (Date.now() - startWait < joinTimeout) {
            // Check if in meeting
            const inMeeting = await findElement(meetingFrame, SELECTORS.inMeeting, 3000);
            if (inMeeting) {
                console.log('[Zoom] ✅ Successfully joined the meeting!');

                // Try to join audio via VoIP
                try {
                    const audioBtn = await findElement(meetingFrame, SELECTORS.muteButton, 5000);
                    if (audioBtn) await audioBtn.click();
                } catch { /* ok */ }

                return { success: true };
            }

            // Check waiting room
            const waiting = await findElement(meetingFrame, SELECTORS.waitingRoom, 1000);
            if (waiting) {
                console.log('[Zoom] In waiting room...');
            }

            // Check ended
            const ended = await findElement(meetingFrame, SELECTORS.meetingEnded, 1000);
            if (ended) {
                return { success: false, error: 'Meeting has ended or access denied' };
            }

            await page.waitForTimeout(2000);
        }

        return { success: false, error: `Timed out waiting to join (${config.BOT_JOIN_TIMEOUT}s)` };

    } catch (err) {
        console.error('[Zoom] Join error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function isMeetingEnded(page) {
    try {
        // Check main page and any iframe
        const ended = await findElement(page, SELECTORS.meetingEnded, 1000);
        return !!ended;
    } catch {
        return false;
    }
}

export async function getParticipantCount(page) {
    return -1; // Zoom web client doesn't easily expose participant count
}
