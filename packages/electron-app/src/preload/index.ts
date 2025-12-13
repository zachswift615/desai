import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  onMcpCommand: (callback: (data: { requestId: string; message: unknown }) => void) => {
    ipcRenderer.on('mcp-command', (_event, data) => callback(data));
  },
  sendMcpResponse: (requestId: string, response: unknown) => {
    ipcRenderer.send('mcp-response', { requestId, response });
  },
});
