/**
 * FloodFillTool — fills connected regions of the same value with the active segment.
 *
 * On click, performs a scanline flood fill from the clicked pixel,
 * filling all connected pixels that share the same original value
 * (or are within the optional tolerance range).
 *
 * Configuration:
 *   - tolerance: pixel-value tolerance for connectivity (default 0 = exact match)
 */

import { BaseTool } from '../../tools/base/BaseTool';
import type { NormalizedPointerEvent } from '../../tools/base/types';
import { segmentationState } from '../SegmentationState';
import { SegmentationRepresentationType } from '../types';
import type { LabelmapData } from '../types';

export class FloodFillTool extends BaseTool {
  static override toolName = 'FloodFill';

  private _segmentationId: string | null = null;

  override get cursor(): string {
    return 'crosshair';
  }

  get tolerance(): number {
    return (this.configuration.tolerance as number) ?? 0;
  }

  set segmentationId(id: string | null) {
    this._segmentationId = id;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    const segId = this._resolveSegmentationId();
    if (!segId) return;

    const seg = segmentationState.getSegmentation(segId);
    if (!seg) return;

    const labelmap = seg.representationData[SegmentationRepresentationType.Labelmap];
    if (!labelmap) return;

    const segmentIndex = seg.activeSegmentIndex;
    const activeSegment = seg.segments.get(segmentIndex);
    if (!activeSegment || activeSegment.locked) return;

    const x = Math.round(evt.worldPoint.x);
    const y = Math.round(evt.worldPoint.y);
    const { width, height, buffer } = labelmap;

    if (x < 0 || y < 0 || x >= width || y >= height) return;

    const targetValue = buffer[y * width + x];

    // Don't fill if already the target segment
    if (targetValue === segmentIndex) return;

    this._floodFill(labelmap, x, y, targetValue, segmentIndex, seg);

    segmentationState.triggerDataModified(segId, segmentIndex);
    this.triggerRender();
  }

  // Drag/up are no-ops for flood fill
  override mouseDragCallback(_evt: NormalizedPointerEvent): void { }
  override mouseUpCallback(_evt: NormalizedPointerEvent): void { }

  /**
   * Scanline flood fill algorithm.
   * More efficient than recursive pixel-by-pixel for large regions.
   */
  private _floodFill(
    labelmap: LabelmapData,
    startX: number,
    startY: number,
    targetValue: number,
    fillValue: number,
    seg: { segments: Map<number, { locked: boolean }> },
  ): void {
    const { width, height, buffer } = labelmap;
    const tolerance = this.tolerance;

    const matches = (val: number): boolean => {
      return Math.abs(val - targetValue) <= tolerance;
    };

    // Stack-based scanline fill
    const stack: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (visited[idx]) continue;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;

      const val = buffer[idx];
      if (!matches(val)) continue;

      // Check if existing segment is locked
      if (val !== 0 && val !== fillValue) {
        const existingSegment = seg.segments.get(val);
        if (existingSegment?.locked) continue;
      }

      // Scan left
      let left = x;
      while (left > 0 && matches(buffer[y * width + (left - 1)]) && !visited[y * width + (left - 1)]) {
        left--;
      }

      // Scan right
      let right = x;
      while (right < width - 1 && matches(buffer[y * width + (right + 1)]) && !visited[y * width + (right + 1)]) {
        right++;
      }

      // Fill the scanline
      for (let px = left; px <= right; px++) {
        const pIdx = y * width + px;
        buffer[pIdx] = fillValue;
        visited[pIdx] = 1;

        // Add pixels above and below to stack
        if (y > 0 && !visited[(y - 1) * width + px]) {
          stack.push([px, y - 1]);
        }
        if (y < height - 1 && !visited[(y + 1) * width + px]) {
          stack.push([px, y + 1]);
        }
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
