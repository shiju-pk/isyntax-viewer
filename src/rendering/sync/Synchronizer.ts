/**
 * Viewport synchronizer — links multiple viewports so that changes
 * in one source viewport are mirrored to target viewports.
 *
 * Pattern inspired by cornerstone3D's synchronizers:
 *   - Event-based observer pattern
 *   - Supports pan/zoom, VOI, and custom sync callbacks
 *   - One source → N targets (or bidirectional)
 */

import { eventBus } from '../events/EventBus';
import { RenderingEvents } from '../events/RenderingEvents';
import type { CameraModifiedEventDetail, VOIModifiedEventDetail } from '../events/RenderingEvents';
import { renderingEngineCache } from '../engine/RenderingEngineCache';
import type { IViewport } from '../viewports/types';

export type SyncCallback = (
  sourceViewport: IViewport,
  targetViewport: IViewport,
  detail: unknown,
) => void;

interface SyncedViewport {
  renderingEngineId: string;
  viewportId: string;
}

export class Synchronizer {
  readonly id: string;
  private _eventName: string;
  private _callback: SyncCallback;
  private _sourceViewports: SyncedViewport[] = [];
  private _targetViewports: SyncedViewport[] = [];
  private _enabled = true;
  private _updating = false; // Prevent re-entrant loops

  constructor(id: string, eventName: string, callback: SyncCallback) {
    this.id = id;
    this._eventName = eventName;
    this._callback = callback;

    eventBus.on(this._eventName as any, this._onSourceEvent as any);
  }

  /**
   * Add a viewport as both source and target (bidirectional sync).
   */
  add(viewport: SyncedViewport): void {
    this.addSource(viewport);
    this.addTarget(viewport);
  }

  addSource(viewport: SyncedViewport): void {
    if (!this._sourceViewports.some(v => v.viewportId === viewport.viewportId)) {
      this._sourceViewports.push(viewport);
    }
  }

  addTarget(viewport: SyncedViewport): void {
    if (!this._targetViewports.some(v => v.viewportId === viewport.viewportId)) {
      this._targetViewports.push(viewport);
    }
  }

  remove(viewportId: string): void {
    this._sourceViewports = this._sourceViewports.filter(v => v.viewportId !== viewportId);
    this._targetViewports = this._targetViewports.filter(v => v.viewportId !== viewportId);
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  get isEnabled(): boolean {
    return this._enabled;
  }

  destroy(): void {
    eventBus.off(this._eventName as any, this._onSourceEvent as any);
    this._sourceViewports = [];
    this._targetViewports = [];
  }

  // --- Private ---

  private _onSourceEvent = (detail: { viewportId: string }): void => {
    if (!this._enabled || this._updating) return;

    // Check if the event came from a source viewport
    const sourceEntry = this._sourceViewports.find(v => v.viewportId === detail.viewportId);
    if (!sourceEntry) return;

    const sourceViewport = this._resolveViewport(sourceEntry);
    if (!sourceViewport) return;

    this._updating = true;
    try {
      for (const targetEntry of this._targetViewports) {
        // Don't sync to self
        if (targetEntry.viewportId === sourceEntry.viewportId) continue;

        const targetViewport = this._resolveViewport(targetEntry);
        if (targetViewport) {
          this._callback(sourceViewport, targetViewport, detail);
        }
      }
    } finally {
      this._updating = false;
    }
  };

  private _resolveViewport(entry: SyncedViewport): IViewport | undefined {
    const engine = renderingEngineCache.get(entry.renderingEngineId);
    return engine?.getViewport(entry.viewportId);
  }
}

// ------------------------------------------------------------------
// Pre-built synchronizer factories
// ------------------------------------------------------------------

/**
 * Synchronizes pan and zoom between viewports.
 */
export function createZoomPanSynchronizer(id: string): Synchronizer {
  return new Synchronizer(
    id,
    RenderingEvents.CAMERA_MODIFIED,
    (source: IViewport, target: IViewport, detail: unknown) => {
      const d = detail as CameraModifiedEventDetail;
      const targetCamera = target.getCamera();
      targetCamera.setState({
        panX: d.camera.panX,
        panY: d.camera.panY,
        zoom: d.camera.zoom,
      });

      // Find the target's rendering engine and trigger render
      const engine = renderingEngineCache.get(target.renderingEngineId);
      engine?.renderViewport(target.id);
    },
  );
}

/**
 * Synchronizes window/level (VOI) between viewports.
 */
export function createVOISynchronizer(id: string): Synchronizer {
  return new Synchronizer(
    id,
    RenderingEvents.VOI_MODIFIED,
    (source: IViewport, target: IViewport, detail: unknown) => {
      const d = detail as VOIModifiedEventDetail;
      target.setProperties({
        windowCenter: d.windowCenter,
        windowWidth: d.windowWidth,
      });

      const engine = renderingEngineCache.get(target.renderingEngineId);
      engine?.renderViewport(target.id);
    },
  );
}
