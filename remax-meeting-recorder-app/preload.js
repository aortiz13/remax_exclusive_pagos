const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Audio sources
    getSources: () => ipcRenderer.invoke('get-sources'),

    // Tell main process which source the user picked
    setSelectedSource: (sourceId) => ipcRenderer.invoke('set-selected-source', sourceId),

    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),

    // App info
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    platform: process.platform,
});
