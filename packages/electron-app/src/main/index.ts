import { app, BrowserWindow, ipcMain, dialog } from 'electron';
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

// IPC handler for image selection
ipcMain.handle('select-image', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Image',
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
      },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const imageBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);

  // Convert to base64 data URL
  const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // For non-SVG images, we'll need to get dimensions in the renderer
  // Return the data URL and let the renderer handle dimension detection
  return {
    dataUrl,
    fileName: path.basename(filePath),
  };
});

// IPC handler for PNG export - exports visible canvas area with save dialog
ipcMain.handle('export-png', async () => {
  if (!mainWindow) return null;

  // Capture the page
  const image = await mainWindow.webContents.capturePage();

  // Show save dialog
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as PNG',
    defaultPath: `design-${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  // Save the PNG
  const pngBuffer = image.toPNG();
  fs.writeFileSync(result.filePath, pngBuffer);

  return result.filePath;
});

// IPC handler for loading an image from a file path (for MCP)
ipcMain.handle('load-image-from-path', async (_event, filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return { error: `File not found: ${filePath}` };
  }

  const imageBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return { dataUrl, fileName: path.basename(filePath) };
});

// Handle MCP responses from renderer
ipcMain.on('mcp-response', (_event, { requestId, response }) => {
  handleRendererResponse(requestId, response);
});

// IPC handler for canvas-only PNG export (without UI chrome)
ipcMain.handle('export-canvas-png', async (_event, { dataUrl, width, height }: { dataUrl: string; width: number; height: number }) => {
  if (!mainWindow) return null;

  // Show save dialog
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Canvas as PNG',
    defaultPath: `design-${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  // Convert data URL to buffer and save
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const pngBuffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(result.filePath, pngBuffer);

  return result.filePath;
});

// IPC handler for direct PNG export without dialog (for MCP automation)
ipcMain.handle('export-canvas-png-direct', async (_event, { dataUrl }: { dataUrl: string }) => {
  // Save to Downloads folder with timestamp
  const downloadsPath = app.getPath('downloads');
  const filePath = path.join(downloadsPath, `design-${Date.now()}.png`);

  // Convert data URL to buffer and save
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const pngBuffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, pngBuffer);

  return filePath;
});

// IPC handler for saving project to JSON file
ipcMain.handle('save-project', async (_event, projectJson: string) => {
  if (!mainWindow) return null;

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project',
    defaultPath: `project-${Date.now()}.json`,
    filters: [{ name: 'Desai Project', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, projectJson, 'utf-8');
  return result.filePath;
});

// IPC handler for loading project from JSON file
ipcMain.handle('load-project', async (_event, filePath?: string) => {
  if (!mainWindow) return { error: 'No window' };

  let targetPath = filePath;

  // If no path provided, show open dialog
  if (!targetPath) {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Load Project',
      filters: [{ name: 'Desai Project', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { error: 'Cancelled' };
    }
    targetPath = result.filePaths[0];
  }

  if (!fs.existsSync(targetPath)) {
    return { error: `File not found: ${targetPath}` };
  }

  const content = fs.readFileSync(targetPath, 'utf-8');
  return { content, filePath: targetPath };
});
