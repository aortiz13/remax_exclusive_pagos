/**
 * Google Meet — Join Flow (v4)
 * Handles joining a Google Meet as an anonymous user
 * - Detects "can't join" immediately and retries until organizer is present
 * - Dismisses overlays, uses force clicks and JS fallbacks
 */

import { config } from '../config.js';

const SELECTORS = {
    cookieDismiss: [
        'button[aria-label="Accept all"]',
        'button[aria-label="Aceptar todo"]',
        'button:has-text("Accept all")',
        'button:has-text("Aceptar todo")',
        'button:has-text("Rechazar todo")',
        'button:has-text("Reject all")',
        'button:has-text("Got it")',
        'button:has-text("Entendido")',
    ],

    continueAsGuest: [
        'button:has-text("Continue without signing in")',
        'button:has-text("Continuar sin cuenta")',
        'button:has-text("Continuar sin iniciar sesión")',
    ],

    nameInput: [
        'input[aria-label="Tu nombre"]',
        'input[aria-label="Your name"]',
        'input[aria-label="Ingresa tu nombre"]',
        'input[aria-label="Enter your name"]',
        'input[placeholder*="nombre"]',
        'input[placeholder*="name"]',
        'input[type="text"][jsname]',
    ],

    joinButton: [
        'button[jsname="Qx7uuf"]',
        'button:has-text("Solicitar unirse")',
        'button:has-text("Pedir unirse")',
        'button:has-text("Ask to join")',
        'button:has-text("Join now")',
        'button:has-text("Unirme")',
        'button:has-text("Participar")',
        '[aria-label*="Solicitar unirse"]',
        '[aria-label*="Ask to join"]',
        '[aria-label*="Join now"]',
    ],

    inMeeting: [
        '[data-self-name]',
        '[data-meeting-title]',
        'div[data-allocation-index]',
        '[aria-label*="Leave call"]',
        '[aria-label*="Salir de la llamada"]',
    ],

    meetingEnded: [
        'div:has-text("has salido de la reunión")',
        'div:has-text("You left the meeting")',
        'div:has-text("La videollamada ha finalizado")',
        'div:has-text("The video call has ended")',
    ],

    micToggle: [
        '[aria-label*="micrófono"]',
        '[aria-label*="microphone"]',
    ],
    camToggle: [
        '[aria-label*="cámara"]',
        '[aria-label*="camera"]',
    ],
    participantCount: [
        '[aria-label*="participante"]',
        '[aria-label*="participant"]',
    ],
};

// Texts that indicate we can't join (organizer not present or meeting ended)
const BLOCKED_TEXTS = [
    'no puedes unirte',
    "can't join",
    'no se puede unir',
    'esta reunión no existe',
    "this meeting doesn't exist",
    'no tiene permiso',
    'not allowed',
];

async function findElement(page, selectorList, timeout = 5000) {
    for (const selector of selectorList) {
        try {
            const el = await page.waitForSelector(selector, { timeout: Math.min(timeout, 2000) });
            if (el) return el;
        } catch { }
    }
    return null;
}

/**
 * Check if the page is showing a "can't join" message
 */
async function isBlockedPage(page) {
    try {
        const text = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '');
        for (const blocked of BLOCKED_TEXTS) {
            if (text.includes(blocked)) return true;
        }
    } catch { }
    return false;
}

/**
 * Check if we're on the pre-join screen (has name input or join button)
 */
async function isPreJoinScreen(page) {
    const nameInput = await findElement(page, SELECTORS.nameInput, 2000);
    if (nameInput) return true;
    const joinBtn = await findElement(page, SELECTORS.joinButton, 2000);
    return !!joinBtn;
}

async function dismissOverlays(page) {
    let dismissed = 0;
    for (const selector of SELECTORS.cookieDismiss) {
        try {
            const el = await page.$(selector);
            if (el) { await el.click({ force: true }); dismissed++; await page.waitForTimeout(500); }
        } catch { }
    }
    try {
        for (const frame of page.frames()) {
            try {
                const btn = await frame.$('button#L2AGLb, button[aria-label="Accept all"]');
                if (btn) { await btn.click({ force: true }); dismissed++; await page.waitForTimeout(1000); }
            } catch { }
        }
    } catch { }
    try {
        await page.evaluate(() => {
            document.querySelectorAll('[aria-modal="true"], .consent-bump').forEach(el => el.remove());
        });
    } catch { }
    for (const selector of SELECTORS.continueAsGuest) {
        try {
            const el = await page.$(selector);
            if (el) { await el.click({ force: true }); dismissed++; await page.waitForTimeout(2000); }
        } catch { }
    }
    return dismissed;
}

async function jsClick(page, element) {
    await page.evaluate(el => { el.scrollIntoView({ block: 'center' }); el.click(); }, element);
}

/**
 * Join a Google Meet meeting
 * Retries up to MAX_RETRIES if the organizer hasn't started the meeting yet
 */
export async function joinGoogleMeet(page, meetingUrl, botName = config.BOT_DISPLAY_NAME) {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 30000; // 30 seconds between retries

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`\n[GoogleMeet] === Attempt ${attempt}/${MAX_RETRIES} ===`);
        console.log(`[GoogleMeet] Navigating to ${meetingUrl}...`);

        try {
            await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(5000);

            // Check for sign-in redirect
            if (page.url().includes('accounts.google.com')) {
                console.log('[GoogleMeet] Redirected to sign-in, retrying URL...');
                await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(5000);
            }

            // === CHECK: Is the meeting accessible? ===
            const blocked = await isBlockedPage(page);
            if (blocked) {
                const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '');
                console.log(`[GoogleMeet] ⚠️ Meeting not available: "${bodyText.replace(/\n/g, ' ').trim()}"`);

                if (attempt < MAX_RETRIES) {
                    console.log(`[GoogleMeet] Will retry in ${RETRY_DELAY_MS / 1000}s (organizer may not have joined yet)`);
                    await page.waitForTimeout(RETRY_DELAY_MS);
                    continue;
                } else {
                    return { success: false, error: 'Meeting not accessible. Make sure the organizer is in the meeting before sending the bot.' };
                }
            }

            // === CHECK: Are we on the pre-join screen? ===
            const preJoin = await isPreJoinScreen(page);
            if (!preJoin) {
                console.log('[GoogleMeet] Not on pre-join screen, logging page state...');
                const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
                console.log(`[GoogleMeet] Page text: ${bodyText.replace(/\n/g, ' ').substring(0, 200)}`);

                if (attempt < MAX_RETRIES) {
                    console.log(`[GoogleMeet] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                    await page.waitForTimeout(RETRY_DELAY_MS);
                    continue;
                }
                return { success: false, error: 'Could not reach pre-join screen' };
            }

            console.log('[GoogleMeet] ✅ Pre-join screen detected');

            // === Dismiss overlays ===
            await dismissOverlays(page);
            await page.waitForTimeout(1000);
            await dismissOverlays(page);

            // === Turn off mic and camera ===
            try {
                const micBtn = await findElement(page, SELECTORS.micToggle, 3000);
                if (micBtn) {
                    const aria = await micBtn.getAttribute('aria-label') || '';
                    if (aria.toLowerCase().includes('desactivar') || aria.toLowerCase().includes('turn off')) {
                        await jsClick(page, micBtn);
                        await page.waitForTimeout(300);
                        console.log('[GoogleMeet] Mic muted');
                    }
                }
            } catch { }
            try {
                const camBtn = await findElement(page, SELECTORS.camToggle, 3000);
                if (camBtn) {
                    const aria = await camBtn.getAttribute('aria-label') || '';
                    if (aria.toLowerCase().includes('desactivar') || aria.toLowerCase().includes('turn off')) {
                        await jsClick(page, camBtn);
                        await page.waitForTimeout(300);
                        console.log('[GoogleMeet] Camera off');
                    }
                }
            } catch { }

            // === Enter bot name ===
            console.log(`[GoogleMeet] Entering name: "${botName}"`);
            const nameInput = await findElement(page, SELECTORS.nameInput, 8000);
            if (nameInput) {
                await nameInput.click({ force: true, clickCount: 3 });
                await nameInput.fill(botName);
                await page.waitForTimeout(500);
                console.log('[GoogleMeet] ✅ Name entered');
            } else {
                console.log('[GoogleMeet] Name input not found (may have default)');
            }

            // === Click join button ===
            console.log('[GoogleMeet] Clicking join button...');
            let joined = false;

            // Strategy 1: selector match + force click
            const joinBtn = await findElement(page, SELECTORS.joinButton, 8000);
            if (joinBtn) {
                try {
                    await joinBtn.click({ force: true, timeout: 5000 });
                    joined = true;
                    console.log('[GoogleMeet] ✅ Join clicked (force)');
                } catch {
                    try { await jsClick(page, joinBtn); joined = true; console.log('[GoogleMeet] ✅ Join clicked (JS)'); } catch { }
                }
            }

            // Strategy 2: text search (only join-like buttons, skip "Volver")
            if (!joined) {
                const joinTexts = ['Solicitar', 'Pedir', 'Ask to', 'Join', 'Unirme', 'Participar'];
                const skipTexts = ['Volver', 'Enviar', 'Comentarios', 'feedback'];
                const allButtons = await page.$$('button');
                for (const btn of allButtons) {
                    try {
                        const text = await btn.textContent();
                        const isVisible = await btn.isVisible();
                        if (!text || !isVisible) continue;
                        const shouldSkip = skipTexts.some(s => text.includes(s));
                        if (shouldSkip) continue;
                        if (joinTexts.some(t => text.includes(t))) {
                            await page.evaluate(el => el.click(), btn);
                            joined = true;
                            console.log(`[GoogleMeet] ✅ Clicked: "${text.trim()}"`);
                            break;
                        }
                    } catch { }
                }
            }

            // Strategy 3: Enter key
            if (!joined) {
                await page.keyboard.press('Enter');
                joined = true;
                console.log('[GoogleMeet] Pressed Enter as fallback');
            }

            // === Wait to be admitted ===
            console.log('[GoogleMeet] Waiting to be admitted by the host...');
            await page.waitForTimeout(3000);

            const joinTimeout = config.BOT_JOIN_TIMEOUT * 1000;
            const startWait = Date.now();

            while (Date.now() - startWait < joinTimeout) {
                const elapsed = Math.round((Date.now() - startWait) / 1000);

                // Check if in meeting
                const inMeeting = await findElement(page, SELECTORS.inMeeting, 3000);
                if (inMeeting) {
                    console.log('[GoogleMeet] ✅ Successfully joined the meeting!');
                    return { success: true };
                }

                // Check if meeting ended
                const ended = await findElement(page, SELECTORS.meetingEnded, 1000);
                if (ended) {
                    return { success: false, error: 'Meeting ended or join request denied' };
                }

                // Check if kicked back to blocked page
                const blockedAgain = await isBlockedPage(page);
                if (blockedAgain) {
                    console.log('[GoogleMeet] ⚠️ Got kicked back to blocked page');
                    if (attempt < MAX_RETRIES) {
                        console.log(`[GoogleMeet] Will retry in ${RETRY_DELAY_MS / 1000}s...`);
                        await page.waitForTimeout(RETRY_DELAY_MS);
                        break; // Break wait loop, retry outer loop
                    }
                    return { success: false, error: 'Join request was denied' };
                }

                if (elapsed % 30 === 0 && elapsed > 0) {
                    console.log(`[GoogleMeet] Still in lobby... (${elapsed}s)`);
                }

                await page.waitForTimeout(2000);
            }

            // If we got here from a blocked-retry break, continue to next attempt
            const blockedCheck = await isBlockedPage(page);
            if (blockedCheck && attempt < MAX_RETRIES) continue;

            // Timeout
            if (attempt === MAX_RETRIES) {
                return { success: false, error: `Timed out waiting to be admitted (${config.BOT_JOIN_TIMEOUT}s)` };
            }

        } catch (err) {
            console.error(`[GoogleMeet] Error on attempt ${attempt}:`, err.message);
            if (attempt === MAX_RETRIES) {
                return { success: false, error: err.message };
            }
            console.log(`[GoogleMeet] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await page.waitForTimeout(RETRY_DELAY_MS);
        }
    }

    return { success: false, error: 'Max retries exceeded' };
}

export async function isMeetingEnded(page) {
    try {
        const ended = await findElement(page, SELECTORS.meetingEnded, 1000);
        return !!ended;
    } catch { return false; }
}

export async function getParticipantCount(page) {
    try {
        const countEl = await findElement(page, SELECTORS.participantCount, 2000);
        if (countEl) {
            const text = await countEl.textContent();
            const match = text?.match(/(\d+)/);
            return match ? parseInt(match[1]) : -1;
        }
        return -1;
    } catch { return -1; }
}
