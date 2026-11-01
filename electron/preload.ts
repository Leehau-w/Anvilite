import { contextBridge, ipcRenderer } from 'electron'
import type { McpConfiguration, McpDispatch, McpReply, McpStatus } from '../src/mcp/contracts'

contextBridge.exposeInMainWorld('electronAPI', {
  mcpReady: (context: { accountId: string }) => ipcRenderer.invoke('mcp-ready', context),
  mcpConfigure: (configuration: McpConfiguration) => ipcRenderer.invoke('mcp-configure', configuration),
  mcpGetStatus: () => ipcRenderer.invoke('mcp-get-status'),
  mcpValidate: (lease: { bridgeId: string; sessionId: string }) => ipcRenderer.invoke('mcp-validate', lease),
  mcpRespond: (reply: McpReply) => ipcRenderer.send('mcp-respond', reply),
  onMcpRequest: (handler: (dispatch: McpDispatch) => void) => {
    const listener = (_event: unknown, dispatch: McpDispatch) => handler(dispatch)
    ipcRenderer.on('mcp-request', listener)
    return () => ipcRenderer.removeListener('mcp-request', listener)
  },
  onMcpStatus: (handler: (status: McpStatus) => void) => {
    const listener = (_event: unknown, status: McpStatus) => handler(status)
    ipcRenderer.on('mcp-status', listener)
    return () => ipcRenderer.removeListener('mcp-status', listener)
  },
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  saveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke('save-file', content, defaultName),
  selectSyncDirectory: (accountId?: string) => ipcRenderer.invoke('select-sync-directory', accountId),
  readSyncFile: (dirPath: string, relativePath: string, accountId?: string) =>
    ipcRenderer.invoke('read-sync-file', dirPath, relativePath, accountId),
  writeSyncFile: (dirPath: string, relativePath: string, content: string, accountId?: string) =>
    ipcRenderer.invoke('write-sync-file', dirPath, relativePath, content, accountId),
})
