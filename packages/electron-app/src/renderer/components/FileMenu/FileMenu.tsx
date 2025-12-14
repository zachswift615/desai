import React, { useCallback } from 'react';
import { useProjectStore } from '../../store';

export function FileMenu() {
  const project = useProjectStore((s) => s.project);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const setViewport = useProjectStore((s) => s.setViewport);

  const handleSave = useCallback(async () => {
    if (!window.electronAPI) return;

    const projectJson = JSON.stringify({ project }, null, 2);
    const savedPath = await window.electronAPI.saveProject(projectJson);

    if (savedPath) {
      console.log('Project saved to:', savedPath);
    }
  }, [project]);

  const handleLoad = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.loadProject();

    if ('error' in result) {
      console.error('Load failed:', result.error);
      return;
    }

    try {
      const parsed = JSON.parse(result.content);
      if (parsed.project) {
        // Restore images from their source paths
        for (const layer of parsed.project.layers || []) {
          for (const element of layer.elements || []) {
            if (element.type === 'image' && element.sourcePath) {
              console.log('Loading image from:', element.sourcePath);
              const imgResult = await window.electronAPI.loadImageFromPath(element.sourcePath);
              if (!('error' in imgResult)) {
                element.src = imgResult.dataUrl;
                console.log('Image loaded successfully, dataUrl length:', imgResult.dataUrl.length);
              } else {
                console.error('Failed to load image:', imgResult.error);
              }
            }
          }
        }
        console.log('Project to restore:', parsed.project);

        restoreProject(parsed.project);

        // Center viewport on loaded canvas - use longer timeout to ensure React has re-rendered
        setTimeout(() => {
          const container = document.getElementById('canvas-container');
          if (!container) {
            console.error('Canvas container not found');
            return;
          }
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;

          const canvasWidth = parsed.project.canvas?.width || 1920;
          const canvasHeight = parsed.project.canvas?.height || 1080;

          const padding = 40;
          const zoomX = (containerWidth - padding * 2) / canvasWidth;
          const zoomY = (containerHeight - padding * 2) / canvasHeight;
          const zoom = Math.min(zoomX, zoomY, 1);

          const scaledWidth = canvasWidth * zoom;
          const scaledHeight = canvasHeight * zoom;
          const panX = (containerWidth - scaledWidth) / 2;
          const panY = (containerHeight - scaledHeight) / 2;

          console.log('FileMenu setViewport:', { zoom, panX, panY, containerWidth, containerHeight });
          setViewport({ zoom, panX, panY });
        }, 100);

        console.log('Project loaded from:', result.filePath);
      }
    } catch (err) {
      console.error('Failed to parse project:', err);
    }
  }, [restoreProject, setViewport]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleLoad}
        className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        title="Load Project (Ctrl+O)"
      >
        Open
      </button>
      <button
        onClick={handleSave}
        className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        title="Save Project (Ctrl+S)"
      >
        Save
      </button>
    </div>
  );
}
