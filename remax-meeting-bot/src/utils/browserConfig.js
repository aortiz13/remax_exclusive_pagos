/**
 * Chromium Browser Configuration
 * Flags optimized for headless meeting joining with audio capture
 */

export const BROWSER_ARGS = [
    // Basics
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',

    // Audio — critical for meeting audio
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',        // Auto-grant mic/cam permissions
    '--use-fake-device-for-media-stream',    // Use virtual devices
    '--disable-features=WebRtcHideLocalIpsWithMdns', // Don't hide local IPs

    // Performance
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-ipc-flooding-protection',

    // Stealth
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',

    // WebRTC
    '--enable-features=WebRtcPipeWireCapturer',
];

/**
 * Get Playwright launch options
 */
export function getLaunchOptions() {
    return {
        headless: false, // Must be false — we need the real UI for meetings
        args: BROWSER_ARGS,
        ignoreDefaultArgs: ['--mute-audio'], // Don't mute audio!
        env: {
            ...process.env,
            DISPLAY: process.env.DISPLAY || ':99',
            PULSE_SERVER: process.env.PULSE_SERVER || '/tmp/pulse-socket',
        },
    };
}

/**
 * Stealth setup for a page — makes the browser look like a real user
 */
export async function applyStealthToPage(page) {
    // Override navigator.webdriver
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // Override permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters)
        );

        // Chrome runtime mock
        window.chrome = {
            runtime: {},
            loadTimes: function () { },
            csi: function () { },
            app: {},
        };

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['es-CL', 'es', 'en-US', 'en'],
        });
    });
}
