import ipc from 'node-ipc';
import type { IpcMessage, IpcResponse } from '@desai/shared';

ipc.config.id = 'desai-mcp';
ipc.config.retry = 1500;
ipc.config.silent = true;

let connected = false;
const pendingRequests = new Map<string, {
  resolve: (value: IpcResponse) => void;
  reject: (error: Error) => void;
}>();

export function connectToElectron(): Promise<void> {
  return new Promise((resolve, reject) => {
    ipc.connectTo('desai-app', () => {
      ipc.of['desai-app'].on('connect', () => {
        connected = true;
        console.error('Connected to Desai app');
        resolve();
      });

      ipc.of['desai-app'].on('disconnect', () => {
        connected = false;
        console.error('Disconnected from Desai app');
      });

      ipc.of['desai-app'].on('response', (data: { requestId: string; response: IpcResponse }) => {
        const pending = pendingRequests.get(data.requestId);
        if (pending) {
          pending.resolve(data.response);
          pendingRequests.delete(data.requestId);
        }
      });

      ipc.of['desai-app'].on('error', (err: Error) => {
        reject(err);
      });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!connected) {
        reject(new Error('Connection timeout - is Desai app running?'));
      }
    }, 5000);
  });
}

export function sendCommand(message: IpcMessage): Promise<IpcResponse> {
  return new Promise((resolve, reject) => {
    if (!connected) {
      reject(new Error('Not connected to Desai app'));
      return;
    }

    const requestId = Math.random().toString(36).substring(7);
    pendingRequests.set(requestId, { resolve, reject });

    ipc.of['desai-app'].emit('command', { requestId, message });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error('Command timeout'));
      }
    }, 30000);
  });
}

export function isConnected(): boolean {
  return connected;
}
