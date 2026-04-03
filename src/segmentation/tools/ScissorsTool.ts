/**
 * ScissorsTool — region-based segmentation using rectangle or ellipse scissors.
 *
 * User draws a bounding region (rectangle or ellipse), then all pixels inside
 * are painted with the active segment index.
 *
 * Configuration:
 *   - scissorShape: 'rectangle' | 'ellipse' (default 'rectangle')
 */

import { BaseTool } from '../../tools/base/BaseTool';
import type { NormalizedPointerEvent, Point2 } from '../../tools/base/types';
import { segmentationState } from '../SegmentationState';
import { SegmentationRepresentationType } from '../types';
import type { LabelmapData } from '../types';

export class ScissorsTool extends BaseTool {
  static override toolName = 'Scissors';

  private _startPoint: Point2 | null = null;
  private _segmentationId: string | null = null;

  override get cursor(): string {
    return 'crosshair';
  }

  get scissorShape(): 'rectangle' | 'ellipse' {
    return (this.configuration.scissorShape as 'rectangle' | 'ellipse') ?? 'rectangle';
  }

  set segmentationId(id: string | null) {
    this._segmentationId = id;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    this._startPoint = { ...evt.worldPoint };
  }

  override mouseDragCallback(_evt: NormalizedPointerEvent): void {
    // Visual preview could be added here in the future
  }

  override mouseUpCallback(evt: NormalizedPointerEvent): void {
    if (!this._startPoint) return;

    const endPoint = evt.worldPoint;
    const segId = this._resolveSegmentationId();
    if (!segId) {
      this._startPoint = null;
      return;
    }

    const seg = segmentationState.getSegmentation(segId);
    if (!seg) {
      this._startPoint = null;
      return;
    }

    const labelmap = seg.representationData[SegmentationRepresentationType.Labelmap];
    if (!labelmap) {
      this._startPoint = null;
      return;
    }

    const segmentIndex = seg.activeSegmentIndex;
    const activeSegment = seg.segments.get(segmentIndex);
    if (!activeSegment || activeSegment.locked) {
      this._startPoint = null;
      return;
    }

    if (this.scissorShape === 'rectangle') {
      this._fillRectangle(labelmap, this._startPoint, endPoint, segmentIndex, seg);
    } else {
      this._fillEllipse(labelmap, this._startPoint, endPoint, segmentIndex, seg);
    }

    segmentationState.triggerDataModified(segId, segmentIndex);
    this._startPoint = null;
    this.triggerRender();
  }

  private _fillRectangle(
    labelmap: LabelmapData,
    p0: Point2,
    p1: Point2,
    segmentIndex: number,
    seg: { segments: Map<number, { locked: boolean }> },
  ): void {
    const x0 = Math.round(Math.min(p0.x, p1.x));
    const y0 = Math.round(Math.min(p0.y, p1.y));
    const x1 = Math.round(Math.max(p0.x, p1.x));
    const y1 = Math.round(Math.max(p0.y, p1.y));
    const { width, height, buffer } = labelmap;

    for (let y = Math.max(0, y0); y <= Math.min(height - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(width - 1, x1); x++) {
        const existing = buffer[y * width + x];
        if (existing !== 0 && existing !== segmentIndex) {
          const existingSegment = seg.segments.get(existing);
          if (existingSegment?.locked) continue;
        }
        buffer[y * width + x] = segmentIndex;
      }
    }
  }

  private _fillEllipse(
    labelmap: LabelmapData,
    p0: Point2,
    p1: Point2,
    segmentIndex: number,
    seg: { segments: Map<number, { locked: boolean }> },
  ): void {
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    const rx = Math.abs(p1.x - p0.x) / 2;
    const ry = Math.abs(p1.y - p0.y) / 2;

    if (rx === 0 || ry === 0) return;

    const { width, height, buffer } = labelmap;
    const x0 = Math.max(0, Math.round(cx - rx));
    const y0 = Math.max(0, Math.round(cy - ry));
    const x1 = Math.min(width - 1, Math.round(cx + rx));
    const y1 = Math.min(height - 1, Math.round(cy + ry));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;

        const existing = buffer[y * width + x];
        if (existing !== 0 && existing !== segmentIndex) {
          const existingSegment = seg.segments.get(existing);
          if (existingSegment?.locked) continue;
        }
        buffer[y * width + x] = segmentIndex;
      }
    }
  }

  private _resolveSegmentationId(): string | null {
    if (this._segmentationId) return this._segmentationId;

    const allSegs = segmentationState.getAllSegmentations();
    for (const seg of allSegs) {
      if (seg.representationData[SegmentationRepresentationType.Labelmap]) {
        this._segmentationId = seg.segmentationId;
        return seg.segmentationId;
      }
    }
    return null;
  }
}
