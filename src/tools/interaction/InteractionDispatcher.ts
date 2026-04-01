import type { IViewport } from '../../rendering/viewports/types';
import type { ITool, PointerEventData } from '../types';

export class InteractionDispatcher {
  private viewport: IViewport | null = null;
  private activeTool: ITool | null = null;
  private element: HTMLElement | null = null;
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  private boundOnPointerDown = this.onPointerDown.bind(this);
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerUp = this.onPointerUp.bind(this);
  private boundOnWheel = this.onWheel.bind(this);

  attach(viewport: IViewport): void {
    this.detach();
    this.viewport = viewport;
    this.element = viewport.element;

    this.element.addEventListener('pointerdown', this.boundOnPointerDown);
    this.element.addEventListener('pointermove', this.boundOnPointerMove);
    this.element.addEventListener('pointerup', this.boundOnPointerUp);
    this.element.addEventListener('pointerleave', this.boundOnPointerUp);
    this.element.addEventListener('wheel', this.boundOnWheel, { passive: false });
  }

  detach(): void {
    if (this.element) {
      this.element.removeEventListener('pointerdown', this.boundOnPointerDown);
      this.element.removeEventListener('pointermove', this.boundOnPointerMove);
      this.element.removeEventListener('pointerup', this.boundOnPointerUp);
      this.element.removeEventListener('pointerleave', this.boundOnPointerUp);
      this.element.removeEventListener('wheel', this.boundOnWheel);
    }

    if (this.activeTool) {
      this.activeTool.deactivate();
    }

    this.viewport = null;
    this.element = null;
    this.isDragging = false;
  }

  setActiveTool(tool: ITool): void {
    if (this.activeTool) {
      this.activeTool.deactivate();
    }
    this.activeTool = tool;
    if (this.viewport) {
      this.activeTool.activate(this.viewport);
    }

    // Update cursor
    if (this.element) {
      switch (tool.type) {
        case 'pan' as string:
          this.element.style.cursor = 'grab';
          break;
        case 'zoom' as string:
          this.element.style.cursor = 'crosshair';
          break;
        case 'windowLevel' as string:
          this.element.style.cursor = 'crosshair';
          break;
        default:
          this.element.style.cursor = 'default';
      }
    }
  }

  getActiveTool(): ITool | null {
    return this.activeTool;
  }

  private onPointerDown(e: PointerEvent): void {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.element && this.activeTool?.type === ('pan' as string)) {
      this.element.style.cursor = 'grabbing';
    }

    if (this.activeTool) {
      const data: PointerEventData = {
        clientX: e.clientX,
        clientY: e.clientY,
        deltaX: 0,
        deltaY: 0,
        button: e.button,
      };
      this.activeTool.onPointerDown(data);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDragging || !this.activeTool) return;

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    const data: PointerEventData = {
      clientX: e.clientX,
      clientY: e.clientY,
      deltaX: dx,
      deltaY: dy,
      button: e.button,
    };
    this.activeTool.onPointerMove(data);
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.element && this.activeTool?.type === ('pan' as string)) {
      this.element.style.cursor = 'grab';
    }

    if (this.activeTool) {
      const data: PointerEventData = {
        clientX: e.clientX,
        clientY: e.clientY,
        deltaX: 0,
        deltaY: 0,
        button: e.button,
      };
      this.activeTool.onPointerUp(data);
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!this.activeTool) return;

    this.activeTool.onWheel({
      deltaY: e.deltaY,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  }
}
