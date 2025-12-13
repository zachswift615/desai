# Desai - Handoff Document

## Vision

**Desai** (Design + AI) is an AI-native design tool that gives Claude Code the ability to create and manipulate designs on a canvas. Think Canva/Photoshop but where Claude can directly control the canvas via MCP tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code                              │
│  (uses MCP tools to control Desai)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol (stdio)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Desai MCP Server                            │
│  packages/mcp-server/                                        │
│  - 18 MCP tools (canvas, layers, shapes, text, elements)    │
│  - Connects to Electron via node-ipc                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ IPC (node-ipc)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Desai Electron App                             │
│  packages/electron-app/                                      │
│  - Main process: window, IPC server                         │
│  - Renderer: React + Zustand + Tailwind                     │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
desai/
├── packages/
│   ├── shared/                 # TypeScript types
│   │   └── src/types.ts        # DesaiProject, Element, IpcMessage types
│   │
│   ├── electron-app/           # Electron + React app
│   │   └── src/
│   │       ├── main/           # Electron main process
│   │       │   ├── index.ts    # Window creation, IPC handlers
│   │       │   └── ipc-server.ts # node-ipc server
│   │       ├── preload/        # Context bridge
│   │       └── renderer/       # React app
│   │           ├── components/
│   │           │   ├── Layout.tsx
│   │           │   ├── Canvas/
│   │           │   ├── Toolbar/
│   │           │   ├── LayersPanel/
│   │           │   └── PropertiesPanel/
│   │           ├── store/
│   │           │   └── projectStore.ts  # Zustand store
│   │           └── hooks/
│   │               └── useMcpHandler.ts # MCP command handler
│   │
│   └── mcp-server/             # MCP server
│       └── src/
│           ├── index.ts        # MCP server + 18 tool definitions
│           └── ipc-client.ts   # Connects to Electron
│
├── docs/plans/
│   ├── 2025-12-12-desai-design.md
│   └── 2025-12-12-desai-implementation.md
│
└── mcp-config-example.json     # Claude Code MCP config
```

## Tech Stack

- **Electron 28** - Desktop runtime
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Zustand** - State management with undo/redo
- **Tailwind CSS** - Styling
- **electron-vite** - Build tool
- **@modelcontextprotocol/sdk** - MCP server
- **node-ipc** - IPC between MCP server and Electron

## What's Working

### UI Components
- [x] Layout with toolbar, canvas, layers panel
- [x] Toolbar with 7 tools (select, move, rect, ellipse, line, text, image)
- [x] Canvas rendering elements (rect, ellipse, text, line)
- [x] Click-to-create shapes
- [x] Element selection (blue outline)
- [x] Layers panel with visibility/lock toggles

### State Management
- [x] Zustand store with full project state
- [x] Undo/redo history (50 steps)
- [x] Layer management
- [x] Element CRUD operations

### MCP Integration
- [x] MCP server with 18 tools defined
- [x] IPC bridge between MCP server and Electron
- [x] useMcpHandler hook processing commands
- [x] All tool-to-action mappings

## Known Issues

### 1. Properties Panel Not Visible
The Properties panel (right side, 256px wide) isn't showing. Possible causes:
- CSS overflow issue
- Component not rendering
- Window size detection

**Debug steps:**
1. Check browser DevTools in Electron (View > Toggle Developer Tools)
2. Inspect the Layout component's right panel div
3. Check if PropertiesPanel component renders

**Fix approach:**
```tsx
// In Layout.tsx, add min-width to prevent collapse:
<div className="w-64 min-w-64 bg-gray-800 border-l border-gray-700 overflow-auto">
  {properties}
</div>
```

### 2. Drag-to-Move Not Implemented
Elements can't be dragged on canvas. Only click-to-select works.

### 3. Text Editing Not Inline
Can't type directly into text elements - must use Properties panel.

## Remaining Features (Priority Order)

### P0 - Critical Fixes

#### Fix Properties Panel
File: `packages/electron-app/src/renderer/components/Layout.tsx`
- Add `min-w-64` class to properties panel div
- Or add `shrink-0` to prevent flex shrinking

#### Test MCP Integration
1. Add to Claude Code MCP config:
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
2. Start Electron app: `pnpm dev`
3. Start new Claude Code session
4. Test: "Create a blue rectangle at position 100, 100"

### P1 - Core Interaction

#### Drag to Move Elements
File: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`

Add mouse drag handling:
```tsx
const [dragging, setDragging] = useState<string | null>(null);
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
  setDragging(elementId);
  setDragStart({ x: e.clientX, y: e.clientY });
};

const handleMouseMove = (e: React.MouseEvent) => {
  if (!dragging) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  // Update element position via store
  updateElement(dragging, { x: element.x + dx, y: element.y + dy });
  setDragStart({ x: e.clientX, y: e.clientY });
};

const handleMouseUp = () => setDragging(null);
```

#### Resize Handles
Add 8-point resize handles around selected elements:
- Corner handles (4): resize maintaining aspect or free
- Edge handles (4): resize single dimension

#### Keyboard Shortcuts
- Delete/Backspace: Delete selected
- Cmd+Z: Undo
- Cmd+Shift+Z: Redo
- Cmd+D: Duplicate
- Arrow keys: Nudge position

### P2 - Enhanced Features

#### Image Import
File: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`

For the Image tool:
```tsx
case 'image':
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const imageElement: ImageElement = {
            id: generateId(),
            type: 'image',
            src: reader.result as string,
            x, y,
            width: img.width,
            height: img.height,
            // ... other props
          };
          addElement(activeLayer.id, imageElement);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
  break;
```

#### Inline Text Editing
Double-click text element to edit inline:
```tsx
const [editingText, setEditingText] = useState<string | null>(null);

// In CanvasElement for text type:
if (editingText === element.id) {
  return (
    <textarea
      autoFocus
      value={element.content}
      onChange={(e) => updateElement(element.id, { content: e.target.value })}
      onBlur={() => setEditingText(null)}
      style={baseStyle}
    />
  );
}
```

#### Canvas Zoom/Pan
- Mouse wheel: Zoom in/out
- Space + drag: Pan canvas
- Store viewport state: { zoom, panX, panY }

### P3 - Export Features

#### Export PNG
```tsx
const exportPng = async () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // Render all elements to canvas
  // Return canvas.toDataURL('image/png')
};
```

#### Export SVG
Convert DOM elements to SVG string

#### Save/Load Projects
- Save: JSON.stringify(project) to .desai file
- Load: Parse and restore to store

### P4 - Polish

#### Multi-select
- Shift+click to add to selection
- Drag to create selection box
- Group/ungroup selected elements

#### Alignment Tools
- Align left/center/right
- Align top/middle/bottom
- Distribute horizontally/vertically

#### Grid & Snapping
- Show grid overlay
- Snap to grid
- Snap to other elements

## MCP Tools Reference

| Tool | Description | IPC Message |
|------|-------------|-------------|
| desai_canvas_create | Create new canvas | canvas:create |
| desai_canvas_get_state | Get full state JSON | canvas:get-state |
| desai_canvas_screenshot | Capture as base64 PNG | canvas:screenshot |
| desai_canvas_clear | Remove all elements | canvas:clear |
| desai_layer_create | Add new layer | layer:create |
| desai_layer_delete | Remove layer | layer:delete |
| desai_layer_set_visibility | Show/hide layer | layer:set-visibility |
| desai_layer_set_opacity | Set layer opacity | layer:set-opacity |
| desai_layer_lock | Lock/unlock layer | layer:lock |
| desai_shape_rectangle | Create rectangle | shape:rectangle |
| desai_shape_ellipse | Create ellipse | shape:ellipse |
| desai_text_create | Create text element | text:create |
| desai_text_update | Update text content | text:update |
| desai_element_transform | Move/resize/rotate | element:transform |
| desai_element_style | Change fill/stroke | element:style |
| desai_element_delete | Delete element | element:delete |
| desai_element_duplicate | Copy element | element:duplicate |

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start Electron dev server
pnpm dev

# Start MCP server standalone
pnpm mcp:start
```

## Key Files for Next Session

1. **Layout issue**: `packages/electron-app/src/renderer/components/Layout.tsx`
2. **Canvas interactions**: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`
3. **State management**: `packages/electron-app/src/renderer/store/projectStore.ts`
4. **MCP handler**: `packages/electron-app/src/renderer/hooks/useMcpHandler.ts`
5. **Design doc**: `docs/plans/2025-12-12-desai-design.md`
6. **Implementation plan**: `docs/plans/2025-12-12-desai-implementation.md`
