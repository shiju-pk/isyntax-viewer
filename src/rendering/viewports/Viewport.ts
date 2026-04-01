import { Camera2D } from '../camera/Camera2D';
import type { IRendererBackend } from '../backends/IRendererBackend';
import { Canvas2DBackend } from '../backends/Canvas2DBackend';
import { WebGLBackend } from '../backends/WebGLBackend';
import { eventBus } from '../events/EventBus';
import { RenderingEvents } from '../events/RenderingEvents';
import type { RenderPipeline } from '../pipeline/RenderPipeline';
import {
  ViewportStatus,
  type IViewport,
  type ViewportInput,
  type ViewportProperties,
  type ViewportType,
} from './types';

export abstract class Viewport implements IViewport {
  readonly id: string;
  readonly element: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly renderingEngineId: string;
  readonly type: ViewportType;
  viewportStatus: ViewportStatus = ViewportStatus.NO_DATA;

  protected camera: Camera2D;
  protected backend: IRendererBackend;
  protected pipeline: RenderPipeline | null = null;
  protected properties: ViewportProperties = {};
  protected imageData: ImageData | null = null;

  static get useCustomRenderingPipeline(): boolean {
    return false;
  }

  constructor(input: ViewportInput) {
    this.id = input.viewportId;
    this.renderingEngineId = input.renderingEngineId;
    this.type = input.type;
    this.element = input.element;
    this.canvas = input.canvas;

    this.camera = new Camera2D();

    const preferredBackend = input.defaultOptions?.preferredBackend;
    if (preferredBackend === 'webgl') {
      try {
        const webgl = new WebGLBackend();
        webgl.init(this.canvas);
        this.backend = webgl;
      } catch {
        // WebGL2 not available — fall back to Canvas2D
        this.backend = new Canvas2DBackend();
        this.backend.init(this.canvas);
      }
    } else {
      this.backend = new Canvas2DBackend();
      this.backend.init(this.canvas);
    }

    this.element.setAttribute('data-viewport-uid', this.id);
    this.element.setAttribute('data-rendering-engine-uid', this.renderingEngineId);
  }

  getCamera(): Camera2D {
    return this.camera;
  }

  setImageData(data: ImageData): void {
    this.imageData = data;
    this.viewportStatus = ViewportStatus.PRE_RENDER;
  }

  getImageData(): ImageData | null {
    return this.imageData;
  }

  render(): void {
    const startTime = performance.now();

    if (this.pipeline) {
      this.pipeline.execute({
        viewportId: this.id,
        camera: this.camera,
        backend: this.backend,
        canvas: this.canvas,
        properties: this.properties,
        imageData: this.imageData,
      });
      if (this.imageData) {
        this.viewportStatus = ViewportStatus.RENDERED;
      }
    } else {
      this.backend.clear(
        (this.properties as { background?: [number, number, number] }).background ?? [0, 0, 0]
      );

      if (this.imageData) {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        const transform = this.camera.computeTransform(
          displayWidth,
          displayHeight,
          this.imageData.width,
          this.imageData.height
        );
        this.backend.drawImage(
          this.imageData,
          transform,
          this.imageData.width,
          this.imageData.height
        );
        this.viewportStatus = ViewportStatus.RENDERED;
      }
    }

    const renderTimeMs = performance.now() - startTime;
    eventBus.emit(RenderingEvents.IMAGE_RENDERED, {
      viewportId: this.id,
      renderingEngineId: this.renderingEngineId,
      renderTimeMs,
    });
  }

  resize(): void {
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    this.backend.resize(displayWidth, displayHeight);

    eventBus.emit(RenderingEvents.ELEMENT_RESIZE, {
      viewportId: this.id,
      width: displayWidth,
      height: displayHeight,
    });
  }

  resetCamera(): void {
    this.camera.reset();

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: this.id,
      camera: this.camera.getState(),
    });
  }

  setProperties(props: ViewportProperties): void {
    Object.assign(this.properties, props);
  }

  getProperties(): ViewportProperties {
    return { ...this.properties };
  }

  dispose(): void {
    this.element.removeAttribute('data-viewport-uid');
    this.element.removeAttribute('data-rendering-engine-uid');
    this.backend.dispose();
    this.imageData = null;
  }
}
