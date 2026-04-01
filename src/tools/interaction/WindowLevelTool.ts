import type { IViewport } from '../../rendering/viewports/types';
import type { ITool, PointerEventData, WheelEventData } from '../types';
import { ToolType } from '../types';
import { Viewport } from '../../rendering/viewports/Viewport';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';

export class WindowLevelTool implements ITool {
  readonly name = 'WindowLevel';
  readonly type = ToolType.WINDOW_LEVEL;
  private viewport: IViewport | null = null;
  private windowCenter = 128;
  private windowWidth = 256;

  activate(viewport: IViewport): void {
    this.viewport = viewport;
    if (viewport instanceof Viewport) {
      const props = viewport.getProperties();
      this.windowCenter = props.windowCenter ?? 128;
      this.windowWidth = props.windowWidth ?? 256;
    }
  }

  deactivate(): void {
    this.viewport = null;
  }

  onPointerDown(_event: PointerEventData): void {
    // No action needed
  }

  onPointerMove(event: PointerEventData): void {
    if (!this.viewport || !(this.viewport instanceof Viewport)) return;

    this.windowCenter += event.deltaY;
    this.windowWidth = Math.max(1, this.windowWidth + event.deltaX);

    this.viewport.setProperties({
      windowCenter: this.windowCenter,
      windowWidth: this.windowWidth,
    });

    eventBus.emit(RenderingEvents.VOI_MODIFIED, {
      viewportId: this.viewport.id,
      windowCenter: this.windowCenter,
      windowWidth: this.windowWidth,
    });

    this.viewport.render();
  }

  onPointerUp(_event: PointerEventData): void {
    // No action needed
  }

  onWheel(_event: WheelEventData): void {
    // W/L tool doesn't handle wheel
  }
}
