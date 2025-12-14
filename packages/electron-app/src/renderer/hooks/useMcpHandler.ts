import { useEffect } from 'react';
import { useProjectStore } from '../store';
import { generateId } from '../utils/id';
import type { IpcMessage, IpcResponse, RectElement, TextElement, EllipseElement, ImageElement, DesaiOp } from '@desai/shared';
import { normalizeParams, opToIpcType } from '../utils/normalizeParams';
import { validateOps } from '../utils/validateOp';

declare global {
  interface Window {
    electronAPI: {
      captureScreenshot: () => Promise<string>;
      selectImage: () => Promise<{ dataUrl: string; fileName: string } | null>;
      loadImageFromPath: (filePath: string) => Promise<{ dataUrl: string; fileName: string } | { error: string }>;
      exportPng: () => Promise<string | null>;
      exportCanvasPng: (data: { dataUrl: string; width: number; height: number }) => Promise<string | null>;
      exportCanvasPngDirect: (data: { dataUrl: string }) => Promise<string | null>;
      saveProject: (projectJson: string) => Promise<string | null>;
      loadProject: (filePath?: string) => Promise<{ content: string; filePath: string } | { error: string }>;
      onMcpCommand: (callback: (data: { requestId: string; message: IpcMessage }) => void) => () => void;
      sendMcpResponse: (requestId: string, response: IpcResponse) => void;
    };
  }
}

/**
 * Execute a single IPC operation
 * Extracted helper function for batch executor and backwards compatibility
 */
async function executeOp(
  message: IpcMessage,
  store: ReturnType<typeof useProjectStore.getState>
): Promise<IpcResponse> {
  const { project, addElement, deleteElement, updateElement, duplicateElement, reorderElement, clearCanvas, createCanvas, addLayer, deleteLayer, setLayerVisibility, setLayerOpacity, setLayerLock, getState, setViewport } = store;

  switch (message.type) {
    case 'canvas:get-state': {
      const state = getState();
      const cleanState = {
        ...state,
        project: {
          ...state.project,
          layers: state.project.layers.map((layer) => ({
            ...layer,
            elements: layer.elements.map((el) => {
              if (el.type === 'image') {
                const { src, ...rest } = el as any;
                return { ...rest, src: rest.sourcePath || '[embedded image]' };
              }
              return el;
            }),
          })),
        },
      };
      return { success: true, data: cleanState };
    }

    case 'canvas:screenshot': {
      const screenshotPath = await window.electronAPI.captureScreenshot();
      return { success: true, data: { path: screenshotPath } };
    }

    case 'canvas:clear':
      clearCanvas();
      return { success: true, data: null };

    case 'canvas:fit': {
      // Calculate zoom to fit canvas in a reasonable viewport (assuming ~1200x800 viewport)
      const viewportWidth = 1200;
      const viewportHeight = 800;
      const padding = 100; // padding around canvas
      const { canvas } = project;
      const zoomX = (viewportWidth - padding * 2) / canvas.width;
      const zoomY = (viewportHeight - padding * 2) / canvas.height;
      const zoom = Math.min(zoomX, zoomY, 1); // don't zoom in past 100%
      // Center the canvas
      const panX = (viewportWidth - canvas.width * zoom) / 2;
      const panY = padding;
      setViewport({ zoom, panX, panY });
      return { success: true, data: { zoom, panX, panY } };
    }

    case 'canvas:zoom': {
      const { zoom } = message.payload as { zoom: number };
      setViewport({ zoom });
      return { success: true, data: null };
    }

    case 'canvas:create':
      createCanvas(
        (message.payload as any).width ?? 1920,
        (message.payload as any).height ?? 1080,
        (message.payload as any).background ?? '#ffffff'
      );
      return { success: true, data: null };

    case 'shape:rectangle': {
      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'No unlocked layer available' };
      }
      const rect: RectElement = {
        id: generateId(),
        type: 'rect',
        x: (message.payload as any).x ?? 0,
        y: (message.payload as any).y ?? 0,
        width: (message.payload as any).width ?? 100,
        height: (message.payload as any).height ?? 100,
        rotation: 0,
        opacity: 100,
        fill: (message.payload as any).fill ?? '#3b82f6',
        stroke: (message.payload as any).stroke ?? '#1e40af',
        strokeWidth: (message.payload as any).strokeWidth ?? 0,
        cornerRadius: (message.payload as any).cornerRadius ?? 0,
        boxShadow: (message.payload as any).boxShadow,
      };
      addElement(activeLayer.id, rect);
      return { success: true, data: { elementId: rect.id } };
    }

    case 'shape:ellipse': {
      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'No unlocked layer available' };
      }
      const ellipse: EllipseElement = {
        id: generateId(),
        type: 'ellipse',
        x: (message.payload as any).x ?? 0,
        y: (message.payload as any).y ?? 0,
        width: (message.payload as any).width ?? 100,
        height: (message.payload as any).height ?? 100,
        rotation: 0,
        opacity: 100,
        fill: (message.payload as any).fill ?? '#10b981',
        stroke: (message.payload as any).stroke ?? '#047857',
        strokeWidth: (message.payload as any).strokeWidth ?? 0,
        boxShadow: (message.payload as any).boxShadow,
      };
      addElement(activeLayer.id, ellipse);
      return { success: true, data: { elementId: ellipse.id } };
    }

    case 'text:create': {
      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'No unlocked layer available' };
      }
      const text: TextElement = {
        id: generateId(),
        type: 'text',
        x: (message.payload as any).x ?? 0,
        y: (message.payload as any).y ?? 0,
        width: (message.payload as any).width ?? 400,
        height: (message.payload as any).height ?? 100,
        rotation: 0,
        opacity: 100,
        content: (message.payload as any).content ?? 'Text',
        fontSize: (message.payload as any).fontSize ?? 24,
        fontFamily: (message.payload as any).fontFamily ?? 'system-ui',
        fontWeight: (message.payload as any).fontWeight ?? 'normal',
        fill: (message.payload as any).fill ?? '#000000',
        align: (message.payload as any).align ?? 'left',
        lineHeight: (message.payload as any).lineHeight ?? 1.2,
        shadow: (message.payload as any).shadow,
      };
      addElement(activeLayer.id, text);
      return { success: true, data: { elementId: text.id } };
    }

    case 'text:update': {
      const { elementId, ...updates } = message.payload as any;
      updateElement(elementId, updates);
      return { success: true, data: null };
    }

    case 'image:import': {
      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'No unlocked layer available' };
      }

      const filePath = (message.payload as any).path || (message.payload as any).src;
      const loadResult = await window.electronAPI.loadImageFromPath(filePath);

      if ('error' in loadResult) {
        return { success: false, error: loadResult.error };
      }

      const { dataUrl } = loadResult;
      const img = new window.Image();
      const dimensionsPromise = new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 200, height: 200 });
      });
      img.src = dataUrl;
      const { width: naturalWidth, height: naturalHeight } = await dimensionsPromise;

      // Calculate dimensions preserving aspect ratio if only one is provided
      const requestedWidth = (message.payload as any).width;
      const requestedHeight = (message.payload as any).height;
      let finalWidth: number;
      let finalHeight: number;

      if (requestedWidth !== undefined && requestedHeight !== undefined) {
        // Both provided - use as-is
        finalWidth = requestedWidth;
        finalHeight = requestedHeight;
      } else if (requestedWidth !== undefined) {
        // Only width provided - calculate height to preserve aspect ratio
        finalWidth = requestedWidth;
        finalHeight = (requestedWidth / naturalWidth) * naturalHeight;
      } else if (requestedHeight !== undefined) {
        // Only height provided - calculate width to preserve aspect ratio
        finalHeight = requestedHeight;
        finalWidth = (requestedHeight / naturalHeight) * naturalWidth;
      } else {
        // Neither provided - use natural dimensions
        finalWidth = naturalWidth;
        finalHeight = naturalHeight;
      }

      const imageElement: ImageElement = {
        id: generateId(),
        type: 'image',
        x: (message.payload as any).x ?? 100,
        y: (message.payload as any).y ?? 100,
        width: finalWidth,
        height: finalHeight,
        rotation: 0,
        opacity: 100,
        src: dataUrl,
        sourcePath: filePath,
        naturalWidth,
        naturalHeight,
        filters: {
          brightness: 100,
          contrast: 100,
          saturate: 100,
          blur: 0,
        },
      };
      addElement(activeLayer.id, imageElement);
      return { success: true, data: { elementId: imageElement.id, naturalWidth, naturalHeight } };
    }

    case 'device:frame': {
      // Create a device-framed screenshot composite
      const { screenshot, bezel, x, y, width: targetWidth, screenInset } = message.payload as {
        screenshot: string;
        bezel: string;
        x?: number;
        y?: number;
        width?: number;
        screenInset?: { top: number; right: number; bottom: number; left: number };
      };

      const activeLayer = project.layers.find((l) => !l.locked);
      if (!activeLayer) {
        return { success: false, error: 'No unlocked layer available' };
      }

      // Load screenshot image
      const screenshotResult = await window.electronAPI.loadImageFromPath(screenshot);
      if ('error' in screenshotResult) {
        return { success: false, error: `Failed to load screenshot: ${screenshotResult.error}` };
      }

      // Load bezel image
      const bezelResult = await window.electronAPI.loadImageFromPath(bezel);
      if ('error' in bezelResult) {
        return { success: false, error: `Failed to load bezel: ${bezelResult.error}` };
      }

      // Get bezel dimensions
      const bezelImg = new Image();
      const bezelDimensions = new Promise<{ width: number; height: number }>((resolve) => {
        bezelImg.onload = () => resolve({ width: bezelImg.naturalWidth, height: bezelImg.naturalHeight });
      });
      bezelImg.src = bezelResult.dataUrl;
      const { width: bezelNaturalWidth, height: bezelNaturalHeight } = await bezelDimensions;

      // Calculate final dimensions
      const scale = targetWidth ? targetWidth / bezelNaturalWidth : 1;
      const finalWidth = bezelNaturalWidth * scale;
      const finalHeight = bezelNaturalHeight * scale;

      // Default screen inset (percentage-based for iPhone 16 Pro Max style bezels)
      // These can be overridden via the screenInset parameter
      const inset = screenInset || {
        top: Math.round(finalHeight * 0.018),    // ~1.8% from top
        right: Math.round(finalWidth * 0.032),   // ~3.2% from right
        bottom: Math.round(finalHeight * 0.018), // ~1.8% from bottom
        left: Math.round(finalWidth * 0.032),    // ~3.2% from left
      };

      // Calculate screen area within the bezel
      const screenWidth = finalWidth - inset.left - inset.right;
      const screenHeight = finalHeight - inset.top - inset.bottom;

      const posX = x ?? 100;
      const posY = y ?? 100;

      // Create screenshot element (behind bezel)
      const screenshotElement: ImageElement = {
        id: generateId(),
        type: 'image',
        x: posX + inset.left + screenWidth / 2,
        y: posY + inset.top + screenHeight / 2,
        width: screenWidth,
        height: screenHeight,
        rotation: 0,
        opacity: 100,
        src: screenshotResult.dataUrl,
        sourcePath: screenshot,
        naturalWidth: 0, // Will be set by renderer
        naturalHeight: 0,
        cornerRadius: Math.round(finalWidth * 0.085), // ~8.5% corner radius for modern iPhones
      };

      // Create bezel element (on top)
      const bezelElement: ImageElement = {
        id: generateId(),
        type: 'image',
        x: posX + finalWidth / 2,
        y: posY + finalHeight / 2,
        width: finalWidth,
        height: finalHeight,
        rotation: 0,
        opacity: 100,
        src: bezelResult.dataUrl,
        sourcePath: bezel,
        naturalWidth: bezelNaturalWidth,
        naturalHeight: bezelNaturalHeight,
      };

      // Add screenshot first (bottom), then bezel (top)
      addElement(activeLayer.id, screenshotElement);
      addElement(activeLayer.id, bezelElement);

      return {
        success: true,
        data: {
          screenshotId: screenshotElement.id,
          bezelId: bezelElement.id,
          dimensions: { width: finalWidth, height: finalHeight },
        },
      };
    }

    case 'element:delete':
      deleteElement((message.payload as any).elementId);
      return { success: true, data: null };

    case 'element:align': {
      const { elementId, align } = message.payload as { elementId: string; align: string };
      const { canvas } = project;

      // Find the element
      let element: any = null;
      for (const layer of project.layers) {
        element = layer.elements.find((e) => e.id === elementId);
        if (element) break;
      }

      if (!element) {
        return { success: false, error: `Element ${elementId} not found` };
      }

      const updates: Record<string, number> = {};

      switch (align) {
        case 'center':
        case 'center-h':
          // Center horizontally
          updates.x = (canvas.width - element.width) / 2;
          break;
        case 'center-v':
          // Center vertically
          updates.y = (canvas.height - element.height) / 2;
          break;
        case 'center-both':
          // Center both
          updates.x = (canvas.width - element.width) / 2;
          updates.y = (canvas.height - element.height) / 2;
          break;
        case 'left':
          updates.x = 0;
          break;
        case 'right':
          updates.x = canvas.width - element.width;
          break;
        case 'top':
          updates.y = 0;
          break;
        case 'bottom':
          updates.y = canvas.height - element.height;
          break;
        default:
          return { success: false, error: `Unknown align value: ${align}` };
      }

      updateElement(elementId, updates);
      return { success: true, data: null };
    }

    case 'element:transform':
      updateElement((message.payload as any).elementId, (message.payload as any).transform);
      return { success: true, data: null };

    case 'element:style':
      updateElement((message.payload as any).elementId, (message.payload as any).style);
      return { success: true, data: null };

    case 'element:duplicate': {
      const newId = duplicateElement((message.payload as any).elementId);
      return { success: true, data: { elementId: newId } };
    }

    case 'element:order': {
      const { elementId, direction } = message.payload as { elementId: string; direction: 'front' | 'back' | 'forward' | 'backward' };
      reorderElement(elementId, direction);
      return { success: true, data: null };
    }

    case 'layer:create': {
      const layerId = addLayer((message.payload as any).name);
      return { success: true, data: { layerId } };
    }

    case 'layer:delete':
      deleteLayer((message.payload as any).layerId);
      return { success: true, data: null };

    case 'layer:set-visibility':
      setLayerVisibility((message.payload as any).layerId, (message.payload as any).visible);
      return { success: true, data: null };

    case 'layer:set-opacity':
      setLayerOpacity((message.payload as any).layerId, (message.payload as any).opacity);
      return { success: true, data: null };

    case 'layer:lock':
      setLayerLock((message.payload as any).layerId, (message.payload as any).locked);
      return { success: true, data: null };

    case 'export:png': {
      const exportPath = await window.electronAPI.exportPng();
      return exportPath
        ? { success: true, data: { path: exportPath } }
        : { success: false, error: 'Export cancelled or failed' };
    }

    case 'export:canvas': {
      // Render canvas to PNG at full resolution
      const { canvas, viewport } = project;
      const canvasEl = document.getElementById('design-canvas');
      if (!canvasEl) {
        return { success: false, error: 'Canvas element not found' };
      }

      const html2canvas = await import('html2canvas').then(m => m.default).catch(() => null);
      if (!html2canvas) {
        return { success: false, error: 'html2canvas not available - install with: pnpm add html2canvas' };
      }

      // Save current viewport and temporarily reset to 1:1 scale for accurate capture
      const originalViewport = { ...viewport };
      setViewport({ zoom: 1, panX: 0, panY: 0 });

      // Wait for DOM to update with new viewport
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      try {
        const renderedCanvas = await html2canvas(canvasEl, {
          width: canvas.width,
          height: canvas.height,
          scale: 1,
          backgroundColor: canvas.background,
          logging: false,
          useCORS: true,
        });

        // Restore original viewport immediately after capture
        setViewport(originalViewport);

        const dataUrl = renderedCanvas.toDataURL('image/png');
        // Use direct export (no dialog) for MCP automation
        const exportPath = await window.electronAPI.exportCanvasPngDirect({ dataUrl });

        return exportPath
          ? { success: true, data: { path: exportPath, width: canvas.width, height: canvas.height } }
          : { success: false, error: 'Export failed' };
      } catch (err) {
        // Restore viewport even on error
        setViewport(originalViewport);
        return { success: false, error: `Canvas export failed: ${err}` };
      }
    }

    case 'project:save': {
      const projectJson = JSON.stringify({ project }, null, 2);
      const filePath = (message.payload as any)?.filePath;

      if (filePath) {
        // Direct save to specified path (for MCP use)
        // Note: This would need a direct file write IPC handler
        // For now, use the save dialog version
      }

      const savedPath = await window.electronAPI.saveProject(projectJson);
      return savedPath
        ? { success: true, data: { path: savedPath } }
        : { success: false, error: 'Save cancelled or failed' };
    }

    case 'project:load': {
      const filePath = (message.payload as any)?.filePath;
      const result = await window.electronAPI.loadProject(filePath);

      if ('error' in result) {
        return { success: false, error: result.error };
      }

      try {
        const parsed = JSON.parse(result.content);
        if (parsed.project) {
          // Restore images from their source paths
          for (const layer of parsed.project.layers || []) {
            for (const element of layer.elements || []) {
              if (element.type === 'image' && element.sourcePath) {
                // Reload image data from source path
                const imgResult = await window.electronAPI.loadImageFromPath(element.sourcePath);
                if (!('error' in imgResult)) {
                  element.src = imgResult.dataUrl;
                }
              }
            }
          }
          store.restoreProject(parsed.project);

          // Center viewport on loaded canvas
          // Calculate zoom to fit canvas in typical viewport (assume ~1200x800 visible area)
          const canvasWidth = parsed.project.canvas?.width || 1920;
          const canvasHeight = parsed.project.canvas?.height || 1080;
          const viewportWidth = 1200;
          const viewportHeight = 800;
          const zoomX = viewportWidth / canvasWidth;
          const zoomY = viewportHeight / canvasHeight;
          const zoom = Math.min(zoomX, zoomY, 1) * 0.9; // 90% to leave margin

          // Center the canvas
          const scaledWidth = canvasWidth * zoom;
          const scaledHeight = canvasHeight * zoom;
          const panX = (viewportWidth - scaledWidth) / 2;
          const panY = (viewportHeight - scaledHeight) / 2;

          setViewport({ zoom, panX, panY });

          return { success: true, data: { path: result.filePath } };
        }
        return { success: false, error: 'Invalid project file format' };
      } catch (err) {
        return { success: false, error: `Failed to parse project file: ${err}` };
      }
    }

    default:
      return { success: false, error: `Unknown command: ${(message as any).type}` };
  }
}

export function useMcpHandler() {
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanup = window.electronAPI.onMcpCommand(async ({ requestId, message }) => {
      // Access store directly to avoid stale closures
      const store = useProjectStore.getState();
      let response: IpcResponse;

      try {
        switch (message.type) {
          case 'batch:execute': {
            const ops = (message.payload as any).ops as DesaiOp[];

            // Validate all ops first
            const validation = validateOps(ops);
            if (!validation.valid) {
              response = { success: false, error: validation.error };
              break;
            }

            // Snapshot state for rollback
            const snapshot = JSON.parse(JSON.stringify(store.project));

            const results: IpcResponse[] = [];
            let batchResponse: IpcResponse | null = null;

            for (let i = 0; i < ops.length; i++) {
              const op = ops[i];
              const ipcType = opToIpcType(op);
              const payload = normalizeParams(op);

              // Build IPC message for this op
              const opMessage = { type: ipcType, payload } as IpcMessage;

              // Execute using existing handler logic
              let opResult: IpcResponse;
              try {
                opResult = await executeOp(opMessage, store);
              } catch (err) {
                opResult = { success: false, error: String(err) };
              }

              if (!opResult.success) {
                // Rollback and return failure
                store.restoreProject(snapshot);
                batchResponse = {
                  success: false,
                  error: `op ${i + 1} failed: ${opResult.error}`,
                };
                break;
              }

              results.push(opResult);
            }

            // If we didn't break early, all ops succeeded
            response = batchResponse ?? { success: true, data: results };
            break;
          }

          default:
            // Delegate all non-batch operations to executeOp
            response = await executeOp(message, store);
        }
      } catch (error) {
        response = { success: false, error: String(error) };
      }

      window.electronAPI.sendMcpResponse(requestId, response);
    });

    // Cleanup listener on unmount
    return cleanup;
  }, []); // Empty deps - we access store directly inside the callback
}
