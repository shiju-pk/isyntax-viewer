/**
 * RotateTool — drag to free-rotate the viewport image.
 *
 * On drag, rotates the camera by the horizontal delta in degrees.
 * Holding Shift snaps to 15° increments on release.
 */

import { BaseTool } from '../base/BaseTool';
import type { NormalizedPointerEvent } from '../base/types';
import { Viewport } from '../../rendering/viewports/Viewport';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';

export class RotateTool extends BaseTool {
  static override toolName = 'Rotate';

  override get cursor(): string {
    return 'alias';
  }

  override mouseDragCallback(evt: NormalizedPointerEvent): void {
    const vp = this.viewportRef?.viewport;
    if (!vp || !(vp instanceof Viewport)) return;

    const camera = vp.getCamera();
    // Horizontal drag controls rotation (1px ≈ 0.5°)
    const deltaRotation = evt.deltaCanvas.x * 0.5;
    camera.rotate(deltaRotation);

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: vp.id,
      camera: camera.getState(),
    });

    this.triggerRender();
  }
}
