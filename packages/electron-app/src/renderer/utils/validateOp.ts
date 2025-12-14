import type { DesaiOp } from '@desai/shared';

type ValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      error: string;
    };

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
  layer: {
    create: ['name'],
    delete: ['id'],
    visibility: ['id', 'visible'],
    opacity: ['id', 'opacity'],
    lock: ['id', 'locked']
  },
  shape: {
    rect: ['x', 'y'],
    ellipse: ['x', 'y'],
  },
  text: {
    create: ['x', 'y', 'content'],
    update: ['id']
  },
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
