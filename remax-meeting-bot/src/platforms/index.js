/**
 * Platform Detector — Determines meeting platform from URL
 */

const PLATFORM_PATTERNS = [
    {
        platform: 'google_meet',
        patterns: [
            /meet\.google\.com\//i,
            /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i,
        ],
        extractId: (url) => {
            const match = url.match(/meet\.google\.com\/([a-z0-9\-]+)/i);
            return match ? match[1] : null;
        },
    },
    {
        platform: 'zoom',
        patterns: [
            /zoom\.us\/j\//i,
            /zoom\.us\/my\//i,
            /zoom\.us\/s\//i,
            /app\.zoom\.us/i,
        ],
        extractId: (url) => {
            const match = url.match(/zoom\.us\/(?:j|s|my)\/(\d+)/i);
            return match ? match[1] : null;
        },
    },
    {
        platform: 'teams',
        patterns: [
            /teams\.microsoft\.com/i,
            /teams\.live\.com/i,
        ],
        extractId: (url) => {
            const match = url.match(/meetup-join\/([^/?]+)/i);
            return match ? match[1] : null;
        },
    },
];

/**
 * Detect the meeting platform from a URL
 * @param {string} url - Meeting URL
 * @returns {{ platform: string, meetingId: string|null } | null}
 */
export function detectPlatform(url) {
    if (!url) return null;

    const normalizedUrl = url.trim().toLowerCase();

    for (const { platform, patterns, extractId } of PLATFORM_PATTERNS) {
        for (const pattern of patterns) {
            if (pattern.test(normalizedUrl)) {
                return {
                    platform,
                    meetingId: extractId(url),
                };
            }
        }
    }

    return null;
}

/**
 * Normalize a meeting URL to its web-client version
 */
export function normalizeUrl(url, platform) {
    const trimmed = url.trim();

    if (platform === 'zoom') {
        // Force web client: zoom.us/wc/join/MEETING_ID
        const match = trimmed.match(/zoom\.us\/(?:j|s)\/(\d+)/i);
        if (match) {
            const meetingId = match[1];
            // Preserve query params (like pwd)
            const urlObj = new URL(trimmed);
            const pwd = urlObj.searchParams.get('pwd');
            let webUrl = `https://app.zoom.us/wc/join/${meetingId}`;
            if (pwd) webUrl += `?pwd=${pwd}`;
            return webUrl;
        }
    }

    return trimmed;
}
