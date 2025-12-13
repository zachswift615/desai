# Desai Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-native design tool where Claude Code can create and manipulate designs via MCP tools.

**Architecture:** Monorepo with three packages: shared types, Electron app (React + TypeScript), and MCP server. The Electron app runs standalone; the MCP server connects via IPC to expose design tools to Claude.

**Tech Stack:** Electron 28+, React 18, TypeScript, Zustand, Tailwind CSS, @modelcontextprotocol/sdk, node-ipc, Vitest

---

## Phase 1: Project Scaffolding

### Task 1.1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

**Step 1: Create root package.json**

```json
{
  "name": "desai",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter electron-app dev",
    "build": "pnpm --filter electron-app build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.log
.env
.env.local
out/
```

**Step 5: Initialize git and commit**

```bash
git init
git add .
git commit -m "chore: initialize monorepo with pnpm workspaces"
```

---

### Task 1.2: Create Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@desai/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/shared/src/types.ts**

```typescript
// Canvas and Project types
export interface DesaiProject {
  id: string;
  name: string;
  canvas: CanvasSettings;
  layers: Layer[];
}

export interface CanvasSettings {
  width: number;
  height: number;
  background: string;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  elements: Element[];
}

// Element types
export type Element =
  | RectElement
  | EllipseElement
  | TextElement
  | ImageElement
  | GroupElement
  | LineElement
  | PathElement;

export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  filters: ImageFilters;
  crop?: CropArea;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupElement extends BaseElement {
  type: 'group';
  children: Element[];
}

export interface PathElement extends BaseElement {
  type: 'path';
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

// State export types (for MCP)
export interface CanvasState {
  project: DesaiProject;
  selection: string[];
  viewport: Viewport;
  history: HistoryState;
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

// IPC message types
export type IpcMessage =
  | { type: 'canvas:create'; payload: { width: number; height: number; background: string } }
  | { type: 'canvas:get-state'; payload: null }
  | { type: 'canvas:screenshot'; payload: null }
  | { type: 'canvas:clear'; payload: null }
  | { type: 'layer:create'; payload: { name: string } }
  | { type: 'layer:delete'; payload: { layerId: string } }
  | { type: 'layer:reorder'; payload: { layerId: string; newIndex: number } }
  | { type: 'layer:set-visibility'; payload: { layerId: string; visible: boolean } }
  | { type: 'layer:set-opacity'; payload: { layerId: string; opacity: number } }
  | { type: 'layer:lock'; payload: { layerId: string; locked: boolean } }
  | { type: 'shape:rectangle'; payload: Partial<RectElement> }
  | { type: 'shape:ellipse'; payload: Partial<EllipseElement> }
  | { type: 'shape:line'; payload: Partial<LineElement> }
  | { type: 'text:create'; payload: Partial<TextElement> }
  | { type: 'text:update'; payload: { elementId: string; updates: Partial<TextElement> } }
  | { type: 'image:import'; payload: { src: string; x: number; y: number; width?: number; height?: number } }
  | { type: 'element:transform'; payload: { elementId: string; transform: Partial<BaseElement> } }
  | { type: 'element:style'; payload: { elementId: string; style: Record<string, unknown> } }
  | { type: 'element:delete'; payload: { elementId: string } }
  | { type: 'element:duplicate'; payload: { elementId: string } }
  | { type: 'export:png'; payload: { scale?: number } }
  | { type: 'export:svg'; payload: null }
  | { type: 'project:save'; payload: { filePath: string } }
  | { type: 'project:load'; payload: { filePath: string } };

export type IpcResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**Step 4: Create packages/shared/src/index.ts**

```typescript
export * from './types';
```

**Step 5: Build and commit**

```bash
cd packages/shared && pnpm install && pnpm build
git add .
git commit -m "feat: add shared types package"
```

---

### Task 1.3: Scaffold Electron App

**Files:**
- Create: `packages/electron-app/package.json`
- Create: `packages/electron-app/tsconfig.json`
- Create: `packages/electron-app/electron.vite.config.ts`
- Create: `packages/electron-app/src/main/index.ts`
- Create: `packages/electron-app/src/preload/index.ts`
- Create: `packages/electron-app/src/renderer/index.html`
- Create: `packages/electron-app/src/renderer/main.tsx`
- Create: `packages/electron-app/src/renderer/App.tsx`

**Step 1: Create packages/electron-app/package.json**

```json
{
  "name": "electron-app",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "@desai/shared": "workspace:*",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "nanoid": "^5.0.4",
    "node-ipc": "^12.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "electron": "^28.0.0",
    "electron-vite": "^2.0.0",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0"
  }
}
```

**Step 2: Create packages/electron-app/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 3: Create packages/electron-app/electron.vite.config.ts**

```typescript
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['node-ipc'],
      },
    },
  },
  preload: {},
  renderer: {
    plugins: [react()],
  },
});
```

**Step 4: Create packages/electron-app/src/main/index.ts**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

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
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
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
```

**Step 5: Create packages/electron-app/src/preload/index.ts**

```typescript
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
```

**Step 6: Create packages/electron-app/src/renderer/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Desai</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

**Step 7: Create packages/electron-app/src/renderer/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 8: Create packages/electron-app/src/renderer/App.tsx**

```tsx
import React from 'react';

export default function App() {
  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex items-center justify-center">
      <h1 className="text-4xl font-bold">Desai</h1>
    </div>
  );
}
```

**Step 9: Create packages/electron-app/src/renderer/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

**Step 10: Create packages/electron-app/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Step 11: Create packages/electron-app/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 12: Install dependencies and verify it runs**

```bash
cd packages/electron-app && pnpm install
pnpm dev
# Verify Electron window opens with "Desai" text
# Close the app (Cmd+Q)
```

**Step 13: Commit**

```bash
git add .
git commit -m "feat: scaffold Electron app with React and Tailwind"
```

---

## Phase 2: State Management & Data Model

### Task 2.1: Create Zustand Store

**Files:**
- Create: `packages/electron-app/src/renderer/store/projectStore.ts`
- Create: `packages/electron-app/src/renderer/store/index.ts`
- Create: `packages/electron-app/src/renderer/utils/id.ts`

**Step 1: Create packages/electron-app/src/renderer/utils/id.ts**

```typescript
import { nanoid } from 'nanoid';

export function generateId(): string {
  return nanoid(10);
}
```

**Step 2: Create packages/electron-app/src/renderer/store/projectStore.ts**

```typescript
import { create } from 'zustand';
import type {
  DesaiProject,
  Layer,
  Element,
  CanvasState,
  Viewport,
} from '@desai/shared';
import { generateId } from '../utils/id';

interface ProjectStore {
  // State
  project: DesaiProject;
  selection: string[];
  viewport: Viewport;
  history: { past: DesaiProject[]; future: DesaiProject[] };
  activeTool: string;

  // Canvas actions
  createCanvas: (width: number, height: number, background: string) => void;
  clearCanvas: () => void;
  getState: () => CanvasState;

  // Layer actions
  addLayer: (name: string) => string;
  deleteLayer: (layerId: string) => void;
  reorderLayer: (layerId: string, newIndex: number) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setLayerLock: (layerId: string, locked: boolean) => void;

  // Element actions
  addElement: (layerId: string, element: Element) => void;
  updateElement: (elementId: string, updates: Partial<Element>) => void;
  deleteElement: (elementId: string) => void;
  duplicateElement: (elementId: string) => string | null;

  // Selection
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;

  // Viewport
  setViewport: (viewport: Partial<Viewport>) => void;

  // Tool
  setActiveTool: (tool: string) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const defaultProject: DesaiProject = {
  id: generateId(),
  name: 'Untitled',
  canvas: {
    width: 1920,
    height: 1080,
    background: '#ffffff',
  },
  layers: [
    {
      id: generateId(),
      name: 'Layer 1',
      visible: true,
      locked: false,
      opacity: 100,
      elements: [],
    },
  ],
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: { ...defaultProject },
  selection: [],
  viewport: { zoom: 1, panX: 0, panY: 0 },
  history: { past: [], future: [] },
  activeTool: 'select',

  createCanvas: (width, height, background) => {
    set({
      project: {
        id: generateId(),
        name: 'Untitled',
        canvas: { width, height, background },
        layers: [
          {
            id: generateId(),
            name: 'Layer 1',
            visible: true,
            locked: false,
            opacity: 100,
            elements: [],
          },
        ],
      },
      selection: [],
      history: { past: [], future: [] },
    });
  },

  clearCanvas: () => {
    const { project, pushHistory } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((layer) => ({ ...layer, elements: [] })),
      },
      selection: [],
    });
  },

  getState: () => {
    const { project, selection, viewport, history } = get();
    return {
      project,
      selection,
      viewport,
      history: {
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
      },
    };
  },

  addLayer: (name) => {
    const { project, pushHistory } = get();
    pushHistory();
    const newLayer: Layer = {
      id: generateId(),
      name,
      visible: true,
      locked: false,
      opacity: 100,
      elements: [],
    };
    set({
      project: {
        ...project,
        layers: [newLayer, ...project.layers],
      },
    });
    return newLayer.id;
  },

  deleteLayer: (layerId) => {
    const { project, pushHistory } = get();
    if (project.layers.length <= 1) return;
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.filter((l) => l.id !== layerId),
      },
    });
  },

  reorderLayer: (layerId, newIndex) => {
    const { project, pushHistory } = get();
    const layers = [...project.layers];
    const currentIndex = layers.findIndex((l) => l.id === layerId);
    if (currentIndex === -1) return;
    pushHistory();
    const [layer] = layers.splice(currentIndex, 1);
    layers.splice(newIndex, 0, layer);
    set({ project: { ...project, layers } });
  },

  setLayerVisibility: (layerId, visible) => {
    const { project } = get();
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === layerId ? { ...l, visible } : l
        ),
      },
    });
  },

  setLayerOpacity: (layerId, opacity) => {
    const { project, pushHistory } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === layerId ? { ...l, opacity } : l
        ),
      },
    });
  },

  setLayerLock: (layerId, locked) => {
    const { project } = get();
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === layerId ? { ...l, locked } : l
        ),
      },
    });
  },

  addElement: (layerId, element) => {
    const { project, pushHistory } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === layerId ? { ...l, elements: [...l.elements, element] } : l
        ),
      },
    });
  },

  updateElement: (elementId, updates) => {
    const { project, pushHistory } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((layer) => ({
          ...layer,
          elements: layer.elements.map((el) =>
            el.id === elementId ? { ...el, ...updates } : el
          ),
        })),
      },
    });
  },

  deleteElement: (elementId) => {
    const { project, pushHistory, selection } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((layer) => ({
          ...layer,
          elements: layer.elements.filter((el) => el.id !== elementId),
        })),
      },
      selection: selection.filter((id) => id !== elementId),
    });
  },

  duplicateElement: (elementId) => {
    const { project, pushHistory } = get();
    for (const layer of project.layers) {
      const element = layer.elements.find((el) => el.id === elementId);
      if (element) {
        pushHistory();
        const newElement = {
          ...element,
          id: generateId(),
          x: element.x + 20,
          y: element.y + 20,
        };
        set({
          project: {
            ...project,
            layers: project.layers.map((l) =>
              l.id === layer.id
                ? { ...l, elements: [...l.elements, newElement] }
                : l
            ),
          },
          selection: [newElement.id],
        });
        return newElement.id;
      }
    }
    return null;
  },

  setSelection: (ids) => set({ selection: ids }),
  clearSelection: () => set({ selection: [] }),

  setViewport: (viewport) =>
    set((state) => ({ viewport: { ...state.viewport, ...viewport } })),

  setActiveTool: (tool) => set({ activeTool: tool }),

  pushHistory: () => {
    const { project, history } = get();
    set({
      history: {
        past: [...history.past.slice(-49), project],
        future: [],
      },
    });
  },

  undo: () => {
    const { history, project } = get();
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    set({
      project: previous,
      history: {
        past: history.past.slice(0, -1),
        future: [project, ...history.future],
      },
    });
  },

  redo: () => {
    const { history, project } = get();
    if (history.future.length === 0) return;
    const next = history.future[0];
    set({
      project: next,
      history: {
        past: [...history.past, project],
        future: history.future.slice(1),
      },
    });
  },
}));
```

**Step 3: Create packages/electron-app/src/renderer/store/index.ts**

```typescript
export { useProjectStore } from './projectStore';
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add Zustand store with project state and history"
```

---

## Phase 3: Core UI Components

### Task 3.1: Create App Layout

**Files:**
- Modify: `packages/electron-app/src/renderer/App.tsx`
- Create: `packages/electron-app/src/renderer/components/Layout.tsx`

**Step 1: Create packages/electron-app/src/renderer/components/Layout.tsx**

```tsx
import React from 'react';

interface LayoutProps {
  toolbar: React.ReactNode;
  canvas: React.ReactNode;
  layers: React.ReactNode;
  properties: React.ReactNode;
}

export function Layout({ toolbar, canvas, layers, properties }: LayoutProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Menu bar placeholder */}
      <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-4 text-sm">
        <span className="font-semibold">Desai</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Toolbar */}
        <div className="w-14 bg-gray-800 border-r border-gray-700 flex flex-col">
          {toolbar}
        </div>

        {/* Center: Canvas + Layers */}
        <div className="flex-1 flex flex-col">
          {/* Canvas area */}
          <div className="flex-1 overflow-hidden">{canvas}</div>

          {/* Bottom: Layers panel */}
          <div className="h-48 bg-gray-800 border-t border-gray-700 overflow-auto">
            {layers}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-64 bg-gray-800 border-l border-gray-700 overflow-auto">
          {properties}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update packages/electron-app/src/renderer/App.tsx**

```tsx
import React from 'react';
import { Layout } from './components/Layout';

export default function App() {
  return (
    <Layout
      toolbar={<div className="p-2 text-xs text-gray-400">Tools</div>}
      canvas={
        <div className="h-full w-full flex items-center justify-center text-gray-500">
          Canvas Area
        </div>
      }
      layers={<div className="p-2 text-xs text-gray-400">Layers Panel</div>}
      properties={<div className="p-2 text-xs text-gray-400">Properties</div>}
    />
  );
}
```

**Step 3: Verify layout renders correctly**

```bash
cd packages/electron-app && pnpm dev
# Verify the layout shows: toolbar left, canvas center, layers bottom, properties right
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add app layout with toolbar, canvas, layers, and properties panels"
```

---

### Task 3.2: Create Toolbar Component

**Files:**
- Create: `packages/electron-app/src/renderer/components/Toolbar/Toolbar.tsx`
- Create: `packages/electron-app/src/renderer/components/Toolbar/ToolButton.tsx`
- Create: `packages/electron-app/src/renderer/components/Toolbar/index.ts`

**Step 1: Create packages/electron-app/src/renderer/components/Toolbar/ToolButton.tsx**

```tsx
import React from 'react';

interface ToolButtonProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}

export function ToolButton({ icon, label, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 flex items-center justify-center rounded text-lg
        ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}
      `}
    >
      {icon}
    </button>
  );
}
```

**Step 2: Create packages/electron-app/src/renderer/components/Toolbar/Toolbar.tsx**

```tsx
import React from 'react';
import { useProjectStore } from '../../store';
import { ToolButton } from './ToolButton';

const tools = [
  { id: 'select', icon: '⬚', label: 'Select (V)' },
  { id: 'move', icon: '✥', label: 'Move (M)' },
  { id: 'rect', icon: '▢', label: 'Rectangle (R)' },
  { id: 'ellipse', icon: '○', label: 'Ellipse (E)' },
  { id: 'line', icon: '╱', label: 'Line (L)' },
  { id: 'text', icon: 'T', label: 'Text (T)' },
  { id: 'image', icon: '🖼', label: 'Image (I)' },
];

export function Toolbar() {
  const activeTool = useProjectStore((s) => s.activeTool);
  const setActiveTool = useProjectStore((s) => s.setActiveTool);

  return (
    <div className="flex flex-col items-center gap-1 p-2">
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          active={activeTool === tool.id}
          onClick={() => setActiveTool(tool.id)}
        />
      ))}
    </div>
  );
}
```

**Step 3: Create packages/electron-app/src/renderer/components/Toolbar/index.ts**

```typescript
export { Toolbar } from './Toolbar';
export { ToolButton } from './ToolButton';
```

**Step 4: Update App.tsx to use Toolbar**

```tsx
import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';

export default function App() {
  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={
        <div className="h-full w-full flex items-center justify-center text-gray-500">
          Canvas Area
        </div>
      }
      layers={<div className="p-2 text-xs text-gray-400">Layers Panel</div>}
      properties={<div className="p-2 text-xs text-gray-400">Properties</div>}
    />
  );
}
```

**Step 5: Verify toolbar works**

```bash
pnpm dev
# Click different tools, verify active state changes (blue highlight)
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add toolbar with tool selection"
```

---

### Task 3.3: Create Canvas Component

**Files:**
- Create: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`
- Create: `packages/electron-app/src/renderer/components/Canvas/CanvasElement.tsx`
- Create: `packages/electron-app/src/renderer/components/Canvas/index.ts`

**Step 1: Create packages/electron-app/src/renderer/components/Canvas/CanvasElement.tsx**

```tsx
import React from 'react';
import type { Element } from '@desai/shared';

interface CanvasElementProps {
  element: Element;
  selected: boolean;
  onSelect: () => void;
}

export function CanvasElement({ element, selected, onSelect }: CanvasElementProps) {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    opacity: element.opacity / 100,
    cursor: 'pointer',
    outline: selected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  switch (element.type) {
    case 'rect':
      return (
        <div
          onClick={handleClick}
          style={{
            ...baseStyle,
            backgroundColor: element.fill,
            border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke}` : 'none',
            borderRadius: element.cornerRadius,
          }}
        />
      );

    case 'ellipse':
      return (
        <div
          onClick={handleClick}
          style={{
            ...baseStyle,
            backgroundColor: element.fill,
            border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke}` : 'none',
            borderRadius: '50%',
          }}
        />
      );

    case 'text':
      return (
        <div
          onClick={handleClick}
          style={{
            ...baseStyle,
            color: element.fill,
            fontSize: element.fontSize,
            fontFamily: element.fontFamily,
            fontWeight: element.fontWeight,
            textAlign: element.align,
            lineHeight: element.lineHeight,
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
          }}
        >
          {element.content}
        </div>
      );

    case 'image':
      return (
        <img
          onClick={handleClick}
          src={element.src}
          alt=""
          style={{
            ...baseStyle,
            objectFit: 'cover',
            filter: `
              brightness(${element.filters.brightness}%)
              contrast(${element.filters.contrast}%)
              saturate(${element.filters.saturate}%)
              blur(${element.filters.blur}px)
            `,
          }}
        />
      );

    case 'line':
      return (
        <svg
          onClick={handleClick}
          style={{
            ...baseStyle,
            overflow: 'visible',
          }}
        >
          <line
            x1={element.x1 - element.x}
            y1={element.y1 - element.y}
            x2={element.x2 - element.x}
            y2={element.y2 - element.y}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
          />
        </svg>
      );

    default:
      return null;
  }
}
```

**Step 2: Create packages/electron-app/src/renderer/components/Canvas/Canvas.tsx**

```tsx
import React, { useRef } from 'react';
import { useProjectStore } from '../../store';
import { CanvasElement } from './CanvasElement';
import { generateId } from '../../utils/id';
import type { RectElement, EllipseElement, TextElement, LineElement } from '@desai/shared';

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const activeTool = useProjectStore((s) => s.activeTool);
  const setSelection = useProjectStore((s) => s.setSelection);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const addElement = useProjectStore((s) => s.addElement);
  const viewport = useProjectStore((s) => s.viewport);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeTool === 'select') {
      clearSelection();
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / viewport.zoom;
    const y = (e.clientY - rect.top) / viewport.zoom;

    const activeLayer = project.layers.find((l) => !l.locked);
    if (!activeLayer) return;

    let newElement;

    switch (activeTool) {
      case 'rect':
        newElement: RectElement = {
          id: generateId(),
          type: 'rect',
          x,
          y,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 100,
          fill: '#3b82f6',
          stroke: '#1e40af',
          strokeWidth: 0,
          cornerRadius: 0,
        };
        break;

      case 'ellipse':
        newElement: EllipseElement = {
          id: generateId(),
          type: 'ellipse',
          x,
          y,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 100,
          fill: '#10b981',
          stroke: '#047857',
          strokeWidth: 0,
        };
        break;

      case 'text':
        newElement: TextElement = {
          id: generateId(),
          type: 'text',
          x,
          y,
          width: 200,
          height: 50,
          rotation: 0,
          opacity: 100,
          content: 'Text',
          fontSize: 24,
          fontFamily: 'system-ui',
          fontWeight: 'normal',
          fill: '#ffffff',
          align: 'left',
          lineHeight: 1.2,
        };
        break;

      case 'line':
        newElement: LineElement = {
          id: generateId(),
          type: 'line',
          x,
          y,
          width: 100,
          height: 2,
          rotation: 0,
          opacity: 100,
          x1: x,
          y1: y,
          x2: x + 100,
          y2: y,
          stroke: '#ffffff',
          strokeWidth: 2,
        };
        break;

      default:
        return;
    }

    if (newElement) {
      addElement(activeLayer.id, newElement);
      setSelection([newElement.id]);
    }
  };

  return (
    <div className="h-full w-full overflow-auto bg-gray-950 flex items-center justify-center p-8">
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="relative shadow-2xl"
        style={{
          width: project.canvas.width,
          height: project.canvas.height,
          backgroundColor: project.canvas.background,
          transform: `scale(${viewport.zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Render layers bottom to top */}
        {[...project.layers].reverse().map((layer) =>
          layer.visible
            ? layer.elements.map((element) => (
                <CanvasElement
                  key={element.id}
                  element={element}
                  selected={selection.includes(element.id)}
                  onSelect={() => setSelection([element.id])}
                />
              ))
            : null
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create packages/electron-app/src/renderer/components/Canvas/index.ts**

```typescript
export { Canvas } from './Canvas';
export { CanvasElement } from './CanvasElement';
```

**Step 4: Update App.tsx to use Canvas**

```tsx
import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';

export default function App() {
  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      layers={<div className="p-2 text-xs text-gray-400">Layers Panel</div>}
      properties={<div className="p-2 text-xs text-gray-400">Properties</div>}
    />
  );
}
```

**Step 5: Verify canvas works**

```bash
pnpm dev
# Select rectangle tool, click on canvas - verify blue rectangle appears
# Select ellipse tool, click - verify green ellipse appears
# Click select tool, click elements to select them (blue outline)
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add canvas with element rendering and creation"
```

---

### Task 3.4: Create Layers Panel

**Files:**
- Create: `packages/electron-app/src/renderer/components/LayersPanel/LayersPanel.tsx`
- Create: `packages/electron-app/src/renderer/components/LayersPanel/LayerItem.tsx`
- Create: `packages/electron-app/src/renderer/components/LayersPanel/index.ts`

**Step 1: Create packages/electron-app/src/renderer/components/LayersPanel/LayerItem.tsx**

```tsx
import React from 'react';
import type { Layer } from '@desai/shared';

interface LayerItemProps {
  layer: Layer;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
}

export function LayerItem({
  layer,
  onToggleVisibility,
  onToggleLock,
  onDelete,
}: LayerItemProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 group">
      <button
        onClick={onToggleVisibility}
        className={`text-sm ${layer.visible ? 'text-white' : 'text-gray-500'}`}
        title={layer.visible ? 'Hide layer' : 'Show layer'}
      >
        {layer.visible ? '👁' : '👁‍🗨'}
      </button>
      <button
        onClick={onToggleLock}
        className={`text-sm ${layer.locked ? 'text-yellow-500' : 'text-gray-500'}`}
        title={layer.locked ? 'Unlock layer' : 'Lock layer'}
      >
        {layer.locked ? '🔒' : '🔓'}
      </button>
      <span className="flex-1 text-sm truncate">{layer.name}</span>
      <span className="text-xs text-gray-500">{layer.elements.length}</span>
      <button
        onClick={onDelete}
        className="text-red-500 opacity-0 group-hover:opacity-100 text-sm"
        title="Delete layer"
      >
        ✕
      </button>
    </div>
  );
}
```

**Step 2: Create packages/electron-app/src/renderer/components/LayersPanel/LayersPanel.tsx**

```tsx
import React from 'react';
import { useProjectStore } from '../../store';
import { LayerItem } from './LayerItem';

export function LayersPanel() {
  const project = useProjectStore((s) => s.project);
  const addLayer = useProjectStore((s) => s.addLayer);
  const deleteLayer = useProjectStore((s) => s.deleteLayer);
  const setLayerVisibility = useProjectStore((s) => s.setLayerVisibility);
  const setLayerLock = useProjectStore((s) => s.setLayerLock);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-sm font-medium">Layers</span>
        <button
          onClick={() => addLayer(`Layer ${project.layers.length + 1}`)}
          className="text-blue-500 hover:text-blue-400 text-sm"
        >
          + Add
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {project.layers.map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            onToggleVisibility={() =>
              setLayerVisibility(layer.id, !layer.visible)
            }
            onToggleLock={() => setLayerLock(layer.id, !layer.locked)}
            onDelete={() => deleteLayer(layer.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create packages/electron-app/src/renderer/components/LayersPanel/index.ts**

```typescript
export { LayersPanel } from './LayersPanel';
export { LayerItem } from './LayerItem';
```

**Step 4: Update App.tsx**

```tsx
import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';

export default function App() {
  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      layers={<LayersPanel />}
      properties={<div className="p-2 text-xs text-gray-400">Properties</div>}
    />
  );
}
```

**Step 5: Verify layers panel works**

```bash
pnpm dev
# Add elements to canvas
# Toggle visibility (eye icon) - elements should hide/show
# Toggle lock - locked layers shouldn't allow new elements
# Add new layers - verify they appear
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add layers panel with visibility and lock controls"
```

---

### Task 3.5: Create Properties Panel

**Files:**
- Create: `packages/electron-app/src/renderer/components/PropertiesPanel/PropertiesPanel.tsx`
- Create: `packages/electron-app/src/renderer/components/PropertiesPanel/PropertyInput.tsx`
- Create: `packages/electron-app/src/renderer/components/PropertiesPanel/index.ts`

**Step 1: Create packages/electron-app/src/renderer/components/PropertiesPanel/PropertyInput.tsx**

```tsx
import React from 'react';

interface PropertyInputProps {
  label: string;
  value: string | number;
  type?: 'text' | 'number' | 'color';
  onChange: (value: string | number) => void;
}

export function PropertyInput({
  label,
  value,
  type = 'text',
  onChange,
}: PropertyInputProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 w-16">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(type === 'number' ? Number(e.target.value) : e.target.value)
        }
        className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
      />
    </div>
  );
}
```

**Step 2: Create packages/electron-app/src/renderer/components/PropertiesPanel/PropertiesPanel.tsx**

```tsx
import React from 'react';
import { useProjectStore } from '../../store';
import { PropertyInput } from './PropertyInput';
import type { Element } from '@desai/shared';

export function PropertiesPanel() {
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const updateElement = useProjectStore((s) => s.updateElement);
  const deleteElement = useProjectStore((s) => s.deleteElement);
  const duplicateElement = useProjectStore((s) => s.duplicateElement);

  // Find selected element
  let selectedElement: Element | null = null;
  for (const layer of project.layers) {
    const found = layer.elements.find((el) => selection.includes(el.id));
    if (found) {
      selectedElement = found;
      break;
    }
  }

  if (!selectedElement) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Select an element to edit its properties
      </div>
    );
  }

  const update = (updates: Partial<Element>) => {
    updateElement(selectedElement!.id, updates);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="text-sm font-medium capitalize">
        {selectedElement.type}
      </div>

      {/* Transform */}
      <div className="space-y-2">
        <div className="text-xs text-gray-500 uppercase">Transform</div>
        <PropertyInput
          label="X"
          value={selectedElement.x}
          type="number"
          onChange={(v) => update({ x: v as number })}
        />
        <PropertyInput
          label="Y"
          value={selectedElement.y}
          type="number"
          onChange={(v) => update({ y: v as number })}
        />
        <PropertyInput
          label="Width"
          value={selectedElement.width}
          type="number"
          onChange={(v) => update({ width: v as number })}
        />
        <PropertyInput
          label="Height"
          value={selectedElement.height}
          type="number"
          onChange={(v) => update({ height: v as number })}
        />
        <PropertyInput
          label="Rotation"
          value={selectedElement.rotation}
          type="number"
          onChange={(v) => update({ rotation: v as number })}
        />
        <PropertyInput
          label="Opacity"
          value={selectedElement.opacity}
          type="number"
          onChange={(v) => update({ opacity: v as number })}
        />
      </div>

      {/* Fill (for shapes and text) */}
      {'fill' in selectedElement && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Fill</div>
          <PropertyInput
            label="Color"
            value={selectedElement.fill}
            type="color"
            onChange={(v) => update({ fill: v as string })}
          />
        </div>
      )}

      {/* Stroke (for shapes) */}
      {'stroke' in selectedElement && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Stroke</div>
          <PropertyInput
            label="Color"
            value={selectedElement.stroke}
            type="color"
            onChange={(v) => update({ stroke: v as string })}
          />
          <PropertyInput
            label="Width"
            value={selectedElement.strokeWidth}
            type="number"
            onChange={(v) => update({ strokeWidth: v as number })}
          />
        </div>
      )}

      {/* Text properties */}
      {selectedElement.type === 'text' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Text</div>
          <textarea
            value={selectedElement.content}
            onChange={(e) => update({ content: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
            rows={3}
          />
          <PropertyInput
            label="Size"
            value={selectedElement.fontSize}
            type="number"
            onChange={(v) => update({ fontSize: v as number })}
          />
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-4 border-t border-gray-700">
        <button
          onClick={() => duplicateElement(selectedElement!.id)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded"
        >
          Duplicate
        </button>
        <button
          onClick={() => deleteElement(selectedElement!.id)}
          className="w-full bg-red-900 hover:bg-red-800 text-sm py-2 rounded"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Create packages/electron-app/src/renderer/components/PropertiesPanel/index.ts**

```typescript
export { PropertiesPanel } from './PropertiesPanel';
export { PropertyInput } from './PropertyInput';
```

**Step 4: Update App.tsx**

```tsx
import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';

export default function App() {
  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      layers={<LayersPanel />}
      properties={<PropertiesPanel />}
    />
  );
}
```

**Step 5: Verify properties panel works**

```bash
pnpm dev
# Create a rectangle, select it
# Modify X, Y, width, height - verify element moves/resizes
# Change fill color - verify color changes
# Click duplicate - verify new element appears
# Click delete - verify element is removed
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add properties panel for editing selected elements"
```

---

## Phase 4: MCP Server

### Task 4.1: Scaffold MCP Server Package

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/index.ts`

**Step 1: Create packages/mcp-server/package.json**

```json
{
  "name": "@desai/mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "desai-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@desai/shared": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "node-ipc": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create packages/mcp-server/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 3: Create packages/mcp-server/src/index.ts**

```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'desai-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'desai_canvas_get_state',
        description: 'Get the current state of the canvas including all layers and elements',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'desai_canvas_screenshot',
        description: 'Capture a screenshot of the current canvas',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'desai_shape_rectangle',
        description: 'Create a rectangle on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            width: { type: 'number', description: 'Width' },
            height: { type: 'number', description: 'Height' },
            fill: { type: 'string', description: 'Fill color (hex)' },
            stroke: { type: 'string', description: 'Stroke color (hex)' },
            strokeWidth: { type: 'number', description: 'Stroke width' },
            cornerRadius: { type: 'number', description: 'Corner radius' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      {
        name: 'desai_text_create',
        description: 'Create a text element on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            content: { type: 'string', description: 'Text content' },
            fontSize: { type: 'number', description: 'Font size' },
            fill: { type: 'string', description: 'Text color (hex)' },
          },
          required: ['x', 'y', 'content'],
        },
      },
      {
        name: 'desai_element_delete',
        description: 'Delete an element from the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'ID of the element to delete' },
          },
          required: ['elementId'],
        },
      },
    ],
  };
});

// Handle tool calls (placeholder - will connect to Electron via IPC)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // For now, return a placeholder response
  // This will be replaced with IPC communication to Electron
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Not connected to Desai app. Please ensure the app is running.',
        }),
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Desai MCP Server running on stdio');
}

main().catch(console.error);
```

**Step 4: Install dependencies and build**

```bash
cd packages/mcp-server && pnpm install && pnpm build
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: scaffold MCP server with tool definitions"
```

---

### Task 4.2: Implement IPC Communication

**Files:**
- Create: `packages/mcp-server/src/ipc-client.ts`
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/electron-app/src/main/index.ts`
- Create: `packages/electron-app/src/main/ipc-server.ts`

**Step 1: Create packages/mcp-server/src/ipc-client.ts**

```typescript
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
```

**Step 2: Create packages/electron-app/src/main/ipc-server.ts**

```typescript
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
```

**Step 3: Update packages/electron-app/src/main/index.ts**

```typescript
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
```

**Step 4: Update packages/electron-app/src/preload/index.ts**

```typescript
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
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: implement IPC communication between MCP server and Electron"
```

---

### Task 4.3: Handle MCP Commands in Renderer

**Files:**
- Create: `packages/electron-app/src/renderer/hooks/useMcpHandler.ts`
- Modify: `packages/electron-app/src/renderer/App.tsx`

**Step 1: Create packages/electron-app/src/renderer/hooks/useMcpHandler.ts**

```typescript
import { useEffect } from 'react';
import { useProjectStore } from '../store';
import { generateId } from '../utils/id';
import type { IpcMessage, IpcResponse, RectElement, TextElement } from '@desai/shared';

declare global {
  interface Window {
    electronAPI: {
      captureScreenshot: () => Promise<string>;
      onMcpCommand: (callback: (data: { requestId: string; message: IpcMessage }) => void) => void;
      sendMcpResponse: (requestId: string, response: IpcResponse) => void;
    };
  }
}

export function useMcpHandler() {
  const project = useProjectStore((s) => s.project);
  const getState = useProjectStore((s) => s.getState);
  const addElement = useProjectStore((s) => s.addElement);
  const deleteElement = useProjectStore((s) => s.deleteElement);
  const updateElement = useProjectStore((s) => s.updateElement);
  const clearCanvas = useProjectStore((s) => s.clearCanvas);
  const createCanvas = useProjectStore((s) => s.createCanvas);
  const addLayer = useProjectStore((s) => s.addLayer);
  const deleteLayer = useProjectStore((s) => s.deleteLayer);
  const setLayerVisibility = useProjectStore((s) => s.setLayerVisibility);
  const setLayerOpacity = useProjectStore((s) => s.setLayerOpacity);
  const setLayerLock = useProjectStore((s) => s.setLayerLock);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onMcpCommand(async ({ requestId, message }) => {
      let response: IpcResponse;

      try {
        switch (message.type) {
          case 'canvas:get-state':
            response = { success: true, data: getState() };
            break;

          case 'canvas:screenshot':
            const screenshot = await window.electronAPI.captureScreenshot();
            response = { success: true, data: { image: screenshot } };
            break;

          case 'canvas:clear':
            clearCanvas();
            response = { success: true, data: null };
            break;

          case 'canvas:create':
            createCanvas(
              message.payload.width,
              message.payload.height,
              message.payload.background
            );
            response = { success: true, data: null };
            break;

          case 'shape:rectangle': {
            const activeLayer = project.layers.find((l) => !l.locked);
            if (!activeLayer) {
              response = { success: false, error: 'No unlocked layer available' };
              break;
            }
            const rect: RectElement = {
              id: generateId(),
              type: 'rect',
              x: message.payload.x ?? 0,
              y: message.payload.y ?? 0,
              width: message.payload.width ?? 100,
              height: message.payload.height ?? 100,
              rotation: 0,
              opacity: 100,
              fill: message.payload.fill ?? '#3b82f6',
              stroke: message.payload.stroke ?? '#1e40af',
              strokeWidth: message.payload.strokeWidth ?? 0,
              cornerRadius: message.payload.cornerRadius ?? 0,
            };
            addElement(activeLayer.id, rect);
            response = { success: true, data: { elementId: rect.id } };
            break;
          }

          case 'text:create': {
            const activeLayer = project.layers.find((l) => !l.locked);
            if (!activeLayer) {
              response = { success: false, error: 'No unlocked layer available' };
              break;
            }
            const text: TextElement = {
              id: generateId(),
              type: 'text',
              x: message.payload.x ?? 0,
              y: message.payload.y ?? 0,
              width: 200,
              height: 50,
              rotation: 0,
              opacity: 100,
              content: message.payload.content ?? 'Text',
              fontSize: message.payload.fontSize ?? 24,
              fontFamily: 'system-ui',
              fontWeight: 'normal',
              fill: message.payload.fill ?? '#ffffff',
              align: 'left',
              lineHeight: 1.2,
            };
            addElement(activeLayer.id, text);
            response = { success: true, data: { elementId: text.id } };
            break;
          }

          case 'element:delete':
            deleteElement(message.payload.elementId);
            response = { success: true, data: null };
            break;

          case 'element:transform':
            updateElement(message.payload.elementId, message.payload.transform);
            response = { success: true, data: null };
            break;

          case 'layer:create':
            const layerId = addLayer(message.payload.name);
            response = { success: true, data: { layerId } };
            break;

          case 'layer:delete':
            deleteLayer(message.payload.layerId);
            response = { success: true, data: null };
            break;

          case 'layer:set-visibility':
            setLayerVisibility(message.payload.layerId, message.payload.visible);
            response = { success: true, data: null };
            break;

          case 'layer:set-opacity':
            setLayerOpacity(message.payload.layerId, message.payload.opacity);
            response = { success: true, data: null };
            break;

          case 'layer:lock':
            setLayerLock(message.payload.layerId, message.payload.locked);
            response = { success: true, data: null };
            break;

          default:
            response = { success: false, error: `Unknown command: ${(message as any).type}` };
        }
      } catch (error) {
        response = { success: false, error: String(error) };
      }

      window.electronAPI.sendMcpResponse(requestId, response);
    });
  }, [project, getState, addElement, deleteElement, updateElement, clearCanvas, createCanvas, addLayer, deleteLayer, setLayerVisibility, setLayerOpacity, setLayerLock]);
}
```

**Step 2: Update packages/electron-app/src/renderer/App.tsx**

```tsx
import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { useMcpHandler } from './hooks/useMcpHandler';

export default function App() {
  useMcpHandler();

  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      layers={<LayersPanel />}
      properties={<PropertiesPanel />}
    />
  );
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: handle MCP commands in renderer via hook"
```

---

### Task 4.4: Complete MCP Tool Implementations

**Files:**
- Modify: `packages/mcp-server/src/index.ts`

**Step 1: Update packages/mcp-server/src/index.ts with full tool implementations**

```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { connectToElectron, sendCommand, isConnected } from './ipc-client.js';
import type { IpcMessage } from '@desai/shared';

const server = new Server(
  {
    name: 'desai-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Canvas operations
      {
        name: 'desai_canvas_create',
        description: 'Create a new canvas with specified dimensions',
        inputSchema: {
          type: 'object',
          properties: {
            width: { type: 'number', description: 'Canvas width in pixels', default: 1920 },
            height: { type: 'number', description: 'Canvas height in pixels', default: 1080 },
            background: { type: 'string', description: 'Background color (hex)', default: '#ffffff' },
          },
        },
      },
      {
        name: 'desai_canvas_get_state',
        description: 'Get the current state of the canvas including all layers and elements',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'desai_canvas_screenshot',
        description: 'Capture a screenshot of the current canvas as base64 PNG',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'desai_canvas_clear',
        description: 'Clear all elements from the canvas',
        inputSchema: { type: 'object', properties: {} },
      },

      // Layer operations
      {
        name: 'desai_layer_create',
        description: 'Create a new layer',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Layer name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'desai_layer_delete',
        description: 'Delete a layer',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'ID of the layer to delete' },
          },
          required: ['layerId'],
        },
      },
      {
        name: 'desai_layer_set_visibility',
        description: 'Show or hide a layer',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'Layer ID' },
            visible: { type: 'boolean', description: 'Whether layer is visible' },
          },
          required: ['layerId', 'visible'],
        },
      },
      {
        name: 'desai_layer_set_opacity',
        description: 'Set layer opacity (0-100)',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'Layer ID' },
            opacity: { type: 'number', description: 'Opacity 0-100' },
          },
          required: ['layerId', 'opacity'],
        },
      },
      {
        name: 'desai_layer_lock',
        description: 'Lock or unlock a layer',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'Layer ID' },
            locked: { type: 'boolean', description: 'Whether layer is locked' },
          },
          required: ['layerId', 'locked'],
        },
      },

      // Shape creation
      {
        name: 'desai_shape_rectangle',
        description: 'Create a rectangle on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            width: { type: 'number', description: 'Width' },
            height: { type: 'number', description: 'Height' },
            fill: { type: 'string', description: 'Fill color (hex)', default: '#3b82f6' },
            stroke: { type: 'string', description: 'Stroke color (hex)' },
            strokeWidth: { type: 'number', description: 'Stroke width', default: 0 },
            cornerRadius: { type: 'number', description: 'Corner radius', default: 0 },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      {
        name: 'desai_shape_ellipse',
        description: 'Create an ellipse on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position (center)' },
            y: { type: 'number', description: 'Y position (center)' },
            width: { type: 'number', description: 'Width (diameter)' },
            height: { type: 'number', description: 'Height (diameter)' },
            fill: { type: 'string', description: 'Fill color (hex)', default: '#10b981' },
            stroke: { type: 'string', description: 'Stroke color (hex)' },
            strokeWidth: { type: 'number', description: 'Stroke width', default: 0 },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },

      // Text
      {
        name: 'desai_text_create',
        description: 'Create a text element on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            content: { type: 'string', description: 'Text content' },
            fontSize: { type: 'number', description: 'Font size in pixels', default: 24 },
            fontFamily: { type: 'string', description: 'Font family', default: 'system-ui' },
            fill: { type: 'string', description: 'Text color (hex)', default: '#ffffff' },
            align: { type: 'string', enum: ['left', 'center', 'right'], default: 'left' },
          },
          required: ['x', 'y', 'content'],
        },
      },
      {
        name: 'desai_text_update',
        description: 'Update an existing text element',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'ID of the text element' },
            content: { type: 'string', description: 'New text content' },
            fontSize: { type: 'number', description: 'New font size' },
            fill: { type: 'string', description: 'New text color' },
          },
          required: ['elementId'],
        },
      },

      // Element manipulation
      {
        name: 'desai_element_transform',
        description: 'Transform an element (move, resize, rotate)',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'Element ID' },
            x: { type: 'number', description: 'New X position' },
            y: { type: 'number', description: 'New Y position' },
            width: { type: 'number', description: 'New width' },
            height: { type: 'number', description: 'New height' },
            rotation: { type: 'number', description: 'Rotation in degrees' },
          },
          required: ['elementId'],
        },
      },
      {
        name: 'desai_element_style',
        description: 'Update element style (fill, stroke, opacity)',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'Element ID' },
            fill: { type: 'string', description: 'Fill color' },
            stroke: { type: 'string', description: 'Stroke color' },
            strokeWidth: { type: 'number', description: 'Stroke width' },
            opacity: { type: 'number', description: 'Opacity 0-100' },
          },
          required: ['elementId'],
        },
      },
      {
        name: 'desai_element_delete',
        description: 'Delete an element from the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'ID of the element to delete' },
          },
          required: ['elementId'],
        },
      },
      {
        name: 'desai_element_duplicate',
        description: 'Duplicate an element',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'ID of the element to duplicate' },
          },
          required: ['elementId'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!isConnected()) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not connected to Desai app. Please ensure the app is running.',
          }),
        },
      ],
    };
  }

  let message: IpcMessage;

  switch (name) {
    case 'desai_canvas_create':
      message = {
        type: 'canvas:create',
        payload: {
          width: (args as any)?.width ?? 1920,
          height: (args as any)?.height ?? 1080,
          background: (args as any)?.background ?? '#ffffff',
        },
      };
      break;

    case 'desai_canvas_get_state':
      message = { type: 'canvas:get-state', payload: null };
      break;

    case 'desai_canvas_screenshot':
      message = { type: 'canvas:screenshot', payload: null };
      break;

    case 'desai_canvas_clear':
      message = { type: 'canvas:clear', payload: null };
      break;

    case 'desai_layer_create':
      message = { type: 'layer:create', payload: { name: (args as any).name } };
      break;

    case 'desai_layer_delete':
      message = { type: 'layer:delete', payload: { layerId: (args as any).layerId } };
      break;

    case 'desai_layer_set_visibility':
      message = {
        type: 'layer:set-visibility',
        payload: { layerId: (args as any).layerId, visible: (args as any).visible },
      };
      break;

    case 'desai_layer_set_opacity':
      message = {
        type: 'layer:set-opacity',
        payload: { layerId: (args as any).layerId, opacity: (args as any).opacity },
      };
      break;

    case 'desai_layer_lock':
      message = {
        type: 'layer:lock',
        payload: { layerId: (args as any).layerId, locked: (args as any).locked },
      };
      break;

    case 'desai_shape_rectangle':
      message = { type: 'shape:rectangle', payload: args as any };
      break;

    case 'desai_shape_ellipse':
      message = { type: 'shape:ellipse', payload: args as any };
      break;

    case 'desai_text_create':
      message = { type: 'text:create', payload: args as any };
      break;

    case 'desai_text_update':
      message = {
        type: 'text:update',
        payload: { elementId: (args as any).elementId, updates: args as any },
      };
      break;

    case 'desai_element_transform':
      message = {
        type: 'element:transform',
        payload: { elementId: (args as any).elementId, transform: args as any },
      };
      break;

    case 'desai_element_style':
      message = {
        type: 'element:style',
        payload: { elementId: (args as any).elementId, style: args as any },
      };
      break;

    case 'desai_element_delete':
      message = { type: 'element:delete', payload: { elementId: (args as any).elementId } };
      break;

    case 'desai_element_duplicate':
      message = { type: 'element:duplicate', payload: { elementId: (args as any).elementId } };
      break;

    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }) }],
      };
  }

  try {
    const response = await sendCommand(message);
    return {
      content: [{ type: 'text', text: JSON.stringify(response) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: String(error) }) }],
    };
  }
});

async function main() {
  // Try to connect to Electron app
  try {
    await connectToElectron();
  } catch (error) {
    console.error('Warning: Could not connect to Desai app:', error);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Desai MCP Server running on stdio');
}

main().catch(console.error);
```

**Step 2: Build and commit**

```bash
cd packages/mcp-server && pnpm build
git add .
git commit -m "feat: implement all MCP tools with IPC communication"
```

---

## Phase 5: Testing & Polish

### Task 5.1: Add MCP Server Configuration

**Files:**
- Create: `mcp-config-example.json`

**Step 1: Create mcp-config-example.json**

```json
{
  "mcpServers": {
    "desai": {
      "command": "node",
      "args": ["/path/to/desai/packages/mcp-server/dist/index.js"]
    }
  }
}
```

**Step 2: Update root package.json scripts**

Add to package.json scripts:
```json
{
  "scripts": {
    "dev": "pnpm --filter electron-app dev",
    "build": "pnpm -r build",
    "mcp:start": "node packages/mcp-server/dist/index.js"
  }
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "docs: add MCP configuration example"
```

---

### Task 5.2: Test End-to-End

**Manual testing steps:**

1. Build all packages:
```bash
pnpm build
```

2. Start Electron app:
```bash
pnpm dev
```

3. In a separate terminal, add MCP server to Claude Code config:
- Edit `~/.config/claude-code/mcp.json`
- Add the desai server configuration

4. Test with Claude Code:
- Ask Claude to create a rectangle at position (100, 100)
- Ask Claude to take a screenshot
- Ask Claude to add text saying "Hello Desai"
- Verify elements appear in the app

**Step: Commit final state**

```bash
git add .
git commit -m "feat: complete Desai v1 implementation"
```

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Scaffolding | 1.1-1.3 | Monorepo, shared types, Electron app |
| Phase 2: State | 2.1 | Zustand store with history |
| Phase 3: UI | 3.1-3.5 | Layout, Toolbar, Canvas, Layers, Properties |
| Phase 4: MCP | 4.1-4.4 | MCP server with full tool implementations |
| Phase 5: Testing | 5.1-5.2 | Configuration and E2E testing |

**Total tasks:** 12 major tasks, each with 5-12 steps

**Key files created:**
- `packages/shared/src/types.ts` - All TypeScript types
- `packages/electron-app/src/renderer/store/projectStore.ts` - State management
- `packages/electron-app/src/renderer/components/*` - UI components
- `packages/mcp-server/src/index.ts` - MCP server with all tools
- `packages/mcp-server/src/ipc-client.ts` - IPC communication
