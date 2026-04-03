export type InteractionMode =
  | 'pan'
  | 'zoom'
  | 'windowLevel'
  | 'rotate'
  | 'length'
  | 'angle'
  | 'ellipticalROI'
  | 'rectangleROI'
  | 'arrowAnnotate'
  | 'probe'
  | 'brush'
  | 'eraser'
  | 'thresholdBrush'
  | 'scissors'
  | 'floodFill';

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
  windowCenter: number;
  windowWidth: number;
}
