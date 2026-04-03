import type { ImageQualityStatus } from '../../core/enums/ImageQualityStatus';

export const RenderingEvents = {
  IMAGE_RENDERED: 'RENDERING:IMAGE_RENDERED',
  VIEWPORT_ENABLED: 'RENDERING:VIEWPORT_ENABLED',
  VIEWPORT_DISABLED: 'RENDERING:VIEWPORT_DISABLED',
  CAMERA_MODIFIED: 'RENDERING:CAMERA_MODIFIED',
  VOI_MODIFIED: 'RENDERING:VOI_MODIFIED',
  ELEMENT_RESIZE: 'RENDERING:ELEMENT_RESIZE',
  IMAGE_QUALITY_CHANGED: 'RENDERING:IMAGE_QUALITY_CHANGED',
  IMAGE_LOAD_PROGRESS: 'RENDERING:IMAGE_LOAD_PROGRESS',
} as const;

export type RenderingEventType =
  (typeof RenderingEvents)[keyof typeof RenderingEvents];

export interface ImageRenderedEventDetail {
  viewportId: string;
  renderingEngineId: string;
  renderTimeMs: number;
}

export interface ViewportEnabledEventDetail {
  viewportId: string;
  renderingEngineId: string;
  element: HTMLElement;
}

export interface ViewportDisabledEventDetail {
  viewportId: string;
  renderingEngineId: string;
  element: HTMLElement;
}

export interface CameraModifiedEventDetail {
  viewportId: string;
  camera: {
    panX: number;
    panY: number;
    zoom: number;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
  };
}

export interface VOIModifiedEventDetail {
  viewportId: string;
  windowCenter: number;
  windowWidth: number;
}

export interface ElementResizeEventDetail {
  viewportId: string;
  width: number;
  height: number;
}

export interface ImageQualityChangedEventDetail {
  imageId: string;
  viewportId?: string;
  previousStatus: ImageQualityStatus;
  currentStatus: ImageQualityStatus;
  level: number;
  totalLevels: number;
}

export interface ImageLoadProgressEventDetail {
  imageId: string;
  level: number;
  totalLevels: number;
  /** 0-100 percentage */
  percentComplete: number;
}

export type RenderingEventDetailMap = {
  [RenderingEvents.IMAGE_RENDERED]: ImageRenderedEventDetail;
  [RenderingEvents.VIEWPORT_ENABLED]: ViewportEnabledEventDetail;
  [RenderingEvents.VIEWPORT_DISABLED]: ViewportDisabledEventDetail;
  [RenderingEvents.CAMERA_MODIFIED]: CameraModifiedEventDetail;
  [RenderingEvents.VOI_MODIFIED]: VOIModifiedEventDetail;
  [RenderingEvents.ELEMENT_RESIZE]: ElementResizeEventDetail;
  [RenderingEvents.IMAGE_QUALITY_CHANGED]: ImageQualityChangedEventDetail;
  [RenderingEvents.IMAGE_LOAD_PROGRESS]: ImageLoadProgressEventDetail;
};
