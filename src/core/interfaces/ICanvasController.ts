import type { InteractionMode, ViewportState } from '../types';

export interface CameraOrientation {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

/**
 * @deprecated Use `IViewport` from `src/rendering/viewports/types.ts` instead.
 * This interface is kept for backward compatibility during transition.
 */
export interface ICanvasController {
  render: () => void;
  setImageData: (imageData: ImageData) => void;
  setMode: (mode: InteractionMode) => void;
  getMode: () => InteractionMode;
  reset: () => void;
  getViewportState: () => ViewportState;
  flipHorizontal: () => void;
  flipVertical: () => void;
  rotateRight90: () => void;
  getCameraOrientation: () => CameraOrientation;
  dispose: () => void;
}
