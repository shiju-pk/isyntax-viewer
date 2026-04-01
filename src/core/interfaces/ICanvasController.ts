import type { InteractionMode, ViewportState } from '../types';

export interface ICanvasController {
  render: () => void;
  setImageData: (imageData: ImageData) => void;
  setMode: (mode: InteractionMode) => void;
  getMode: () => InteractionMode;
  reset: () => void;
  getViewportState: () => ViewportState;
  dispose: () => void;
}
