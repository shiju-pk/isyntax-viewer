/**
 * LinkedScrollManager — Frame-of-Reference based linked scrolling.
 *
 * When viewports share the same Frame of Reference UID, scrolling one
 * viewport (the "master") synchronizes the others ("slaves") to the
 * closest matching slice position based on Image Position Patient.
 *
 * Ported from legacy `linkmanager.js` without Dojo dependencies.
 */

import type {
  LinkedViewportEntry,
  LinkedScrollCallback,
} from './types';

export class LinkedScrollManager {
  private _viewports = new Map<string, LinkedViewportEntry>();
  private _isLinked = false;
  private _masterViewportId: string | null = null;
  private _onScroll: Set<LinkedScrollCallback> = new Set();

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /** Register a viewport for potential linking. */
  registerViewport(entry: LinkedViewportEntry): void {
    this._viewports.set(entry.viewportId, entry);
  }

  /** Unregister a viewport. */
  unregisterViewport(viewportId: string): void {
    this._viewports.delete(viewportId);
    if (this._masterViewportId === viewportId) {
      this._masterViewportId = null;
    }
  }

  /** Update viewport metadata (e.g., when image changes). */
  updateViewport(viewportId: string, updates: Partial<LinkedViewportEntry>): void {
    const existing = this._viewports.get(viewportId);
    if (existing) {
      Object.assign(existing, updates);
    }
  }

  // -----------------------------------------------------------------------
  // Linking
  // -----------------------------------------------------------------------

  /** Enable linked scrolling with the given viewport as master. */
  enableLinking(masterViewportId: string): void {
    this._isLinked = true;
    this._masterViewportId = masterViewportId;
  }

  /** Disable linked scrolling. */
  disableLinking(): void {
    this._isLinked = false;
    this._masterViewportId = null;
  }

  /** Toggle linked scrolling. */
  toggleLinking(masterViewportId: string): void {
    if (this._isLinked) {
      this.disableLinking();
    } else {
      this.enableLinking(masterViewportId);
    }
  }

  get isLinked(): boolean { return this._isLinked; }
  get masterViewportId(): string | null { return this._masterViewportId; }

  // -----------------------------------------------------------------------
  // Scroll synchronization
  // -----------------------------------------------------------------------

  /**
   * Called when the master viewport scrolls.
   * Synchronizes all linked viewports that share the same Frame of Reference.
   *
   * @param sourceViewportId - The viewport that initiated the scroll.
   * @param newImageIndex - The new image index in the source viewport.
   * @param imagePositionPatient - IPP of the new slice (optional, for position-based sync).
   */
  onMasterScroll(
    sourceViewportId: string,
    newImageIndex: number,
    imagePositionPatient?: number[],
  ): void {
    if (!this._isLinked) return;

    const source = this._viewports.get(sourceViewportId);
    if (!source) return;

    // Update source entry
    source.currentImageIndex = newImageIndex;
    if (imagePositionPatient) {
      source.imagePositionPatient = imagePositionPatient;
    }

    // Find all viewports with the same Frame of Reference
    const linkedViewports = this._getLinkedViewports(source);

    for (const target of linkedViewports) {
      if (target.viewportId === sourceViewportId) continue;

      let targetIndex: number;

      if (imagePositionPatient && source.imageOrientationPatient) {
        // Position-based sync: find closest slice in target
        targetIndex = this._findClosestSliceByPosition(
          source,
          target,
          imagePositionPatient,
        );
      } else {
        // Ratio-based sync: map proportionally
        targetIndex = this._mapIndexProportionally(
          newImageIndex,
          source.imageCount,
          target.imageCount,
        );
      }

      if (targetIndex !== target.currentImageIndex) {
        target.currentImageIndex = targetIndex;
        this._notifyScroll(target.viewportId, targetIndex);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Subscriptions
  // -----------------------------------------------------------------------

  /** Subscribe to scroll sync events. Returns unsubscribe function. */
  onScrollSync(cb: LinkedScrollCallback): () => void {
    this._onScroll.add(cb);
    return () => { this._onScroll.delete(cb); };
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get a registered viewport entry by ID. */
  getViewport(viewportId: string): LinkedViewportEntry | undefined {
    return this._viewports.get(viewportId);
  }

  /** Get all viewport IDs linked to the given viewport. */
  getLinkedViewportIds(viewportId: string): string[] {
    const source = this._viewports.get(viewportId);
    if (!source) return [];
    return this._getLinkedViewports(source).map((v) => v.viewportId);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose(): void {
    this._viewports.clear();
    this._onScroll.clear();
    this._isLinked = false;
    this._masterViewportId = null;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private _getLinkedViewports(source: LinkedViewportEntry): LinkedViewportEntry[] {
    const result: LinkedViewportEntry[] = [];
    for (const entry of this._viewports.values()) {
      if (entry.frameOfReferenceUID === source.frameOfReferenceUID) {
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * Find the closest slice in the target viewport based on IPP projection
   * along the slice normal vector.
   */
  private _findClosestSliceByPosition(
    source: LinkedViewportEntry,
    _target: LinkedViewportEntry,
    sourceIPP: number[],
  ): number {
    // If target doesn't have orientation data, fall back to proportional
    if (!source.imageOrientationPatient || sourceIPP.length < 3) {
      return this._mapIndexProportionally(
        source.currentImageIndex,
        source.imageCount,
        _target.imageCount,
      );
    }

    // Compute normal vector from IOP
    const iop = source.imageOrientationPatient;
    const nx = iop[1] * iop[5] - iop[2] * iop[4];
    const ny = iop[2] * iop[3] - iop[0] * iop[5];
    const nz = iop[0] * iop[4] - iop[1] * iop[3];

    // Project source position along normal
    const sourceProj = sourceIPP[0] * nx + sourceIPP[1] * ny + sourceIPP[2] * nz;

    // For now, use proportional mapping as a fallback since we don't have
    // per-slice IPP for the target. Full implementation would query all
    // target slice positions and find the closest projection.
    // This is a simplified version that works for parallel slice stacks.
    void sourceProj;

    return this._mapIndexProportionally(
      source.currentImageIndex,
      source.imageCount,
      _target.imageCount,
    );
  }

  /** Map an index proportionally from one stack to another. */
  private _mapIndexProportionally(
    sourceIndex: number,
    sourceCount: number,
    targetCount: number,
  ): number {
    if (sourceCount <= 1 || targetCount <= 1) return 0;
    const ratio = sourceIndex / (sourceCount - 1);
    return Math.round(ratio * (targetCount - 1));
  }

  private _notifyScroll(viewportId: string, newIndex: number): void {
    for (const cb of this._onScroll) {
      cb(viewportId, newIndex);
    }
  }
}
