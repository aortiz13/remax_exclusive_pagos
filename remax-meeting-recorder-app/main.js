const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, session, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');

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
        height: 520,
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
        // Start minimized to tray — only show when meeting detected or user clicks tray
        // mainWindow.show(); // Don't show on start
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('close', (e) => {
        // Hide instead of close (stay in tray)
        if (!app.isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
}

// ─── Display Media Handler (system audio capture) ────────────────
function setupDisplayMediaHandler() {
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
            let source = null;
            if (selectedSourceId) {
                source = sources.find(s => s.id === selectedSourceId);
            }
            if (!source) {
                source = sources.find(s => s.id.startsWith('screen:')) || sources[0];
            }
            if (!source) { callback({}); return; }
            callback({ video: source, audio: 'loopback' });
        } catch (err) {
            console.error('Display media handler error:', err);
            callback({});
        }
    });
}

// ─── Meeting Detection ──────────────────────────────────────────
const { exec } = require('child_process');

function detectMeetingMac() {
    return new Promise((resolve) => {
        // In dev: scripts/ is next to main.js
        // In built app: scripts/ is in Resources/scripts/ via extraResources
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
                // Windows: use desktopCapturer
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
                } catch {
                    // Screen recording permission not granted
                }
            }

            if (meetTitle && !meetingActive) {
                meetingActive = true;
                console.log(`[Detector] 🎥 Meeting detected: "${meetTitle}"`);

                // On macOS, try to get the source ID for recording
                if (process.platform === 'darwin' && !lastMeetSourceId) {
                    try {
                        const sources = await desktopCapturer.getSources({
                            types: ['window', 'screen'],
                            thumbnailSize: { width: 1, height: 1 },
                        });
                        // Find Chrome window or use first screen
                        const chromeWin = sources.find(s => s.name.toLowerCase().includes('chrome') || s.name.toLowerCase().includes('meet'));
                        lastMeetSourceId = chromeWin?.id || sources.find(s => s.id.startsWith('screen:'))?.id || sources[0]?.id;
                    } catch {
                        // Will use screen as fallback when recording starts
                    }
                }

                // Show notification
                if (Notification.isSupported()) {
                    const notif = new Notification({
                        title: 'Reunión detectada',
                        body: `Google Meet: ${meetTitle.substring(0, 50)}`,
                        icon: path.join(__dirname, 'assets', 'icon.png'),
                        silent: false,
                    });
                    notif.on('click', () => {
                        mainWindow?.show();
                        mainWindow?.focus();
                    });
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
app.whenReady().then(() => {
    setupDisplayMediaHandler();
    createWindow();
    createTray();

    // Request permissions on macOS
    if (process.platform === 'darwin') {
        systemPreferences.askForMediaAccess('microphone').catch(() => {});
        systemPreferences.askForMediaAccess('camera').catch(() => {});
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

// Set selected source for recording
ipcMain.handle('set-selected-source', (event, sourceId) => {
    selectedSourceId = sourceId;
    return true;
});

// Get current meeting status
ipcMain.handle('get-meeting-status', () => {
    return { active: meetingActive, sourceId: lastMeetSourceId };
});

// Window controls
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-close', () => mainWindow?.hide());
ipcMain.handle('window-quit', () => { app.isQuitting = true; app.quit(); });

// Get app version
ipcMain.handle('get-app-version', () => app.getVersion());

// Get platform
ipcMain.handle('get-platform', () => process.platform);
