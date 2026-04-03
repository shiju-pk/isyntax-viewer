/**
 * BrushTool — circular or square brush for painting segments on a labelmap.
 *
 * On mouseDown + drag, paints the active segment index into the labelmap
 * at world coordinates, respecting brush radius and shape.
 *
 * Configuration:
 *   - radius: brush radius in world-space pixels (default 10)
 *   - shape: 'circle' | 'square' (default 'circle')
 *   - segmentationId: which segmentation to paint on
 */

import { BaseTool } from '../../tools/base/BaseTool';
import type { NormalizedPointerEvent } from '../../tools/base/types';
import { segmentationState } from '../SegmentationState';
import { SegmentationRepresentationType, SegmentationEvents, DEFAULT_BRUSH_CONFIG } from '../types';
import type { BrushConfiguration, LabelmapData } from '../types';
import { eventBus } from '../../rendering/events/EventBus';

export class BrushTool extends BaseTool {
  static override toolName = 'Brush';

  private _segmentationId: string | null = null;
  private _isPainting = false;

  override get cursor(): string {
    return 'crosshair';
  }

  get brushConfig(): BrushConfiguration {
    return {
      radius: (this.configuration.radius as number) ?? DEFAULT_BRUSH_CONFIG.radius,
      shape: (this.configuration.shape as 'circle' | 'square') ?? DEFAULT_BRUSH_CONFIG.shape,
    };
  }

  set segmentationId(id: string | null) {
    this._segmentationId = id;
  }

  get segmentationId(): string | null {
    return this._segmentationId;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    const segId = this._resolveSegmentationId();
    if (!segId) return;

    this._isPainting = true;
    this._paint(evt.worldPoint.x, evt.worldPoint.y, segId);
    this.viewportRef?.viewport.render();
  }

  override mouseDragCallback(evt: NormalizedPointerEvent): void {
    if (!this._isPainting) return;

    const segId = this._resolveSegmentationId();
    if (!segId) return;

    this._paint(evt.worldPoint.x, evt.worldPoint.y, segId);
    this.viewportRef?.viewport.render();
  }

  override mouseUpCallback(_evt: NormalizedPointerEvent): void {
    if (!this._isPainting) return;
    this._isPainting = false;

    const segId = this._resolveSegmentationId();
    if (segId) {
      const seg = segmentationState.getSegmentation(segId);
      segmentationState.triggerDataModified(segId, seg?.activeSegmentIndex);
    }
  }

  protected _paint(worldX: number, worldY: number, segmentationId: string): void {
    const seg = segmentationState.getSegmentation(segmentationId);
    if (!seg) return;

    const labelmap = seg.representationData[SegmentationRepresentationType.Labelmap];
    if (!labelmap) return;

    const segmentIndex = seg.activeSegmentIndex;
    const activeSegment = seg.segments.get(segmentIndex);
    if (!activeSegment || activeSegment.locked) return;

    const { radius, shape } = this.brushConfig;
    const cx = Math.round(worldX);
    const cy = Math.round(worldY);

    this._paintRegion(labelmap, cx, cy, radius, shape, segmentIndex);
  }

  protected _paintRegion(
    labelmap: LabelmapData,
    cx: number,
    cy: number,
    radius: number,
    shape: 'circle' | 'square',
    value: number,
  ): void {
    const r = Math.round(radius);
    const { width, height, buffer } = labelmap;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (shape === 'circle') {
          if (dx * dx + dy * dy > r * r) continue;
        }

        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;

        // Check if the target pixel's segment is locked
        const existingSegIdx = buffer[py * width + px];
        if (existingSegIdx !== 0) {
          const existingSeg = segmentationState.getSegmentation(this._resolveSegmentationId()!);
          if (existingSeg) {
            const existingSegment = existingSeg.segments.get(existingSegIdx);
            if (existingSegment?.locked) continue;
          }
        }

        buffer[py * width + px] = value;
      }
    }
  }

  private _resolveSegmentationId(): string | null {
    if (this._segmentationId) return this._segmentationId;

    // Auto-resolve: find the first labelmap segmentation
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
