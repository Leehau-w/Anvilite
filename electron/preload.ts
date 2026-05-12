import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  saveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke('save-file', content, defaultName),
  selectSyncDirectory: () => ipcRenderer.invoke('select-sync-directory'),
  readSyncFile: (dirPath: string, relativePath: string) =>
    ipcRenderer.invoke('read-sync-file', dirPath, relativePath),
  writeSyncFile: (dirPath: string, relativePath: string, content: string) =>
    ipcRenderer.invoke('write-sync-file', dirPath, relativePath, content),
})
