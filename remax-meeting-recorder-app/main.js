const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

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

// ─── System Tray ─────────────────────────────────────────────────
function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    try {
        const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        tray = new Tray(icon);
        tray.setToolTip('RE/MAX Meeting Recorder');
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
        // Tray icon not available, skip
        console.warn('Tray icon not created:', e.message);
    }
}

// ─── App Lifecycle ───────────────────────────────────────────────
app.whenReady().then(() => {
    createWindow();
    createTray();

    // Request microphone permission on macOS
    if (process.platform === 'darwin') {
        systemPreferences.askForMediaAccess('microphone').catch(() => {});
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    // Keep running in tray on macOS
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

// Window controls (frameless window)
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-close', () => mainWindow?.hide());

// Get app version
ipcMain.handle('get-app-version', () => app.getVersion());
