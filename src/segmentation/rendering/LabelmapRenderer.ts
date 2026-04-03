/**
 * LabelmapRenderer — renders labelmap segmentation overlay onto the viewport canvas.
 *
 * Converts the Uint8Array labelmap buffer into a colored RGBA ImageData,
 * then composites it on top of the image using globalAlpha blending.
 *
 * Features:
 *   - Per-segment colors from ColorLUT
 *   - Per-segment visibility
 *   - Fill + outline rendering
 *   - Configurable opacity
 */

import type { IViewport } from '../../rendering/viewports/types';
import { segmentationState } from '../SegmentationState';
import { getSegmentColor } from '../ColorLUT';
import {
  SegmentationRepresentationType,
  type LabelmapData,
  type SegmentationDisplayConfig,
  type SegmentationRepresentation,
} from '../types';

export class LabelmapRenderer {
  private _offscreenCanvas: OffscreenCanvas | null = null;
  private _offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private _overlayImageData: ImageData | null = null;

  /**
   * Render all labelmap representations for a viewport.
   */
  render(viewport: IViewport): void {
    const reps = segmentationState.getViewportRepresentations(viewport.id);
    const labelmapReps = reps.filter(
      r => r.type === SegmentationRepresentationType.Labelmap && r.visible,
    );

    if (labelmapReps.length === 0) return;

    const canvas = viewport.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (const rep of labelmapReps) {
      this._renderSingleLabelmap(viewport, ctx, rep);
    }
  }

  private _renderSingleLabelmap(
    viewport: IViewport,
    ctx: CanvasRenderingContext2D,
    rep: SegmentationRepresentation,
  ): void {
    const seg = segmentationState.getSegmentation(rep.segmentationId);
    if (!seg) return;

    const labelmap = seg.representationData[SegmentationRepresentationType.Labelmap];
    if (!labelmap) return;

    const { width, height, buffer } = labelmap;
    const config = rep.config;

    // Ensure offscreen canvas matches labelmap dimensions
    this._ensureOffscreen(width, height);
    if (!this._offscreenCtx || !this._overlayImageData) return;

    const overlayData = this._overlayImageData.data;

    // Clear overlay
    overlayData.fill(0);

    // Paint fill
    if (config.fillEnabled) {
      for (let i = 0; i < buffer.length; i++) {
        const segIdx = buffer[i];
        if (segIdx === 0) continue; // background

        const segment = seg.segments.get(segIdx);
        if (!segment || !segment.visible) continue;

        const color = getSegmentColor(rep.colorLUTIndex, segIdx);
        const px = i * 4;
        overlayData[px] = color[0];
        overlayData[px + 1] = color[1];
        overlayData[px + 2] = color[2];
        overlayData[px + 3] = Math.round(color[3] * config.fillAlpha);
      }
    }

    // Paint outlines (edge detection on label boundaries)
    if (config.outlineEnabled) {
      this._paintOutlines(buffer, overlayData, width, height, seg, rep, config);
    }

    // Put overlay onto offscreen canvas
    this._offscreenCtx.putImageData(this._overlayImageData, 0, 0);

    // Composite onto viewport canvas using camera transform
    const camera = viewport.getCamera();
    const imageData = viewport.getImageData();
    if (!imageData) return;

    const transform = camera.computeTransform(
      ctx.canvas.width,
      ctx.canvas.height,
      imageData.width,
      imageData.height,
    );

    ctx.save();
    ctx.globalAlpha = 1.0; // Alpha already baked into pixels
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(Math.abs(transform.scaleX), Math.abs(transform.scaleY));
    ctx.drawImage(this._offscreenCanvas!, 0, 0);
    ctx.restore();
  }

  private _paintOutlines(
    buffer: Uint8Array,
    overlayData: Uint8ClampedArray,
    width: number,
    height: number,
    seg: { segments: Map<number, { visible: boolean }> },
    rep: SegmentationRepresentation,
    config: SegmentationDisplayConfig,
  ): void {
    const ow = config.outlineWidth;
    const outlineAlpha = Math.round(255 * config.outlineAlpha);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const segIdx = buffer[idx];
        if (segIdx === 0) continue;

        const segment = seg.segments.get(segIdx);
        if (!segment || !segment.visible) continue;

        // Check if this pixel is on a boundary
        if (this._isBoundary(buffer, x, y, width, height, segIdx)) {
          const color = getSegmentColor(rep.colorLUTIndex, segIdx);

          // Paint outline with configurable width
          for (let dy = -ow; dy <= ow; dy++) {
            for (let dx = -ow; dx <= ow; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const nIdx = (ny * width + nx) * 4;
              // Only overwrite if this makes the pixel more opaque
              if (overlayData[nIdx + 3] < outlineAlpha) {
                overlayData[nIdx] = color[0];
                overlayData[nIdx + 1] = color[1];
                overlayData[nIdx + 2] = color[2];
                overlayData[nIdx + 3] = outlineAlpha;
              }
            }
          }
        }
      }
    }
  }

  private _isBoundary(
    buffer: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number,
    segIdx: number,
  ): boolean {
    // 4-connected neighbors
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true; // edge of image
      if (buffer[ny * width + nx] !== segIdx) return true;
    }
    return false;
  }

  private _ensureOffscreen(width: number, height: number): void {
    if (
      !this._offscreenCanvas ||
      this._offscreenCanvas.width !== width ||
      this._offscreenCanvas.height !== height
    ) {
      this._offscreenCanvas = new OffscreenCanvas(width, height);
      this._offscreenCtx = this._offscreenCanvas.getContext('2d');
      this._overlayImageData = new ImageData(width, height);
    }
  }

  dispose(): void {
    this._offscreenCanvas = null;
    this._offscreenCtx = null;
    this._overlayImageData = null;
  }
}
