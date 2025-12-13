# Desai - AI-Native Design Tool

**Date:** 2025-12-12
**Status:** Design Approved

## Overview

Desai is an AI-native design tool that gives Claude Code the ability to create and manipulate designs on a canvas. It combines a standalone Electron desktop app with an MCP server that exposes design tools to Claude.

**Name origin:** Design + AI = Desai

## Requirements

- **Use case**: General-purpose design (marketing assets, UI/UX mockups, creative work)
- **Platform**: Electron desktop app
- **Features v1**: Layers, shapes, text, image import, crop, basic filters
- **Rendering**: HTML/SVG-first (inspired by Canva's approach)
- **AI vision**: Screenshots + structured DOM/state export
- **Integration**: MCP Server for Claude Code tools

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code                              │
│  (uses MCP tools to control Desai)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol (stdio)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Desai MCP Server                            │
│  - Exposes design tools (create_shape, move_layer, etc.)    │
│  - Communicates with Electron app via IPC                   │
│  - Handles screenshot capture and state export              │
└─────────────────────┬───────────────────────────────────────┘
                      │ IPC (named pipe / socket)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Desai Electron App                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Main Process                                        │    │
│  │  - Window management                                 │    │
│  │  - File I/O (save/load projects)                    │    │
│  │  - IPC bridge to MCP server                         │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Renderer Process (React + TypeScript)              │    │
│  │  - HTML/SVG canvas with layers                      │    │
│  │  - Interactive tools (select, move, resize)         │    │
│  │  - Properties panel                                  │    │
│  │  - Layer panel                                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Why decoupled architecture?**
- Electron app works standalone (users can design manually)
- MCP server can start/stop independently
- Easier testing - can mock either side
- Future: MCP could connect to web version too

## MCP Tools API

### Canvas Operations
```typescript
desai_canvas_create({ width: 1920, height: 1080, background: "#ffffff" })
desai_canvas_get_state() // Returns full JSON of all layers/elements
desai_canvas_screenshot() // Returns base64 PNG for visual analysis
desai_canvas_clear()
```

### Layer Management
```typescript
desai_layer_create({ name: "Header", type: "group" })
desai_layer_select(layerId)
desai_layer_delete(layerId)
desai_layer_reorder(layerId, newIndex) // Move in z-stack
desai_layer_set_visibility(layerId, visible: boolean)
desai_layer_set_opacity(layerId, opacity: 0-100)
desai_layer_lock(layerId, locked: boolean)
```

### Shape Creation
```typescript
desai_shape_rectangle({ x, y, width, height, fill, stroke, cornerRadius })
desai_shape_ellipse({ cx, cy, rx, ry, fill, stroke })
desai_shape_line({ x1, y1, x2, y2, stroke, strokeWidth })
desai_shape_polygon({ points: [[x,y]...], fill, stroke })
desai_shape_path({ d: "M0,0 L10,10...", fill, stroke }) // SVG path
```

### Text
```typescript
desai_text_create({ x, y, content, fontSize, fontFamily, fill, align })
desai_text_update(elementId, { content?, fontSize?, ... })
```

### Images
```typescript
desai_image_import({ src: "path/or/url", x, y, width?, height? })
desai_image_crop(elementId, { x, y, width, height })
desai_image_filter(elementId, { brightness?, contrast?, saturate?, blur? })
```

### Element Manipulation (works on any element)
```typescript
desai_element_transform(elementId, { x?, y?, width?, height?, rotation? })
desai_element_style(elementId, { fill?, stroke?, opacity?, ... })
desai_element_duplicate(elementId)
desai_element_delete(elementId)
desai_element_group(elementIds[])
desai_element_ungroup(groupId)
```

### Export
```typescript
desai_export_png({ scale?: 1 })
desai_export_svg()
desai_export_pdf()
desai_project_save(filePath)
desai_project_load(filePath)
```

## Data Model

```typescript
interface DesaiProject {
  id: string;
  name: string;
  canvas: {
    width: number;
    height: number;
    background: string; // color or gradient
  };
  layers: Layer[];
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0-100
  elements: Element[];
}

type Element = RectElement | EllipseElement | TextElement | ImageElement | GroupElement | PathElement;

interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number;
}

interface RectElement extends BaseElement {
  type: "rect";
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

interface TextElement extends BaseElement {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: string;
  align: "left" | "center" | "right";
  lineHeight: number;
}

interface ImageElement extends BaseElement {
  type: "image";
  src: string; // path or data URL
  naturalWidth: number;
  naturalHeight: number;
  filters: {
    brightness: number;
    contrast: number;
    saturate: number;
    blur: number;
  };
  crop?: { x: number; y: number; width: number; height: number };
}

interface GroupElement extends BaseElement {
  type: "group";
  children: Element[];
}
```

## UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Menu Bar (File, Edit, View, Help)                               │
├────────────┬─────────────────────────────────────┬───────────────┤
│            │                                     │               │
│  Toolbar   │                                     │  Properties   │
│            │                                     │  Panel        │
│  - Select  │                                     │               │
│  - Move    │         Canvas Area                 │  - Position   │
│  - Rect    │                                     │  - Size       │
│  - Ellipse │      (zoomable, pannable)          │  - Rotation   │
│  - Text    │                                     │  - Fill       │
│  - Image   │                                     │  - Stroke     │
│  - Line    │                                     │  - Opacity    │
│  - Pen     │                                     │  - Filters    │
│            │                                     │               │
├────────────┴─────────────────────────────────────┤               │
│  Layers Panel                                    │               │
│  ┌─────────────────────────────────────────────┐ │               │
│  │ 👁 🔒 Layer 1                               │ │               │
│  │ 👁 🔒 Layer 2                               │ │               │
│  │ 👁 🔒 Background                            │ │               │
│  └─────────────────────────────────────────────┘ │               │
└──────────────────────────────────────────────────┴───────────────┘
```

**Key interactions:**
- **Canvas**: Click to select, drag to move, handles to resize/rotate
- **Toolbar**: Click tool, then click/drag on canvas to create
- **Layers Panel**: Drag to reorder, click eye for visibility, click lock to prevent edits
- **Properties Panel**: Edit selected element's attributes in real-time

**State Management:**
- Zustand for global state
- Single source of truth for project data
- Undo/redo stack for history
- Optimistic updates with IPC sync

## Tech Stack

**Electron App:**
- Electron v28+
- React 18
- TypeScript
- Zustand (state management)
- Tailwind CSS
- electron-builder (packaging)
- Vitest (testing)

**MCP Server:**
- Node.js + TypeScript
- @modelcontextprotocol/sdk
- node-ipc (communication with Electron)

## Project Structure

```
desai/
├── packages/
│   ├── electron-app/           # Main Electron application
│   │   ├── src/
│   │   │   ├── main/           # Electron main process
│   │   │   │   ├── index.ts
│   │   │   │   ├── ipc.ts      # IPC handlers
│   │   │   │   └── menu.ts
│   │   │   ├── renderer/       # React app
│   │   │   │   ├── components/
│   │   │   │   │   ├── Canvas/
│   │   │   │   │   ├── Toolbar/
│   │   │   │   │   ├── LayersPanel/
│   │   │   │   │   └── PropertiesPanel/
│   │   │   │   ├── store/      # Zustand stores
│   │   │   │   ├── hooks/
│   │   │   │   └── App.tsx
│   │   │   └── preload/        # Electron preload scripts
│   │   └── package.json
│   │
│   ├── mcp-server/             # MCP server (separate process)
│   │   ├── src/
│   │   │   ├── index.ts        # MCP server entry
│   │   │   ├── tools/          # Tool implementations
│   │   │   │   ├── canvas.ts
│   │   │   │   ├── layers.ts
│   │   │   │   ├── shapes.ts
│   │   │   │   ├── text.ts
│   │   │   │   ├── images.ts
│   │   │   │   └── export.ts
│   │   │   └── ipc-client.ts   # Connects to Electron
│   │   └── package.json
│   │
│   └── shared/                 # Shared types & utilities
│       ├── src/
│       │   ├── types.ts        # DesaiProject, Element, etc.
│       │   └── constants.ts
│       └── package.json
│
├── package.json                # Workspace root (pnpm workspaces)
├── tsconfig.base.json
└── README.md
```

## AI Vision: Screenshots & State Export

For Claude to make intelligent design decisions, it needs to "see" the canvas:

**Screenshot Capture (`desai_canvas_screenshot`)**
```typescript
{
  image: "data:image/png;base64,iVBORw0KGgo...",
  width: 1920,
  height: 1080,
  timestamp: "2024-12-12T10:30:00Z"
}
```

Implementation uses Electron's `webContents.capturePage()` on the canvas area.

**State Export (`desai_canvas_get_state`)**
```typescript
{
  project: { /* full DesaiProject object */ },
  selection: ["element-id-1", "element-id-2"],
  viewport: { zoom: 1.5, panX: 100, panY: 50 },
  history: { canUndo: true, canRedo: false }
}
```

**Combined Workflow for Claude:**
1. `desai_canvas_screenshot()` - "What does this look like?"
2. `desai_canvas_get_state()` - "What exactly is where?"
3. Make decisions based on both visual + structural understanding
4. Execute changes via manipulation tools
5. Screenshot again to verify result

This dual approach gives Claude both **intuition** (visual) and **precision** (structural).
