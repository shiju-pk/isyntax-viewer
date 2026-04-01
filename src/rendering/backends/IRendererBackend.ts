import type { CanvasTransform } from '../camera/types';

export interface IRendererBackend {
  init(canvas: HTMLCanvasElement): void;
  clear(color?: [number, number, number]): void;
  drawImage(
    source: ImageBitmap | ImageData | OffscreenCanvas,
    transform: CanvasTransform,
    imageWidth: number,
    imageHeight: number
  ): void;
  resize(width: number, height: number): void;
  getCanvas(): HTMLCanvasElement;
  dispose(): void;
}
