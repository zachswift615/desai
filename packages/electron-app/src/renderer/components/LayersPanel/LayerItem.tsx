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
