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
    export: { png: 'png', canvas: 'canvas' },
    project: { save: 'save', load: 'load' },
  };

  const mappedOp = opMappings[target]?.[operation] ?? operation;
  return `${target}:${mappedOp}`;
}
