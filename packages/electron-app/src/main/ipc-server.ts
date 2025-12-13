import ipc from 'node-ipc';
import { BrowserWindow } from 'electron';
import type { IpcMessage, IpcResponse } from '@desai/shared';

ipc.config.id = 'desai-app';
ipc.config.retry = 1500;
ipc.config.silent = true;

let mainWindow: BrowserWindow | null = null;
const pendingCommands = new Map<string, (response: IpcResponse) => void>();

export function setupIpcServer(window: BrowserWindow) {
  mainWindow = window;

  ipc.serve(() => {
    ipc.server.on('command', (data: { requestId: string; message: IpcMessage }, socket) => {
      console.log('Received command:', data.message.type);

      // Forward to renderer
      if (mainWindow) {
        mainWindow.webContents.send('mcp-command', {
          requestId: data.requestId,
          message: data.message,
        });

        // Store callback to respond
        pendingCommands.set(data.requestId, (response) => {
          ipc.server.emit(socket, 'response', { requestId: data.requestId, response });
        });
      }
    });
  });

  ipc.server.start();
  console.log('IPC server started');
}

export function handleRendererResponse(requestId: string, response: IpcResponse) {
  const callback = pendingCommands.get(requestId);
  if (callback) {
    callback(response);
    pendingCommands.delete(requestId);
  }
}

export function stopIpcServer() {
  ipc.server.stop();
}
