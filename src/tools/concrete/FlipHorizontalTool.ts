/**
 * FlipHorizontalTool — toggles horizontal flip on mouseDown (click).
 *
 * This is an "action" tool: a single click flips the image.
 */

import { BaseTool } from '../base/BaseTool';
import type { NormalizedPointerEvent } from '../base/types';
import { Viewport } from '../../rendering/viewports/Viewport';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';

export class FlipHorizontalTool extends BaseTool {
  static override toolName = 'FlipHorizontal';

  override get cursor(): string {
    return 'pointer';
  }

  override mouseDownCallback(_evt: NormalizedPointerEvent): void {
    const vp = this.viewportRef?.viewport;
    if (!vp || !(vp instanceof Viewport)) return;

    const camera = vp.getCamera();
    camera.flipHorizontal();

    eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
      viewportId: vp.id,
      camera: camera.getState(),
    });

    this.triggerRender();
  }
}
