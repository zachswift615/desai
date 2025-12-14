# Unified MCP API Design

## Problem

Current MCP server exposes 19 separate tools, consuming ~11,000 tokens in tool schemas. This is inefficient for Claude Code sessions where context is precious. Additionally, Claude already knows what operations it needs to perform, so batching them in a single call reduces round trips.

## Solution

Replace all 19 tools with a single `desai` tool that accepts an array of operations.

## API Design

### Tool Schema

```typescript
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
        description: 'Operations to execute: [{target,op,...params}]'
      }
    },
    required: ['ops']
  }
}
```

### Usage Examples

```json
// Create canvas and add elements
{
  "ops": [
    {"target": "canvas", "op": "create", "w": 800, "h": 600},
    {"target": "shape", "op": "rect", "x": 100, "y": 100, "w": 200, "h": 150, "fill": "#3b82f6"},
    {"target": "text", "op": "create", "x": 150, "y": 160, "content": "Hello", "fontSize": 24},
    {"target": "canvas", "op": "screenshot"}
  ]
}

// Modify existing element
{
  "ops": [
    {"target": "element", "op": "transform", "id": "el_abc123", "x": 200, "y": 300},
    {"target": "element", "op": "style", "id": "el_abc123", "fill": "#ff0000"}
  ]
}
```

## Parameter Shorthand

| Short | Full | Used in |
|-------|------|---------|
| `w` | `width` | shapes, canvas |
| `h` | `height` | shapes, canvas |
| `bg` | `background` | canvas |
| `id` | `elementId` or `layerId` | element/layer ops |
| `radius` | `cornerRadius` | rect |

## Atomic Transactions

Operations execute as an atomic transaction:

1. Snapshot canvas state before execution
2. Execute ops sequentially
3. If any op fails: rollback to snapshot, return error with details
4. If all succeed: return array of results

This prevents partial state when operations depend on each other.

## Error Handling

Concise error messages for the freeform API:

| Scenario | Error |
|----------|-------|
| Missing required param | `"rect: x required"` |
| Invalid element ID | `"element not found: abc123"` |
| No unlocked layer | `"no unlocked layer"` |
| Invalid op | `"unknown op: canvas.foo"` |
| Invalid target | `"unknown target: widget"` |
| Type error | `"rect: width must be number"` |

### Failure Response

```json
{
  "success": false,
  "error": "Op 3 failed: element not found: abc123",
  "failedOp": {"target": "element", "op": "transform", "id": "abc123"},
  "completedOps": 2
}
```

## Implementation

### Changes Required

1. **packages/shared/src/types.ts**
   - Add `DesaiOp` type
   - Add `batch:execute` IPC message type

2. **packages/mcp-server/src/index.ts**
   - Replace 19 tool definitions with single `desai` tool
   - Convert ops array to `batch:execute` IPC message
   - Simplify tool handler to just forward to IPC

3. **packages/electron-app/src/renderer/hooks/useMcpHandler.ts**
   - Add `batch:execute` handler
   - Implement state snapshot/restore for rollback
   - Add parameter normalization (shorthand expansion)
   - Add input validation with concise errors
   - Execute ops sequentially using existing handlers

### Architecture

```
Claude Code
    │
    ▼
desai MCP tool (single tool, ~400 tokens)
    │
    ▼
batch:execute IPC message
    │
    ▼
Batch executor (snapshot, validate, execute, rollback on error)
    │
    ▼
Existing handlers (shape:rectangle, text:create, etc.)
```

The batch executor orchestrates existing handlers, so internal architecture stays the same.

## Token Savings

- Before: ~11,000 tokens (19 tools × ~600 tokens each)
- After: ~400 tokens (1 tool)
- Savings: ~96%
