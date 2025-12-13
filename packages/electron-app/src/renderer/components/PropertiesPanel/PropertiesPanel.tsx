import React from 'react';
import { useProjectStore } from '../../store';
import { PropertyInput } from './PropertyInput';
import type { Element } from '@desai/shared';

export function PropertiesPanel() {
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const updateElement = useProjectStore((s) => s.updateElement);
  const deleteElement = useProjectStore((s) => s.deleteElement);
  const duplicateElement = useProjectStore((s) => s.duplicateElement);

  // Find selected element
  let selectedElement: Element | null = null;
  for (const layer of project.layers) {
    const found = layer.elements.find((el) => selection.includes(el.id));
    if (found) {
      selectedElement = found;
      break;
    }
  }

  if (!selectedElement) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Select an element to edit its properties
      </div>
    );
  }

  const update = (updates: Partial<Element>) => {
    updateElement(selectedElement!.id, updates);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent canvas from receiving events and clearing selection
    e.stopPropagation();
  };

  return (
    <div className="p-4 space-y-4" onMouseDown={handleMouseDown}>
      <div className="text-sm font-medium capitalize">
        {selectedElement.type}
      </div>

      {/* Transform */}
      <div className="space-y-2">
        <div className="text-xs text-gray-500 uppercase">Transform</div>
        <PropertyInput
          label="X"
          value={selectedElement.x}
          type="number"
          onChange={(v) => update({ x: v as number })}
        />
        <PropertyInput
          label="Y"
          value={selectedElement.y}
          type="number"
          onChange={(v) => update({ y: v as number })}
        />
        <PropertyInput
          label="Width"
          value={selectedElement.width}
          type="number"
          onChange={(v) => update({ width: v as number })}
        />
        <PropertyInput
          label="Height"
          value={selectedElement.height}
          type="number"
          onChange={(v) => update({ height: v as number })}
        />
        <PropertyInput
          label="Rotation"
          value={selectedElement.rotation}
          type="number"
          onChange={(v) => update({ rotation: v as number })}
        />
        <PropertyInput
          label="Opacity"
          value={selectedElement.opacity}
          type="number"
          onChange={(v) => update({ opacity: v as number })}
        />
      </div>

      {/* Fill (for shapes and text) */}
      {'fill' in selectedElement && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Fill</div>
          <PropertyInput
            label="Color"
            value={selectedElement.fill}
            type="color"
            onChange={(v) => update({ fill: v as string })}
          />
        </div>
      )}

      {/* Stroke (for shapes) */}
      {'stroke' in selectedElement && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Stroke</div>
          <PropertyInput
            label="Color"
            value={selectedElement.stroke}
            type="color"
            onChange={(v) => update({ stroke: v as string })}
          />
          <PropertyInput
            label="Width"
            value={selectedElement.strokeWidth}
            type="number"
            onChange={(v) => update({ strokeWidth: v as number })}
          />
        </div>
      )}

      {/* Text properties */}
      {selectedElement.type === 'text' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Text</div>
          <textarea
            value={selectedElement.content}
            onChange={(e) => update({ content: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
            rows={3}
          />
          <PropertyInput
            label="Size"
            value={selectedElement.fontSize}
            type="number"
            onChange={(v) => update({ fontSize: v as number })}
          />
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-4 border-t border-gray-700">
        <button
          onClick={() => duplicateElement(selectedElement!.id)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded"
        >
          Duplicate
        </button>
        <button
          onClick={() => deleteElement(selectedElement!.id)}
          className="w-full bg-red-900 hover:bg-red-800 text-sm py-2 rounded"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
