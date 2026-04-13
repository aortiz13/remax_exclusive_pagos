const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, session, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow = null;
let tray = null;
let selectedSourceId = null;
let meetingDetectionInterval = null;
let meetingActive = false;
let lastMeetSourceId = null;

// ─── Create Main Window ──────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 580,
        minWidth: 340,
        minHeight: 480,
        maxWidth: 440,
        resizable: true,
        frame: false,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 14, y: 14 },
        transparent: false,
        backgroundColor: '#0f1117',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false,
        skipTaskbar: false,
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        // Show on start so user can log in
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('close', (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
}

// ─── Display Media Handler ───────────────────────────────────────
function setupDisplayMediaHandler() {
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            console.log('[MediaHandler] getDisplayMedia requested');
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 1, height: 1 },
            });

            if (!sources || sources.length === 0) {
                console.error('[MediaHandler] No sources — Screen Recording permission denied');
                // Don't call callback — let getDisplayMedia reject so renderer falls back to mic
                return;
            }

            console.log('[MediaHandler] Sources available:', sources.length);

            // Find best source
            let source = null;
            if (selectedSourceId) {
                source = sources.find(s => s.id === selectedSourceId);
            }
            if (!source) {
                source = sources.find(s => s.id.startsWith('screen:')) || sources[0];
            }

            console.log('[MediaHandler] Using source:', source.name);
            callback({ video: source, audio: 'loopback' });
        } catch (err) {
            console.error('[MediaHandler] Error:', err.message);
            // Don't call callback — let getDisplayMedia reject
        }
    });
}

// ─── Screen Recording Permission ─────────────────────────────────
function checkScreenRecordingPermission() {
    if (process.platform !== 'darwin') return true;

    // On macOS 10.15+, check screen recording access
    try {
        const status = systemPreferences.getMediaAccessStatus('screen');
        console.log('[Permissions] Screen recording status:', status);
        return status === 'granted';
    } catch {
        return false;
    }
}

async function requestScreenRecordingPermission() {
    if (process.platform !== 'darwin') return true;

    const hasPermission = checkScreenRecordingPermission();
    if (hasPermission) {
        console.log('[Permissions] ✅ Screen recording permission granted');
        return true;
    }

    console.log('[Permissions] ⚠️ Screen recording NOT granted, requesting...');
    // On macOS, we need to trigger the permission dialog by trying to capture
    // The system will show a dialog asking the user to grant access
    try {
        await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
    } catch {
        // This triggers the macOS permission dialog
    }

    return checkScreenRecordingPermission();
}

// ─── Meeting Detection (AppleScript for macOS) ──────────────────
function detectMeetingMac() {
    return new Promise((resolve) => {
        const scriptPath = app.isPackaged
            ? path.join(process.resourcesPath, 'scripts', 'detect-meet.scpt')
            : path.join(__dirname, 'scripts', 'detect-meet.scpt');
        exec(`osascript "${scriptPath}"`, { timeout: 5000 }, (err, stdout) => {
            if (err) { resolve(null); return; }
            const title = stdout.trim();
            resolve(title && title.length > 0 ? title : null);
        });
    });
}

function startMeetingDetection() {
    if (meetingDetectionInterval) return;

    console.log('[Detector] Starting meeting detection...');
    meetingDetectionInterval = setInterval(async () => {
        try {
            let meetTitle = null;

            if (process.platform === 'darwin') {
                meetTitle = await detectMeetingMac();
            } else {
                try {
                    const sources = await desktopCapturer.getSources({
                        types: ['window'],
                        thumbnailSize: { width: 1, height: 1 },
                    });
                    const meetSource = sources.find(s => {
                        const name = s.name.toLowerCase();
                        return name.includes('meet.google.com') ||
                               name.includes('google meet') ||
                               name.startsWith('meet:') ||
                               name.startsWith('meet -');
                    });
                    if (meetSource) {
                        meetTitle = meetSource.name;
                        lastMeetSourceId = meetSource.id;
                    }
                } catch { /* no permission */ }
            }

            if (meetTitle && !meetingActive) {
                meetingActive = true;
                console.log(`[Detector] 🎥 Meeting detected: "${meetTitle}"`);

                // Try to get source ID for recording (non-blocking)
                if (!lastMeetSourceId) {
                    try {
                        const sources = await desktopCapturer.getSources({
                            types: ['screen', 'window'],
                            thumbnailSize: { width: 1, height: 1 },
                        });
                        const chromeWin = sources.find(s =>
                            s.name.toLowerCase().includes('chrome') || s.name.toLowerCase().includes('meet')
                        );
                        lastMeetSourceId = chromeWin?.id || sources.find(s => s.id.startsWith('screen:'))?.id;
                    } catch {
                        console.log('[Detector] Could not get source ID — will use screen fallback');
                    }
                }

                // Notify
                if (Notification.isSupported()) {
                    const notif = new Notification({
                        title: 'Reunión detectada',
                        body: `Google Meet: ${meetTitle.substring(0, 50)}`,
                        icon: path.join(__dirname, 'assets', 'icon.png'),
                        silent: false,
                    });
                    notif.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
                    notif.show();
                }

                mainWindow?.webContents.send('meeting-detected', {
                    sourceId: lastMeetSourceId || 'screen:0:0',
                    sourceName: meetTitle,
                });
                mainWindow?.show();
                mainWindow?.focus();

            } else if (!meetTitle && meetingActive) {
                meetingActive = false;
                lastMeetSourceId = null;
                console.log('[Detector] Meeting ended');
                mainWindow?.webContents.send('meeting-ended');
            }
        } catch (err) {
            console.error('[Detector] Error:', err);
        }
    }, 3000);
}

function stopMeetingDetection() {
    if (meetingDetectionInterval) {
        clearInterval(meetingDetectionInterval);
        meetingDetectionInterval = null;
    }
}

// ─── System Tray ─────────────────────────────────────────────────
function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    try {
        let icon;
        try {
            icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        } catch {
            icon = nativeImage.createEmpty();
        }
        tray = new Tray(icon);
        tray.setToolTip('REMAX Meeting Recorder — Escuchando...');
        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
            }
        });
        const contextMenu = Menu.buildFromTemplate([
            { label: '📺 Abrir Grabadora', click: () => { mainWindow?.show(); mainWindow?.focus(); }},
            { type: 'separator' },
            { label: '⏸ Pausar detección', type: 'checkbox', checked: false, click: (item) => {
                if (item.checked) { stopMeetingDetection(); tray?.setToolTip('REMAX Recorder — Pausado'); }
                else { startMeetingDetection(); tray?.setToolTip('REMAX Recorder — Escuchando...'); }
            }},
            { type: 'separator' },
            { label: '🚪 Salir', click: () => { app.isQuitting = true; app.quit(); }},
        ]);
        tray.setContextMenu(contextMenu);
    } catch (e) {
        console.warn('Tray icon not created:', e.message);
    }
}

// ─── App Lifecycle ───────────────────────────────────────────────
app.whenReady().then(async () => {
    setupDisplayMediaHandler();
    createWindow();
    createTray();

    // Request permissions on macOS
    if (process.platform === 'darwin') {
        systemPreferences.askForMediaAccess('microphone').catch(() => {});
        // Check screen recording (non-blocking, just log)
        await requestScreenRecordingPermission();
    }

    // Start detecting meetings
    startMeetingDetection();

    // Auto-start on login
    app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden'],
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        else { mainWindow?.show(); mainWindow?.focus(); }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    app.isQuitting = true;
    stopMeetingDetection();
});

// ─── IPC Handlers ────────────────────────────────────────────────
ipcMain.handle('set-selected-source', (event, sourceId) => {
    selectedSourceId = sourceId;
    return true;
});

ipcMain.handle('get-meeting-status', () => {
    return { active: meetingActive, sourceId: lastMeetSourceId };
});

// Check screen recording permission
ipcMain.handle('check-screen-permission', () => {
    return checkScreenRecordingPermission();
});

// Request permission
ipcMain.handle('request-screen-permission', async () => {
    return await requestScreenRecordingPermission();
});

// Window controls
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-close', () => mainWindow?.hide());
ipcMain.handle('window-quit', () => { app.isQuitting = true; app.quit(); });

// Get app version
ipcMain.handle('get-app-version', () => app.getVersion());

// Get platform
ipcMain.handle('get-platform', () => process.platform);
