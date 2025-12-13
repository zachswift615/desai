import React, { useRef, useEffect, useState } from 'react';
import type { Element, Fill } from '@desai/shared';

function fillToCSS(fill: Fill): string {
  if (typeof fill === 'string') {
    return fill;
  }
  if (fill.type === 'linear') {
    const stops = fill.stops
      .map(s => `${s.color} ${s.position}%`)
      .join(', ');
    return `linear-gradient(${fill.angle}deg, ${stops})`;
  }
  return '#ffffff';
}

interface CanvasElementProps {
  element: Element;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent, element: Element) => void;
  onResizeStart?: (e: React.MouseEvent, element: Element, handle: ResizeHandle) => void;
  isEditing?: boolean;
  onDoubleClick?: () => void;
  onEditComplete?: (content: string) => void;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_SIZE = 8;
const HANDLE_OFFSET = HANDLE_SIZE / 2;

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

interface EditableTextProps {
  element: Element & { type: 'text' };
  onComplete: (content: string) => void;
}

function EditableText({ element, onComplete }: EditableTextProps) {
  const [content, setContent] = useState(element.content);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divRef.current) {
      divRef.current.focus();
      // Place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(divRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  const handleBlur = () => {
    if (divRef.current) {
      // Use innerText to preserve line breaks
      onComplete(divRef.current.innerText || '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (divRef.current) {
        onComplete(divRef.current.innerText || '');
      }
    }
  };

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        color: element.fill,
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
        fontWeight: element.fontWeight,
        textAlign: element.align,
        lineHeight: element.lineHeight,
        whiteSpace: 'pre-wrap',
        outline: '2px solid #3b82f6',
        outlineOffset: '2px',
        cursor: 'text',
        userSelect: 'text',
      }}
    >
      {content}
    </div>
  );
}

function ResizeHandles({
  element,
  onResizeStart
}: {
  element: Element;
  onResizeStart: (e: React.MouseEvent, element: Element, handle: ResizeHandle) => void;
}) {
  const handleStyle = (handle: ResizeHandle): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      backgroundColor: 'white',
      border: '2px solid #3b82f6',
      cursor: HANDLE_CURSORS[handle],
      zIndex: 10,
    };

    // Position handles at corners and edges
    switch (handle) {
      case 'nw':
        return { ...base, top: -HANDLE_OFFSET, left: -HANDLE_OFFSET };
      case 'n':
        return { ...base, top: -HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' };
      case 'ne':
        return { ...base, top: -HANDLE_OFFSET, right: -HANDLE_OFFSET };
      case 'e':
        return { ...base, top: '50%', right: -HANDLE_OFFSET, transform: 'translateY(-50%)' };
      case 'se':
        return { ...base, bottom: -HANDLE_OFFSET, right: -HANDLE_OFFSET };
      case 's':
        return { ...base, bottom: -HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' };
      case 'sw':
        return { ...base, bottom: -HANDLE_OFFSET, left: -HANDLE_OFFSET };
      case 'w':
        return { ...base, top: '50%', left: -HANDLE_OFFSET, transform: 'translateY(-50%)' };
    }
  };

  const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  return (
    <>
      {handles.map((handle) => (
        <div
          key={handle}
          style={handleStyle(handle)}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, element, handle);
          }}
        />
      ))}
    </>
  );
}

export function CanvasElement({ element, selected, onSelect, onDragStart, onResizeStart, isEditing, onDoubleClick, onEditComplete }: CanvasElementProps) {
  // If editing, render the editable version
  if (isEditing && element.type === 'text' && onEditComplete) {
    return <EditableText element={element} onComplete={onEditComplete} />;
  }

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    opacity: element.opacity / 100,
    cursor: selected ? 'move' : 'pointer',
    outline: selected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
    userSelect: 'none',
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent native text selection during drag
    if (!selected) {
      onSelect();
    }
    onDragStart(e, element);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick();
    }
  };

  switch (element.type) {
    case 'rect':
      return (
        <div
          onMouseDown={handleMouseDown}
          style={{
            ...baseStyle,
            background: fillToCSS(element.fill),
            border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke}` : 'none',
            borderRadius: element.cornerRadius,
          }}
        >
          {selected && onResizeStart && <ResizeHandles element={element} onResizeStart={onResizeStart} />}
        </div>
      );

    case 'ellipse':
      return (
        <div
          onMouseDown={handleMouseDown}
          style={{
            ...baseStyle,
            backgroundColor: element.fill,
            border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke}` : 'none',
            borderRadius: '50%',
          }}
        >
          {selected && onResizeStart && <ResizeHandles element={element} onResizeStart={onResizeStart} />}
        </div>
      );

    case 'text':
      return (
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          style={{
            ...baseStyle,
            color: element.fill,
            fontSize: element.fontSize,
            fontFamily: element.fontFamily,
            fontWeight: element.fontWeight,
            textAlign: element.align,
            lineHeight: element.lineHeight,
            whiteSpace: 'pre-wrap',
            overflow: 'visible', // Allow resize handles to show outside bounds
          }}
        >
          {element.content}
          {selected && onResizeStart && <ResizeHandles element={element} onResizeStart={onResizeStart} />}
        </div>
      );

    case 'image':
      return (
        <div
          onMouseDown={handleMouseDown}
          style={{
            ...baseStyle,
          }}
        >
          <img
            src={element.src}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: `
                brightness(${element.filters.brightness}%)
                contrast(${element.filters.contrast}%)
                saturate(${element.filters.saturate}%)
                blur(${element.filters.blur}px)
              `,
              pointerEvents: 'none',
            }}
          />
          {selected && onResizeStart && <ResizeHandles element={element} onResizeStart={onResizeStart} />}
        </div>
      );

    case 'line':
      return (
        <svg
          onMouseDown={handleMouseDown}
          style={{
            ...baseStyle,
            overflow: 'visible',
          }}
        >
          <line
            x1={element.x1 - element.x}
            y1={element.y1 - element.y}
            x2={element.x2 - element.x}
            y2={element.y2 - element.y}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
          />
          {selected && onResizeStart && <ResizeHandles element={element} onResizeStart={onResizeStart} />}
        </svg>
      );

    default:
      return null;
  }
}
