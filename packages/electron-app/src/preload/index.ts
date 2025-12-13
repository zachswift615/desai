import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  onMcpCommand: (callback: (command: unknown) => void) => {
    ipcRenderer.on('mcp-command', (_event, command) => callback(command));
  },
  sendMcpResponse: (response: unknown) => {
    ipcRenderer.send('mcp-response', response);
  },
});
