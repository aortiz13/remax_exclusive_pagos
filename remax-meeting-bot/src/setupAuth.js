/**
 * Setup Auth — One-time manual Google login
 * 
 * Run this ONCE to set up the bot's Google session:
 *   node src/setupAuth.js
 * 
 * It opens a visible browser → you login to Google → cookies are saved.
 * The worker reuses these cookies for every meeting join.
 * 
 * Can also be triggered via HTTP API from the bot service.
 */

import { chromium } from 'playwright';
import { BROWSER_ARGS } from './utils/browserConfig.js';
import fs from 'fs';
import path from 'path';
import http from 'http';

const USER_DATA_DIR = process.env.BOT_USER_DATA_DIR || '/app/google-session';
const AUTH_STATE_FILE = path.join(USER_DATA_DIR, 'auth-state.json');

/**
 * Check if we have a valid saved auth state
 */
export function hasAuthState() {
    try {
        if (fs.existsSync(AUTH_STATE_FILE)) {
            const stat = fs.statSync(AUTH_STATE_FILE);
            const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
            console.log(`[Auth] Auth state found (${Math.round(ageDays)} days old)`);
            return { exists: true, ageDays: Math.round(ageDays) };
        }
    } catch { }
    return { exists: false, ageDays: -1 };
}

/**
 * Get saved auth state (cookies, localStorage, etc.)
 */
export function getAuthState() {
    try {
        const data = fs.readFileSync(AUTH_STATE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

/**
 * Save auth state after successful login
 */
async function saveAuthState(context) {
    const state = await context.storageState();
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`[Auth] ✅ Auth state saved to ${AUTH_STATE_FILE}`);
    return state;
}

/**
 * Open browser for manual login, wait until user completes it
 * Returns true if login was successful
 */
async function performLogin() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  🔐 Google Account Setup                    ║');
    console.log('║  A browser will open.                       ║');
    console.log('║  Please login to the Google account         ║');
    console.log('║  dedicated to the meeting bot.              ║');
    console.log('║  After login, the session will be saved.    ║');
    console.log('╚══════════════════════════════════════════════╝');

    const browser = await chromium.launch({
        headless: false,
        args: [
            ...BROWSER_ARGS,
            '--disable-blink-features=AutomationControlled',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        env: {
            ...process.env,
            DISPLAY: process.env.DISPLAY || ':99',
        },
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        locale: 'es-CL',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Navigate to Google login
    await page.goto('https://accounts.google.com/signin', { waitUntil: 'domcontentloaded' });

    console.log('\n[Auth] 🌐 Browser opened. Please login to your Google account.');
    console.log('[Auth] Waiting for successful login (max 10 minutes)...\n');

    // Wait until we detect a successful Google login
    const maxWait = 10 * 60 * 1000; // 10 minutes
    const startTime = Date.now();
    let loggedIn = false;

    while (Date.now() - startTime < maxWait) {
        try {
            const url = page.url();
            
            // Check if we're on Google Meet or myaccount (signals successful login)
            if (url.includes('myaccount.google.com') || 
                url.includes('mail.google.com') ||
                url.includes('meet.google.com') ||
                url.includes('workspace.google.com')) {
                loggedIn = true;
                break;
            }

            // Check for Google account avatar/profile
            const avatar = await page.$('[data-ogsr-up] img, .gb_A img, .gb_Ma img, #gb img.gb_r');
            if (avatar) {
                loggedIn = true;
                break;
            }

            // Check cookies for login tokens
            const cookies = await context.cookies();
            const hasAuthCookie = cookies.some(c => 
                (c.name === 'SID' || c.name === 'SSID' || c.name === 'HSID') &&
                c.domain.includes('.google.com')
            );
            if (hasAuthCookie) {
                loggedIn = true;
                break;
            }
        } catch { }

        await page.waitForTimeout(2000);
    }

    if (loggedIn) {
        // Navigate to Meet briefly to ensure Meet-specific cookies are set
        console.log('[Auth] 🔄 Login detected! Setting up Meet cookies...');
        try {
            await page.goto('https://meet.google.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(3000);
        } catch { }

        // Save the state
        await saveAuthState(context);
        console.log('[Auth] ✅ Authentication complete! Bot is ready to join meetings.');
    } else {
        console.log('[Auth] ❌ Login timed out. Please try again.');
    }

    await browser.close();
    return loggedIn;
}

/**
 * Start a simple HTTP server for auth setup (used from Easypanel)
 * The bot can trigger auth setup via API call
 */
async function startAuthServer() {
    const port = parseInt(process.env.AUTH_PORT || '3099');

    const server = http.createServer(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }

        if (req.url === '/auth/status') {
            const state = hasAuthState();
            res.writeHead(200);
            return res.end(JSON.stringify({
                authenticated: state.exists,
                age_days: state.ageDays,
                message: state.exists 
                    ? `Authenticated (${state.ageDays} days old)` 
                    : 'Not authenticated. Run setup.',
            }));
        }

        if (req.url === '/auth/setup' && req.method === 'POST') {
            res.writeHead(200);
            res.end(JSON.stringify({ message: 'Auth setup started. Check container display.' }));
            
            // Run login in background
            try {
                await performLogin();
            } catch (err) {
                console.error('[Auth] Setup error:', err.message);
            }
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(port, () => {
        console.log(`[Auth] 🔐 Auth server listening on port ${port}`);
    });
}

// ─── Main Entry Point ──────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--server')) {
    startAuthServer();
} else if (args.includes('--check')) {
    const state = hasAuthState();
    console.log(JSON.stringify(state, null, 2));
    process.exit(state.exists ? 0 : 1);
} else {
    // Run interactive login
    performLogin().then(success => {
        process.exit(success ? 0 : 1);
    });
}
