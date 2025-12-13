import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { setupIpcServer, handleRendererResponse, stopIpcServer } from './ipc-server';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Setup IPC server for MCP communication
  setupIpcServer(mainWindow);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopIpcServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler for screenshots
ipcMain.handle('capture-screenshot', async () => {
  if (!mainWindow) return null;
  const image = await mainWindow.webContents.capturePage();
  return image.toDataURL();
});

// Handle MCP responses from renderer
ipcMain.on('mcp-response', (_event, { requestId, response }) => {
  handleRendererResponse(requestId, response);
});
