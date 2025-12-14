# Unified MCP API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace 19 MCP tools with a single `desai` tool that accepts batched operations, reducing token usage by ~96%.

**Architecture:** Single MCP tool sends `batch:execute` IPC message to Electron app. The batch executor snapshots state, executes ops sequentially using existing handlers, and rolls back on any failure.

**Tech Stack:** TypeScript, MCP SDK, Electron IPC, Zustand store

---

### Task 1: Add Types for Batch Operations

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add DesaiOp type and batch IPC message**

Add at the end of the file, before the closing of types:

```typescript
// Unified MCP operation type
export interface DesaiOp {
  target: 'canvas' | 'layer' | 'shape' | 'text' | 'element' | 'image' | 'export';
  op: string;
  [key: string]: unknown;
}

// Batch execution response
export interface BatchResult {
  success: true;
  data: IpcResponse[];
} | {
  success: false;
  error: string;
  failedOp: DesaiOp;
  completedOps: number;
}
```

**Step 2: Add batch:execute to IpcMessage union**

Find the `IpcMessage` type union and add this line:

```typescript
  | { type: 'batch:execute'; payload: { ops: DesaiOp[] } }
```

**Step 3: Verify types compile**

Run: `cd /Users/zachswift/projects/desai && pnpm exec tsc --noEmit -p packages/shared`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add DesaiOp and batch:execute types"
```

---

### Task 2: Add Parameter Normalization Utility

**Files:**
- Create: `packages/electron-app/src/renderer/utils/normalizeParams.ts`

**Step 1: Create the normalization utility**

```typescript
import type { DesaiOp } from '@desai/shared';

/**
 * Normalize shorthand parameters to full names
 * w -> width, h -> height, bg -> background, id -> elementId/layerId, radius -> cornerRadius
 */
export function normalizeParams(op: DesaiOp): Record<string, unknown> {
  const { target, op: operation, ...params } = op;
  const normalized: Record<string, unknown> = { ...params };

  // Expand shorthand
  if ('w' in normalized) {
    normalized.width = normalized.w;
    delete normalized.w;
  }
  if ('h' in normalized) {
    normalized.height = normalized.h;
    delete normalized.h;
  }
  if ('bg' in normalized) {
    normalized.background = normalized.bg;
    delete normalized.bg;
  }
  if ('radius' in normalized) {
    normalized.cornerRadius = normalized.radius;
    delete normalized.radius;
  }

  // Map 'id' to correct field based on target
  if ('id' in normalized) {
    if (target === 'layer') {
      normalized.layerId = normalized.id;
    } else {
      normalized.elementId = normalized.id;
    }
    delete normalized.id;
  }

  return normalized;
}

/**
 * Convert DesaiOp to IPC message type string
 * e.g., {target: 'shape', op: 'rect'} -> 'shape:rectangle'
 */
export function opToIpcType(op: DesaiOp): string {
  const { target, op: operation } = op;

  // Map short op names to full IPC type names
  const opMappings: Record<string, Record<string, string>> = {
    shape: { rect: 'rectangle', ellipse: 'ellipse' },
    canvas: { create: 'create', get_state: 'get-state', screenshot: 'screenshot', clear: 'clear' },
    layer: { create: 'create', delete: 'delete', visibility: 'set-visibility', opacity: 'set-opacity', lock: 'lock' },
    text: { create: 'create', update: 'update' },
    element: { transform: 'transform', style: 'style', delete: 'delete', duplicate: 'duplicate' },
    image: { add: 'import' },
    export: { png: 'png' },
  };

  const mappedOp = opMappings[target]?.[operation] ?? operation;
  return `${target}:${mappedOp}`;
}
```

**Step 2: Verify file is valid TypeScript**

Run: `cd /Users/zachswift/projects/desai && pnpm exec tsc --noEmit -p packages/electron-app`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/electron-app/src/renderer/utils/normalizeParams.ts
git commit -m "feat(electron): add parameter normalization utility"
```

---

### Task 3: Add Input Validation Utility

**Files:**
- Create: `packages/electron-app/src/renderer/utils/validateOp.ts`

**Step 1: Create the validation utility**

```typescript
import type { DesaiOp } from '@desai/shared';

interface ValidationResult {
  valid: true;
} | {
  valid: false;
  error: string;
}

const VALID_TARGETS = ['canvas', 'layer', 'shape', 'text', 'element', 'image', 'export'] as const;

const VALID_OPS: Record<string, string[]> = {
  canvas: ['create', 'get_state', 'screenshot', 'clear'],
  layer: ['create', 'delete', 'visibility', 'opacity', 'lock'],
  shape: ['rect', 'ellipse'],
  text: ['create', 'update'],
  element: ['transform', 'style', 'delete', 'duplicate'],
  image: ['add'],
  export: ['png'],
};

const REQUIRED_PARAMS: Record<string, Record<string, string[]>> = {
  layer: { create: ['name'] },
  shape: {
    rect: ['x', 'y'],
    ellipse: ['x', 'y'],
  },
  text: { create: ['x', 'y', 'content'] },
  element: {
    transform: ['id'],
    style: ['id'],
    delete: ['id'],
    duplicate: ['id'],
  },
  image: { add: ['path'] },
};

export function validateOp(op: DesaiOp, index: number): ValidationResult {
  const { target, op: operation } = op;

  // Check target
  if (!target || !VALID_TARGETS.includes(target as any)) {
    return { valid: false, error: `op ${index + 1}: unknown target "${target}"` };
  }

  // Check operation
  if (!operation || !VALID_OPS[target]?.includes(operation)) {
    return { valid: false, error: `op ${index + 1}: unknown op "${target}.${operation}"` };
  }

  // Check required params (using normalized names - id, w, h are ok)
  const required = REQUIRED_PARAMS[target]?.[operation] ?? [];
  for (const param of required) {
    // Check both short and full names
    const shortNames: Record<string, string> = { width: 'w', height: 'h', elementId: 'id', layerId: 'id' };
    const hasParam = param in op || shortNames[param] in op;
    if (!hasParam) {
      return { valid: false, error: `op ${index + 1}: ${operation} requires ${param}` };
    }
  }

  return { valid: true };
}

export function validateOps(ops: DesaiOp[]): ValidationResult {
  if (!Array.isArray(ops)) {
    return { valid: false, error: 'ops must be array' };
  }
  if (ops.length === 0) {
    return { valid: false, error: 'ops array empty' };
  }

  for (let i = 0; i < ops.length; i++) {
    const result = validateOp(ops[i], i);
    if (!result.valid) return result;
  }

  return { valid: true };
}
```

**Step 2: Verify file is valid TypeScript**

Run: `cd /Users/zachswift/projects/desai && pnpm exec tsc --noEmit -p packages/electron-app`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/electron-app/src/renderer/utils/validateOp.ts
git commit -m "feat(electron): add operation validation utility"
```

---

### Task 4: Add Batch Executor to MCP Handler

**Files:**
- Modify: `packages/electron-app/src/renderer/hooks/useMcpHandler.ts`

**Step 1: Add imports at top of file**

After the existing imports, add:

```typescript
import type { DesaiOp } from '@desai/shared';
import { normalizeParams, opToIpcType } from '../utils/normalizeParams';
import { validateOps } from '../utils/validateOp';
```

**Step 2: Add batch:execute case in the switch statement**

Add this case right after the opening of `try { switch (message.type) {`:

```typescript
          case 'batch:execute': {
            const ops = message.payload.ops as DesaiOp[];

            // Validate all ops first
            const validation = validateOps(ops);
            if (!validation.valid) {
              response = { success: false, error: validation.error };
              break;
            }

            // Snapshot state for rollback
            const snapshot = JSON.parse(JSON.stringify(store.project));

            const results: IpcResponse[] = [];

            for (let i = 0; i < ops.length; i++) {
              const op = ops[i];
              const ipcType = opToIpcType(op);
              const payload = normalizeParams(op);

              // Build IPC message for this op
              const opMessage = { type: ipcType, payload } as IpcMessage;

              // Execute using existing handler logic (recursive call pattern)
              let opResult: IpcResponse;
              try {
                opResult = await executeOp(opMessage, store);
              } catch (err) {
                opResult = { success: false, error: String(err) };
              }

              if (!opResult.success) {
                // Rollback and return failure
                store.restoreProject(snapshot);
                response = {
                  success: false,
                  error: `op ${i + 1} failed: ${opResult.error}`,
                };
                break;
              }

              results.push(opResult);
            }

            // If we didn't break early, all ops succeeded
            if (!response) {
              response = { success: true, data: results };
            }
            break;
          }
```

**Step 3: Extract executeOp helper function**

Add this function before the `useMcpHandler` function (outside the component):

```typescript
async function executeOp(
  message: IpcMessage,
  store: ReturnType<typeof useProjectStore.getState>
): Promise<IpcResponse> {
  const { project, addElement, deleteElement, updateElement, duplicateElement, clearCanvas, createCanvas, addLayer, deleteLayer, setLayerVisibility, setLayerOpacity, setLayerLock, getState } = store;

  switch (message.type) {
    case 'canvas:get-state': {
      const state = getState();
      const cleanState = {
        ...state,
        project: {
          ...state.project,
          layers: state.project.layers.map((layer) => ({
            ...layer,
            elements: layer.elements.map((el) => {
              if (el.type === 'image') {
                const { src, ...rest } = el as any;
                return { ...rest, src: rest.sourcePath || '[embedded image]' };
              }
              return el;
            }),
          })),
        },
      };
      return { success: true, data: cleanState };
    }

    case 'canvas:screenshot': {
      const screenshotPath = await window.electronAPI.captureScreenshot();
      return { success: true, data: { path: screenshotPath } };
    }

    case 'canvas:clear':
      clearCanvas();
      return { success: true, data: null };

    case 'canvas:create':
      createCanvas(
        (message.payload as any).width ?? 1920,
        (message.payload as any).height ?? 1080,
        (message.payload as any).background ?? '#ffffff'
      );
      return { success: true, data: null };

    case 'shape:rectangle': {
      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'no unlocked layer' };
      }
      const rect: RectElement = {
        id: generateId(),
        type: 'rect',
        x: (message.payload as any).x ?? 0,
        y: (message.payload as any).y ?? 0,
        width: (message.payload as any).width ?? 100,
        height: (message.payload as any).height ?? 100,
        rotation: 0,
        opacity: 100,
        fill: (message.payload as any).fill ?? '#3b82f6',
        stroke: (message.payload as any).stroke ?? '#1e40af',
        strokeWidth: (message.payload as any).strokeWidth ?? 0,
        cornerRadius: (message.payload as any).cornerRadius ?? 0,
      };
      addElement(activeLayer.id, rect);
      return { success: true, data: { elementId: rect.id } };
    }

    case 'shape:ellipse': {
      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'no unlocked layer' };
      }
      const ellipse: EllipseElement = {
        id: generateId(),
        type: 'ellipse',
        x: (message.payload as any).x ?? 0,
        y: (message.payload as any).y ?? 0,
        width: (message.payload as any).width ?? 100,
        height: (message.payload as any).height ?? 100,
        rotation: 0,
        opacity: 100,
        fill: (message.payload as any).fill ?? '#10b981',
        stroke: (message.payload as any).stroke ?? '#047857',
        strokeWidth: (message.payload as any).strokeWidth ?? 0,
      };
      addElement(activeLayer.id, ellipse);
      return { success: true, data: { elementId: ellipse.id } };
    }

    case 'text:create': {
      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'no unlocked layer' };
      }
      const text: TextElement = {
        id: generateId(),
        type: 'text',
        x: (message.payload as any).x ?? 0,
        y: (message.payload as any).y ?? 0,
        width: (message.payload as any).width ?? 400,
        height: (message.payload as any).height ?? 100,
        rotation: 0,
        opacity: 100,
        content: (message.payload as any).content ?? 'Text',
        fontSize: (message.payload as any).fontSize ?? 24,
        fontFamily: (message.payload as any).fontFamily ?? 'system-ui',
        fontWeight: (message.payload as any).fontWeight ?? 'normal',
        fill: (message.payload as any).fill ?? '#000000',
        align: (message.payload as any).align ?? 'left',
        lineHeight: 1.2,
        shadow: (message.payload as any).shadow,
      };
      addElement(activeLayer.id, text);
      return { success: true, data: { elementId: text.id } };
    }

    case 'text:update': {
      const { elementId, ...updates } = message.payload as any;
      updateElement(elementId, updates);
      return { success: true, data: null };
    }

    case 'image:import': {
      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'no unlocked layer' };
      }

      const filePath = (message.payload as any).path || (message.payload as any).src;
      const loadResult = await window.electronAPI.loadImageFromPath(filePath);

      if ('error' in loadResult) {
        return { success: false, error: loadResult.error };
      }

      const { dataUrl } = loadResult;
      const img = new window.Image();
      const dimensionsPromise = new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 200, height: 200 });
      });
      img.src = dataUrl;
      const { width: naturalWidth, height: naturalHeight } = await dimensionsPromise;

      const imageElement: ImageElement = {
        id: generateId(),
        type: 'image',
        x: (message.payload as any).x ?? 100,
        y: (message.payload as any).y ?? 100,
        width: (message.payload as any).width ?? naturalWidth,
        height: (message.payload as any).height ?? naturalHeight,
        rotation: 0,
        opacity: 100,
        src: dataUrl,
        sourcePath: filePath,
        naturalWidth,
        naturalHeight,
        filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0 },
      };
      addElement(activeLayer.id, imageElement);
      return { success: true, data: { elementId: imageElement.id, naturalWidth, naturalHeight } };
    }

    case 'element:delete':
      deleteElement((message.payload as any).elementId);
      return { success: true, data: null };

    case 'element:transform':
      updateElement((message.payload as any).elementId, message.payload as any);
      return { success: true, data: null };

    case 'element:style':
      updateElement((message.payload as any).elementId, message.payload as any);
      return { success: true, data: null };

    case 'element:duplicate': {
      const newId = duplicateElement((message.payload as any).elementId);
      return { success: true, data: { elementId: newId } };
    }

    case 'layer:create': {
      const layerId = addLayer((message.payload as any).name);
      return { success: true, data: { layerId } };
    }

    case 'layer:delete':
      deleteLayer((message.payload as any).layerId);
      return { success: true, data: null };

    case 'layer:set-visibility':
      setLayerVisibility((message.payload as any).layerId, (message.payload as any).visible);
      return { success: true, data: null };

    case 'layer:set-opacity':
      setLayerOpacity((message.payload as any).layerId, (message.payload as any).opacity);
      return { success: true, data: null };

    case 'layer:lock':
      setLayerLock((message.payload as any).layerId, (message.payload as any).locked);
      return { success: true, data: null };

    case 'export:png': {
      const exportPath = await window.electronAPI.exportPng();
      return exportPath
        ? { success: true, data: { path: exportPath } }
        : { success: false, error: 'export cancelled' };
    }

    default:
      return { success: false, error: `unknown command: ${(message as any).type}` };
  }
}
```

**Step 4: Add restoreProject to the store**

This requires adding a `restoreProject` action to the Zustand store. For now, mark this as a dependency - we'll need to add it in Task 5.

**Step 5: Commit**

```bash
git add packages/electron-app/src/renderer/hooks/useMcpHandler.ts
git commit -m "feat(electron): add batch:execute handler with rollback"
```

---

### Task 5: Add restoreProject to Zustand Store

**Files:**
- Modify: `packages/electron-app/src/renderer/store.ts` (or wherever the store is defined)

**Step 1: Find the store file**

Run: `find /Users/zachswift/projects/desai/packages/electron-app -name "store.ts" -o -name "store.tsx"`

**Step 2: Add restoreProject action**

Add to the store interface and implementation:

```typescript
// In the store interface
restoreProject: (snapshot: DesaiProject) => void;

// In the store implementation
restoreProject: (snapshot) => set({ project: snapshot }),
```

**Step 3: Verify types compile**

Run: `cd /Users/zachswift/projects/desai && pnpm exec tsc --noEmit -p packages/electron-app`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/electron-app/src/renderer/store.ts
git commit -m "feat(store): add restoreProject for atomic rollback"
```

---

### Task 6: Replace MCP Server Tools with Single desai Tool

**Files:**
- Modify: `packages/mcp-server/src/index.ts`

**Step 1: Replace the tools array with single tool**

Replace the entire `tools` array in `ListToolsRequestSchema` handler with:

```typescript
tools: [
  {
    name: 'desai',
    description: `Design canvas tool. Pass array of ops to execute sequentially.

Op format: {target, op, ...params}

canvas: create(width?,height?,bg?), get_state, screenshot, clear
layer: create(name), delete(id), visibility(id,visible), opacity(id,val), lock(id,locked)
shape: rect(x,y,w,h,fill?,stroke?,radius?), ellipse(x,y,w,h,fill?,stroke?)
text: create(x,y,content,fontSize?,fontWeight?,fill?,shadow?), update(id,content?,fontSize?,fill?)
element: transform(id,x?,y?,w?,h?,rotation?), style(id,fill?,stroke?,opacity?), delete(id), duplicate(id)
image: add(path,x?,y?,w?,h?)
export: png

Returns: [{success,data?,error?}] per op`,
    inputSchema: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          items: { type: 'object' },
          description: 'Operations to execute: [{target,op,...params}]',
        },
      },
      required: ['ops'],
    },
  },
],
```

**Step 2: Replace the CallToolRequestSchema handler**

Replace the entire switch statement with:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== 'desai') {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }) }],
    };
  }

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

  const ops = (args as any)?.ops;
  if (!Array.isArray(ops) || ops.length === 0) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'ops must be non-empty array' }) }],
    };
  }

  const message: IpcMessage = {
    type: 'batch:execute',
    payload: { ops },
  };

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
```

**Step 3: Verify types compile**

Run: `cd /Users/zachswift/projects/desai && pnpm exec tsc --noEmit -p packages/mcp-server`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/index.ts
git commit -m "feat(mcp): replace 19 tools with single desai tool"
```

---

### Task 7: Build and Test

**Step 1: Build all packages**

Run: `cd /Users/zachswift/projects/desai && pnpm build`
Expected: Build succeeds

**Step 2: Start the app**

Run: `cd /Users/zachswift/projects/desai && pnpm dev`
Expected: App starts

**Step 3: Test single operation**

Use Claude Code to test:
```json
{"ops": [{"target": "canvas", "op": "create", "w": 800, "h": 600}]}
```
Expected: Canvas created

**Step 4: Test batch operations**

```json
{
  "ops": [
    {"target": "canvas", "op": "clear"},
    {"target": "shape", "op": "rect", "x": 100, "y": 100, "w": 200, "h": 150, "fill": "#ff0000"},
    {"target": "text", "op": "create", "x": 150, "y": 125, "content": "Test", "fontSize": 24}
  ]
}
```
Expected: Canvas cleared, rect and text created

**Step 5: Test rollback on failure**

```json
{
  "ops": [
    {"target": "shape", "op": "rect", "x": 50, "y": 50, "w": 100, "h": 100, "fill": "#00ff00"},
    {"target": "element", "op": "transform", "id": "nonexistent", "x": 200}
  ]
}
```
Expected: Error returned, green rect NOT on canvas (rolled back)

**Step 6: Test get_state returns clean data**

```json
{"ops": [{"target": "canvas", "op": "get_state"}]}
```
Expected: State returned, no base64 image blobs

**Step 7: Commit any fixes**

If tests revealed issues, fix and commit.

**Step 8: Final commit**

```bash
git add -A
git commit -m "test: verify unified MCP API works correctly"
```

---

### Task 8: Update Claude Code MCP Config (if needed)

**Note:** This may not require code changes, just documentation.

The MCP server name stays the same (`desai`), so existing configs should work. Claude Code will automatically see the new single tool instead of 19 tools.

**Step 1: Verify MCP registration**

Check that Claude Code sees the `desai` tool by running `/mcp` or checking context.

**Step 2: Document the change**

Update any user-facing docs to show the new API format.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add batch types | shared/types.ts |
| 2 | Parameter normalization | electron-app/utils/normalizeParams.ts |
| 3 | Input validation | electron-app/utils/validateOp.ts |
| 4 | Batch executor | electron-app/hooks/useMcpHandler.ts |
| 5 | Store rollback | electron-app/store.ts |
| 6 | Single MCP tool | mcp-server/index.ts |
| 7 | Build and test | - |
| 8 | Config update | - |
