/**
 * ViewportSyncManager — Extends the existing linked scrolling with
 * additional synchronization modes: WL sync, zoom sync, and all sync.
 *
 * Sync groups are defined per hanging protocol or manually by user.
 */

import { eventBus } from '../rendering/events/EventBus';
import { RenderingEvents } from '../rendering/events/RenderingEvents';
import type { SyncMode } from '../hanging-protocol/types';

export interface SyncGroupConfig {
  id: string;
  cellIndices: number[];
  mode: SyncMode;
}

export class ViewportSyncManager {
  private _groups: SyncGroupConfig[] = [];
  private _viewportMap = new Map<number, string>(); // cellIndex → viewportId
  private _subscriptions: Array<() => void> = [];
  private _suppressing = false;

  /** Register a viewport with its cell index. */
  registerViewport(cellIndex: number, viewportId: string): void {
    this._viewportMap.set(cellIndex, viewportId);
  }

  /** Unregister a viewport. */
  unregisterViewport(cellIndex: number): void {
    this._viewportMap.delete(cellIndex);
  }

  /** Set sync groups (typically from a hanging protocol). */
  setSyncGroups(groups: SyncGroupConfig[]): void {
    this.dispose();
    this._groups = groups;
    this._setupListeners();
  }

  /** Get current sync groups. */
  getSyncGroups(): readonly SyncGroupConfig[] {
    return this._groups;
  }

  /** Find which group a viewport belongs to. */
  getGroupForViewport(viewportId: string): SyncGroupConfig | undefined {
    for (const group of this._groups) {
      for (const cellIdx of group.cellIndices) {
        if (this._viewportMap.get(cellIdx) === viewportId) {
          return group;
        }
      }
    }
    return undefined;
  }

  /** Get linked viewport IDs for a given viewport. */
  getLinkedViewports(viewportId: string): string[] {
    const group = this.getGroupForViewport(viewportId);
    if (!group) return [];

    return group.cellIndices
      .map((idx) => this._viewportMap.get(idx))
      .filter((id): id is string => id !== undefined && id !== viewportId);
  }

  private _setupListeners(): void {
    // Listen for VOI changes
    const voiHandler = (detail: any) => {
      if (this._suppressing || detail.source === 'sync') return;
      const group = this.getGroupForViewport(detail.viewportId);
      if (!group || (group.mode !== 'windowLevel' && group.mode !== 'all')) return;

      const linked = this.getLinkedViewports(detail.viewportId);
      this._suppressing = true;
      for (const targetId of linked) {
        eventBus.emit(RenderingEvents.VOI_MODIFIED, {
          viewportId: targetId,
          windowCenter: detail.windowCenter,
          windowWidth: detail.windowWidth,
          source: 'sync',
        } as any);
      }
      this._suppressing = false;
    };
    eventBus.on(RenderingEvents.VOI_MODIFIED, voiHandler);
    this._subscriptions.push(() => eventBus.off(RenderingEvents.VOI_MODIFIED, voiHandler));

    // Listen for camera changes (zoom/pan sync)
    const cameraHandler = (detail: any) => {
      if (this._suppressing || detail.source === 'sync') return;
      const group = this.getGroupForViewport(detail.viewportId);
      if (!group || (group.mode !== 'zoom' && group.mode !== 'all')) return;

      const linked = this.getLinkedViewports(detail.viewportId);
      this._suppressing = true;
      for (const targetId of linked) {
        eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
          viewportId: targetId,
          camera: detail.camera,
          source: 'sync',
        } as any);
      }
      this._suppressing = false;
    };
    eventBus.on(RenderingEvents.CAMERA_MODIFIED, cameraHandler);
    this._subscriptions.push(() => eventBus.off(RenderingEvents.CAMERA_MODIFIED, cameraHandler));
  }

  /** Clean up all listeners. */
  dispose(): void {
    for (const unsub of this._subscriptions) {
      unsub();
    }
    this._subscriptions = [];
    this._groups = [];
  }
}
