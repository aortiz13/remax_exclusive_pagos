/**
 * Local Google Login Script
 * Run this on your Mac to login to Google and generate auth cookies.
 * The cookies will be saved to a file that you upload to the bot container.
 *
 * Usage:
 *   1. npm install playwright
 *   2. npx playwright install chromium
 *   3. node login-google.js
 *   4. Login in the browser that opens
 *   5. The script saves auth-state.json automatically
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, 'auth-state.json');

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  🔐 Google Login para Meeting Bot           ║');
    console.log('║  Se abrirá un browser.                      ║');
    console.log('║  Inicia sesión con tu cuenta Gmail           ║');
    console.log('║  dedicada al bot de reuniones.               ║');
    console.log('╚══════════════════════════════════════════════╝');

    const browser = await chromium.launch({
        headless: false,  // Browser visible
        args: [
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,900',
        ],
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        locale: 'es-CL',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Go to Google accounts
    await page.goto('https://accounts.google.com/signin', { waitUntil: 'domcontentloaded' });

    console.log('\n🌐 Browser abierto. Inicia sesión en Google...');
    console.log('⏳ Esperando login (máximo 10 minutos)...\n');

    // Wait for login
    const maxWait = 10 * 60 * 1000;
    const startTime = Date.now();
    let loggedIn = false;

    while (Date.now() - startTime < maxWait) {
        try {
            const cookies = await context.cookies();
            const hasAuth = cookies.some(c =>
                (c.name === 'SID' || c.name === 'SSID' || c.name === 'HSID') &&
                c.domain.includes('.google.com')
            );
            if (hasAuth) {
                loggedIn = true;
                break;
            }
        } catch { }
        await page.waitForTimeout(2000);
    }

    if (loggedIn) {
        // Go to Meet to get meet-specific cookies
        console.log('🔄 Login detectado. Cargando cookies de Meet...');
        try {
            await page.goto('https://meet.google.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(3000);
        } catch { }

        // Save state
        const state = await context.storageState();
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(state, null, 2));
        console.log(`\n✅ ¡Login exitoso! Archivo guardado: ${OUTPUT_FILE}`);
        console.log('\nAhora sube este archivo al contenedor del bot.');
        console.log('Instrucciones en la terminal.\n');
    } else {
        console.log('\n❌ Timeout. No se detectó login. Intenta de nuevo.\n');
    }

    await browser.close();
}

main().catch(console.error);
