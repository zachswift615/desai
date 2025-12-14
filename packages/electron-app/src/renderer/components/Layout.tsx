import React from 'react';
import { ZoomControls } from './ZoomControls';

interface LayoutProps {
  toolbar: React.ReactNode;
  canvas: React.ReactNode;
  layers: React.ReactNode;
  properties: React.ReactNode;
}

export function Layout({ toolbar, canvas, layers, properties }: LayoutProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Menu bar with zoom controls */}
      <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 text-sm">
        <span className="font-semibold">Desai</span>
        <ZoomControls />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Toolbar */}
        <div className="w-14 bg-gray-800 border-r border-gray-700 flex flex-col">
          {toolbar}
        </div>

        {/* Center: Canvas + Layers */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Canvas area */}
          <div className="flex-1 overflow-hidden">{canvas}</div>

          {/* Bottom: Layers panel */}
          <div className="h-48 bg-gray-800 border-t border-gray-700 overflow-auto">
            {layers}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-64 min-w-[256px] shrink-0 bg-gray-800 border-l border-gray-700 overflow-auto">
          {properties}
        </div>
      </div>
    </div>
  );
}
