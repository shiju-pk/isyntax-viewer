export interface CameraState {
  panX: number;
  panY: number;
  zoom: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

export interface FitToCanvasParams {
  canvasWidth: number;
  canvasHeight: number;
  imageWidth: number;
  imageHeight: number;
}

export interface CanvasTransform {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}
