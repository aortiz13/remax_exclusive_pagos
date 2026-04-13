const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let selectedSourceId = null; // Stored when user picks a source

// ─── Create Main Window ──────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 420,
        height: 680,
        minWidth: 380,
        minHeight: 600,
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
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Prevent navigation away
    mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
}

// ─── Display Media Handler (system audio capture on macOS) ───────
function setupDisplayMediaHandler() {
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window', 'screen'],
            });

            // Use the pre-selected source, or fall back to first screen
            let source = null;
            if (selectedSourceId) {
                source = sources.find(s => s.id === selectedSourceId);
            }
            if (!source) {
                source = sources.find(s => s.id.startsWith('screen:')) || sources[0];
            }

            if (!source) {
                callback({});
                return;
            }

            // 'loopback' = capture system audio via ScreenCaptureKit (macOS 13+)
            // This captures ALL audio output including headphones
            callback({ video: source, audio: 'loopback' });
        } catch (err) {
            console.error('Display media handler error:', err);
            callback({});
        }
    });
}

// ─── System Tray ─────────────────────────────────────────────────
function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    try {
        const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        tray = new Tray(icon);
        tray.setToolTip('REMAX Meeting Recorder');
        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
            }
        });
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Abrir', click: () => mainWindow?.show() },
            { type: 'separator' },
            { label: 'Salir', click: () => app.quit() },
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

    // Request microphone + screen recording permissions on macOS
    if (process.platform === 'darwin') {
        systemPreferences.askForMediaAccess('microphone').catch(() => {});
        systemPreferences.askForMediaAccess('camera').catch(() => {});
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ────────────────────────────────────────────────

// Get available audio sources for recording
ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 150, height: 100 },
        fetchWindowIcons: true,
    });

    return sources.map(s => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
        appIcon: s.appIcon?.toDataURL() || null,
    }));
});

// Store the selected source ID (used by display media handler)
ipcMain.handle('set-selected-source', (event, sourceId) => {
    selectedSourceId = sourceId;
    return true;
});

// Window controls (frameless window)
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-close', () => mainWindow?.hide());

// Get app version
ipcMain.handle('get-app-version', () => app.getVersion());
