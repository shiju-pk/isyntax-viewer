/**
 * NewWindowLevelTool — BaseTool implementation of Window/Level adjustment.
 * Drag-X adjusts window width, drag-Y adjusts window center.
 */

import { BaseTool } from '../base/BaseTool';
import type { NormalizedPointerEvent } from '../base/types';
import { Viewport } from '../../rendering/viewports/Viewport';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';

export class NewWindowLevelTool extends BaseTool {
  static override toolName = 'WindowLevel';

  private _windowCenter = 128;
  private _windowWidth = 256;

  override get cursor(): string {
    return 'crosshair';
  }

  override onSetToolActive(): void {
    const vp = this.viewportRef?.viewport;
    if (vp instanceof Viewport) {
      const props = vp.getProperties();
      this._windowCenter = props.windowCenter ?? 128;
      this._windowWidth = props.windowWidth ?? 256;
    }
  }

  override mouseDragCallback(evt: NormalizedPointerEvent): void {
    const vp = this.viewportRef?.viewport;
    if (!vp || !(vp instanceof Viewport)) return;

    this._windowCenter += evt.deltaCanvas.y;
    this._windowWidth = Math.max(1, this._windowWidth + evt.deltaCanvas.x);

    vp.setProperties({
      windowCenter: this._windowCenter,
      windowWidth: this._windowWidth,
    });

    eventBus.emit(RenderingEvents.VOI_MODIFIED, {
      viewportId: vp.id,
      windowCenter: this._windowCenter,
      windowWidth: this._windowWidth,
    });

    this.triggerRender();
  }
}
