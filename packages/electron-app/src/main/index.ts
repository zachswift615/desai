import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
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

// IPC handler for screenshots - saves to temp file to avoid context bloat
ipcMain.handle('capture-screenshot', async () => {
  if (!mainWindow) return null;
  const image = await mainWindow.webContents.capturePage();

  // Save to temp file instead of returning base64 (saves ~25k tokens)
  const tempDir = path.join(os.tmpdir(), 'desai-screenshots');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const filePath = path.join(tempDir, `screenshot-${timestamp}.png`);
  const pngBuffer = image.toPNG();
  fs.writeFileSync(filePath, pngBuffer);

  return filePath;
});

// Handle MCP responses from renderer
ipcMain.on('mcp-response', (_event, { requestId, response }) => {
  handleRendererResponse(requestId, response);
});
