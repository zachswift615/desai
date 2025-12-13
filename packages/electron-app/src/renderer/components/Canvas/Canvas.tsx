import React, { useRef, useState, useCallback } from 'react';
import { useProjectStore } from '../../store';
import { CanvasElement, type ResizeHandle } from './CanvasElement';
import { generateId } from '../../utils/id';
import type { RectElement, EllipseElement, TextElement, LineElement, Element } from '@desai/shared';

interface DragState {
  isDragging: boolean;
  dragStartPos: { x: number; y: number } | null;
  elementStartPos: { x: number; y: number } | null;
  draggedElementId: string | null;
}

interface ResizeState {
  isResizing: boolean;
  resizeStartPos: { x: number; y: number } | null;
  elementStartBounds: { x: number; y: number; width: number; height: number } | null;
  resizedElementId: string | null;
  resizeHandle: ResizeHandle | null;
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

  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    resizeStartPos: null,
    elementStartBounds: null,
    resizedElementId: null,
    resizeHandle: null,
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

  const handleResizeStart = useCallback((e: React.MouseEvent, element: Element, handle: ResizeHandle) => {
    if (activeTool !== 'select') return;

    // Push history before resize starts
    pushHistory();

    setResizeState({
      isResizing: true,
      resizeStartPos: { x: e.clientX, y: e.clientY },
      elementStartBounds: { x: element.x, y: element.y, width: element.width, height: element.height },
      resizedElementId: element.id,
      resizeHandle: handle,
    });
  }, [activeTool, pushHistory]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle dragging
    if (dragState.isDragging && dragState.dragStartPos && dragState.elementStartPos && dragState.draggedElementId) {
      const deltaX = (e.clientX - dragState.dragStartPos.x) / viewport.zoom;
      const deltaY = (e.clientY - dragState.dragStartPos.y) / viewport.zoom;

      const newX = dragState.elementStartPos.x + deltaX;
      const newY = dragState.elementStartPos.y + deltaY;

      // Use no-history version during drag for performance
      updateElementNoHistory(dragState.draggedElementId, { x: newX, y: newY });
      return;
    }

    // Handle resizing
    if (resizeState.isResizing && resizeState.resizeStartPos && resizeState.elementStartBounds && resizeState.resizedElementId && resizeState.resizeHandle) {
      const deltaX = (e.clientX - resizeState.resizeStartPos.x) / viewport.zoom;
      const deltaY = (e.clientY - resizeState.resizeStartPos.y) / viewport.zoom;

      const MIN_SIZE = 10;
      const { x, y, width, height } = resizeState.elementStartBounds;
      const handle = resizeState.resizeHandle;

      let newX = x;
      let newY = y;
      let newWidth = width;
      let newHeight = height;

      // Calculate new dimensions based on handle
      switch (handle) {
        case 'nw':
          newX = x + deltaX;
          newY = y + deltaY;
          newWidth = width - deltaX;
          newHeight = height - deltaY;
          break;
        case 'n':
          newY = y + deltaY;
          newHeight = height - deltaY;
          break;
        case 'ne':
          newY = y + deltaY;
          newWidth = width + deltaX;
          newHeight = height - deltaY;
          break;
        case 'e':
          newWidth = width + deltaX;
          break;
        case 'se':
          newWidth = width + deltaX;
          newHeight = height + deltaY;
          break;
        case 's':
          newHeight = height + deltaY;
          break;
        case 'sw':
          newX = x + deltaX;
          newWidth = width - deltaX;
          newHeight = height + deltaY;
          break;
        case 'w':
          newX = x + deltaX;
          newWidth = width - deltaX;
          break;
      }

      // Enforce minimum size
      if (newWidth < MIN_SIZE) {
        if (handle.includes('w')) {
          newX = x + width - MIN_SIZE;
        }
        newWidth = MIN_SIZE;
      }
      if (newHeight < MIN_SIZE) {
        if (handle.includes('n')) {
          newY = y + height - MIN_SIZE;
        }
        newHeight = MIN_SIZE;
      }

      // Use no-history version during resize for performance
      updateElementNoHistory(resizeState.resizedElementId, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    }
  }, [dragState, resizeState, viewport.zoom, updateElementNoHistory]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging) {
      setDragState({
        isDragging: false,
        dragStartPos: null,
        elementStartPos: null,
        draggedElementId: null,
      });
    }
    if (resizeState.isResizing) {
      setResizeState({
        isResizing: false,
        resizeStartPos: null,
        elementStartBounds: null,
        resizedElementId: null,
        resizeHandle: null,
      });
    }
  }, [dragState.isDragging, resizeState.isResizing]);

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
                  onResizeStart={handleResizeStart}
                />
              ))}
            </React.Fragment>
          ) : null
        )}
      </div>
    </div>
  );
}
