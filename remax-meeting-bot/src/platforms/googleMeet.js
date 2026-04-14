/**
 * Google Meet — Join Flow (v5 — Authenticated)
 * Handles joining Google Meet with a saved Google session
 * When authenticated, Google Meet shows a different pre-join screen:
 * - No name input needed (uses Google account name)
 * - Join button might say "Unirse ahora" instead of "Solicitar unirse"
 */

import { config } from '../config.js';

const SELECTORS = {
    cookieDismiss: [
        'button[aria-label="Accept all"]',
        'button[aria-label="Aceptar todo"]',
        'button:has-text("Accept all")',
        'button:has-text("Aceptar todo")',
        'button:has-text("Rechazar todo")',
        'button:has-text("Got it")',
        'button:has-text("Entendido")',
    ],

    // Join buttons — both anonymous and authenticated flows
    joinButton: [
        // Authenticated (same organization)
        'button:has-text("Unirse ahora")',
        'button:has-text("Join now")',
        '[aria-label*="Unirse ahora"]',
        '[aria-label*="Join now"]',
        // Anonymous / external
        'button:has-text("Solicitar unirse")',
        'button:has-text("Pedir unirse")',
        'button:has-text("Ask to join")',
        '[aria-label*="Solicitar unirse"]',
        '[aria-label*="Ask to join"]',
        // Generic
        'button:has-text("Unirme")',
        'button:has-text("Participar")',
        'button[jsname="Qx7uuf"]',
    ],

    nameInput: [
        'input[aria-label="Tu nombre"]',
        'input[aria-label="Your name"]',
        'input[aria-label="Ingresa tu nombre"]',
        'input[aria-label="Enter your name"]',
        'input[placeholder*="nombre"]',
        'input[placeholder*="name"]',
    ],

    micToggle: [
        '[aria-label*="micrófono"]',
        '[aria-label*="microphone"]',
    ],
    camToggle: [
        '[aria-label*="cámara"]',
        '[aria-label*="camera"]',
    ],

    inMeeting: [
        '[data-self-name]',
        '[data-meeting-title]',
        'div[data-allocation-index]',
        '[aria-label*="Leave call"]',
        '[aria-label*="Salir de la llamada"]',
        '[aria-label*="Salir"]',
        'button[aria-label*="call_end"]',
        // Text-based selectors (from real Google Meet DOM)
        'button:has-text("call_end")',
        'button:has-text("chat_bubble")',
        '[aria-label*="chat"]',
        '[aria-label*="Chat"]',
        // The "info" button only appears in-meeting
        'button:has-text("infoinfo")',
    ],

    meetingEnded: [
        'div:has-text("has salido de la reunión")',
        'div:has-text("You left the meeting")',
        'div:has-text("La videollamada ha finalizado")',
        'div:has-text("The video call has ended")',
    ],

    participantCount: [
        '[aria-label*="participante"]',
        '[aria-label*="participant"]',
    ],
};

// Texts that indicate the meeting is not accessible
const BLOCKED_TEXTS = [
    'no puedes unirte',
    "can't join",
    'no se puede unir',
    'esta reunión no existe',
    "this meeting doesn't exist",
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

async function isBlockedPage(page) {
    try {
        const text = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '');
        for (const blocked of BLOCKED_TEXTS) {
            if (text.includes(blocked)) return true;
        }
    } catch { }
    return false;
}

async function dismissOverlays(page) {
    let dismissed = 0;
    for (const selector of SELECTORS.cookieDismiss) {
        try {
            const el = await page.$(selector);
            if (el) { await el.click({ force: true }); dismissed++; await page.waitForTimeout(500); }
        } catch { }
    }
    // Iframe cookie consent
    try {
        for (const frame of page.frames()) {
            try {
                const btn = await frame.$('button#L2AGLb, button[aria-label="Accept all"]');
                if (btn) { await btn.click({ force: true }); dismissed++; await page.waitForTimeout(1000); }
            } catch { }
        }
    } catch { }
    // Remove modal overlays
    try {
        await page.evaluate(() => {
            document.querySelectorAll('[aria-modal="true"], .consent-bump').forEach(el => el.remove());
        });
    } catch { }
    return dismissed;
}

async function jsClick(page, element) {
    await page.evaluate(el => { el.scrollIntoView({ block: 'center' }); el.click(); }, element);
}

/**
 * Log page diagnostics
 */
async function logPageState(page, label) {
    try {
        const url = page.url();
        const title = await page.title();
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '(empty)');
        console.log(`[Diag:${label}] URL: ${url}`);
        console.log(`[Diag:${label}] Title: ${title}`);
        console.log(`[Diag:${label}] Text: ${bodyText.replace(/\n/g, ' ').substring(0, 200)}`);

        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button'))
                .filter(b => b.offsetParent !== null)
                .map(b => b.textContent?.trim()?.substring(0, 40))
                .filter(Boolean);
        });
        console.log(`[Diag:${label}] Visible buttons: ${JSON.stringify(buttons)}`);
    } catch (err) {
        console.log(`[Diag:${label}] Error: ${err.message}`);
    }
}

/**
 * Join a Google Meet meeting (authenticated or anonymous)
 */
export async function joinGoogleMeet(page, meetingUrl, botName = config.BOT_DISPLAY_NAME) {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 30000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`\n[GoogleMeet] === Attempt ${attempt}/${MAX_RETRIES} ===`);
        console.log(`[GoogleMeet] Navigating to ${meetingUrl}...`);

        try {
            await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(5000);

            // === Check if blocked ===
            const blocked = await isBlockedPage(page);
            if (blocked) {
                await logPageState(page, 'blocked');
                if (attempt < MAX_RETRIES) {
                    console.log(`[GoogleMeet] ⚠️ Meeting not available. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                    await page.waitForTimeout(RETRY_DELAY_MS);
                    continue;
                }
                return { success: false, error: 'No se puede unir. Asegúrate de estar en la reunión como organizador.' };
            }

            // === Log what we see ===
            await logPageState(page, 'loaded');

            // === Dismiss overlays ===
            await dismissOverlays(page);
            await page.waitForTimeout(1000);
            await dismissOverlays(page);

            // === Turn off mic and camera ===
            try {
                const micBtn = await findElement(page, SELECTORS.micToggle, 3000);
                if (micBtn) {
                    const aria = await micBtn.getAttribute('aria-label') || '';
                    if (aria.toLowerCase().includes('desactivar') || aria.toLowerCase().includes('turn off') || aria.toLowerCase().includes('activado')) {
                        await jsClick(page, micBtn);
                        await page.waitForTimeout(300);
                        console.log('[GoogleMeet] 🔇 Mic muted');
                    }
                }
            } catch { }
            try {
                const camBtn = await findElement(page, SELECTORS.camToggle, 3000);
                if (camBtn) {
                    const aria = await camBtn.getAttribute('aria-label') || '';
                    if (aria.toLowerCase().includes('desactivar') || aria.toLowerCase().includes('turn off') || aria.toLowerCase().includes('activada')) {
                        await jsClick(page, camBtn);
                        await page.waitForTimeout(300);
                        console.log('[GoogleMeet] 📷 Camera off');
                    }
                }
            } catch { }

            // === Enter bot name (only if input exists — anonymous flow) ===
            const nameInput = await findElement(page, SELECTORS.nameInput, 3000);
            if (nameInput) {
                console.log(`[GoogleMeet] Name input found → entering "${botName}"`);
                await nameInput.click({ force: true, clickCount: 3 });
                await nameInput.fill(botName);
                await page.waitForTimeout(500);
            } else {
                console.log('[GoogleMeet] No name input → authenticated flow (using Google account name)');
            }

            // === Disable mic and camera before joining (human-like behavior) ===
            console.log('[GoogleMeet] Disabling mic/camera before joining...');
            try {
                await page.keyboard.press('Control+d'); // Mute mic
                await page.waitForTimeout(300 + Math.random() * 500);
                await page.keyboard.press('Control+e'); // Disable camera
                await page.waitForTimeout(300 + Math.random() * 500);
            } catch { }

            // === Click join button ===
            console.log('[GoogleMeet] Looking for join button...');
            // Small human-like delay before clicking
            await page.waitForTimeout(1000 + Math.random() * 2000);
            let joined = false;

            // Strategy 1: selector match
            const joinBtn = await findElement(page, SELECTORS.joinButton, 8000);
            if (joinBtn) {
                const btnText = await joinBtn.textContent() || '';
                try {
                    await joinBtn.click({ force: true, timeout: 5000 });
                    joined = true;
                    console.log(`[GoogleMeet] ✅ Clicked: "${btnText.trim()}"`);
                } catch {
                    try { await jsClick(page, joinBtn); joined = true; console.log(`[GoogleMeet] ✅ JS clicked: "${btnText.trim()}"`); } catch { }
                }
            }

            // Strategy 2: text search (skip non-join buttons)
            if (!joined) {
                const joinTexts = ['Solicitar', 'Pedir', 'Ask to', 'Join', 'Unir', 'Participar'];
                const skipTexts = ['Volver', 'Enviar', 'Comentarios', 'feedback', 'Cancelar', 'Salir'];
                const allButtons = await page.$$('button');
                for (const btn of allButtons) {
                    try {
                        const text = await btn.textContent();
                        const isVisible = await btn.isVisible();
                        if (!text || !isVisible) continue;
                        if (skipTexts.some(s => text.includes(s))) continue;
                        if (joinTexts.some(t => text.includes(t))) {
                            await page.evaluate(el => el.click(), btn);
                            joined = true;
                            console.log(`[GoogleMeet] ✅ Text-matched: "${text.trim()}"`);
                            break;
                        }
                    } catch { }
                }
            }

            // Strategy 3: Enter key
            if (!joined) {
                await page.keyboard.press('Enter');
                joined = true;
                console.log('[GoogleMeet] Pressed Enter (fallback)');
            }

            // === Wait to enter meeting ===
            console.log('[GoogleMeet] Waiting to enter meeting...');
            await page.waitForTimeout(3000);
            await logPageState(page, 'after_join');

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
                    return { success: false, error: 'Meeting ended or join denied' };
                }

                // Check if blocked
                const blockedAgain = await isBlockedPage(page);
                if (blockedAgain) {
                    if (attempt < MAX_RETRIES) break;
                    return { success: false, error: 'Join request denied' };
                }

                // Check if we're back at the pre-join (request not sent)
                try {
                    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
                    if (pageText.includes('Volviendo a la pantalla')) {
                        if (attempt < MAX_RETRIES) break;
                        return { success: false, error: 'Redirected to home screen' };
                    }
                } catch { }

                if (elapsed % 30 === 0 && elapsed > 0) {
                    console.log(`[GoogleMeet] Still in lobby... (${elapsed}s)`);
                    await logPageState(page, `lobby_${elapsed}s`);
                }

                await page.waitForTimeout(2000);
            }

            // Check if we should retry
            const blockedCheck = await isBlockedPage(page);
            if (blockedCheck && attempt < MAX_RETRIES) {
                console.log(`[GoogleMeet] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                await page.waitForTimeout(RETRY_DELAY_MS);
                continue;
            }

            if (attempt === MAX_RETRIES) {
                return { success: false, error: `Timeout waiting to be admitted (${config.BOT_JOIN_TIMEOUT}s)` };
            }

        } catch (err) {
            console.error(`[GoogleMeet] Error on attempt ${attempt}:`, err.message);
            if (attempt === MAX_RETRIES) return { success: false, error: err.message };
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
