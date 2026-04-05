/**
 * OverlayState — Manages runtime visibility toggles and color overrides
 * for DICOM overlay planes.
 *
 * This is the reactive state layer that sits between the parsed OverlayGroup
 * and the OverlayRenderer. UI components subscribe to state changes to
 * trigger re-renders.
 */

import type { OverlayGroup, OverlayRenderOptions } from './types';
import { DEFAULT_OVERLAY_COLORS } from './types';

export type OverlayStateChangeCallback = () => void;

export class OverlayState {
  private _group: OverlayGroup | null = null;
  private _globalVisible = true;
  private _planeVisibility: (boolean | undefined)[] = new Array(16).fill(undefined);
  private _planeColors: (string | undefined)[] = new Array(16).fill(undefined);
  private _listeners: Set<OverlayStateChangeCallback> = new Set();

  /** Set the parsed overlay group (called when a new image is loaded). */
  setGroup(group: OverlayGroup | null): void {
    this._group = group;
    this._notify();
  }

  /** Get the current overlay group. */
  getGroup(): OverlayGroup | null {
    return this._group;
  }

  /** Toggle global overlay visibility. */
  setGlobalVisible(visible: boolean): void {
    this._globalVisible = visible;
    this._notify();
  }

  /** Get global overlay visibility. */
  isGlobalVisible(): boolean {
    return this._globalVisible;
  }

  /** Toggle visibility for a specific plane (0–15). */
  setPlaneVisible(groupIndex: number, visible: boolean | undefined): void {
    if (groupIndex < 0 || groupIndex > 15) return;
    this._planeVisibility[groupIndex] = visible;
    this._notify();
  }

  /** Get visibility for a specific plane. */
  isPlaneVisible(groupIndex: number): boolean | undefined {
    return this._planeVisibility[groupIndex];
  }

  /** Set color override for a specific plane. */
  setPlaneColor(groupIndex: number, color: string | undefined): void {
    if (groupIndex < 0 || groupIndex > 15) return;
    this._planeColors[groupIndex] = color;
    this._notify();
  }

  /** Get effective color for a specific plane. */
  getPlaneColor(groupIndex: number): string {
    return this._planeColors[groupIndex] ?? DEFAULT_OVERLAY_COLORS[groupIndex] ?? '#FFFFFF';
  }

  /** Reset all visibility and color overrides. */
  reset(): void {
    this._planeVisibility.fill(undefined);
    this._planeColors.fill(undefined);
    this._globalVisible = true;
    this._notify();
  }

  /**
   * Build render options from current state.
   * Merges global visibility, per-plane overrides, and colors.
   */
  buildRenderOptions(
    imageWidth: number,
    imageHeight: number,
    pixelLevel: number,
    currentFrame: number,
    isMultiFrame: boolean,
  ): OverlayRenderOptions {
    // If global visibility is off, set all planes to hidden
    const planeVisibility = this._globalVisible
      ? [...this._planeVisibility]
      : new Array(16).fill(false);

    return {
      imageWidth,
      imageHeight,
      pixelLevel,
      currentFrame,
      isMultiFrame,
      planeVisibility,
      planeColors: [...this._planeColors],
    };
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(callback: OverlayStateChangeCallback): () => void {
    this._listeners.add(callback);
    return () => { this._listeners.delete(callback); };
  }

  /** Dispose all subscriptions. */
  dispose(): void {
    this._listeners.clear();
    this._group = null;
  }

  private _notify(): void {
    for (const cb of this._listeners) {
      cb();
    }
  }
}
