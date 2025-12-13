import React from 'react';
import { useProjectStore } from '../../store';
import { ToolButton } from './ToolButton';

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

  return (
    <div className="flex flex-col items-center gap-1 p-2">
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          active={activeTool === tool.id}
          onClick={() => setActiveTool(tool.id)}
        />
      ))}
    </div>
  );
}
