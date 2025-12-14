import React, { useCallback, useState } from 'react';
import { useProjectStore } from '../../store';

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function ZoomControls() {
  const viewport = useProjectStore((s) => s.viewport);
  const setViewport = useProjectStore((s) => s.setViewport);
  const project = useProjectStore((s) => s.project);
  const [zoomMode, setZoomMode] = useState<'fit' | 'width' | 'custom'>('custom');

  const zoomPercent = Math.round(viewport.zoom * 100);

  const zoomIn = useCallback(() => {
    const newZoom = Math.min(5, viewport.zoom * 1.25);
    setViewport({ zoom: newZoom });
    setZoomMode('custom');
  }, [viewport.zoom, setViewport]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(0.1, viewport.zoom / 1.25);
    setViewport({ zoom: newZoom });
    setZoomMode('custom');
  }, [viewport.zoom, setViewport]);

  const setZoom100 = useCallback(() => {
    setViewport({ zoom: 1, panX: 0, panY: 0 });
    setZoomMode('custom');
  }, [setViewport]);

  const fitToView = useCallback(() => {
    // Get actual canvas container dimensions from DOM
    const container = document.getElementById('canvas-container');
    if (!container) {
      console.warn('Canvas container not found');
      return;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const canvasWidth = project.canvas.width;
    const canvasHeight = project.canvas.height;

    console.log('fitToView:', { containerWidth, containerHeight, canvasWidth, canvasHeight });

    // Calculate zoom to fit both dimensions with some padding
    const padding = 40; // pixels of padding around canvas
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    const zoomX = availableWidth / canvasWidth;
    const zoomY = availableHeight / canvasHeight;
    const newZoom = Math.min(zoomX, zoomY, 1); // Don't zoom in past 100%

    console.log('fitToView zoom:', { zoomX, zoomY, newZoom });

    // Center the canvas in the container
    const scaledWidth = canvasWidth * newZoom;
    const scaledHeight = canvasHeight * newZoom;
    const panX = (containerWidth - scaledWidth) / 2;
    const panY = (containerHeight - scaledHeight) / 2;

    console.log('fitToView result:', { newZoom, panX, panY });

    setViewport({ zoom: newZoom, panX, panY });
    setZoomMode('fit');
  }, [project.canvas.width, project.canvas.height, setViewport]);

  const fitWidth = useCallback(() => {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const padding = 40;
    const availableWidth = containerWidth - padding * 2;
    const canvasWidth = project.canvas.width;
    const canvasHeight = project.canvas.height;

    const newZoom = Math.min(availableWidth / canvasWidth, 1);
    const scaledWidth = canvasWidth * newZoom;
    const scaledHeight = canvasHeight * newZoom;
    const panX = (containerWidth - scaledWidth) / 2;
    const panY = (containerHeight - scaledHeight) / 2;

    setViewport({ zoom: newZoom, panX, panY });
    setZoomMode('width');
  }, [project.canvas.width, project.canvas.height, setViewport]);

  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'fit') {
      fitToView();
    } else if (value === 'width') {
      fitWidth();
    } else {
      const zoom = parseFloat(value);
      setViewport({ zoom });
      setZoomMode('custom');
    }
  }, [fitToView, fitWidth, setViewport]);

  // Determine dropdown display value
  const getDropdownValue = () => {
    if (zoomMode === 'fit') return 'fit';
    if (zoomMode === 'width') return 'width';
    // Find if current zoom matches a preset
    const matchingPreset = ZOOM_PRESETS.find(z => Math.abs(z - viewport.zoom) < 0.01);
    return matchingPreset?.toString() || 'custom';
  };

  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
      {/* Zoom Out */}
      <button
        onClick={zoomOut}
        className="p-1 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
        title="Zoom Out"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      {/* Zoom Dropdown */}
      <select
        value={getDropdownValue()}
        onChange={handlePresetChange}
        className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 min-w-[80px] cursor-pointer hover:bg-gray-600 transition-colors"
      >
        <option value="fit">Fit to View</option>
        <option value="width">Fit Width</option>
        <option disabled>──────</option>
        {zoomMode === 'custom' && !ZOOM_PRESETS.find(z => Math.abs(z - viewport.zoom) < 0.01) && (
          <option value="custom">{zoomPercent}%</option>
        )}
        {ZOOM_PRESETS.map((z) => (
          <option key={z} value={z}>
            {Math.round(z * 100)}%
          </option>
        ))}
      </select>

      {/* Zoom In */}
      <button
        onClick={zoomIn}
        className="p-1 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
        title="Zoom In"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      {/* 100% button */}
      <button
        onClick={setZoom100}
        className="px-2 py-1 hover:bg-gray-700 rounded text-gray-300 hover:text-white text-xs transition-colors"
        title="Reset to 100%"
      >
        {zoomPercent}%
      </button>

      {/* Fit to View */}
      <button
        onClick={fitToView}
        className="p-1 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
        title="Fit to View"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeOpacity="0.3" />
        </svg>
      </button>
    </div>
  );
}
