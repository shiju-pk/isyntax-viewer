/**
 * NewZoomTool — BaseTool implementation of zoom.
 * Supports both drag-zoom and mouse-wheel zoom.
 */

import { BaseTool } from '../base/BaseTool';
import type { NormalizedPointerEvent, NormalizedWheelEvent } from '../base/types';
import { Viewport } from '../../rendering/viewports/Viewport';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';

export class NewZoomTool extends BaseTool {
  static override toolName = 'Zoom';

  override get cursor(): string {
    return 'crosshair';
  }

  override mouseDragCallback(evt: NormalizedPointerEvent): void {
    const vp = this.viewportRef?.viewport;
    if (!vp || !(vp instanceof Viewport)) return;

    const camera = vp.getCamera();
    const factor = 1 + evt.deltaCanvas.y * -0.005;
    camera.zoomBy(factor);

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: vp.id,
      camera: camera.getState(),
    });

    this.triggerRender();
  }

  override mouseWheelCallback(evt: NormalizedWheelEvent): void {
    const vp = this.viewportRef?.viewport;
    if (!vp || !(vp instanceof Viewport)) return;

    const camera = vp.getCamera();
    const factor = evt.deltaY > 0 ? 0.9 : 1.1;
    camera.zoomBy(factor);

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: vp.id,
      camera: camera.getState(),
    });

    this.triggerRender();
  }
}
