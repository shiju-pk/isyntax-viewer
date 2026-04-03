/**
 * NewPanTool — BaseTool implementation of pan/drag navigation.
 * Replaces the old interaction/PanTool.
 */

import { BaseTool } from '../base/BaseTool';
import type { NormalizedPointerEvent, NormalizedWheelEvent } from '../base/types';
import { Viewport } from '../../rendering/viewports/Viewport';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';

export class NewPanTool extends BaseTool {
  static override toolName = 'Pan';

  override get cursor(): string {
    return 'grab';
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    // Switch to grabbing cursor during drag
    if (this.viewportRef?.element) {
      this.viewportRef.element.style.cursor = 'grabbing';
    }
  }

  override mouseUpCallback(evt: NormalizedPointerEvent): void {
    // Restore grab cursor
    if (this.viewportRef?.element) {
      this.viewportRef.element.style.cursor = 'grab';
    }
  }

  override mouseDragCallback(evt: NormalizedPointerEvent): void {
    const vp = this.viewportRef?.viewport;
    if (!vp || !(vp instanceof Viewport)) return;

    const camera = vp.getCamera();
    camera.pan(evt.deltaCanvas.x, evt.deltaCanvas.y);

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: vp.id,
      camera: camera.getState(),
    });

    this.triggerRender();
  }
}
