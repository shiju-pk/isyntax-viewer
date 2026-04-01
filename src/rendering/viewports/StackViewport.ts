import { Viewport } from './Viewport';
import { ViewportStatus, type ViewportInput, type ViewportProperties } from './types';
import { eventBus } from '../events/EventBus';
import { RenderingEvents } from '../events/RenderingEvents';
import { RenderPipeline } from '../pipeline/RenderPipeline';
import { WebGLBackend } from '../backends/WebGLBackend';

export class StackViewport extends Viewport {
  private imageIds: string[] = [];
  private currentImageIdIndex = 0;

  static override get useCustomRenderingPipeline(): boolean {
    return true;
  }

  constructor(input: ViewportInput) {
    super(input);
    this.pipeline = new RenderPipeline();
  }

  setStack(imageIds: string[], initialIndex = 0): void {
    this.imageIds = imageIds;
    this.currentImageIdIndex = initialIndex;
    this.viewportStatus = ViewportStatus.LOADING;
  }

  getImageIds(): string[] {
    return [...this.imageIds];
  }

  getCurrentImageIdIndex(): number {
    return this.currentImageIdIndex;
  }

  getCurrentImageId(): string | undefined {
    return this.imageIds[this.currentImageIdIndex];
  }

  setImageIdIndex(index: number): void {
    if (index < 0 || index >= this.imageIds.length) return;
    this.currentImageIdIndex = index;
  }

  scroll(delta: number): void {
    const newIndex = Math.max(
      0,
      Math.min(this.imageIds.length - 1, this.currentImageIdIndex + delta)
    );
    if (newIndex !== this.currentImageIdIndex) {
      this.currentImageIdIndex = newIndex;
    }
  }

  override setProperties(props: ViewportProperties): void {
    const prevWC = this.properties.windowCenter;
    const prevWW = this.properties.windowWidth;
    super.setProperties(props);

    if (
      props.windowCenter !== undefined ||
      props.windowWidth !== undefined
    ) {
      const wc = this.properties.windowCenter ?? 128;
      const ww = this.properties.windowWidth ?? 256;

      if (
        props.windowCenter !== prevWC ||
        props.windowWidth !== prevWW
      ) {
        // Sync VOI state to WebGLBackend for GPU-accelerated W/L
        if (this.backend instanceof WebGLBackend) {
          (this.backend as WebGLBackend).setVOI(wc, ww);
        }

        eventBus.emit(RenderingEvents.VOI_MODIFIED, {
          viewportId: this.id,
          windowCenter: wc,
          windowWidth: ww,
        });
      }
    }

    if (props.invert !== undefined && this.backend instanceof WebGLBackend) {
      (this.backend as WebGLBackend).setInvert(props.invert);
    }
  }

  override dispose(): void {
    this.imageIds = [];
    this.currentImageIdIndex = 0;
    super.dispose();
  }
}
