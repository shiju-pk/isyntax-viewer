/**
 * SegmentationState — singleton global store for all segmentations.
 *
 * Manages:
 *   - CRUD operations on segmentations and segments
 *   - Active segmentation / segment tracking
 *   - Per-viewport representation bindings
 *   - Event emission on all mutations
 *
 * Pattern: centralized state manager (like cornerstone3D SegmentationStateManager)
 */

import { eventBus } from '../rendering/events/EventBus';
import {
  SegmentationEvents,
  SegmentationRepresentationType,
  DEFAULT_SEGMENTATION_DISPLAY_CONFIG,
  type Segmentation,
  type Segment,
  type SegmentationRepresentation,
  type SegmentationDisplayConfig,
  type LabelmapData,
  type ContourData,
  type ColorRGBA,
} from './types';
import { getSegmentColor } from './ColorLUT';

let uidCounter = 0;
export function generateSegmentationUID(): string {
  return `seg-${Date.now()}-${++uidCounter}`;
}

class SegmentationStateSingleton {
  /** All segmentations, keyed by segmentationId */
  private _segmentations = new Map<string, Segmentation>();

  /** Per-viewport representation bindings: viewportId → representations[] */
  private _viewportRepresentations = new Map<string, SegmentationRepresentation[]>();

  // ─── Segmentation CRUD ────────────────────────────────────────

  addSegmentation(segmentation: Segmentation): void {
    this._segmentations.set(segmentation.segmentationId, segmentation);
    eventBus.emit(SegmentationEvents.SEGMENTATION_ADDED as any, {
      segmentationId: segmentation.segmentationId,
    });
  }

  getSegmentation(segmentationId: string): Segmentation | undefined {
    return this._segmentations.get(segmentationId);
  }

  getAllSegmentations(): Segmentation[] {
    return Array.from(this._segmentations.values());
  }

  removeSegmentation(segmentationId: string): boolean {
    const seg = this._segmentations.get(segmentationId);
    if (!seg) return false;

    // Remove from all viewport representations
    for (const [vpId, reps] of this._viewportRepresentations) {
      const filtered = reps.filter(r => r.segmentationId !== segmentationId);
      this._viewportRepresentations.set(vpId, filtered);
    }

    this._segmentations.delete(segmentationId);
    eventBus.emit(SegmentationEvents.SEGMENTATION_REMOVED as any, {
      segmentationId,
    });
    return true;
  }

  // ─── Create Labelmap ──────────────────────────────────────────

  createLabelmap(
    imageWidth: number,
    imageHeight: number,
    options?: {
      segmentationId?: string;
      label?: string;
      imageId?: string;
    },
  ): Segmentation {
    const segmentationId = options?.segmentationId ?? generateSegmentationUID();

    const labelmap: LabelmapData = {
      buffer: new Uint8Array(imageWidth * imageHeight),
      width: imageWidth,
      height: imageHeight,
    };

    const segmentation: Segmentation = {
      segmentationId,
      label: options?.label ?? 'Segmentation',
      imageId: options?.imageId,
      segments: new Map(),
      activeSegmentIndex: 1,
      representationData: {
        [SegmentationRepresentationType.Labelmap]: labelmap,
      },
    };

    // Add default segment 1
    segmentation.segments.set(1, {
      segmentIndex: 1,
      label: 'Segment 1',
      color: getSegmentColor(0, 1),
      visible: true,
      locked: false,
      active: true,
    });

    this.addSegmentation(segmentation);
    return segmentation;
  }

  // ─── Create Contour ───────────────────────────────────────────

  createContour(
    options?: {
      segmentationId?: string;
      label?: string;
      imageId?: string;
    },
  ): Segmentation {
    const segmentationId = options?.segmentationId ?? generateSegmentationUID();

    const contour: ContourData = {
      contours: new Map(),
    };

    const segmentation: Segmentation = {
      segmentationId,
      label: options?.label ?? 'Contour Segmentation',
      imageId: options?.imageId,
      segments: new Map(),
      activeSegmentIndex: 1,
      representationData: {
        [SegmentationRepresentationType.Contour]: contour,
      },
    };

    segmentation.segments.set(1, {
      segmentIndex: 1,
      label: 'Segment 1',
      color: getSegmentColor(0, 1),
      visible: true,
      locked: false,
      active: true,
    });

    this.addSegmentation(segmentation);
    return segmentation;
  }

  // ─── Segment Management ───────────────────────────────────────

  addSegment(
    segmentationId: string,
    options?: { label?: string; color?: ColorRGBA },
  ): Segment | undefined {
    const seg = this._segmentations.get(segmentationId);
    if (!seg) return undefined;

    // Find next available index
    let nextIndex = 1;
    while (seg.segments.has(nextIndex)) nextIndex++;

    const segment: Segment = {
      segmentIndex: nextIndex,
      label: options?.label ?? `Segment ${nextIndex}`,
      color: options?.color ?? getSegmentColor(0, nextIndex),
      visible: true,
      locked: false,
      active: false,
    };

    seg.segments.set(nextIndex, segment);
    eventBus.emit(SegmentationEvents.SEGMENTATION_MODIFIED as any, {
      segmentationId,
    });

    return segment;
  }

  removeSegment(segmentationId: string, segmentIndex: number): boolean {
    const seg = this._segmentations.get(segmentationId);
    if (!seg || segmentIndex === 0) return false;

    const removed = seg.segments.delete(segmentIndex);
    if (!removed) return false;

    // Clear labelmap pixels for this segment
    const labelmap = seg.representationData[SegmentationRepresentationType.Labelmap];
    if (labelmap) {
      for (let i = 0; i < labelmap.buffer.length; i++) {
        if (labelmap.buffer[i] === segmentIndex) {
          labelmap.buffer[i] = 0;
        }
      }
    }

    // Clear contour data for this segment
    const contour = seg.representationData[SegmentationRepresentationType.Contour];
    if (contour) {
      contour.contours.delete(segmentIndex);
    }

    eventBus.emit(SegmentationEvents.SEGMENTATION_DATA_MODIFIED as any, {
      segmentationId,
      segmentIndex,
    });

    return true;
  }

  setActiveSegment(segmentationId: string, segmentIndex: number): void {
    const seg = this._segmentations.get(segmentationId);
    if (!seg) return;

    // Deactivate all, activate target
    for (const [, s] of seg.segments) {
      s.active = s.segmentIndex === segmentIndex;
    }
    seg.activeSegmentIndex = segmentIndex;

    eventBus.emit(SegmentationEvents.ACTIVE_SEGMENT_CHANGED as any, {
      segmentationId,
      segmentIndex,
    });
  }

  setSegmentVisibility(segmentationId: string, segmentIndex: number, visible: boolean): void {
    const seg = this._segmentations.get(segmentationId);
    const segment = seg?.segments.get(segmentIndex);
    if (segment) {
      segment.visible = visible;
      eventBus.emit(SegmentationEvents.SEGMENTATION_MODIFIED as any, { segmentationId });
    }
  }

  setSegmentLocked(segmentationId: string, segmentIndex: number, locked: boolean): void {
    const seg = this._segmentations.get(segmentationId);
    const segment = seg?.segments.get(segmentIndex);
    if (segment) {
      segment.locked = locked;
      eventBus.emit(SegmentationEvents.SEGMENTATION_MODIFIED as any, { segmentationId });
    }
  }

  // ─── Labelmap Operations ──────────────────────────────────────

  getLabelmapData(segmentationId: string): LabelmapData | undefined {
    const seg = this._segmentations.get(segmentationId);
    return seg?.representationData[SegmentationRepresentationType.Labelmap];
  }

  setLabelmapPixel(segmentationId: string, x: number, y: number, segmentIndex: number): void {
    const labelmap = this.getLabelmapData(segmentationId);
    if (!labelmap) return;
    if (x < 0 || y < 0 || x >= labelmap.width || y >= labelmap.height) return;
    labelmap.buffer[y * labelmap.width + x] = segmentIndex;
  }

  getLabelmapPixel(segmentationId: string, x: number, y: number): number {
    const labelmap = this.getLabelmapData(segmentationId);
    if (!labelmap) return 0;
    if (x < 0 || y < 0 || x >= labelmap.width || y >= labelmap.height) return 0;
    return labelmap.buffer[y * labelmap.width + x];
  }

  triggerDataModified(segmentationId: string, segmentIndex?: number): void {
    eventBus.emit(SegmentationEvents.SEGMENTATION_DATA_MODIFIED as any, {
      segmentationId,
      segmentIndex,
    });
  }

  // ─── Viewport Representations ─────────────────────────────────

  addRepresentationToViewport(
    viewportId: string,
    segmentationId: string,
    type: SegmentationRepresentationType,
    config?: Partial<SegmentationDisplayConfig>,
  ): void {
    let reps = this._viewportRepresentations.get(viewportId);
    if (!reps) {
      reps = [];
      this._viewportRepresentations.set(viewportId, reps);
    }

    // Avoid duplicates
    const exists = reps.some(
      r => r.segmentationId === segmentationId && r.type === type,
    );
    if (exists) return;

    reps.push({
      segmentationId,
      type,
      visible: true,
      active: true,
      colorLUTIndex: 0,
      config: { ...DEFAULT_SEGMENTATION_DISPLAY_CONFIG, ...config },
    });
  }

  getViewportRepresentations(viewportId: string): SegmentationRepresentation[] {
    return this._viewportRepresentations.get(viewportId) ?? [];
  }

  removeRepresentationFromViewport(
    viewportId: string,
    segmentationId: string,
    type: SegmentationRepresentationType,
  ): void {
    const reps = this._viewportRepresentations.get(viewportId);
    if (!reps) return;
    const filtered = reps.filter(
      r => !(r.segmentationId === segmentationId && r.type === type),
    );
    this._viewportRepresentations.set(viewportId, filtered);
  }

  // ─── Cleanup ──────────────────────────────────────────────────

  clear(): void {
    this._segmentations.clear();
    this._viewportRepresentations.clear();
  }
}

export const segmentationState = new SegmentationStateSingleton();
