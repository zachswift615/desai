# Desai P0-P2 Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Desai's core interaction features - fix the Properties Panel, test MCP integration end-to-end, and implement drag/resize/keyboard/zoom/pan interactions.

**Architecture:** The Electron app uses React + Zustand for state management. MCP server communicates via node-ipc bridge. Canvas is div-based (not SVG), with elements rendered as positioned divs. All state changes go through the Zustand store which handles undo/redo.

**Tech Stack:** Electron 28, React 18, Zustand 4.5, Tailwind CSS, TypeScript, node-ipc, @modelcontextprotocol/sdk

---

## Phase 1: P0 Critical Fixes

### Task 1: Fix Properties Panel Visibility

**Files:**
- Modify: `packages/electron-app/src/renderer/components/Layout.tsx:36`

**Context:** The Properties panel (right side, 256px) collapses due to flexbox shrinking. Need to prevent shrinking.

**Step 1: Add flex-shrink-0 to properties panel container**

In `Layout.tsx`, find the properties panel div (around line 36) and add `shrink-0`:

```tsx
{/* Properties Panel - right side */}
<div className="w-64 min-w-64 shrink-0 bg-gray-800 border-l border-gray-700 overflow-auto">
  {properties}
</div>
```

**Step 2: Build and verify**

Run: `cd /Users/zachswift/projects/desai && pnpm build`
Expected: Build succeeds without errors

**Step 3: Start app and visually verify**

Run: `cd /Users/zachswift/projects/desai/packages/electron-app && pnpm dev`
Expected: Properties panel visible on right side (256px wide)

**Step 4: Commit**

```bash
git add packages/electron-app/src/renderer/components/Layout.tsx
git commit -m "fix: prevent properties panel from collapsing with shrink-0"
```

---

### Task 2: Test MCP Integration End-to-End

**Files:**
- Read: `mcp-config-example.json`
- Test: MCP server connection to running Electron app

**Context:** This is an iterative testing phase. The MCP server connects to Electron via node-ipc. Claude Code must restart to pick up MCP config changes. We'll test tool by tool.

**Step 1: Verify MCP server builds correctly**

Run: `cd /Users/zachswift/projects/desai && pnpm build`
Expected: All packages build successfully

**Step 2: User configures MCP in Claude Code**

User action required: Add to `~/.claude.json` or project MCP config:
```json
{
  "mcpServers": {
    "desai": {
      "command": "node",
      "args": ["/Users/zachswift/projects/desai/packages/mcp-server/dist/index.js"]
    }
  }
}
```

**Step 3: Start Electron app**

Run: `cd /Users/zachswift/projects/desai/packages/electron-app && pnpm dev`
Expected: Electron window opens with canvas

**Step 4: User restarts Claude Code session**

User action required: Exit and restart Claude Code to load MCP config

**Step 5: Test desai_canvas_get_state tool**

Claude action: Call `desai_canvas_get_state` MCP tool
Expected: Returns JSON with project state (canvas, layers, elements)

**Step 6: Test desai_shape_rectangle tool**

Claude action: Call `desai_shape_rectangle` with:
- x: 100, y: 100, width: 200, height: 150
- fill: "#3b82f6" (blue)
- stroke: "#1d4ed8", strokeWidth: 2

Expected: Blue rectangle appears on canvas at position (100, 100)

**Step 7: Test desai_canvas_screenshot tool**

Claude action: Call `desai_canvas_screenshot`
Expected: Returns base64 PNG of current canvas

**Step 8: Iterate on any issues**

If tools fail:
1. Check Electron console (View > Toggle Developer Tools)
2. Check MCP server logs
3. Fix issues, rebuild, restart session

**Step 9: Document working state**

Once all tools work, record in workshop:
```bash
workshop decision "MCP integration verified working" -r "Tested canvas state, shape creation, and screenshot tools end-to-end"
```

---

## Phase 2: P1 Core Interactions

### Task 3: Implement Drag-to-Move Elements

**Files:**
- Modify: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`

**Context:** Currently only click-to-select works. Need mouse down/move/up handlers for dragging selected elements.

**Step 1: Add drag state to Canvas component**

In `Canvas.tsx`, add state for tracking drag operations:

```tsx
// Add after existing useState declarations
const [isDragging, setIsDragging] = useState(false);
const [dragStart, setDragStart] = useState<{ x: number; y: number; elementX: number; elementY: number } | null>(null);
const [dragElementId, setDragElementId] = useState<string | null>(null);
```

**Step 2: Create mouse event handlers**

Add these handlers in the Canvas component:

```tsx
const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
  // Only start drag if element is selected and we're in select or move mode
  if (activeTool !== 'select' && activeTool !== 'move') return;

  const element = findElementById(elementId);
  if (!element) return;

  // Check if element's layer is locked
  const layer = project.layers.find(l => l.elements.some(el => el.id === elementId));
  if (layer?.locked) return;

  e.stopPropagation();
  setIsDragging(true);
  setDragElementId(elementId);
  setDragStart({
    x: e.clientX,
    y: e.clientY,
    elementX: element.x,
    elementY: element.y
  });

  // Select the element if not already selected
  if (!selectedElementIds.includes(elementId)) {
    setSelectedElements([elementId]);
  }
};

const handleMouseMove = (e: React.MouseEvent) => {
  if (!isDragging || !dragStart || !dragElementId) return;

  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;

  // Calculate new position accounting for zoom
  const newX = dragStart.elementX + dx / viewport.zoom;
  const newY = dragStart.elementY + dy / viewport.zoom;

  updateElement(dragElementId, { x: newX, y: newY });
};

const handleMouseUp = () => {
  setIsDragging(false);
  setDragStart(null);
  setDragElementId(null);
};

// Helper to find element by ID across all layers
const findElementById = (elementId: string) => {
  for (const layer of project.layers) {
    const element = layer.elements.find(el => el.id === elementId);
    if (element) return element;
  }
  return null;
};
```

**Step 3: Attach handlers to canvas container**

Update the canvas container div to handle mouse events:

```tsx
<div
  className="relative flex-1 bg-gray-900 overflow-hidden"
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseUp}
  onClick={handleCanvasClick}
>
```

**Step 4: Pass mousedown handler to CanvasElement**

Modify CanvasElement rendering to include mousedown:

```tsx
<CanvasElement
  key={element.id}
  element={element}
  isSelected={selectedElementIds.includes(element.id)}
  onSelect={() => setSelectedElements([element.id])}
  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
/>
```

**Step 5: Update CanvasElement to accept onMouseDown prop**

In `CanvasElement.tsx`, add the prop and attach it:

```tsx
interface CanvasElementProps {
  element: Element;
  isSelected: boolean;
  onSelect: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export function CanvasElement({ element, isSelected, onSelect, onMouseDown }: CanvasElementProps) {
  // ... existing code

  return (
    <div
      style={baseStyle}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={onMouseDown}
      className={`cursor-${isDraggable ? 'move' : 'default'}`}
    >
      {/* ... element content */}
    </div>
  );
}
```

**Step 6: Build and test**

Run: `cd /Users/zachswift/projects/desai && pnpm build`
Run: `cd /Users/zachswift/projects/desai/packages/electron-app && pnpm dev`

Test:
1. Create a rectangle via MCP or click
2. Select it (click)
3. Drag it to a new position
Expected: Element moves smoothly with mouse

**Step 7: Commit**

```bash
git add packages/electron-app/src/renderer/components/Canvas/
git commit -m "feat: implement drag-to-move for canvas elements"
```

---

### Task 4: Implement Resize Handles

**Files:**
- Create: `packages/electron-app/src/renderer/components/Canvas/ResizeHandles.tsx`
- Modify: `packages/electron-app/src/renderer/components/Canvas/CanvasElement.tsx`
- Modify: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`

**Context:** Selected elements need 8 resize handles (4 corners + 4 edges). Dragging handles resizes the element.

**Step 1: Create ResizeHandles component**

Create `packages/electron-app/src/renderer/components/Canvas/ResizeHandles.tsx`:

```tsx
import React from 'react';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizeHandlesProps {
  width: number;
  height: number;
  onResizeStart: (e: React.MouseEvent, handle: HandlePosition) => void;
}

const handleSize = 8;
const halfHandle = handleSize / 2;

export function ResizeHandles({ width, height, onResizeStart }: ResizeHandlesProps) {
  const handles: { position: HandlePosition; x: number; y: number; cursor: string }[] = [
    { position: 'nw', x: -halfHandle, y: -halfHandle, cursor: 'nwse-resize' },
    { position: 'n', x: width / 2 - halfHandle, y: -halfHandle, cursor: 'ns-resize' },
    { position: 'ne', x: width - halfHandle, y: -halfHandle, cursor: 'nesw-resize' },
    { position: 'e', x: width - halfHandle, y: height / 2 - halfHandle, cursor: 'ew-resize' },
    { position: 'se', x: width - halfHandle, y: height - halfHandle, cursor: 'nwse-resize' },
    { position: 's', x: width / 2 - halfHandle, y: height - halfHandle, cursor: 'ns-resize' },
    { position: 'sw', x: -halfHandle, y: height - halfHandle, cursor: 'nesw-resize' },
    { position: 'w', x: -halfHandle, y: height / 2 - halfHandle, cursor: 'ew-resize' },
  ];

  return (
    <>
      {handles.map(({ position, x, y, cursor }) => (
        <div
          key={position}
          className="absolute bg-white border border-blue-500"
          style={{
            left: x,
            top: y,
            width: handleSize,
            height: handleSize,
            cursor,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, position);
          }}
        />
      ))}
    </>
  );
}
```

**Step 2: Add resize state to Canvas**

In `Canvas.tsx`, add resize tracking state:

```tsx
const [isResizing, setIsResizing] = useState(false);
const [resizeHandle, setResizeHandle] = useState<HandlePosition | null>(null);
const [resizeStart, setResizeStart] = useState<{
  x: number;
  y: number;
  elementX: number;
  elementY: number;
  elementWidth: number;
  elementHeight: number;
} | null>(null);
const [resizeElementId, setResizeElementId] = useState<string | null>(null);
```

**Step 3: Add resize handlers to Canvas**

```tsx
const handleResizeStart = (e: React.MouseEvent, elementId: string, handle: HandlePosition) => {
  const element = findElementById(elementId);
  if (!element) return;

  e.stopPropagation();
  setIsResizing(true);
  setResizeHandle(handle);
  setResizeElementId(elementId);
  setResizeStart({
    x: e.clientX,
    y: e.clientY,
    elementX: element.x,
    elementY: element.y,
    elementWidth: element.width,
    elementHeight: element.height,
  });
};

const handleResizeMove = (e: React.MouseEvent) => {
  if (!isResizing || !resizeStart || !resizeHandle || !resizeElementId) return;

  const dx = (e.clientX - resizeStart.x) / viewport.zoom;
  const dy = (e.clientY - resizeStart.y) / viewport.zoom;

  let newX = resizeStart.elementX;
  let newY = resizeStart.elementY;
  let newWidth = resizeStart.elementWidth;
  let newHeight = resizeStart.elementHeight;

  // Adjust based on which handle is being dragged
  if (resizeHandle.includes('w')) {
    newX = resizeStart.elementX + dx;
    newWidth = resizeStart.elementWidth - dx;
  }
  if (resizeHandle.includes('e')) {
    newWidth = resizeStart.elementWidth + dx;
  }
  if (resizeHandle.includes('n')) {
    newY = resizeStart.elementY + dy;
    newHeight = resizeStart.elementHeight - dy;
  }
  if (resizeHandle.includes('s')) {
    newHeight = resizeStart.elementHeight + dy;
  }

  // Enforce minimum size
  if (newWidth < 10) {
    newWidth = 10;
    if (resizeHandle.includes('w')) newX = resizeStart.elementX + resizeStart.elementWidth - 10;
  }
  if (newHeight < 10) {
    newHeight = 10;
    if (resizeHandle.includes('n')) newY = resizeStart.elementY + resizeStart.elementHeight - 10;
  }

  updateElement(resizeElementId, { x: newX, y: newY, width: newWidth, height: newHeight });
};

const handleResizeEnd = () => {
  setIsResizing(false);
  setResizeHandle(null);
  setResizeStart(null);
  setResizeElementId(null);
};
```

**Step 4: Update mouse move/up to handle resize**

Modify the existing handlers:

```tsx
const handleMouseMove = (e: React.MouseEvent) => {
  if (isResizing) {
    handleResizeMove(e);
    return;
  }
  if (isDragging && dragStart && dragElementId) {
    // ... existing drag logic
  }
};

const handleMouseUp = () => {
  if (isResizing) {
    handleResizeEnd();
    return;
  }
  // ... existing drag end logic
};
```

**Step 5: Pass resize handler to CanvasElement**

```tsx
<CanvasElement
  key={element.id}
  element={element}
  isSelected={selectedElementIds.includes(element.id)}
  onSelect={() => setSelectedElements([element.id])}
  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
  onResizeStart={(e, handle) => handleResizeStart(e, element.id, handle)}
/>
```

**Step 6: Update CanvasElement to render handles when selected**

In `CanvasElement.tsx`:

```tsx
import { ResizeHandles, HandlePosition } from './ResizeHandles';

interface CanvasElementProps {
  element: Element;
  isSelected: boolean;
  onSelect: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent, handle: HandlePosition) => void;
}

export function CanvasElement({ element, isSelected, onSelect, onMouseDown, onResizeStart }: CanvasElementProps) {
  // ... existing code

  return (
    <div
      style={baseStyle}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={onMouseDown}
    >
      {/* ... element content */}

      {isSelected && onResizeStart && (
        <ResizeHandles
          width={element.width}
          height={element.height}
          onResizeStart={onResizeStart}
        />
      )}
    </div>
  );
}
```

**Step 7: Build and test**

Run: `pnpm build && cd packages/electron-app && pnpm dev`

Test:
1. Create a rectangle
2. Select it
3. Drag corner handles to resize
4. Drag edge handles to resize one dimension
Expected: Element resizes, minimum size enforced

**Step 8: Commit**

```bash
git add packages/electron-app/src/renderer/components/Canvas/
git commit -m "feat: add resize handles for selected elements"
```

---

### Task 5: Implement Keyboard Shortcuts

**Files:**
- Create: `packages/electron-app/src/renderer/hooks/useKeyboardShortcuts.ts`
- Modify: `packages/electron-app/src/renderer/App.tsx`

**Context:** Need Delete, Undo/Redo, Duplicate, and Arrow key nudge shortcuts.

**Step 1: Create keyboard shortcuts hook**

Create `packages/electron-app/src/renderer/hooks/useKeyboardShortcuts.ts`:

```tsx
import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';

export function useKeyboardShortcuts() {
  const {
    selectedElementIds,
    deleteElement,
    duplicateElement,
    updateElement,
    undo,
    redo,
    project,
  } = useProjectStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementIds.length > 0) {
        e.preventDefault();
        selectedElementIds.forEach(id => deleteElement(id));
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z
      if (cmdOrCtrl && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if (cmdOrCtrl && e.key === 'd' && selectedElementIds.length > 0) {
        e.preventDefault();
        selectedElementIds.forEach(id => duplicateElement(id));
        return;
      }

      // Arrow key nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedElementIds.length > 0) {
        e.preventDefault();
        const nudgeAmount = e.shiftKey ? 10 : 1;

        selectedElementIds.forEach(elementId => {
          // Find the element
          let element = null;
          for (const layer of project.layers) {
            element = layer.elements.find(el => el.id === elementId);
            if (element) break;
          }
          if (!element) return;

          const updates: { x?: number; y?: number } = {};
          switch (e.key) {
            case 'ArrowUp':
              updates.y = element.y - nudgeAmount;
              break;
            case 'ArrowDown':
              updates.y = element.y + nudgeAmount;
              break;
            case 'ArrowLeft':
              updates.x = element.x - nudgeAmount;
              break;
            case 'ArrowRight':
              updates.x = element.x + nudgeAmount;
              break;
          }
          updateElement(elementId, updates);
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, deleteElement, duplicateElement, updateElement, undo, redo, project]);
}
```

**Step 2: Use hook in App.tsx**

In `packages/electron-app/src/renderer/App.tsx`, add the hook:

```tsx
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  useKeyboardShortcuts();
  // ... rest of component
}
```

**Step 3: Build and test**

Run: `pnpm build && cd packages/electron-app && pnpm dev`

Test each shortcut:
1. Select an element, press Delete -> element removed
2. Cmd+Z -> undo
3. Cmd+Shift+Z -> redo
4. Cmd+D -> duplicate (offset by 10px)
5. Arrow keys -> nudge 1px
6. Shift+Arrow -> nudge 10px

**Step 4: Commit**

```bash
git add packages/electron-app/src/renderer/hooks/useKeyboardShortcuts.ts
git add packages/electron-app/src/renderer/App.tsx
git commit -m "feat: add keyboard shortcuts (delete, undo, redo, duplicate, nudge)"
```

---

### Task 6: Implement Canvas Zoom/Pan

**Files:**
- Modify: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`

**Context:** Viewport state already exists in store (zoom, panX, panY). Need to wire up mouse wheel for zoom and Space+drag for pan.

**Step 1: Add pan state**

In `Canvas.tsx`, add pan tracking:

```tsx
const [isPanning, setIsPanning] = useState(false);
const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
const [spacePressed, setSpacePressed] = useState(false);
```

**Step 2: Add keyboard listener for Space key**

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !spacePressed) {
      setSpacePressed(true);
    }
  };
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      setSpacePressed(false);
      setIsPanning(false);
      setPanStart(null);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, [spacePressed]);
```

**Step 3: Add wheel handler for zoom**

```tsx
const handleWheel = (e: React.WheelEvent) => {
  e.preventDefault();

  // Zoom with mouse wheel
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.1), 5);

  setViewport({ zoom: newZoom });
};
```

**Step 4: Update mouse handlers for pan**

```tsx
const handleCanvasMouseDown = (e: React.MouseEvent) => {
  if (spacePressed) {
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    return;
  }
  // ... existing click-to-create logic
};

const handleMouseMove = (e: React.MouseEvent) => {
  if (isPanning && panStart) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    setViewport({
      panX: viewport.panX + dx,
      panY: viewport.panY + dy,
    });
    setPanStart({ x: e.clientX, y: e.clientY });
    return;
  }
  // ... existing resize/drag logic
};

const handleMouseUp = () => {
  if (isPanning) {
    setIsPanning(false);
    setPanStart(null);
    return;
  }
  // ... existing logic
};
```

**Step 5: Apply viewport transform to canvas content**

Update the canvas content container to use viewport:

```tsx
<div
  className="absolute inset-0"
  style={{
    transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
    transformOrigin: '0 0',
  }}
>
  {/* Render layers and elements here */}
</div>
```

**Step 6: Update cursor based on state**

```tsx
const getCursor = () => {
  if (spacePressed) return 'grab';
  if (isPanning) return 'grabbing';
  if (isDragging) return 'move';
  if (isResizing) return 'default'; // Handle cursors are set per-handle
  return 'default';
};

// On canvas container:
<div style={{ cursor: getCursor() }} ...>
```

**Step 7: Build and test**

Run: `pnpm build && cd packages/electron-app && pnpm dev`

Test:
1. Mouse wheel up/down -> zoom in/out
2. Hold Space + drag -> pan canvas
3. Verify elements still render at correct positions when zoomed/panned

**Step 8: Commit**

```bash
git add packages/electron-app/src/renderer/components/Canvas/Canvas.tsx
git commit -m "feat: add canvas zoom (wheel) and pan (space+drag)"
```

---

## Phase 3: P2 Enhanced Features

### Task 7: Implement Image Import

**Files:**
- Modify: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`
- Modify: `packages/shared/src/types.ts` (if ImageElement not complete)

**Context:** The Image tool exists in toolbar but clicking canvas doesn't do anything useful. Need to open file picker and create ImageElement.

**Step 1: Verify ImageElement type exists**

Check `packages/shared/src/types.ts` for ImageElement definition. Should have `src: string` for base64 data.

**Step 2: Add image creation handler**

In `Canvas.tsx`, update the click handler for image tool:

```tsx
case 'image': {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const imageElement = {
          id: generateId(),
          type: 'image' as const,
          name: file.name,
          x,
          y,
          width: Math.min(img.width, 400), // Cap initial size
          height: Math.min(img.height, 400),
          rotation: 0,
          opacity: 1,
          src: reader.result as string,
        };
        addElement(activeLayer.id, imageElement);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  input.click();
  break;
}
```

**Step 3: Update CanvasElement to render images**

In `CanvasElement.tsx`, add image rendering case:

```tsx
case 'image':
  return (
    <div style={baseStyle}>
      <img
        src={(element as any).src}
        alt={element.name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          pointerEvents: 'none',
        }}
      />
      {isSelected && onResizeStart && (
        <ResizeHandles width={element.width} height={element.height} onResizeStart={onResizeStart} />
      )}
    </div>
  );
```

**Step 4: Build and test**

Run: `pnpm build && cd packages/electron-app && pnpm dev`

Test:
1. Select Image tool from toolbar
2. Click canvas
3. File picker opens
4. Select an image
5. Image appears on canvas at click position

**Step 5: Commit**

```bash
git add packages/electron-app/src/renderer/components/Canvas/
git commit -m "feat: implement image import via file picker"
```

---

### Task 8: Implement Inline Text Editing

**Files:**
- Modify: `packages/electron-app/src/renderer/components/Canvas/CanvasElement.tsx`
- Modify: `packages/electron-app/src/renderer/components/Canvas/Canvas.tsx`

**Context:** Double-clicking a text element should enable inline editing.

**Step 1: Add editing state to Canvas**

In `Canvas.tsx`:

```tsx
const [editingTextId, setEditingTextId] = useState<string | null>(null);
```

**Step 2: Pass editing state and handlers to CanvasElement**

```tsx
<CanvasElement
  key={element.id}
  element={element}
  isSelected={selectedElementIds.includes(element.id)}
  isEditing={editingTextId === element.id}
  onSelect={() => setSelectedElements([element.id])}
  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
  onResizeStart={(e, handle) => handleResizeStart(e, element.id, handle)}
  onDoubleClick={() => {
    if (element.type === 'text') {
      setEditingTextId(element.id);
    }
  }}
  onFinishEditing={() => setEditingTextId(null)}
  onTextChange={(content) => updateElement(element.id, { content })}
/>
```

**Step 3: Update CanvasElement for text editing**

In `CanvasElement.tsx`:

```tsx
interface CanvasElementProps {
  element: Element;
  isSelected: boolean;
  isEditing?: boolean;
  onSelect: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent, handle: HandlePosition) => void;
  onDoubleClick?: () => void;
  onFinishEditing?: () => void;
  onTextChange?: (content: string) => void;
}

// In the text case:
case 'text': {
  const textElement = element as TextElement;

  if (isEditing && onTextChange && onFinishEditing) {
    return (
      <div style={baseStyle} onClick={(e) => e.stopPropagation()}>
        <textarea
          autoFocus
          value={textElement.content}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={onFinishEditing}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onFinishEditing();
          }}
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: textElement.color || '#ffffff',
            fontSize: textElement.fontSize || 16,
            fontFamily: textElement.fontFamily || 'sans-serif',
            textAlign: textElement.align || 'left',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={baseStyle}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <span
        style={{
          color: textElement.color || '#ffffff',
          fontSize: textElement.fontSize || 16,
          fontFamily: textElement.fontFamily || 'sans-serif',
          textAlign: textElement.align || 'left',
          whiteSpace: 'pre-wrap',
        }}
      >
        {textElement.content}
      </span>
      {isSelected && !isEditing && onResizeStart && (
        <ResizeHandles width={element.width} height={element.height} onResizeStart={onResizeStart} />
      )}
    </div>
  );
}
```

**Step 4: Build and test**

Run: `pnpm build && cd packages/electron-app && pnpm dev`

Test:
1. Create a text element
2. Select it (single click)
3. Double-click to edit
4. Type new text
5. Click outside or press Escape to finish
6. Text content updated

**Step 5: Commit**

```bash
git add packages/electron-app/src/renderer/components/Canvas/
git commit -m "feat: add inline text editing on double-click"
```

---

## Phase 4: Verification & Polish

### Task 9: End-to-End MCP Testing with All Features

**Context:** After all features are implemented, do a comprehensive MCP tool test.

**Step 1: Rebuild everything**

Run: `cd /Users/zachswift/projects/desai && pnpm build`

**Step 2: Start app and restart Claude session**

1. Start Electron: `cd packages/electron-app && pnpm dev`
2. Restart Claude Code session to reload MCP

**Step 3: Test MCP tool sequence**

Claude should test:
1. `desai_canvas_create` - Create new canvas
2. `desai_layer_create` - Add a layer
3. `desai_shape_rectangle` - Create blue rectangle at (100, 100)
4. `desai_shape_ellipse` - Create red ellipse at (300, 100)
5. `desai_text_create` - Create "Hello Desai" text at (200, 300)
6. `desai_element_transform` - Move the rectangle to (150, 150)
7. `desai_element_style` - Change rectangle fill to green
8. `desai_canvas_screenshot` - Capture and verify visually
9. `desai_element_duplicate` - Duplicate the ellipse
10. `desai_element_delete` - Delete the duplicate

**Step 4: Document results**

```bash
workshop decision "Full MCP integration verified" -r "All 18 tools tested and working with new drag/resize/keyboard features"
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete P0-P2 implementation with full MCP integration"
```

---

## Summary

| Task | Description | Est. Complexity |
|------|-------------|-----------------|
| 1 | Fix Properties Panel | Simple (1 line) |
| 2 | Test MCP Integration | Iterative (requires restarts) |
| 3 | Drag-to-Move | Medium |
| 4 | Resize Handles | Medium |
| 5 | Keyboard Shortcuts | Medium |
| 6 | Canvas Zoom/Pan | Medium |
| 7 | Image Import | Medium |
| 8 | Inline Text Editing | Medium |
| 9 | End-to-End Testing | Verification |

**Dependencies:**
- Task 1 should be done first (enables testing)
- Task 2 can happen anytime but needs user involvement
- Tasks 3-8 can be done in any order
- Task 9 requires all others complete
