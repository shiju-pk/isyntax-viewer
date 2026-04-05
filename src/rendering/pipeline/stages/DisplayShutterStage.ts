/**
 * DisplayShutterStage — Applies GSPS display shutters (rectangular, circular,
 * polygonal) to the rendered image within the pipeline.
 *
 * Pixels outside the shutter region are replaced with the shutter
 * presentation value (default black). Sits after OverlayCompositorStage
 * and before CompositorStage.
 */

import type { IRenderStage, RenderContext } from '../IRenderStage';
import type { GSPSDisplayShutter } from '../../../gsps-engine/types';

export class DisplayShutterStage implements IRenderStage {
  readonly name = 'DisplayShutterStage';

  private _shutters: GSPSDisplayShutter[] = [];
  private _enabled = false;

  setShutters(shutters: GSPSDisplayShutter[]): void {
    this._shutters = shutters;
    this._enabled = shutters.length > 0;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  execute(context: RenderContext): void {
    if (!this._enabled || this._shutters.length === 0) return;

    const imgData = context.outputImageData;
    if (!imgData) return;

    // Clone the output buffer if shared with source
    if (context.imageData && imgData.data.buffer === context.imageData.data.buffer) {
      context.outputImageData = new ImageData(
        new Uint8ClampedArray(imgData.data),
        imgData.width,
        imgData.height,
      );
    }

    const target = context.outputImageData!;
    const { width, height, data } = target;

    // Build a mask: true = pixel is visible (inside ALL shutters)
    // Shutters are intersected — pixel must be inside all shutter shapes
    const mask = new Uint8Array(width * height);
    mask.fill(1); // start all visible

    for (const shutter of this._shutters) {
      switch (shutter.shape) {
        case 'RECTANGULAR':
          this._applyRectangularMask(mask, width, height, shutter);
          break;
        case 'CIRCULAR':
          this._applyCircularMask(mask, width, height, shutter);
          break;
        case 'POLYGONAL':
          this._applyPolygonalMask(mask, width, height, shutter);
          break;
      }
    }

    // Apply mask: pixels outside the shutter become the presentation value
    const pv = this._shutters[0].shutterPresentationValue ?? 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 0) {
        const idx = i << 2;
        data[idx] = pv;
        data[idx + 1] = pv;
        data[idx + 2] = pv;
        // keep alpha = 255
      }
    }
  }

  private _applyRectangularMask(
    mask: Uint8Array,
    width: number,
    height: number,
    shutter: GSPSDisplayShutter,
  ): void {
    if (!shutter.rectangularVertices) return;
    // Vertices: [top, left, bottom, right] (1-based DICOM coordinates)
    const [top, left, bottom, right] = shutter.rectangularVertices;
    const t = Math.max(0, top - 1);
    const l = Math.max(0, left - 1);
    const b = Math.min(height - 1, bottom - 1);
    const r = Math.min(width - 1, right - 1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y < t || y > b || x < l || x > r) {
          mask[y * width + x] = 0;
        }
      }
    }
  }

  private _applyCircularMask(
    mask: Uint8Array,
    width: number,
    height: number,
    shutter: GSPSDisplayShutter,
  ): void {
    if (!shutter.circularCenter || shutter.circularRadius == null) return;
    const [cy, cx] = shutter.circularCenter; // [row, col]
    const r = shutter.circularRadius;
    const r2 = r * r;

    for (let y = 0; y < height; y++) {
      const dy = y - (cy - 1);
      const dy2 = dy * dy;
      for (let x = 0; x < width; x++) {
        const dx = x - (cx - 1);
        if (dx * dx + dy2 > r2) {
          mask[y * width + x] = 0;
        }
      }
    }
  }

  private _applyPolygonalMask(
    mask: Uint8Array,
    width: number,
    height: number,
    shutter: GSPSDisplayShutter,
  ): void {
    if (!shutter.polygonalVertices || shutter.polygonalVertices.length < 6) return;
    const verts = shutter.polygonalVertices;
    const n = verts.length / 2;

    // Build [x, y] pairs (converting from [row, col] DICOM to [x, y])
    const polyX: number[] = [];
    const polyY: number[] = [];
    for (let i = 0; i < n; i++) {
      polyY.push(verts[i * 2] - 1);     // row → y
      polyX.push(verts[i * 2 + 1] - 1); // col → x
    }

    // Ray casting point-in-polygon for each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!this._pointInPolygon(x, y, polyX, polyY, n)) {
          mask[y * width + x] = 0;
        }
      }
    }
  }

  private _pointInPolygon(
    x: number,
    y: number,
    polyX: number[],
    polyY: number[],
    n: number,
  ): boolean {
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      if (
        (polyY[i] > y) !== (polyY[j] > y) &&
        x < ((polyX[j] - polyX[i]) * (y - polyY[i])) / (polyY[j] - polyY[i]) + polyX[i]
      ) {
        inside = !inside;
      }
    }
    return inside;
  }
}
