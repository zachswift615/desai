import React, { useRef, useState, useCallback } from 'react';
import { useProjectStore } from '../../store';
import { CanvasElement } from './CanvasElement';
import { generateId } from '../../utils/id';
import type { RectElement, EllipseElement, TextElement, LineElement, Element } from '@desai/shared';

interface DragState {
  isDragging: boolean;
  dragStartPos: { x: number; y: number } | null;
  elementStartPos: { x: number; y: number } | null;
  draggedElementId: string | null;
}

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const activeTool = useProjectStore((s) => s.activeTool);
  const setSelection = useProjectStore((s) => s.setSelection);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const addElement = useProjectStore((s) => s.addElement);
  const updateElement = useProjectStore((s) => s.updateElement);
  const updateElementNoHistory = useProjectStore((s) => s.updateElementNoHistory);
  const pushHistory = useProjectStore((s) => s.pushHistory);
  const viewport = useProjectStore((s) => s.viewport);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragStartPos: null,
    elementStartPos: null,
    draggedElementId: null,
  });

  const handleDragStart = useCallback((e: React.MouseEvent, element: Element) => {
    if (activeTool !== 'select') return;

    // Push history before drag starts
    pushHistory();

    setDragState({
      isDragging: true,
      dragStartPos: { x: e.clientX, y: e.clientY },
      elementStartPos: { x: element.x, y: element.y },
      draggedElementId: element.id,
    });
  }, [activeTool, pushHistory]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.dragStartPos || !dragState.elementStartPos || !dragState.draggedElementId) {
      return;
    }

    const deltaX = (e.clientX - dragState.dragStartPos.x) / viewport.zoom;
    const deltaY = (e.clientY - dragState.dragStartPos.y) / viewport.zoom;

    const newX = dragState.elementStartPos.x + deltaX;
    const newY = dragState.elementStartPos.y + deltaY;

    // Use no-history version during drag for performance
    updateElementNoHistory(dragState.draggedElementId, { x: newX, y: newY });
  }, [dragState, viewport.zoom, updateElementNoHistory]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging) {
      setDragState({
        isDragging: false,
        dragStartPos: null,
        elementStartPos: null,
        draggedElementId: null,
      });
    }
  }, [dragState.isDragging]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeTool === 'select') {
      clearSelection();
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / viewport.zoom;
    const y = (e.clientY - rect.top) / viewport.zoom;

    const activeLayer = project.layers.find((l) => !l.locked);
    if (!activeLayer) return;

    let newElement;

    switch (activeTool) {
      case 'rect':
        const rectElement: RectElement = {
          id: generateId(),
          type: 'rect',
          x,
          y,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 100,
          fill: '#3b82f6',
          stroke: '#1e40af',
          strokeWidth: 0,
          cornerRadius: 0,
        };
        newElement = rectElement;
        break;

      case 'ellipse':
        const ellipseElement: EllipseElement = {
          id: generateId(),
          type: 'ellipse',
          x,
          y,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 100,
          fill: '#10b981',
          stroke: '#047857',
          strokeWidth: 0,
        };
        newElement = ellipseElement;
        break;

      case 'text':
        const textElement: TextElement = {
          id: generateId(),
          type: 'text',
          x,
          y,
          width: 200,
          height: 50,
          rotation: 0,
          opacity: 100,
          content: 'Text',
          fontSize: 24,
          fontFamily: 'system-ui',
          fontWeight: 'normal',
          fill: '#ffffff',
          align: 'left',
          lineHeight: 1.2,
        };
        newElement = textElement;
        break;

      case 'line':
        const lineElement: LineElement = {
          id: generateId(),
          type: 'line',
          x,
          y,
          width: 100,
          height: 2,
          rotation: 0,
          opacity: 100,
          x1: x,
          y1: y,
          x2: x + 100,
          y2: y,
          stroke: '#ffffff',
          strokeWidth: 2,
        };
        newElement = lineElement;
        break;

      default:
        return;
    }

    if (newElement) {
      addElement(activeLayer.id, newElement);
      setSelection([newElement.id]);
    }
  };

  return (
    <div className="h-full w-full overflow-auto bg-gray-950 flex items-center justify-center p-8">
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative shadow-2xl"
        style={{
          width: project.canvas.width,
          height: project.canvas.height,
          backgroundColor: project.canvas.background,
          transform: `scale(${viewport.zoom})`,
          transformOrigin: 'center center',
          userSelect: 'none',
        }}
      >
        {/* Render layers bottom to top */}
        {[...project.layers].reverse().map((layer) =>
          layer.visible ? (
            <React.Fragment key={layer.id}>
              {layer.elements.map((element) => (
                <CanvasElement
                  key={element.id}
                  element={element}
                  selected={selection.includes(element.id)}
                  onSelect={() => setSelection([element.id])}
                  onDragStart={handleDragStart}
                />
              ))}
            </React.Fragment>
          ) : null
        )}
      </div>
    </div>
  );
}
