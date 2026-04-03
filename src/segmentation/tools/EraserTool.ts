/**
 * EraserTool — erases labelmap data by painting segment index 0 (background).
 *
 * Extends BrushTool but always paints with value 0.
 */

import { BrushTool } from './BrushTool';
import { segmentationState } from '../SegmentationState';
import { SegmentationRepresentationType } from '../types';

export class EraserTool extends BrushTool {
  static override toolName = 'Eraser';

  override get cursor(): string {
    return 'crosshair';
  }

  protected override _paint(worldX: number, worldY: number, segmentationId: string): void {
    const seg = segmentationState.getSegmentation(segmentationId);
    if (!seg) return;

    const labelmap = seg.representationData[SegmentationRepresentationType.Labelmap];
    if (!labelmap) return;

    const { radius, shape } = this.brushConfig;
    const cx = Math.round(worldX);
    const cy = Math.round(worldY);

    // Paint with 0 = background (erase)
    this._paintRegion(labelmap, cx, cy, radius, shape, 0);
  }
}
