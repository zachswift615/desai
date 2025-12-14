import React, { useRef, useState, useCallback, useEffect } from 'react';
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

interface PanState {
  isPanning: boolean;
  panStartPos: { x: number; y: number } | null;
  viewportStartPan: { panX: number; panY: number } | null;
}

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  const setViewport = useProjectStore((s) => s.setViewport);
  const editingTextId = useProjectStore((s) => s.editingTextId);
  const setEditingText = useProjectStore((s) => s.setEditingText);

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

  const [panState, setPanState] = useState<PanState>({
    isPanning: false,
    panStartPos: null,
    viewportStartPan: null,
  });

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Handle keyboard events for space key and escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if (e.code === 'Escape' && editingTextId) {
        e.preventDefault();
        setEditingText(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed, editingTextId, setEditingText]);

  const handleDragStart = useCallback((e: React.MouseEvent, element: Element) => {
    if (activeTool !== 'select') return;
    // Don't start dragging if space is pressed (panning mode)
    if (isSpacePressed) return;

    // Push history before drag starts
    pushHistory();

    setDragState({
      isDragging: true,
      dragStartPos: { x: e.clientX, y: e.clientY },
      elementStartPos: { x: element.x, y: element.y },
      draggedElementId: element.id,
    });
  }, [activeTool, pushHistory, isSpacePressed]);

  const handleResizeStart = useCallback((e: React.MouseEvent, element: Element, handle: ResizeHandle) => {
    if (activeTool !== 'select') return;
    // Don't start resizing if space is pressed (panning mode)
    if (isSpacePressed) return;

    // Push history before resize starts
    pushHistory();

    setResizeState({
      isResizing: true,
      resizeStartPos: { x: e.clientX, y: e.clientY },
      elementStartBounds: { x: element.x, y: element.y, width: element.width, height: element.height },
      resizedElementId: element.id,
      resizeHandle: handle,
    });
  }, [activeTool, pushHistory, isSpacePressed]);

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
    if (panState.isPanning) {
      setPanState({
        isPanning: false,
        panStartPos: null,
        viewportStartPan: null,
      });
    }
  }, [dragState.isDragging, resizeState.isResizing, panState.isPanning]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // Calculate mouse position relative to container
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    // Zoom factor: scroll up = zoom in, scroll down = zoom out
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const oldZoom = viewport.zoom;
    let newZoom = oldZoom * zoomFactor;

    // Clamp zoom between 0.1 and 5
    newZoom = Math.max(0.1, Math.min(5, newZoom));

    // Calculate world position of mouse before zoom
    const worldX = (mouseX - viewport.panX) / oldZoom;
    const worldY = (mouseY - viewport.panY) / oldZoom;

    // Adjust pan so world position stays under mouse after zoom
    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;

    setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
  }, [viewport, setViewport]);

  // Handle mouse down for panning
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or Space + left mouse button
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setPanState({
        isPanning: true,
        panStartPos: { x: e.clientX, y: e.clientY },
        viewportStartPan: { panX: viewport.panX, panY: viewport.panY },
      });
    }
  }, [isSpacePressed, viewport.panX, viewport.panY]);

  // Handle mouse move for panning and dragging (container level for reliable capture)
  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle element dragging at container level for reliable mouse capture
    if (dragState.isDragging && dragState.dragStartPos && dragState.elementStartPos && dragState.draggedElementId) {
      const deltaX = (e.clientX - dragState.dragStartPos.x) / viewport.zoom;
      const deltaY = (e.clientY - dragState.dragStartPos.y) / viewport.zoom;

      const newX = dragState.elementStartPos.x + deltaX;
      const newY = dragState.elementStartPos.y + deltaY;

      updateElementNoHistory(dragState.draggedElementId, { x: newX, y: newY });
      return;
    }

    // Handle element resizing at container level
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

      updateElementNoHistory(resizeState.resizedElementId, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
      return;
    }

    // Handle panning
    if (panState.isPanning && panState.panStartPos && panState.viewportStartPan) {
      const deltaX = e.clientX - panState.panStartPos.x;
      const deltaY = e.clientY - panState.panStartPos.y;

      setViewport({
        panX: panState.viewportStartPan.panX + deltaX,
        panY: panState.viewportStartPan.panY + deltaY,
      });
    }
  }, [dragState, resizeState, panState, viewport.zoom, updateElementNoHistory, setViewport]);

  const handleTextDoubleClick = useCallback((elementId: string) => {
    setEditingText(elementId);
  }, [setEditingText]);

  const handleEditComplete = useCallback((elementId: string, content: string) => {
    updateElement(elementId, { content });
    setEditingText(null);
  }, [updateElement, setEditingText]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Don't handle click if we were panning
    if (panState.isPanning) return;

    // Exit edit mode if clicking on canvas
    if (editingTextId) {
      setEditingText(null);
      return;
    }

    if (activeTool === 'select') {
      clearSelection();
      return;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // Convert screen coordinates to canvas world coordinates
    const screenX = e.clientX - containerRect.left;
    const screenY = e.clientY - containerRect.top;
    const x = (screenX - viewport.panX) / viewport.zoom;
    const y = (screenY - viewport.panY) / viewport.zoom;

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
          fill: '#000000',
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

  const cursorStyle = panState.isPanning
    ? 'grabbing'
    : isSpacePressed
    ? 'grab'
    : 'default';

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-gray-950 relative"
      onWheel={handleWheel}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: cursorStyle }}
    >
      <div
        id="design-canvas"
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="absolute shadow-2xl"
        style={{
          width: project.canvas.width,
          height: project.canvas.height,
          backgroundColor: project.canvas.background,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
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
                  isEditing={editingTextId === element.id}
                  onDoubleClick={element.type === 'text' ? () => handleTextDoubleClick(element.id) : undefined}
                  onEditComplete={element.type === 'text' ? (content) => handleEditComplete(element.id, content) : undefined}
                />
              ))}
            </React.Fragment>
          ) : null
        )}
      </div>
    </div>
  );
}
