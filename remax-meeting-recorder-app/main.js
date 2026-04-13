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
function startMeetingDetection() {
    if (meetingDetectionInterval) return;

    console.log('[Detector] Starting meeting detection...');
    meetingDetectionInterval = setInterval(async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window'],
                thumbnailSize: { width: 1, height: 1 },
            });

            // Look for Google Meet windows
            const meetWindow = sources.find(s => {
                const name = s.name.toLowerCase();
                return name.includes('meet.google.com') ||
                       name.includes('google meet') ||
                       (name.includes('meet -') && name.includes('google')) ||
                       name.includes('meet –');
            });

            if (meetWindow && !meetingActive) {
                // Meeting detected!
                meetingActive = true;
                lastMeetSourceId = meetWindow.id;
                console.log(`[Detector] 🎥 Meeting detected: "${meetWindow.name}" (${meetWindow.id})`);

                // Show notification
                if (Notification.isSupported()) {
                    const notif = new Notification({
                        title: 'Reunión detectada',
                        body: `Google Meet activo: ${meetWindow.name.substring(0, 50)}`,
                        icon: path.join(__dirname, 'assets', 'icon.png'),
                        silent: false,
                    });
                    notif.on('click', () => {
                        mainWindow?.show();
                        mainWindow?.focus();
                    });
                    notif.show();
                }

                // Tell renderer about the meeting
                mainWindow?.webContents.send('meeting-detected', {
                    sourceId: meetWindow.id,
                    sourceName: meetWindow.name,
                });

                // Show and focus window
                mainWindow?.show();
                mainWindow?.focus();

            } else if (!meetWindow && meetingActive) {
                // Meeting ended
                meetingActive = false;
                lastMeetSourceId = null;
                console.log('[Detector] Meeting ended');
                mainWindow?.webContents.send('meeting-ended');
            }
        } catch (err) {
            // Silent — detection loop should never crash
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
