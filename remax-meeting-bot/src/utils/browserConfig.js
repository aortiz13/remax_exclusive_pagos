/**
 * Chromium Browser Configuration
 * Flags optimized for headless meeting joining with audio capture
 * v2: Enhanced stealth to pass Google's bot detection
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
    '--disable-features=WebRtcHideLocalIpsWithMdns',

    // Performance
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-ipc-flooding-protection',

    // Stealth — critical for passing Google's bot check
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
    '--start-maximized',
    '--disable-infobars',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-update',

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
        ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
        env: {
            ...process.env,
            DISPLAY: process.env.DISPLAY || ':99',
            PULSE_SERVER: process.env.PULSE_SERVER || '/tmp/pulse-socket',
        },
    };
}

/**
 * Stealth setup for a page — makes the browser look like a real user
 * v2: comprehensive stealth to evade Google's "confirmar que no eres un bot" check
 */
export async function applyStealthToPage(page) {
    await page.addInitScript(() => {
        // 1. Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        // 2. Override permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters)
        );

        // 3. Chrome runtime mock (full)
        window.chrome = {
            runtime: {
                onMessage: { addListener: () => { }, removeListener: () => { } },
                sendMessage: () => { },
                connect: () => ({ onMessage: { addListener: () => { } }, postMessage: () => { } }),
                getManifest: () => ({}),
                getURL: (path) => `chrome-extension://fake/${path}`,
                id: 'fake-extension-id',
            },
            loadTimes: function () {
                return {
                    requestTime: Date.now() / 1000 - 5,
                    startLoadTime: Date.now() / 1000 - 4,
                    commitLoadTime: Date.now() / 1000 - 3,
                    finishDocumentLoadTime: Date.now() / 1000 - 2,
                    finishLoadTime: Date.now() / 1000 - 1,
                    firstPaintTime: Date.now() / 1000 - 0.5,
                    firstPaintAfterLoadTime: 0,
                    navigationType: 'Other',
                    wasFetchedViaSpdy: false,
                    wasNpnNegotiated: true,
                    npnNegotiatedProtocol: 'h2',
                    wasAlternateProtocolAvailable: false,
                    connectionInfo: 'h2',
                };
            },
            csi: function () {
                return {
                    startE: Date.now(),
                    onloadT: Date.now(),
                    pageT: Date.now() - performance.timing.navigationStart,
                    tran: 15,
                };
            },
            app: {
                isInstalled: false,
                InstallState: { INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
            },
        };

        // 4. Override plugins (simulate real plugins)
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const plugins = [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
                ];
                plugins.length = 3;
                return plugins;
            },
        });

        // 5. Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['es-CL', 'es', 'en-US', 'en'],
        });
        Object.defineProperty(navigator, 'language', {
            get: () => 'es-CL',
        });

        // 6. Override platform
        Object.defineProperty(navigator, 'platform', {
            get: () => 'Linux x86_64',
        });
        Object.defineProperty(navigator, 'vendor', {
            get: () => 'Google Inc.',
        });

        // 7. Override hardwareConcurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 8,
        });

        // 8. Override deviceMemory
        Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8,
        });

        // 9. Override maxTouchPoints
        Object.defineProperty(navigator, 'maxTouchPoints', {
            get: () => 0,
        });

        // 10. WebGL renderer override
        const getParameterOrig = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (param) {
            if (param === 37445) return 'Intel Inc.';  // UNMASKED_VENDOR_WEBGL
            if (param === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
            return getParameterOrig.call(this, param);
        };

        // 11. Override connection/rtt
        if (navigator.connection) {
            Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 });
        }

        // 12. Prevent iframe detection
        try {
            Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
                get: function () {
                    return window;
                }
            });
        } catch { }

        // 13. Override toString for native functions
        const originalToString = Function.prototype.toString;
        Function.prototype.toString = function () {
            if (this === Function.prototype.toString) return 'function toString() { [native code] }';
            return originalToString.call(this);
        };
    });
}
