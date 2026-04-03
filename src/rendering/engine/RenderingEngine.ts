import type {
  IViewport,
  PublicViewportInput,
  ViewportInput,
} from '../viewports/types';
import { viewportTypeRegistry } from './ViewportTypeRegistry';
import { renderingEngineCache } from './RenderingEngineCache';
import { eventBus } from '../events/EventBus';
import { RenderingEvents } from '../events/RenderingEvents';

let idCounter = 0;
function generateId(): string {
  return `renderingEngine-${++idCounter}`;
}

function getOrCreateCanvas(element: HTMLDivElement): HTMLCanvasElement {
  let canvas = element.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    element.appendChild(canvas);
  }
  return canvas;
}

export class RenderingEngine {
  readonly id: string;
  private _viewports = new Map<string, IViewport>();
  private _needsRender = new Set<string>();
  private _animationFrameSet = false;
  private _animationFrameHandle: number | null = null;
  private _destroyed = false;
  private _afterRenderCallbacks: Array<() => void> = [];

  constructor(id?: string) {
    this.id = id ?? generateId();
    renderingEngineCache.set(this);
  }

  enableElement(input: PublicViewportInput): void {
    this._throwIfDestroyed();

    const { viewportId, type, element, defaultOptions } = input;

    // If viewport already exists, disable it first
    if (this._viewports.has(viewportId)) {
      this.disableElement(viewportId);
    }

    const ViewportClass = viewportTypeRegistry.get(type);
    if (!ViewportClass) {
      throw new Error(
        `No viewport class registered for type "${type}". ` +
          `Registered types: ${viewportTypeRegistry.getRegisteredTypes().join(', ')}`
      );
    }

    const canvas = getOrCreateCanvas(element);
    const { clientWidth, clientHeight } = canvas;
    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
      canvas.width = clientWidth;
      canvas.height = clientHeight;
    }

    const viewportInput: ViewportInput = {
      viewportId,
      renderingEngineId: this.id,
      type,
      element,
      canvas,
      defaultOptions: defaultOptions ?? {},
    };

    const viewport = new ViewportClass(viewportInput);
    this._viewports.set(viewportId, viewport);

    eventBus.emit(RenderingEvents.VIEWPORT_ENABLED, {
      viewportId,
      renderingEngineId: this.id,
      element,
    });
  }

  disableElement(viewportId: string): void {
    this._throwIfDestroyed();

    const viewport = this._viewports.get(viewportId);
    if (!viewport) {
      console.warn(`Viewport "${viewportId}" does not exist`);
      return;
    }

    eventBus.emit(RenderingEvents.VIEWPORT_DISABLED, {
      viewportId,
      renderingEngineId: this.id,
      element: viewport.element,
    });

    viewport.dispose();
    this._viewports.delete(viewportId);
    this._needsRender.delete(viewportId);

    if (this._viewports.size === 0) {
      this._clearAnimationFrame();
    }
  }

  setViewports(inputs: PublicViewportInput[]): void {
    this._throwIfDestroyed();
    // Disable all existing viewports
    for (const vpId of Array.from(this._viewports.keys())) {
      this.disableElement(vpId);
    }
    // Enable all new viewports
    for (const input of inputs) {
      this.enableElement(input);
    }
  }

  getViewport(viewportId: string): IViewport | undefined {
    return this._viewports.get(viewportId);
  }

  getViewports(): IViewport[] {
    return Array.from(this._viewports.values());
  }

  render(): void {
    const viewportIds = Array.from(this._viewports.keys());
    this._setViewportsToBeRenderedNextFrame(viewportIds);
  }

  renderViewport(viewportId: string): void {
    this._setViewportsToBeRenderedNextFrame([viewportId]);
  }

  renderViewports(viewportIds: string[]): void {
    this._setViewportsToBeRenderedNextFrame(viewportIds);
  }

  resize(immediate = true): void {
    this._throwIfDestroyed();

    for (const viewport of this._viewports.values()) {
      viewport.resize();
    }

    if (immediate) {
      this.render();
    }
  }

  destroy(): void {
    if (this._destroyed) return;

    for (const vpId of Array.from(this._viewports.keys())) {
      this.disableElement(vpId);
    }

    this._clearAnimationFrame();
    renderingEngineCache.delete(this.id);
    this._destroyed = true;
  }

  get hasBeenDestroyed(): boolean {
    return this._destroyed;
  }

  onAfterRender(cb: () => void): () => void {
    this._afterRenderCallbacks.push(cb);
    return () => {
      const idx = this._afterRenderCallbacks.indexOf(cb);
      if (idx !== -1) this._afterRenderCallbacks.splice(idx, 1);
    };
  }

  private _setViewportsToBeRenderedNextFrame(viewportIds: string[]): void {
    for (const id of viewportIds) {
      this._needsRender.add(id);
    }
    this._scheduleRender();
  }

  private _scheduleRender(): void {
    if (this._needsRender.size > 0 && !this._animationFrameSet) {
      this._animationFrameHandle = window.requestAnimationFrame(
        this._renderFlaggedViewports
      );
      this._animationFrameSet = true;
    }
  }

  private _renderFlaggedViewports = (): void => {
    this._animationFrameSet = false;
    this._animationFrameHandle = null;

    const viewportIdsToRender = Array.from(this._needsRender);
    this._needsRender.clear();

    for (const vpId of viewportIdsToRender) {
      const viewport = this._viewports.get(vpId);
      if (viewport) {
        viewport.render();
      }
    }

    for (const cb of this._afterRenderCallbacks) {
      cb();
    }
  };

  private _clearAnimationFrame(): void {
    if (this._animationFrameHandle !== null) {
      window.cancelAnimationFrame(this._animationFrameHandle);
    }
    this._needsRender.clear();
    this._animationFrameSet = false;
    this._animationFrameHandle = null;
  }

  private _throwIfDestroyed(): void {
    if (this._destroyed) {
      throw new Error(
        'RenderingEngine has been destroyed. Create a new instance.'
      );
    }
  }
}
