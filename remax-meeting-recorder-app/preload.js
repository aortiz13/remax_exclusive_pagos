const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Audio sources
    getSources: () => ipcRenderer.invoke('get-sources'),

    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),

    // App info
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    platform: process.platform,
});
