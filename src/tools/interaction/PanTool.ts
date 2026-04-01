import type { IViewport } from '../../rendering/viewports/types';
import type { ITool, PointerEventData, WheelEventData } from '../types';
import { ToolType } from '../types';
import { Viewport } from '../../rendering/viewports/Viewport';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';

export class PanTool implements ITool {
  readonly name = 'Pan';
  readonly type = ToolType.PAN;
  private viewport: (IViewport & { getCamera?(): unknown }) | null = null;

  activate(viewport: IViewport): void {
    this.viewport = viewport;
  }

  deactivate(): void {
    this.viewport = null;
  }

  onPointerDown(_event: PointerEventData): void {
    // No action needed on pointer down
  }

  onPointerMove(event: PointerEventData): void {
    if (!this.viewport || !(this.viewport instanceof Viewport)) return;
    const camera = this.viewport.getCamera();
    camera.pan(event.deltaX, event.deltaY);

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: this.viewport.id,
      camera: camera.getState(),
    });

    this.viewport.render();
  }

  onPointerUp(_event: PointerEventData): void {
    // No action needed on pointer up
  }

  onWheel(_event: WheelEventData): void {
    // Pan tool doesn't handle wheel
  }
}
