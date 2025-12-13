// Canvas and Project types
export interface DesaiProject {
  id: string;
  name: string;
  canvas: CanvasSettings;
  layers: Layer[];
}

export interface CanvasSettings {
  width: number;
  height: number;
  background: string;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  elements: Element[];
}

// Element types
export type Element =
  | RectElement
  | EllipseElement
  | TextElement
  | ImageElement
  | GroupElement
  | LineElement
  | PathElement;

export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  filters: ImageFilters;
  crop?: CropArea;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupElement extends BaseElement {
  type: 'group';
  children: Element[];
}

export interface PathElement extends BaseElement {
  type: 'path';
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

// State export types (for MCP)
export interface CanvasState {
  project: DesaiProject;
  selection: string[];
  viewport: Viewport;
  history: HistoryState;
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

// IPC message types
export type IpcMessage =
  | { type: 'canvas:create'; payload: { width: number; height: number; background: string } }
  | { type: 'canvas:get-state'; payload: null }
  | { type: 'canvas:screenshot'; payload: null }
  | { type: 'canvas:clear'; payload: null }
  | { type: 'layer:create'; payload: { name: string } }
  | { type: 'layer:delete'; payload: { layerId: string } }
  | { type: 'layer:reorder'; payload: { layerId: string; newIndex: number } }
  | { type: 'layer:set-visibility'; payload: { layerId: string; visible: boolean } }
  | { type: 'layer:set-opacity'; payload: { layerId: string; opacity: number } }
  | { type: 'layer:lock'; payload: { layerId: string; locked: boolean } }
  | { type: 'shape:rectangle'; payload: Partial<RectElement> }
  | { type: 'shape:ellipse'; payload: Partial<EllipseElement> }
  | { type: 'shape:line'; payload: Partial<LineElement> }
  | { type: 'text:create'; payload: Partial<TextElement> }
  | { type: 'text:update'; payload: { elementId: string; updates: Partial<TextElement> } }
  | { type: 'image:import'; payload: { src: string; x: number; y: number; width?: number; height?: number } }
  | { type: 'element:transform'; payload: { elementId: string; transform: Partial<BaseElement> } }
  | { type: 'element:style'; payload: { elementId: string; style: Record<string, unknown> } }
  | { type: 'element:delete'; payload: { elementId: string } }
  | { type: 'element:duplicate'; payload: { elementId: string } }
  | { type: 'export:png'; payload: { scale?: number } }
  | { type: 'export:svg'; payload: null }
  | { type: 'project:save'; payload: { filePath: string } }
  | { type: 'project:load'; payload: { filePath: string } };

export type IpcResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
