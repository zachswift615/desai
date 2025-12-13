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
