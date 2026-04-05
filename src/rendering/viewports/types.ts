export enum ViewportType {
  STACK = 'stack',
  WSI = 'wsi',
  VOLUME = 'volume',
}

export enum ViewportStatus {
  NO_DATA = 'noData',
  LOADING = 'loading',
  PRE_RENDER = 'preRender',
  RENDERED = 'rendered',
}

export interface ViewportInput {
  viewportId: string;
  renderingEngineId: string;
  type: ViewportType;
  element: HTMLDivElement;
  canvas: HTMLCanvasElement;
  defaultOptions?: ViewportInputOptions;
}

export interface PublicViewportInput {
  viewportId: string;
  type: ViewportType;
  element: HTMLDivElement;
  defaultOptions?: ViewportInputOptions;
}

export interface ViewportInputOptions {
  background?: [number, number, number];
  preferredBackend?: 'canvas2d' | 'webgl';
}

export interface ViewportProperties {
  windowCenter?: number;
  windowWidth?: number;
  invert?: boolean;
  interpolationType?: InterpolationType;
  colormap?: string;
}

export enum InterpolationType {
  NEAREST = 0,
  LINEAR = 1,
}

export interface IViewport {
  readonly id: string;
  readonly element: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly renderingEngineId: string;
  readonly type: ViewportType;
  viewportStatus: ViewportStatus;

  render(): void;
  resize(): void;
  resetCamera(): void;
  setImageData(data: ImageData): void;
  getImageData(): ImageData | null;
  getCamera(): import('../camera/Camera2D').Camera2D;
  setProperties(props: ViewportProperties): void;
  getProperties(): ViewportProperties;
  addPipelineStage(stage: import('../pipeline/IRenderStage').IRenderStage, index?: number): void;
  dispose(): void;
}
