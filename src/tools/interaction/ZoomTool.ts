import type { IViewport } from '../../rendering/viewports/types';
import type { ITool, PointerEventData, WheelEventData } from '../types';
import { ToolType } from '../types';
import { Viewport } from '../../rendering/viewports/Viewport';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';

export class ZoomTool implements ITool {
  readonly name = 'Zoom';
  readonly type = ToolType.ZOOM;
  private viewport: IViewport | null = null;

  activate(viewport: IViewport): void {
    this.viewport = viewport;
  }

  deactivate(): void {
    this.viewport = null;
  }

  onPointerDown(_event: PointerEventData): void {
    // No action needed
  }

  onPointerMove(event: PointerEventData): void {
    if (!this.viewport || !(this.viewport instanceof Viewport)) return;
    const camera = this.viewport.getCamera();
    const factor = 1 + event.deltaY * -0.005;
    camera.zoomBy(factor);

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: this.viewport.id,
      camera: camera.getState(),
    });

    this.viewport.render();
  }

  onPointerUp(_event: PointerEventData): void {
    // No action needed
  }

  onWheel(event: WheelEventData): void {
    if (!this.viewport || !(this.viewport instanceof Viewport)) return;
    const camera = this.viewport.getCamera();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    camera.zoomBy(factor);

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: this.viewport.id,
      camera: camera.getState(),
    });

    this.viewport.render();
  }
}
