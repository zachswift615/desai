import { create } from 'zustand';
import type {
  DesaiProject,
  Layer,
  Element,
  CanvasState,
  Viewport,
} from '@desai/shared';
import { generateId } from '../utils/id';

interface ProjectStore {
  // State
  project: DesaiProject;
  selection: string[];
  viewport: Viewport;
  history: { past: DesaiProject[]; future: DesaiProject[] };
  activeTool: string;

  // Canvas actions
  createCanvas: (width: number, height: number, background: string) => void;
  clearCanvas: () => void;
  getState: () => CanvasState;

  // Layer actions
  addLayer: (name: string) => string;
  deleteLayer: (layerId: string) => void;
  reorderLayer: (layerId: string, newIndex: number) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setLayerLock: (layerId: string, locked: boolean) => void;

  // Element actions
  addElement: (layerId: string, element: Element) => void;
  updateElement: (elementId: string, updates: Partial<Element>) => void;
  deleteElement: (elementId: string) => void;
  duplicateElement: (elementId: string) => string | null;

  // Selection
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;

  // Viewport
  setViewport: (viewport: Partial<Viewport>) => void;

  // Tool
  setActiveTool: (tool: string) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const defaultProject: DesaiProject = {
  id: generateId(),
  name: 'Untitled',
  canvas: {
    width: 1920,
    height: 1080,
    background: '#ffffff',
  },
  layers: [
    {
      id: generateId(),
      name: 'Layer 1',
      visible: true,
      locked: false,
      opacity: 100,
      elements: [],
    },
  ],
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: { ...defaultProject },
  selection: [],
  viewport: { zoom: 1, panX: 0, panY: 0 },
  history: { past: [], future: [] },
  activeTool: 'select',

  createCanvas: (width, height, background) => {
    set({
      project: {
        id: generateId(),
        name: 'Untitled',
        canvas: { width, height, background },
        layers: [
          {
            id: generateId(),
            name: 'Layer 1',
            visible: true,
            locked: false,
            opacity: 100,
            elements: [],
          },
        ],
      },
      selection: [],
      history: { past: [], future: [] },
    });
  },

  clearCanvas: () => {
    const { project, pushHistory } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((layer) => ({ ...layer, elements: [] })),
      },
      selection: [],
    });
  },

  getState: () => {
    const { project, selection, viewport, history } = get();
    return {
      project,
      selection,
      viewport,
      history: {
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
      },
    };
  },

  addLayer: (name) => {
    const { project, pushHistory } = get();
    pushHistory();
    const newLayer: Layer = {
      id: generateId(),
      name,
      visible: true,
      locked: false,
      opacity: 100,
      elements: [],
    };
    set({
      project: {
        ...project,
        layers: [newLayer, ...project.layers],
      },
    });
    return newLayer.id;
  },

  deleteLayer: (layerId) => {
    const { project, pushHistory } = get();
    if (project.layers.length <= 1) return;
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.filter((l) => l.id !== layerId),
      },
    });
  },

  reorderLayer: (layerId, newIndex) => {
    const { project, pushHistory } = get();
    const layers = [...project.layers];
    const currentIndex = layers.findIndex((l) => l.id === layerId);
    if (currentIndex === -1) return;
    pushHistory();
    const [layer] = layers.splice(currentIndex, 1);
    layers.splice(newIndex, 0, layer);
    set({ project: { ...project, layers } });
  },

  setLayerVisibility: (layerId, visible) => {
    const { project } = get();
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === layerId ? { ...l, visible } : l
        ),
      },
    });
  },

  setLayerOpacity: (layerId, opacity) => {
    const { project, pushHistory } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === layerId ? { ...l, opacity } : l
        ),
      },
    });
  },

  setLayerLock: (layerId, locked) => {
    const { project } = get();
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === layerId ? { ...l, locked } : l
        ),
      },
    });
  },

  addElement: (layerId, element) => {
    const { project, pushHistory } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((l) =>
          l.id === layerId ? { ...l, elements: [...l.elements, element] } : l
        ),
      },
    });
  },

  updateElement: (elementId, updates) => {
    const { project, pushHistory } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((layer) => ({
          ...layer,
          elements: layer.elements.map((el) =>
            el.id === elementId ? { ...el, ...updates } : el
          ),
        })),
      },
    });
  },

  deleteElement: (elementId) => {
    const { project, pushHistory, selection } = get();
    pushHistory();
    set({
      project: {
        ...project,
        layers: project.layers.map((layer) => ({
          ...layer,
          elements: layer.elements.filter((el) => el.id !== elementId),
        })),
      },
      selection: selection.filter((id) => id !== elementId),
    });
  },

  duplicateElement: (elementId) => {
    const { project, pushHistory } = get();
    for (const layer of project.layers) {
      const element = layer.elements.find((el) => el.id === elementId);
      if (element) {
        pushHistory();
        const newElement = {
          ...element,
          id: generateId(),
          x: element.x + 20,
          y: element.y + 20,
        };
        set({
          project: {
            ...project,
            layers: project.layers.map((l) =>
              l.id === layer.id
                ? { ...l, elements: [...l.elements, newElement] }
                : l
            ),
          },
          selection: [newElement.id],
        });
        return newElement.id;
      }
    }
    return null;
  },

  setSelection: (ids) => set({ selection: ids }),
  clearSelection: () => set({ selection: [] }),

  setViewport: (viewport) =>
    set((state) => ({ viewport: { ...state.viewport, ...viewport } })),

  setActiveTool: (tool) => set({ activeTool: tool }),

  pushHistory: () => {
    const { project, history } = get();
    set({
      history: {
        past: [...history.past.slice(-49), project],
        future: [],
      },
    });
  },

  undo: () => {
    const { history, project } = get();
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    set({
      project: previous,
      history: {
        past: history.past.slice(0, -1),
        future: [project, ...history.future],
      },
    });
  },

  redo: () => {
    const { history, project } = get();
    if (history.future.length === 0) return;
    const next = history.future[0];
    set({
      project: next,
      history: {
        past: [...history.past, project],
        future: history.future.slice(1),
      },
    });
  },
}));
