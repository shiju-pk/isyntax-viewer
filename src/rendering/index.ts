// Rendering layer — display pipeline & viewport

/**
 * @deprecated Use RenderingEngine + Viewport instead.
 */
export { createCanvasRenderer } from './canvas/CanvasRenderer';

// Engine
export { RenderingEngine, renderingEngineCache, viewportTypeRegistry } from './engine';

// Viewports
export {
  Viewport,
  StackViewport,
  WSIViewport,
  ViewportType,
  ViewportStatus,
  InterpolationType,
} from './viewports';
export type {
  IViewport,
  ViewportInput,
  PublicViewportInput,
  ViewportInputOptions,
  ViewportProperties,
  WSIImageInfo,
} from './viewports';

// Camera
export { Camera2D } from './camera';
export type { CameraState, CanvasTransform } from './camera';

// Backends
export { Canvas2DBackend } from './backends';
export type { IRendererBackend } from './backends';

// Pipeline
export { RenderPipeline, ImageMapper, VOILUTStage, ColorMapStage, CompositorStage, OverlayCompositorStage, DisplayShutterStage } from './pipeline';
export type { IRenderStage, RenderContext } from './pipeline';

// Events
export { EventBus, eventBus, RenderingEvents } from './events';
export type {
  RenderingEventType,
  RenderingEventDetailMap,
  ImageRenderedEventDetail,
  CameraModifiedEventDetail,
  VOIModifiedEventDetail,
} from './events';

// Synchronizers
export { Synchronizer, createZoomPanSynchronizer, createVOISynchronizer } from './sync';
export type { SyncCallback } from './sync';
