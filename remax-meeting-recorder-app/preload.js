const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Meeting detection events
    onMeetingDetected: (callback) => ipcRenderer.on('meeting-detected', (_, data) => callback(data)),
    onMeetingEnded: (callback) => ipcRenderer.on('meeting-ended', () => callback()),

    // Recording source
    setSelectedSource: (sourceId) => ipcRenderer.invoke('set-selected-source', sourceId),
    getMeetingStatus: () => ipcRenderer.invoke('get-meeting-status'),

    // Permissions
    checkScreenPermission: () => ipcRenderer.invoke('check-screen-permission'),
    requestScreenPermission: () => ipcRenderer.invoke('request-screen-permission'),

    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
    quitApp: () => ipcRenderer.invoke('window-quit'),

    // App info
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    platform: process.platform,
});
