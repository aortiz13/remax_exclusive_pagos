/**
 * Google Meet — Join Flow (v3)
 * Handles joining a Google Meet as an anonymous user
 * Enhanced diagnostics: logs page URL, title, and HTML snippet on each step
 */

import { config } from '../config.js';

const SELECTORS = {
    // Cookie / consent banners
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

    continueAsGuest: [
        'button:has-text("Continue without signing in")',
        'button:has-text("Continuar sin cuenta")',
        'button:has-text("Continuar sin iniciar sesión")',
        'button:has-text("Continue as guest")',
        'a:has-text("Continue without signing in")',
        'a:has-text("Continuar sin cuenta")',
    ],

    nameInput: [
        'input[aria-label="Tu nombre"]',
        'input[aria-label="Your name"]',
        'input[aria-label="Ingresa tu nombre"]',
        'input[aria-label="Enter your name"]',
        'input[placeholder*="nombre"]',
        'input[placeholder*="name"]',
        'input[type="text"][jsname]',
        'input[data-placeholder*="name"]',
    ],

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
        'button:has-text("Participar")',
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
        'div:has-text("Return to home screen")',
    ],

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

    participantCount: [
        '[aria-label*="participante"]',
        '[aria-label*="participant"]',
    ],
};

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
 * Log diagnostic info about the current page state
 */
async function logPageState(page, label) {
    try {
        const url = page.url();
        const title = await page.title();
        console.log(`[Diag:${label}] URL: ${url}`);
        console.log(`[Diag:${label}] Title: ${title}`);

        // Log all visible text (first 500 chars)
        const bodyText = await page.evaluate(() => {
            return document.body?.innerText?.substring(0, 800) || '(no body text)';
        });
        console.log(`[Diag:${label}] Page text:\n${bodyText}\n---`);

        // Log all buttons on the page
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button')).map(b => ({
                text: b.textContent?.trim()?.substring(0, 50),
                ariaLabel: b.getAttribute('aria-label'),
                visible: b.offsetParent !== null,
            })).filter(b => b.text || b.ariaLabel);
        });
        console.log(`[Diag:${label}] Buttons found (${buttons.length}):`);
        buttons.forEach((b, i) => {
            console.log(`  [${i}] text="${b.text}" aria="${b.ariaLabel}" visible=${b.visible}`);
        });

        // Log all inputs
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(i => ({
                type: i.type,
                placeholder: i.placeholder,
                ariaLabel: i.getAttribute('aria-label'),
                visible: i.offsetParent !== null,
            }));
        });
        console.log(`[Diag:${label}] Inputs found (${inputs.length}):`);
        inputs.forEach((inp, i) => {
            console.log(`  [${i}] type="${inp.type}" placeholder="${inp.placeholder}" aria="${inp.ariaLabel}" visible=${inp.visible}`);
        });
    } catch (err) {
        console.log(`[Diag:${label}] Error getting diagnostics: ${err.message}`);
    }
}

/**
 * Dismiss overlays (cookies, consent, etc.)
 */
async function dismissOverlays(page) {
    let dismissed = 0;

    for (const selector of SELECTORS.cookieDismiss) {
        try {
            const el = await page.$(selector);
            if (el) {
                await el.click({ force: true });
                dismissed++;
                await page.waitForTimeout(500);
            }
        } catch { }
    }

    // Check iframes for cookie consent
    try {
        for (const frame of page.frames()) {
            try {
                const btn = await frame.$('button#L2AGLb, button[aria-label="Accept all"]');
                if (btn) {
                    await btn.click({ force: true });
                    dismissed++;
                    await page.waitForTimeout(1000);
                }
            } catch { }
        }
    } catch { }

    // Remove blocking overlays via JS
    try {
        await page.evaluate(() => {
            document.querySelectorAll('[aria-modal="true"], .consent-bump').forEach(el => el.remove());
        });
    } catch { }

    // Handle "Continue without signing in"
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

    return dismissed;
}

async function jsClick(page, element) {
    await page.evaluate(el => {
        el.scrollIntoView({ block: 'center' });
        el.click();
    }, element);
}

/**
 * Join a Google Meet meeting
 */
export async function joinGoogleMeet(page, meetingUrl, botName = config.BOT_DISPLAY_NAME) {
    console.log(`[GoogleMeet] Navigating to ${meetingUrl}...`);

    try {
        await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000);

        // === DIAGNOSTICS: What page are we on? ===
        await logPageState(page, 'after_load');

        // Check if we got redirected to a sign-in page
        const currentUrl = page.url();
        if (currentUrl.includes('accounts.google.com')) {
            console.log('[GoogleMeet] ❌ Redirected to Google sign-in. Trying to go back...');
            // Try going directly to the meet URL again
            await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(5000);
            await logPageState(page, 'after_retry');
        }

        // === Dismiss overlays ===
        const d1 = await dismissOverlays(page);
        console.log(`[GoogleMeet] Dismissed ${d1} overlay(s)`);
        await page.waitForTimeout(1500);
        
        const d2 = await dismissOverlays(page);
        if (d2 > 0) {
            console.log(`[GoogleMeet] Dismissed ${d2} more overlay(s)`);
            await page.waitForTimeout(1500);
        }

        // === DIAGNOSTICS after overlay dismissal ===
        await logPageState(page, 'after_overlays');

        // === Turn off camera and mic ===
        console.log('[GoogleMeet] Turning off camera and microphone...');
        try {
            const micBtn = await findElement(page, SELECTORS.micToggle, 3000);
            if (micBtn) {
                const ariaLabel = await micBtn.getAttribute('aria-label') || '';
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

        // === Enter bot name ===
        console.log(`[GoogleMeet] Entering name: "${botName}"`);
        const nameInput = await findElement(page, SELECTORS.nameInput, 10000);
        if (nameInput) {
            await nameInput.click({ force: true, clickCount: 3 });
            await nameInput.fill(botName);
            await page.waitForTimeout(500);
            console.log('[GoogleMeet] ✅ Name entered');
        } else {
            console.log('[GoogleMeet] ⚠️ Name input not found');
            // Try finding ANY text input on the page
            const anyInput = await page.$('input[type="text"]:visible');
            if (anyInput) {
                console.log('[GoogleMeet] Found a text input, trying to fill it...');
                await anyInput.click({ force: true, clickCount: 3 });
                await anyInput.fill(botName);
                await page.waitForTimeout(500);
            }
        }

        // === Click join button ===
        console.log('[GoogleMeet] Clicking join button...');

        // Strategy 1: selectors + force click
        let joined = false;
        const joinBtn = await findElement(page, SELECTORS.joinButton, 10000);
        if (joinBtn) {
            try {
                await joinBtn.click({ force: true, timeout: 5000 });
                joined = true;
                console.log('[GoogleMeet] ✅ Join button clicked (force)');
            } catch {
                try {
                    await jsClick(page, joinBtn);
                    joined = true;
                    console.log('[GoogleMeet] ✅ Join button clicked (JS)');
                } catch { }
            }
        }

        // Strategy 2: find by text content
        if (!joined) {
            console.log('[GoogleMeet] Trying button text search...');
            const joinTexts = ['Solicitar', 'Pedir', 'Ask to', 'Join', 'Unir', 'Participar'];
            const allButtons = await page.$$('button');
            for (const btn of allButtons) {
                try {
                    const text = await btn.textContent();
                    const isVisible = await btn.isVisible();
                    if (text && isVisible && joinTexts.some(t => text.includes(t))) {
                        await page.evaluate(el => el.click(), btn);
                        joined = true;
                        console.log(`[GoogleMeet] ✅ Clicked button: "${text.trim()}"`);
                        break;
                    }
                } catch { }
            }
        }

        // Strategy 3: click the biggest/most prominent button
        if (!joined) {
            console.log('[GoogleMeet] Trying prominent button strategy...');
            const bigButton = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const visible = buttons.filter(b => b.offsetParent !== null && b.offsetWidth > 100);
                visible.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight));
                if (visible.length > 0) {
                    visible[0].click();
                    return visible[0].textContent?.trim() || '(no text)';
                }
                return null;
            });
            if (bigButton) {
                joined = true;
                console.log(`[GoogleMeet] ✅ Clicked prominent button: "${bigButton}"`);
            }
        }

        // Strategy 4: Enter key
        if (!joined) {
            console.log('[GoogleMeet] Trying Enter key...');
            await page.keyboard.press('Enter');
            joined = true;
        }

        if (!joined) {
            return { success: false, error: 'Could not find or click join button' };
        }

        // === DIAGNOSTICS after clicking join ===
        await page.waitForTimeout(3000);
        await logPageState(page, 'after_join_click');

        console.log('[GoogleMeet] Waiting to be admitted...');

        // === Wait to be admitted ===
        const joinTimeout = config.BOT_JOIN_TIMEOUT * 1000;
        const startWait = Date.now();

        while (Date.now() - startWait < joinTimeout) {
            const inMeeting = await findElement(page, SELECTORS.inMeeting, 3000);
            if (inMeeting) {
                console.log('[GoogleMeet] ✅ Successfully joined the meeting!');
                return { success: true };
            }

            const ended = await findElement(page, SELECTORS.meetingEnded, 1000);
            if (ended) {
                return { success: false, error: 'Meeting has ended or request was denied' };
            }

            // Log every 30 seconds
            const elapsed = Math.round((Date.now() - startWait) / 1000);
            if (elapsed % 30 === 0 && elapsed > 0) {
                console.log(`[GoogleMeet] Still waiting... (${elapsed}s)`);
            }

            await page.waitForTimeout(2000);
        }

        return { success: false, error: `Timed out waiting to be admitted (${config.BOT_JOIN_TIMEOUT}s)` };

    } catch (err) {
        console.error('[GoogleMeet] Join error:', err.message);
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
