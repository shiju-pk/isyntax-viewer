export type InteractionMode = 'pan' | 'zoom' | 'windowLevel';

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
  windowCenter: number;
  windowWidth: number;
}
