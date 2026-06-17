import { contextBridge, ipcRenderer } from 'electron'

// Expose a typed API to the renderer via contextBridge.
// contextIsolation: true, nodeIntegration: false — no exceptions.
contextBridge.exposeInMainWorld('api', {
  // Placeholder — typed handlers added in Task 3 (IPC layer)
  ping: () => ipcRenderer.invoke('ping'),
})
