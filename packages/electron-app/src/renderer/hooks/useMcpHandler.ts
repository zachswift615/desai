import { useEffect } from 'react';
import { useProjectStore } from '../store';
import { generateId } from '../utils/id';
import type { IpcMessage, IpcResponse, RectElement, TextElement, EllipseElement, ImageElement } from '@desai/shared';

declare global {
  interface Window {
    electronAPI: {
      captureScreenshot: () => Promise<string>;
      selectImage: () => Promise<{ dataUrl: string; fileName: string } | null>;
      loadImageFromPath: (filePath: string) => Promise<{ dataUrl: string; fileName: string } | { error: string }>;
      exportPng: () => Promise<string | null>;
      onMcpCommand: (callback: (data: { requestId: string; message: IpcMessage }) => void) => () => void;
      sendMcpResponse: (requestId: string, response: IpcResponse) => void;
    };
  }
}

export function useMcpHandler() {
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanup = window.electronAPI.onMcpCommand(async ({ requestId, message }) => {
      // Access store directly to avoid stale closures
      const store = useProjectStore.getState();
      const { project, getState, addElement, deleteElement, updateElement, duplicateElement, clearCanvas, createCanvas, addLayer, deleteLayer, setLayerVisibility, setLayerOpacity, setLayerLock } = store;
      let response: IpcResponse;

      try {
        switch (message.type) {
          case 'canvas:get-state': {
            // Get state but strip out base64 image data to save context
            const state = getState();
            const cleanState = {
              ...state,
              project: {
                ...state.project,
                layers: state.project.layers.map((layer) => ({
                  ...layer,
                  elements: layer.elements.map((el) => {
                    if (el.type === 'image') {
                      // Replace base64 src with sourcePath for MCP response
                      const { src, ...rest } = el as any;
                      return { ...rest, src: rest.sourcePath || '[embedded image]' };
                    }
                    return el;
                  }),
                })),
              },
            };
            response = { success: true, data: cleanState };
            break;
          }

          case 'canvas:screenshot':
            const screenshotPath = await window.electronAPI.captureScreenshot();
            response = { success: true, data: { path: screenshotPath } };
            break;

          case 'canvas:clear':
            clearCanvas();
            response = { success: true, data: null };
            break;

          case 'canvas:create':
            createCanvas(
              message.payload.width,
              message.payload.height,
              message.payload.background
            );
            response = { success: true, data: null };
            break;

          case 'shape:rectangle': {
            const activeLayer = project.layers.find((l) => !l.locked);
            if (!activeLayer) {
              response = { success: false, error: 'No unlocked layer available' };
              break;
            }
            const rect: RectElement = {
              id: generateId(),
              type: 'rect',
              x: message.payload.x ?? 0,
              y: message.payload.y ?? 0,
              width: message.payload.width ?? 100,
              height: message.payload.height ?? 100,
              rotation: 0,
              opacity: 100,
              fill: message.payload.fill ?? '#3b82f6',
              stroke: message.payload.stroke ?? '#1e40af',
              strokeWidth: message.payload.strokeWidth ?? 0,
              cornerRadius: message.payload.cornerRadius ?? 0,
            };
            addElement(activeLayer.id, rect);
            response = { success: true, data: { elementId: rect.id } };
            break;
          }

          case 'shape:ellipse': {
            const activeLayer = project.layers.find((l) => !l.locked);
            if (!activeLayer) {
              response = { success: false, error: 'No unlocked layer available' };
              break;
            }
            const ellipse: EllipseElement = {
              id: generateId(),
              type: 'ellipse',
              x: message.payload.x ?? 0,
              y: message.payload.y ?? 0,
              width: message.payload.width ?? 100,
              height: message.payload.height ?? 100,
              rotation: 0,
              opacity: 100,
              fill: message.payload.fill ?? '#10b981',
              stroke: message.payload.stroke ?? '#047857',
              strokeWidth: message.payload.strokeWidth ?? 0,
            };
            addElement(activeLayer.id, ellipse);
            response = { success: true, data: { elementId: ellipse.id } };
            break;
          }

          case 'text:create': {
            const activeLayer = project.layers.find((l) => !l.locked);
            if (!activeLayer) {
              response = { success: false, error: 'No unlocked layer available' };
              break;
            }
            const text: TextElement = {
              id: generateId(),
              type: 'text',
              x: message.payload.x ?? 0,
              y: message.payload.y ?? 0,
              width: message.payload.width ?? 400,
              height: message.payload.height ?? 100,
              rotation: 0,
              opacity: 100,
              content: message.payload.content ?? 'Text',
              fontSize: message.payload.fontSize ?? 24,
              fontFamily: message.payload.fontFamily ?? 'system-ui',
              fontWeight: message.payload.fontWeight ?? 'normal',
              fill: message.payload.fill ?? '#000000',
              align: message.payload.align ?? 'left',
              lineHeight: 1.2,
              shadow: message.payload.shadow,
            };
            addElement(activeLayer.id, text);
            response = { success: true, data: { elementId: text.id } };
            break;
          }

          case 'image:import': {
            const activeLayer = project.layers.find((l) => !l.locked);
            if (!activeLayer) {
              response = { success: false, error: 'No unlocked layer available' };
              break;
            }

            // Load image via IPC (main process reads file)
            const filePath = message.payload.src;
            const loadResult = await window.electronAPI.loadImageFromPath(filePath);

            if ('error' in loadResult) {
              response = { success: false, error: loadResult.error };
              break;
            }

            const { dataUrl } = loadResult;

            // Get natural dimensions using Image
            const img = new window.Image();
            const dimensionsPromise = new Promise<{ width: number; height: number }>((resolve) => {
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = () => resolve({ width: 200, height: 200 }); // fallback
            });
            img.src = dataUrl;
            const { width: naturalWidth, height: naturalHeight } = await dimensionsPromise;

            const imageElement: ImageElement = {
              id: generateId(),
              type: 'image',
              x: message.payload.x ?? 100,
              y: message.payload.y ?? 100,
              width: message.payload.width ?? naturalWidth,
              height: message.payload.height ?? naturalHeight,
              rotation: 0,
              opacity: 100,
              src: dataUrl,
              sourcePath: filePath, // Store original path for MCP state reporting
              naturalWidth,
              naturalHeight,
              filters: {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                blur: 0,
              },
            };
            addElement(activeLayer.id, imageElement);
            response = { success: true, data: { elementId: imageElement.id, naturalWidth, naturalHeight } };
            break;
          }

          case 'element:delete':
            deleteElement(message.payload.elementId);
            response = { success: true, data: null };
            break;

          case 'element:transform':
            updateElement(message.payload.elementId, message.payload.transform);
            response = { success: true, data: null };
            break;

          case 'element:style':
            updateElement(message.payload.elementId, message.payload.style);
            response = { success: true, data: null };
            break;

          case 'element:duplicate':
            const newId = duplicateElement(message.payload.elementId);
            response = { success: true, data: { elementId: newId } };
            break;

          case 'layer:create':
            const layerId = addLayer(message.payload.name);
            response = { success: true, data: { layerId } };
            break;

          case 'layer:delete':
            deleteLayer(message.payload.layerId);
            response = { success: true, data: null };
            break;

          case 'layer:set-visibility':
            setLayerVisibility(message.payload.layerId, message.payload.visible);
            response = { success: true, data: null };
            break;

          case 'layer:set-opacity':
            setLayerOpacity(message.payload.layerId, message.payload.opacity);
            response = { success: true, data: null };
            break;

          case 'layer:lock':
            setLayerLock(message.payload.layerId, message.payload.locked);
            response = { success: true, data: null };
            break;

          case 'export:png': {
            const exportPath = await window.electronAPI.exportPng();
            response = exportPath
              ? { success: true, data: { path: exportPath } }
              : { success: false, error: 'Export cancelled or failed' };
            break;
          }

          default:
            response = { success: false, error: `Unknown command: ${(message as any).type}` };
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
