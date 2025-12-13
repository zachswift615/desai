import React from 'react';
import { useProjectStore } from '../../store';
import { ToolButton } from './ToolButton';
import { generateId } from '../../utils/id';
import type { ImageElement } from '@desai/shared';

const tools = [
  { id: 'select', icon: '⬚', label: 'Select (V)' },
  { id: 'move', icon: '✥', label: 'Move (M)' },
  { id: 'rect', icon: '▢', label: 'Rectangle (R)' },
  { id: 'ellipse', icon: '○', label: 'Ellipse (E)' },
  { id: 'line', icon: '╱', label: 'Line (L)' },
  { id: 'text', icon: 'T', label: 'Text (T)' },
  { id: 'image', icon: '🖼', label: 'Image (I)' },
];

export function Toolbar() {
  const activeTool = useProjectStore((s) => s.activeTool);
  const setActiveTool = useProjectStore((s) => s.setActiveTool);
  const project = useProjectStore((s) => s.project);
  const addElement = useProjectStore((s) => s.addElement);
  const setSelection = useProjectStore((s) => s.setSelection);

  const handleToolClick = async (toolId: string) => {
    if (toolId === 'image') {
      // Handle image import directly
      if (!window.electronAPI) {
        console.error('Electron API not available');
        return;
      }

      const result = await window.electronAPI.selectImage();
      if (!result) return;

      const { dataUrl } = result;

      // Create an image element to get natural dimensions
      const img = new Image();
      img.onload = () => {
        const activeLayer = project.layers.find((l) => !l.locked);
        if (!activeLayer) return;

        // Create image element with natural dimensions
        const imageElement: ImageElement = {
          id: generateId(),
          type: 'image',
          x: 100,
          y: 100,
          width: img.naturalWidth,
          height: img.naturalHeight,
          rotation: 0,
          opacity: 100,
          src: dataUrl,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          filters: {
            brightness: 100,
            contrast: 100,
            saturate: 100,
            blur: 0,
          },
        };

        addElement(activeLayer.id, imageElement);
        setSelection([imageElement.id]);
      };
      img.src = dataUrl;
    } else {
      setActiveTool(toolId);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 p-2">
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          active={activeTool === tool.id}
          onClick={() => handleToolClick(tool.id)}
        />
      ))}
    </div>
  );
}
