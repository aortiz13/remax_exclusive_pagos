/**
 * Google Meet — Join Flow (v2)
 * Handles joining a Google Meet as an anonymous user
 * Fixed: dismisses cookie banners and overlay dialogs that block clicks
 */

import { config } from '../config.js';

// Selectors grouped for easy maintenance when Google updates their UI
const SELECTORS = {
    // Cookie / consent banners that block everything
    cookieDismiss: [
        'button[aria-label="Accept all"]',
        'button[aria-label="Aceptar todo"]',
        'button[aria-label="Reject all"]',
        'button[aria-label="Rechazar todo"]',
        'button:has-text("Accept all")',
        'button:has-text("Aceptar todo")',
        'button:has-text("Rechazar todo")',
        'button:has-text("Reject all")',
        'button:has-text("Got it")',
        'button:has-text("Entendido")',
        'button:has-text("I agree")',
        'button:has-text("Acepto")',
        '[aria-label="Dismiss"]',
        '[aria-label="Cerrar"]',
    ],

    // "Continue without signing in" / guest prompts
    continueAsGuest: [
        'button:has-text("Continue without signing in")',
        'button:has-text("Continuar sin cuenta")',
        'button:has-text("Continuar sin iniciar sesión")',
        'button:has-text("Continue as guest")',
        'a:has-text("Continue without signing in")',
        'a:has-text("Continuar sin cuenta")',
    ],

    // Pre-join screen name input
    nameInput: [
        'input[aria-label="Tu nombre"]',
        'input[aria-label="Your name"]',
        'input[placeholder*="nombre"]',
        'input[placeholder*="name"]',
        'input[type="text"][jsname]',
    ],

    // Join button variants
    joinButton: [
        'button[jsname="Qx7uuf"]',
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
        '[data-meeting-title]',
        'div[data-allocation-index]',
        '[aria-label*="Presentación"]',
        '[aria-label*="Presentation"]',
        // Meeting controls visible = we're in
        '[aria-label*="Leave call"]',
        '[aria-label*="Salir de la llamada"]',
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
 * Dismiss ALL overlays — cookie banners, consent dialogs, etc.
 */
async function dismissOverlays(page) {
    console.log('[GoogleMeet] Dismissing overlays...');
    let dismissed = 0;

    // 1. Try cookie consent buttons
    for (const selector of SELECTORS.cookieDismiss) {
        try {
            const el = await page.$(selector);
            if (el) {
                await el.click({ force: true });
                dismissed++;
                console.log(`[GoogleMeet] Dismissed overlay: ${selector}`);
                await page.waitForTimeout(500);
            }
        } catch { }
    }

    // 2. Try clicking the cookie consent via JS (Google's cookie iframe)
    try {
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const consentBtn = await frame.$('button#L2AGLb, button[aria-label="Accept all"]');
                if (consentBtn) {
                    await consentBtn.click({ force: true });
                    dismissed++;
                    console.log('[GoogleMeet] Dismissed cookie consent in iframe');
                    await page.waitForTimeout(1000);
                }
            } catch { }
        }
    } catch { }

    // 3. Remove any blocking overlays via JavaScript
    try {
        await page.evaluate(() => {
            // Remove cookie consent banners
            document.querySelectorAll('[aria-modal="true"], .consent-bump, .qqtRac, .gws-adscontrol').forEach(el => {
                el.remove();
            });
            // Remove any fixed/absolute overlays that might block interaction
            document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]').forEach(el => {
                if (el.style.zIndex > 100 && !el.querySelector('input') && !el.querySelector('[data-self-name]')) {
                    el.remove();
                }
            });
        });
    } catch { }

    // 4. Handle "Continue without signing in"
    for (const selector of SELECTORS.continueAsGuest) {
        try {
            const el = await page.$(selector);
            if (el) {
                await el.click({ force: true });
                dismissed++;
                console.log('[GoogleMeet] Clicked "Continue without signing in"');
                await page.waitForTimeout(2000);
            }
        } catch { }
    }

    console.log(`[GoogleMeet] Dismissed ${dismissed} overlay(s)`);
    return dismissed;
}

/**
 * Click an element using JavaScript (bypasses overlay interception)
 */
async function jsClick(page, element) {
    await page.evaluate(el => {
        el.scrollIntoView({ block: 'center' });
        el.click();
    }, element);
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
        await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(4000); // Let the page fully render

        // === STEP 1: Dismiss ALL overlays (cookies, consent, etc.) ===
        await dismissOverlays(page);
        await page.waitForTimeout(1000);

        // Dismiss again after wait (some appear delayed)
        await dismissOverlays(page);

        // === STEP 2: Try to turn off camera and mic BEFORE joining ===
        console.log('[GoogleMeet] Turning off camera and microphone...');
        try {
            const micBtn = await findElement(page, SELECTORS.micToggle, 3000);
            if (micBtn) {
                const ariaLabel = await micBtn.getAttribute('aria-label') || '';
                // If mic is ON (label says "turn off"), click to mute
                if (ariaLabel.toLowerCase().includes('desactivar') || ariaLabel.toLowerCase().includes('turn off')) {
                    await jsClick(page, micBtn);
                    await page.waitForTimeout(300);
                }
            }
        } catch { }

        try {
            const camBtn = await findElement(page, SELECTORS.camToggle, 3000);
            if (camBtn) {
                const ariaLabel = await camBtn.getAttribute('aria-label') || '';
                if (ariaLabel.toLowerCase().includes('desactivar') || ariaLabel.toLowerCase().includes('turn off')) {
                    await jsClick(page, camBtn);
                    await page.waitForTimeout(300);
                }
            }
        } catch { }

        // === STEP 3: Enter the bot name ===
        console.log(`[GoogleMeet] Entering name: "${botName}"`);
        const nameInput = await findElement(page, SELECTORS.nameInput, 10000);
        if (nameInput) {
            await nameInput.click({ force: true, clickCount: 3 });
            await nameInput.fill(botName);
            await page.waitForTimeout(500);
            console.log('[GoogleMeet] Name entered successfully');
        } else {
            console.log('[GoogleMeet] Name input not found — may already have a name set');
        }

        // === STEP 4: Click join button ===
        console.log('[GoogleMeet] Clicking join button...');
        
        // Try strategy 1: find via selectors and force-click
        let joined = false;
        const joinBtn = await findElement(page, SELECTORS.joinButton, 10000);
        if (joinBtn) {
            try {
                await joinBtn.click({ force: true, timeout: 5000 });
                joined = true;
                console.log('[GoogleMeet] Join button clicked (force)');
            } catch {
                // Strategy 2: JS click
                try {
                    await jsClick(page, joinBtn);
                    joined = true;
                    console.log('[GoogleMeet] Join button clicked (JS)');
                } catch (e2) {
                    console.log('[GoogleMeet] JS click also failed:', e2.message);
                }
            }
        }

        // Strategy 3: Find any button with join-like text
        if (!joined) {
            console.log('[GoogleMeet] Trying button text search...');
            const allButtons = await page.$$('button');
            for (const btn of allButtons) {
                try {
                    const text = await btn.textContent();
                    if (text && (
                        text.includes('Unir') || text.includes('Join') ||
                        text.includes('Solicitar') || text.includes('Pedir') ||
                        text.includes('Ask to')
                    )) {
                        await page.evaluate(el => el.click(), btn);
                        joined = true;
                        console.log(`[GoogleMeet] Clicked button with text: "${text.trim()}"`);
                        break;
                    }
                } catch { }
            }
        }

        // Strategy 4: Press Enter (sometimes works on the name input)
        if (!joined) {
            console.log('[GoogleMeet] Trying Enter key...');
            await page.keyboard.press('Enter');
            joined = true;
        }

        if (!joined) {
            return { success: false, error: 'Join button not found' };
        }

        console.log('[GoogleMeet] Waiting to be admitted...');

        // === STEP 5: Wait to be admitted ===
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
