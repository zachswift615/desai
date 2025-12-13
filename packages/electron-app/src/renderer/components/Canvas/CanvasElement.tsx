import React from 'react';
import type { Element } from '@desai/shared';

interface CanvasElementProps {
  element: Element;
  selected: boolean;
  onSelect: () => void;
}

export function CanvasElement({ element, selected, onSelect }: CanvasElementProps) {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    opacity: element.opacity / 100,
    cursor: 'pointer',
    outline: selected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  switch (element.type) {
    case 'rect':
      return (
        <div
          onClick={handleClick}
          style={{
            ...baseStyle,
            backgroundColor: element.fill,
            border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke}` : 'none',
            borderRadius: element.cornerRadius,
          }}
        />
      );

    case 'ellipse':
      return (
        <div
          onClick={handleClick}
          style={{
            ...baseStyle,
            backgroundColor: element.fill,
            border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke}` : 'none',
            borderRadius: '50%',
          }}
        />
      );

    case 'text':
      return (
        <div
          onClick={handleClick}
          style={{
            ...baseStyle,
            color: element.fill,
            fontSize: element.fontSize,
            fontFamily: element.fontFamily,
            fontWeight: element.fontWeight,
            textAlign: element.align,
            lineHeight: element.lineHeight,
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
          }}
        >
          {element.content}
        </div>
      );

    case 'image':
      return (
        <img
          onClick={handleClick}
          src={element.src}
          alt=""
          style={{
            ...baseStyle,
            objectFit: 'cover',
            filter: `
              brightness(${element.filters.brightness}%)
              contrast(${element.filters.contrast}%)
              saturate(${element.filters.saturate}%)
              blur(${element.filters.blur}px)
            `,
          }}
        />
      );

    case 'line':
      return (
        <svg
          onClick={handleClick}
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
        </svg>
      );

    default:
      return null;
  }
}
