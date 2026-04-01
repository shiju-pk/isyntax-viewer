import type { InteractionMode, ViewportState } from '../types';

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
  dispose: () => void;
}
