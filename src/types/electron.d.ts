import type { McpRendererApi } from '../mcp/contracts'

interface ElectronAPI extends Partial<McpRendererApi> {
  minimize: () => void
  maximize: () => void
  close: () => void
  saveFile: (content: string, defaultName: string) => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  selectSyncDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>
  readSyncFile: (
    dirPath: string,
    relativePath: string
  ) => Promise<{ success: boolean; exists?: boolean; content?: string; error?: string }>
  writeSyncFile: (
    dirPath: string,
    relativePath: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
