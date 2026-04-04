interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  saveFile: (content: string, defaultName: string) => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
