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
  const { project, addElement, deleteElement, updateElement, duplicateElement, clearCanvas, createCanvas, addLayer, deleteLayer, setLayerVisibility, setLayerOpacity, setLayerLock, getState } = store;

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
        lineHeight: 1.2,
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

      const imageElement: ImageElement = {
        id: generateId(),
        type: 'image',
        x: (message.payload as any).x ?? 100,
        y: (message.payload as any).y ?? 100,
        width: (message.payload as any).width ?? naturalWidth,
        height: (message.payload as any).height ?? naturalHeight,
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

    case 'element:delete':
      deleteElement((message.payload as any).elementId);
      return { success: true, data: null };

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
