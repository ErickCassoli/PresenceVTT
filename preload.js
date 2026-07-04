'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  setFullScreen: (flag) => ipcRenderer.send('set-fullscreen', flag),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),

  // Custom titlebar controls (DM window is frameless).
  minimizeWindow: () => ipcRenderer.send('win-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('win-toggle-maximize'),
  closeWindow: () => ipcRenderer.send('win-close'),
  isWindowMaximized: () => ipcRenderer.invoke('win-is-maximized'),
  onWindowMaximizedChanged: (callback) => {
    const handler = (_event, isMax) => callback(isMax);
    ipcRenderer.on('window-maximized-changed', handler);
    return () => ipcRenderer.removeListener('window-maximized-changed', handler);
  },

  saveVideoFile: (sourcePath, sceneId, mimeType) =>
    ipcRenderer.invoke('save-video-file', sourcePath, sceneId, mimeType),
  saveVideoBlob: (sceneId, arrayBuffer, mimeType) =>
    ipcRenderer.invoke('save-video-blob', sceneId, arrayBuffer, mimeType),
  getVideoFilePath: (sceneId) =>
    ipcRenderer.invoke('get-video-file-path', sceneId),
  deleteVideoFile: (sceneId) =>
    ipcRenderer.invoke('delete-video-file', sceneId),
  onVideoSaveProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('video-save-progress', handler);
    return () => ipcRenderer.removeListener('video-save-progress', handler);
  },

  showSaveDialog: (opts) => ipcRenderer.invoke('show-save-dialog', opts),
  showOpenDialog: (opts) => ipcRenderer.invoke('show-open-dialog', opts),
  createBackupZip: (destPath, scenesData, extras) => ipcRenderer.invoke('create-backup-zip', destPath, scenesData, extras),
  readBackupManifest: (zipPath) => ipcRenderer.invoke('read-backup-manifest', zipPath),
  extractBackupScenes: (zipPath, assignments) => ipcRenderer.invoke('extract-backup-scenes', zipPath, assignments),
  readBackupProfile: (zipPath) => ipcRenderer.invoke('read-backup-profile', zipPath),
  onBackupProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('backup-progress', handler);
    return () => ipcRenderer.removeListener('backup-progress', handler);
  },

  // Auto-update: the main process pushes status ('available' | 'downloading' | 'ready');
  // installUpdate restarts into the downloaded version.
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  // Manual "check for updates" from the Config menu. Resolves { supported, reason? };
  // results still arrive via onUpdateStatus ('checking' | 'available' | 'none' | 'error').
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
});
