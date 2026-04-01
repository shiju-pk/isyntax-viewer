import type { IRendererBackend } from '../backends/IRendererBackend';
import type { Camera2D } from '../camera/Camera2D';
import type { ViewportProperties } from '../viewports/types';

export interface RenderContext {
  viewportId: string;
  camera: Camera2D;
  backend: IRendererBackend;
  canvas: HTMLCanvasElement;
  properties: ViewportProperties;
  imageData: ImageData | null;
  outputImageData: ImageData | null;

  // Raw pixel data for pipeline stages that operate before RGBA conversion
  rawPixelData?: ArrayLike<number>;
  rawFormat?: string;
  rawRows?: number;
  rawCols?: number;
  rawPlanes?: number;
  rawRescaleSlope?: number;
  rawRescaleIntercept?: number;
}

export interface IRenderStage {
  readonly name: string;
  execute(context: RenderContext): void;
}
