import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  loadImageFromPath: (filePath: string) => ipcRenderer.invoke('load-image-from-path', filePath),
  exportPng: () => ipcRenderer.invoke('export-png'),
  exportCanvasPng: (data: { dataUrl: string; width: number; height: number }) => ipcRenderer.invoke('export-canvas-png', data),
  exportCanvasPngDirect: (data: { dataUrl: string }) => ipcRenderer.invoke('export-canvas-png-direct', data),
  saveProject: (projectJson: string) => ipcRenderer.invoke('save-project', projectJson),
  loadProject: (filePath?: string) => ipcRenderer.invoke('load-project', filePath),
  onMcpCommand: (callback: (data: { requestId: string; message: unknown }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as { requestId: string; message: unknown });
    ipcRenderer.on('mcp-command', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('mcp-command', handler);
  },
  sendMcpResponse: (requestId: string, response: unknown) => {
    ipcRenderer.send('mcp-response', { requestId, response });
  },
});
