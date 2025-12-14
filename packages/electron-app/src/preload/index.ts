import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  exportPng: () => ipcRenderer.invoke('export-png'),
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
