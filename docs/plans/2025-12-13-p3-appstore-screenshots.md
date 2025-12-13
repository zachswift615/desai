# P3: App Store Screenshot Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Claude Code to create App Store screenshot designs with gradient backgrounds, styled text, multiple designs, and PNG export.

**Architecture:** Extend the existing Zustand store to support multiple designs (artboards). Add gradient fill support to rectangles. Enhance text with shadows and fontWeight via MCP. Add export functionality via IPC to main process. UI gets a design switcher in the toolbar area.

**Tech Stack:** React 18, Zustand 4.5, Electron 28 (capturePage for export), TypeScript, node-ipc for MCP communication.

---

## Task 1: Add Gradient Fill Support to Types

**Files:**
- Modify: `packages/shared/src/types.ts:45-51`

**Step 1: Define Gradient type**

Add after line 44 (after BaseElement interface):

```typescript
export interface GradientStop {
  color: string;
  position: number; // 0-100
}

export interface LinearGradient {
  type: 'linear';
  angle: number; // degrees, 0 = left-to-right, 90 = top-to-bottom
  stops: GradientStop[];
}

export type Fill = string | LinearGradient;
```

**Step 2: Update RectElement to use Fill type**

Change RectElement interface:

```typescript
export interface RectElement extends BaseElement {
  type: 'rect';
  fill: Fill;  // Changed from string to Fill
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}
```

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add gradient fill type support for rectangles"
```

---

## Task 2: Render Gradient Fills in CanvasElement

**Files:**
- Modify: `packages/electron-app/src/renderer/components/Canvas/CanvasElement.tsx`

**Step 1: Add gradient CSS helper function**

Add at top of file after imports:

```typescript
function fillToCSS(fill: string | { type: 'linear'; angle: number; stops: { color: string; position: number }[] }): string {
  if (typeof fill === 'string') {
    return fill;
  }
  if (fill.type === 'linear') {
    const stops = fill.stops
      .map(s => `${s.color} ${s.position}%`)
      .join(', ');
    return `linear-gradient(${fill.angle}deg, ${stops})`;
  }
  return '#ffffff';
}
```

**Step 2: Update rectangle rendering**

Find the rect rendering section (around line 150-180) and change:

```typescript
// Before:
backgroundColor: element.fill,

// After:
background: fillToCSS(element.fill),
```

**Step 3: Run build to verify**

```bash
cd /Users/zachswift/projects/desai && pnpm build
```
Expected: Build succeeds with no type errors

**Step 4: Commit**

```bash
git add packages/electron-app/src/renderer/components/Canvas/CanvasElement.tsx
git commit -m "feat: render gradient fills for rectangles"
```

---

## Task 3: Add Gradient Support to MCP Tool

**Files:**
- Modify: `packages/mcp-server/src/index.ts:117-135`

**Step 1: Update rectangle tool schema**

Update the `desai_shape_rectangle` tool definition:

```typescript
{
  name: 'desai_shape_rectangle',
  description: 'Create a rectangle on the canvas. Supports solid colors or linear gradients.',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X position' },
      y: { type: 'number', description: 'Y position' },
      width: { type: 'number', description: 'Width' },
      height: { type: 'number', description: 'Height' },
      fill: {
        oneOf: [
          { type: 'string', description: 'Solid fill color (hex)' },
          {
            type: 'object',
            description: 'Linear gradient',
            properties: {
              type: { type: 'string', enum: ['linear'] },
              angle: { type: 'number', description: 'Gradient angle in degrees (0=left-to-right, 90=top-to-bottom, 180=right-to-left)' },
              stops: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    color: { type: 'string', description: 'Stop color (hex)' },
                    position: { type: 'number', description: 'Stop position (0-100)' }
                  },
                  required: ['color', 'position']
                }
              }
            },
            required: ['type', 'angle', 'stops']
          }
        ],
        default: '#3b82f6'
      },
      stroke: { type: 'string', description: 'Stroke color (hex)' },
      strokeWidth: { type: 'number', description: 'Stroke width', default: 0 },
      cornerRadius: { type: 'number', description: 'Corner radius', default: 0 },
    },
    required: ['x', 'y', 'width', 'height'],
  },
},
```

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add packages/mcp-server/src/index.ts
git commit -m "feat: add gradient fill support to rectangle MCP tool"
```

---

## Task 4: Add Text Shadow Support to Types

**Files:**
- Modify: `packages/shared/src/types.ts:70-79`

**Step 1: Add TextShadow interface**

Add before TextElement:

```typescript
export interface TextShadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}
```

**Step 2: Update TextElement**

```typescript
export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  shadow?: TextShadow;  // Add this line
}
```

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add text shadow type support"
```

---

## Task 5: Render Text Shadows

**Files:**
- Modify: `packages/electron-app/src/renderer/components/Canvas/CanvasElement.tsx`

**Step 1: Update text element rendering**

Find the text rendering section (look for `element.type === 'text'`) and add textShadow:

```typescript
// In the text element style object, add:
textShadow: element.shadow
  ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${element.shadow.color}`
  : undefined,
```

**Step 2: Also update EditableText component**

In the EditableText component's style object, add the same:

```typescript
textShadow: element.shadow
  ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${element.shadow.color}`
  : undefined,
```

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add packages/electron-app/src/renderer/components/Canvas/CanvasElement.tsx
git commit -m "feat: render text shadows"
```

---

## Task 6: Add Text Shadow and FontWeight to MCP Tool

**Files:**
- Modify: `packages/mcp-server/src/index.ts:154-171`
- Modify: `packages/electron-app/src/renderer/hooks/useMcpHandler.ts:111-137`

**Step 1: Update text_create tool schema**

```typescript
{
  name: 'desai_text_create',
  description: 'Create a text element on the canvas',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X position' },
      y: { type: 'number', description: 'Y position' },
      width: { type: 'number', description: 'Text box width', default: 400 },
      height: { type: 'number', description: 'Text box height', default: 100 },
      content: { type: 'string', description: 'Text content' },
      fontSize: { type: 'number', description: 'Font size in pixels', default: 24 },
      fontFamily: { type: 'string', description: 'Font family', default: 'system-ui' },
      fontWeight: { type: 'string', description: 'Font weight (normal, bold, 100-900)', default: 'normal' },
      fill: { type: 'string', description: 'Text color (hex)', default: '#ffffff' },
      align: { type: 'string', enum: ['left', 'center', 'right'], default: 'left' },
      shadow: {
        type: 'object',
        description: 'Text shadow',
        properties: {
          x: { type: 'number', description: 'Horizontal offset' },
          y: { type: 'number', description: 'Vertical offset' },
          blur: { type: 'number', description: 'Blur radius' },
          color: { type: 'string', description: 'Shadow color (hex or rgba)' }
        }
      }
    },
    required: ['x', 'y', 'content'],
  },
},
```

**Step 2: Update useMcpHandler text:create handler**

In `useMcpHandler.ts`, update the text:create case:

```typescript
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
    width: message.payload.width ?? 400,
    height: message.payload.height ?? 100,
    rotation: 0,
    opacity: 100,
    content: message.payload.content ?? 'Text',
    fontSize: message.payload.fontSize ?? 24,
    fontFamily: message.payload.fontFamily ?? 'system-ui',
    fontWeight: message.payload.fontWeight ?? 'normal',
    fill: message.payload.fill ?? '#ffffff',
    align: message.payload.align ?? 'left',
    lineHeight: 1.2,
    shadow: message.payload.shadow,
  };
  addElement(activeLayer.id, text);
  response = { success: true, data: { elementId: text.id } };
  break;
}
```

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add packages/mcp-server/src/index.ts packages/electron-app/src/renderer/hooks/useMcpHandler.ts
git commit -m "feat: add text shadow and fontWeight to MCP text tool"
```

---

## Task 7: Add PNG Export IPC Handler

**Files:**
- Modify: `packages/electron-app/src/main/index.ts`
- Modify: `packages/electron-app/src/preload/index.ts`

**Step 1: Add export IPC handler in main process**

Add after the `select-image` handler:

```typescript
// IPC handler for PNG export - exports visible canvas area
ipcMain.handle('export-png', async (_event, { scale = 1 } = {}) => {
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
  const pngBuffer = image.toPNG({ scaleFactor: scale });
  fs.writeFileSync(result.filePath, pngBuffer);

  return result.filePath;
});
```

**Step 2: Expose in preload**

Add to the `contextBridge.exposeInMainWorld` call in preload:

```typescript
exportPng: (options?: { scale?: number }) => ipcRenderer.invoke('export-png', options),
```

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add packages/electron-app/src/main/index.ts packages/electron-app/src/preload/index.ts
git commit -m "feat: add PNG export IPC handler with save dialog"
```

---

## Task 8: Add Export MCP Tool

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/electron-app/src/renderer/hooks/useMcpHandler.ts`

**Step 1: Add export tool definition to MCP server**

Add to the tools array:

```typescript
{
  name: 'desai_export_png',
  description: 'Export the current canvas as a PNG file. Opens save dialog for user to choose location.',
  inputSchema: {
    type: 'object',
    properties: {
      scale: { type: 'number', description: 'Scale factor for export (1 = 100%, 2 = 200%)', default: 1 },
    },
  },
},
```

**Step 2: Add case handler in MCP server**

Add to the switch statement:

```typescript
case 'desai_export_png':
  message = { type: 'export:png', payload: { scale: (args as any)?.scale ?? 1 } };
  break;
```

**Step 3: Add export handler in useMcpHandler**

Update the Window interface to include exportPng:

```typescript
exportPng: (options?: { scale?: number }) => Promise<string | null>;
```

Add case in the switch:

```typescript
case 'export:png':
  const exportPath = await window.electronAPI.exportPng({ scale: message.payload.scale });
  response = exportPath
    ? { success: true, data: { path: exportPath } }
    : { success: false, error: 'Export cancelled or failed' };
  break;
```

**Step 4: Build and verify**

```bash
pnpm build
```

**Step 5: Commit**

```bash
git add packages/mcp-server/src/index.ts packages/electron-app/src/renderer/hooks/useMcpHandler.ts
git commit -m "feat: add PNG export MCP tool"
```

---

## Task 9: Multi-Design Store Architecture

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/electron-app/src/renderer/store/projectStore.ts`

**Step 1: Add Design type to shared types**

Add after DesaiProject:

```typescript
export interface Design {
  id: string;
  name: string;
  project: DesaiProject;
}

export interface DesaiWorkspace {
  designs: Design[];
  activeDesignId: string;
  clipboard: Element | null;
}
```

**Step 2: Refactor store to support multiple designs**

This is a significant refactor. Update `projectStore.ts`:

```typescript
import { create } from 'zustand';
import type {
  DesaiProject,
  Design,
  Layer,
  Element,
  CanvasState,
  Viewport,
} from '@desai/shared';
import { generateId } from '../utils/id';

interface ProjectStore {
  // Multi-design state
  designs: Design[];
  activeDesignId: string;
  clipboard: Element | null;

  // Current design accessors
  getActiveDesign: () => Design | undefined;
  getActiveProject: () => DesaiProject;

  // Design actions
  createDesign: (name: string, width: number, height: number, background: string) => string;
  deleteDesign: (designId: string) => void;
  switchDesign: (designId: string) => void;
  renameDesign: (designId: string, name: string) => void;
  duplicateDesign: (designId: string) => string;
  listDesigns: () => { id: string; name: string }[];

  // Clipboard
  copyElement: (elementId: string) => void;
  pasteElement: () => string | null;

  // Existing state (per-design)
  selection: string[];
  viewport: Viewport;
  history: { past: DesaiProject[]; future: DesaiProject[] };
  activeTool: string;
  editingTextId: string | null;

  // ... keep all existing actions but modify to work on activeDesign
  // (The actions stay the same interface, just internally work on activeDesign)

  createCanvas: (width: number, height: number, background: string) => void;
  clearCanvas: () => void;
  getState: () => CanvasState;
  addLayer: (name: string) => string;
  deleteLayer: (layerId: string) => void;
  reorderLayer: (layerId: string, newIndex: number) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setLayerLock: (layerId: string, locked: boolean) => void;
  addElement: (layerId: string, element: Element) => void;
  updateElement: (elementId: string, updates: Partial<Element>) => void;
  updateElementNoHistory: (elementId: string, updates: Partial<Element>) => void;
  deleteElement: (elementId: string) => void;
  duplicateElement: (elementId: string) => string | null;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setActiveTool: (tool: string) => void;
  setEditingText: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Backward compatibility - expose project for existing code
  project: DesaiProject;
}

const createDefaultProject = (): DesaiProject => ({
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
});

const createDefaultDesign = (name: string, width: number, height: number, background: string): Design => ({
  id: generateId(),
  name,
  project: {
    id: generateId(),
    name,
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
});

export const useProjectStore = create<ProjectStore>((set, get) => {
  const initialDesign = createDefaultDesign('Design 1', 1920, 1080, '#ffffff');

  return {
    designs: [initialDesign],
    activeDesignId: initialDesign.id,
    clipboard: null,

    // Computed property for backward compatibility
    get project() {
      const design = get().designs.find(d => d.id === get().activeDesignId);
      return design?.project ?? createDefaultProject();
    },

    getActiveDesign: () => {
      const { designs, activeDesignId } = get();
      return designs.find(d => d.id === activeDesignId);
    },

    getActiveProject: () => {
      const design = get().getActiveDesign();
      return design?.project ?? createDefaultProject();
    },

    createDesign: (name, width, height, background) => {
      const newDesign = createDefaultDesign(name, width, height, background);
      set(state => ({
        designs: [...state.designs, newDesign],
        activeDesignId: newDesign.id,
        selection: [],
        history: { past: [], future: [] },
      }));
      return newDesign.id;
    },

    deleteDesign: (designId) => {
      const { designs, activeDesignId } = get();
      if (designs.length <= 1) return; // Keep at least one design

      const newDesigns = designs.filter(d => d.id !== designId);
      const newActiveId = activeDesignId === designId
        ? newDesigns[0].id
        : activeDesignId;

      set({
        designs: newDesigns,
        activeDesignId: newActiveId,
        selection: [],
      });
    },

    switchDesign: (designId) => {
      const { designs } = get();
      if (designs.some(d => d.id === designId)) {
        set({
          activeDesignId: designId,
          selection: [],
          history: { past: [], future: [] },
          viewport: { zoom: 1, panX: 0, panY: 0 },
        });
      }
    },

    renameDesign: (designId, name) => {
      set(state => ({
        designs: state.designs.map(d =>
          d.id === designId ? { ...d, name } : d
        ),
      }));
    },

    duplicateDesign: (designId) => {
      const { designs } = get();
      const source = designs.find(d => d.id === designId);
      if (!source) return '';

      const newDesign: Design = {
        id: generateId(),
        name: `${source.name} (Copy)`,
        project: structuredClone(source.project),
      };
      newDesign.project.id = generateId();

      set(state => ({
        designs: [...state.designs, newDesign],
        activeDesignId: newDesign.id,
      }));

      return newDesign.id;
    },

    listDesigns: () => {
      return get().designs.map(d => ({ id: d.id, name: d.name }));
    },

    copyElement: (elementId) => {
      const project = get().getActiveProject();
      for (const layer of project.layers) {
        const element = layer.elements.find(el => el.id === elementId);
        if (element) {
          set({ clipboard: structuredClone(element) });
          return;
        }
      }
    },

    pasteElement: () => {
      const { clipboard, getActiveProject, pushHistory } = get();
      if (!clipboard) return null;

      const project = getActiveProject();
      const activeLayer = project.layers.find(l => !l.locked);
      if (!activeLayer) return null;

      pushHistory();
      const newElement = {
        ...structuredClone(clipboard),
        id: generateId(),
        x: clipboard.x + 20,
        y: clipboard.y + 20,
      };

      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(l =>
                    l.id === activeLayer.id
                      ? { ...l, elements: [...l.elements, newElement] }
                      : l
                  ),
                },
              }
            : d
        ),
        selection: [newElement.id],
      }));

      return newElement.id;
    },

    // Initialize remaining state
    selection: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
    history: { past: [], future: [] },
    activeTool: 'select',
    editingTextId: null,

    // Modify existing actions to work on active design
    // Helper to update active design's project
    _updateProject: (updater: (project: DesaiProject) => DesaiProject) => {
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? { ...d, project: updater(d.project) }
            : d
        ),
      }));
    },

    createCanvas: (width, height, background) => {
      const { pushHistory } = get();
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  id: generateId(),
                  name: d.name,
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
              }
            : d
        ),
        selection: [],
        history: { past: [], future: [] },
      }));
    },

    clearCanvas: () => {
      const { pushHistory, getActiveProject } = get();
      const project = getActiveProject();
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(layer => ({ ...layer, elements: [] })),
                },
              }
            : d
        ),
        selection: [],
      }));
    },

    getState: () => {
      const { getActiveProject, selection, viewport, history } = get();
      return {
        project: getActiveProject(),
        selection,
        viewport,
        history: {
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        },
      };
    },

    addLayer: (name) => {
      const { pushHistory } = get();
      pushHistory();
      const newLayer: Layer = {
        id: generateId(),
        name,
        visible: true,
        locked: false,
        opacity: 100,
        elements: [],
      };
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? { ...d, project: { ...d.project, layers: [newLayer, ...d.project.layers] } }
            : d
        ),
      }));
      return newLayer.id;
    },

    deleteLayer: (layerId) => {
      const { getActiveProject, pushHistory } = get();
      if (getActiveProject().layers.length <= 1) return;
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.filter(l => l.id !== layerId),
                },
              }
            : d
        ),
      }));
    },

    reorderLayer: (layerId, newIndex) => {
      const { getActiveProject, pushHistory } = get();
      const layers = [...getActiveProject().layers];
      const currentIndex = layers.findIndex(l => l.id === layerId);
      if (currentIndex === -1) return;
      pushHistory();
      const [layer] = layers.splice(currentIndex, 1);
      layers.splice(newIndex, 0, layer);
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? { ...d, project: { ...d.project, layers } }
            : d
        ),
      }));
    },

    setLayerVisibility: (layerId, visible) => {
      const { pushHistory } = get();
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(l =>
                    l.id === layerId ? { ...l, visible } : l
                  ),
                },
              }
            : d
        ),
      }));
    },

    setLayerOpacity: (layerId, opacity) => {
      const { pushHistory } = get();
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(l =>
                    l.id === layerId ? { ...l, opacity } : l
                  ),
                },
              }
            : d
        ),
      }));
    },

    setLayerLock: (layerId, locked) => {
      const { pushHistory } = get();
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(l =>
                    l.id === layerId ? { ...l, locked } : l
                  ),
                },
              }
            : d
        ),
      }));
    },

    addElement: (layerId, element) => {
      const { pushHistory } = get();
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(l =>
                    l.id === layerId ? { ...l, elements: [...l.elements, element] } : l
                  ),
                },
              }
            : d
        ),
      }));
    },

    updateElement: (elementId, updates) => {
      const { pushHistory } = get();
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(layer => ({
                    ...layer,
                    elements: layer.elements.map(el =>
                      el.id === elementId ? { ...el, ...updates } : el
                    ),
                  })),
                },
              }
            : d
        ),
      }));
    },

    updateElementNoHistory: (elementId, updates) => {
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(layer => ({
                    ...layer,
                    elements: layer.elements.map(el =>
                      el.id === elementId ? { ...el, ...updates } : el
                    ),
                  })),
                },
              }
            : d
        ),
      }));
    },

    deleteElement: (elementId) => {
      const { pushHistory, selection } = get();
      pushHistory();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === state.activeDesignId
            ? {
                ...d,
                project: {
                  ...d.project,
                  layers: d.project.layers.map(layer => ({
                    ...layer,
                    elements: layer.elements.filter(el => el.id !== elementId),
                  })),
                },
              }
            : d
        ),
        selection: selection.filter(id => id !== elementId),
      }));
    },

    duplicateElement: (elementId) => {
      const { getActiveProject, pushHistory } = get();
      const project = getActiveProject();
      for (const layer of project.layers) {
        const element = layer.elements.find(el => el.id === elementId);
        if (element) {
          pushHistory();
          const newElement = {
            ...element,
            id: generateId(),
            x: element.x + 20,
            y: element.y + 20,
          };
          set(state => ({
            designs: state.designs.map(d =>
              d.id === state.activeDesignId
                ? {
                    ...d,
                    project: {
                      ...d.project,
                      layers: d.project.layers.map(l =>
                        l.id === layer.id
                          ? { ...l, elements: [...l.elements, newElement] }
                          : l
                      ),
                    },
                  }
                : d
            ),
            selection: [newElement.id],
          }));
          return newElement.id;
        }
      }
      return null;
    },

    setSelection: (ids) => set({ selection: ids }),
    clearSelection: () => set({ selection: [] }),

    setViewport: (viewport) =>
      set(state => ({ viewport: { ...state.viewport, ...viewport } })),

    setActiveTool: (tool) => set({ activeTool: tool }),

    setEditingText: (id) => set({ editingTextId: id }),

    pushHistory: () => {
      const { getActiveProject, history } = get();
      set({
        history: {
          past: [...history.past.slice(-49), structuredClone(getActiveProject())],
          future: [],
        },
      });
    },

    undo: () => {
      const { history, getActiveProject, activeDesignId } = get();
      if (history.past.length === 0) return;
      const previous = history.past[history.past.length - 1];
      const current = getActiveProject();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === activeDesignId ? { ...d, project: previous } : d
        ),
        history: {
          past: history.past.slice(0, -1),
          future: [current, ...history.future],
        },
      }));
    },

    redo: () => {
      const { history, getActiveProject, activeDesignId } = get();
      if (history.future.length === 0) return;
      const next = history.future[0];
      const current = getActiveProject();
      set(state => ({
        designs: state.designs.map(d =>
          d.id === activeDesignId ? { ...d, project: next } : d
        ),
        history: {
          past: [...history.past, current],
          future: history.future.slice(1),
        },
      }));
    },
  };
});
```

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/electron-app/src/renderer/store/projectStore.ts
git commit -m "feat: refactor store to support multiple designs"
```

---

## Task 10: Add Design MCP Tools

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/electron-app/src/renderer/hooks/useMcpHandler.ts`
- Modify: `packages/shared/src/types.ts` (add IPC message types)

**Step 1: Add IPC message types**

Add to the IpcMessage union in `types.ts`:

```typescript
| { type: 'design:create'; payload: { name: string; width: number; height: number; background: string } }
| { type: 'design:list'; payload: null }
| { type: 'design:switch'; payload: { designId: string } }
| { type: 'design:delete'; payload: { designId: string } }
| { type: 'design:duplicate'; payload: { designId: string } }
| { type: 'element:copy'; payload: { elementId: string } }
| { type: 'element:paste'; payload: null }
```

**Step 2: Add MCP tool definitions**

Add to tools array in `mcp-server/src/index.ts`:

```typescript
// Design operations
{
  name: 'desai_design_create',
  description: 'Create a new design/artboard with specified dimensions',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Design name' },
      width: { type: 'number', description: 'Canvas width in pixels' },
      height: { type: 'number', description: 'Canvas height in pixels' },
      background: { type: 'string', description: 'Background color (hex)', default: '#ffffff' },
    },
    required: ['name', 'width', 'height'],
  },
},
{
  name: 'desai_design_list',
  description: 'List all open designs',
  inputSchema: { type: 'object', properties: {} },
},
{
  name: 'desai_design_switch',
  description: 'Switch to a different design by ID',
  inputSchema: {
    type: 'object',
    properties: {
      designId: { type: 'string', description: 'ID of the design to switch to' },
    },
    required: ['designId'],
  },
},
{
  name: 'desai_design_duplicate',
  description: 'Duplicate an existing design',
  inputSchema: {
    type: 'object',
    properties: {
      designId: { type: 'string', description: 'ID of the design to duplicate' },
    },
    required: ['designId'],
  },
},
{
  name: 'desai_element_copy',
  description: 'Copy an element to clipboard (for pasting into any design)',
  inputSchema: {
    type: 'object',
    properties: {
      elementId: { type: 'string', description: 'ID of the element to copy' },
    },
    required: ['elementId'],
  },
},
{
  name: 'desai_element_paste',
  description: 'Paste the copied element into the current design',
  inputSchema: { type: 'object', properties: {} },
},
```

**Step 3: Add case handlers in MCP server**

Add to switch statement:

```typescript
case 'desai_design_create':
  message = { type: 'design:create', payload: args as any };
  break;

case 'desai_design_list':
  message = { type: 'design:list', payload: null };
  break;

case 'desai_design_switch':
  message = { type: 'design:switch', payload: { designId: (args as any).designId } };
  break;

case 'desai_design_duplicate':
  message = { type: 'design:duplicate', payload: { designId: (args as any).designId } };
  break;

case 'desai_element_copy':
  message = { type: 'element:copy', payload: { elementId: (args as any).elementId } };
  break;

case 'desai_element_paste':
  message = { type: 'element:paste', payload: null };
  break;
```

**Step 4: Add handlers in useMcpHandler**

Add cases:

```typescript
case 'design:create': {
  const designId = createDesign(
    message.payload.name,
    message.payload.width,
    message.payload.height,
    message.payload.background ?? '#ffffff'
  );
  response = { success: true, data: { designId } };
  break;
}

case 'design:list': {
  const designs = listDesigns();
  response = { success: true, data: { designs } };
  break;
}

case 'design:switch': {
  switchDesign(message.payload.designId);
  response = { success: true, data: null };
  break;
}

case 'design:duplicate': {
  const newId = duplicateDesign(message.payload.designId);
  response = newId
    ? { success: true, data: { designId: newId } }
    : { success: false, error: 'Design not found' };
  break;
}

case 'element:copy': {
  copyElement(message.payload.elementId);
  response = { success: true, data: null };
  break;
}

case 'element:paste': {
  const newId = pasteElement();
  response = newId
    ? { success: true, data: { elementId: newId } }
    : { success: false, error: 'Nothing to paste or no unlocked layer' };
  break;
}
```

**Step 5: Update useMcpHandler imports**

Add the new store actions to the hook's store usage:

```typescript
const createDesign = useProjectStore((s) => s.createDesign);
const listDesigns = useProjectStore((s) => s.listDesigns);
const switchDesign = useProjectStore((s) => s.switchDesign);
const duplicateDesign = useProjectStore((s) => s.duplicateDesign);
const copyElement = useProjectStore((s) => s.copyElement);
const pasteElement = useProjectStore((s) => s.pasteElement);
```

**Step 6: Build and verify**

```bash
pnpm build
```

**Step 7: Commit**

```bash
git add packages/shared/src/types.ts packages/mcp-server/src/index.ts packages/electron-app/src/renderer/hooks/useMcpHandler.ts
git commit -m "feat: add design management MCP tools"
```

---

## Task 11: Add Design Switcher UI

**Files:**
- Create: `packages/electron-app/src/renderer/components/DesignTabs/DesignTabs.tsx`
- Modify: `packages/electron-app/src/renderer/components/Layout.tsx`

**Step 1: Create DesignTabs component**

```typescript
import React from 'react';
import { useProjectStore } from '../../store';

export function DesignTabs() {
  const designs = useProjectStore((s) => s.designs);
  const activeDesignId = useProjectStore((s) => s.activeDesignId);
  const switchDesign = useProjectStore((s) => s.switchDesign);
  const createDesign = useProjectStore((s) => s.createDesign);

  const handleNewDesign = () => {
    const name = `Design ${designs.length + 1}`;
    createDesign(name, 1920, 1080, '#ffffff');
  };

  return (
    <div className="flex items-center gap-1 bg-gray-900 px-2 py-1 border-b border-gray-700">
      {designs.map((design) => (
        <button
          key={design.id}
          onClick={() => switchDesign(design.id)}
          className={`px-3 py-1 text-sm rounded-t ${
            design.id === activeDesignId
              ? 'bg-gray-800 text-white'
              : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          {design.name}
        </button>
      ))}
      <button
        onClick={handleNewDesign}
        className="px-2 py-1 text-sm text-gray-400 hover:text-white"
        title="New Design"
      >
        +
      </button>
    </div>
  );
}
```

**Step 2: Add DesignTabs to Layout**

Update Layout.tsx to include DesignTabs above the main content:

```typescript
import { DesignTabs } from './DesignTabs/DesignTabs';

// In the render, add above the flex row:
<div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
  <DesignTabs />
  <div className="flex flex-1 overflow-hidden">
    {/* ... existing layout ... */}
  </div>
</div>
```

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add packages/electron-app/src/renderer/components/DesignTabs/DesignTabs.tsx packages/electron-app/src/renderer/components/Layout.tsx
git commit -m "feat: add design tabs UI for switching between designs"
```

---

## Task 12: Add Copy/Paste Keyboard Shortcuts

**Files:**
- Modify: `packages/electron-app/src/renderer/hooks/useKeyboardShortcuts.ts`

**Step 1: Add copy/paste shortcuts**

Add to the keyboard handler:

```typescript
// Cmd/Ctrl+C: Copy
if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
  e.preventDefault();
  if (selection.length > 0) {
    copyElement(selection[0]); // Copy first selected element
  }
  return;
}

// Cmd/Ctrl+V: Paste
if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
  e.preventDefault();
  pasteElement();
  return;
}
```

**Step 2: Add store actions to hook**

```typescript
const copyElement = useProjectStore((s) => s.copyElement);
const pasteElement = useProjectStore((s) => s.pasteElement);
```

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add packages/electron-app/src/renderer/hooks/useKeyboardShortcuts.ts
git commit -m "feat: add Cmd+C/Cmd+V keyboard shortcuts for copy/paste"
```

---

## Task 13: Final Integration Test

**Step 1: Rebuild everything**

```bash
pnpm build
```

**Step 2: Manual verification checklist**

Test in the app:
- [ ] Create rectangle with gradient: `desai_shape_rectangle` with gradient fill
- [ ] Create text with shadow: `desai_text_create` with shadow property
- [ ] Create new design: `desai_design_create` at 1290x2796
- [ ] Switch between designs: `desai_design_switch`
- [ ] Copy element and paste to different design
- [ ] Export PNG: `desai_export_png`
- [ ] Verify design tabs show all designs

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete P3 App Store screenshot features"
git push
```

---

## Summary

| Task | Description | Complexity |
|------|-------------|------------|
| 1 | Gradient fill types | Simple |
| 2 | Render gradients | Simple |
| 3 | Gradient MCP tool | Simple |
| 4 | Text shadow types | Simple |
| 5 | Render text shadows | Simple |
| 6 | Text shadow MCP tool | Simple |
| 7 | PNG export IPC | Medium |
| 8 | Export MCP tool | Simple |
| 9 | Multi-design store | Complex |
| 10 | Design MCP tools | Medium |
| 11 | Design tabs UI | Simple |
| 12 | Copy/paste shortcuts | Simple |
| 13 | Integration test | Testing |

**Total: 13 tasks**

After completing this plan, Claude Code will be able to:
1. Create 5 iPhone screenshot designs at 1290×2796
2. Add gradient backgrounds (`#1C1C1E` to `#000000`)
3. Add bold headlines with drop shadows
4. Import app screenshots
5. Copy consistent elements between designs
6. Export all as PNGs

---

**Plan complete and saved to `docs/plans/2025-12-13-p3-appstore-screenshots.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
