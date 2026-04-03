/**
 * ThresholdBrushTool — brush that only paints where the underlying image pixel
 * value falls within a configurable threshold range.
 *
 * Configuration:
 *   - radius, shape (from BrushTool)
 *   - thresholdLower: minimum pixel value to paint (default 0)
 *   - thresholdUpper: maximum pixel value to paint (default 255)
 */

import { BrushTool } from './BrushTool';
import { segmentationState } from '../SegmentationState';
import { SegmentationRepresentationType } from '../types';
import type { LabelmapData } from '../types';

export class ThresholdBrushTool extends BrushTool {
  static override toolName = 'ThresholdBrush';

  get thresholdLower(): number {
    return (this.configuration.thresholdLower as number) ?? 0;
  }

  get thresholdUpper(): number {
    return (this.configuration.thresholdUpper as number) ?? 255;
  }

  protected override _paint(worldX: number, worldY: number, segmentationId: string): void {
    const seg = segmentationState.getSegmentation(segmentationId);
    if (!seg) return;

    const labelmap = seg.representationData[SegmentationRepresentationType.Labelmap];
    if (!labelmap) return;

    const segmentIndex = seg.activeSegmentIndex;
    const activeSegment = seg.segments.get(segmentIndex);
    if (!activeSegment || activeSegment.locked) return;

    // Need image data for threshold comparison
    const imageData = this.viewportRef?.viewport.getImageData();
    if (!imageData) return;

    const { radius, shape } = this.brushConfig;
    const cx = Math.round(worldX);
    const cy = Math.round(worldY);
    const r = Math.round(radius);
    const { width, height, buffer } = labelmap;
    const lower = this.thresholdLower;
    const upper = this.thresholdUpper;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (shape === 'circle' && dx * dx + dy * dy > r * r) continue;

        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;

        // Check threshold against source image
        const imgIdx = (py * imageData.width + px) * 4;
        const luminance = Math.round(
          (imageData.data[imgIdx] + imageData.data[imgIdx + 1] + imageData.data[imgIdx + 2]) / 3,
        );

        if (luminance < lower || luminance > upper) continue;

        // Check if existing segment is locked
        const existingSegIdx = buffer[py * width + px];
        if (existingSegIdx !== 0 && existingSegIdx !== segmentIndex) {
          const existingSegment = seg.segments.get(existingSegIdx);
          if (existingSegment?.locked) continue;
        }

        buffer[py * width + px] = segmentIndex;
      }
    }
  }
}
