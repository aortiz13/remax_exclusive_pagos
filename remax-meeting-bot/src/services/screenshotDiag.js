/**
 * Screenshot Diagnostics — Takes screenshots for debugging when things go wrong
 */
import { uploadFile } from '../lib/storage.js';

/**
 * Take a diagnostic screenshot and upload to MinIO
 * @param {import('playwright').Page} page
 * @param {string} sessionId
 * @param {string} label - Description (e.g., "join_failed", "error_state")
 * @returns {string|null} Public URL or null
 */
export async function takeScreenshot(page, sessionId, label = 'diagnostic') {
    try {
        const buffer = await page.screenshot({ fullPage: true, type: 'png' });
        const storagePath = `bot-diagnostics/${sessionId}/${label}_${Date.now()}.png`;

        const url = await uploadFile(storagePath, buffer, 'image/png');
        console.log(`[Screenshot] 📸 Saved: ${label} → ${storagePath}`);
        return url;
    } catch (err) {
        console.error('[Screenshot] Failed to capture:', err.message);
        return null;
    }
}
