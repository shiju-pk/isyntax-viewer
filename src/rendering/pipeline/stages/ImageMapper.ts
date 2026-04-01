import type { IRenderStage, RenderContext } from '../IRenderStage';

export class ImageMapper implements IRenderStage {
  readonly name = 'ImageMapper';

  execute(context: RenderContext): void {
    // Raw pixel data path: convert raw formats to RGBA ImageData
    if (context.rawPixelData && context.rawFormat && context.rawRows && context.rawCols) {
      context.outputImageData = this.convertRawToImageData(context);
      return;
    }

    // Pre-converted RGBA pass-through
    if (!context.imageData) return;
    context.outputImageData = context.imageData;
  }

  private convertRawToImageData(context: RenderContext): ImageData {
    const pixelData = context.rawPixelData!;
    const rows = context.rawRows!;
    const cols = context.rawCols!;
    const planes = context.rawPlanes ?? 1;
    const format = context.rawFormat!;

    const imageData = new ImageData(cols, rows);
    const rgba = imageData.data;

    if (planes === 1 || format === 'MONO') {
      this.convertMono(pixelData, rgba, rows, cols, context);
    } else {
      this.convertYBR(pixelData, rgba, rows, cols);
    }

    return imageData;
  }

  private convertMono(
    pixelData: ArrayLike<number>,
    rgba: Uint8ClampedArray,
    rows: number,
    cols: number,
    context: RenderContext
  ): void {
    const totalPixels = rows * cols;
    const slope = context.rawRescaleSlope ?? 1;
    const intercept = context.rawRescaleIntercept ?? 0;

    // Determine window/level from properties or auto-calculate
    let ww = context.properties.windowWidth;
    let wc = context.properties.windowCenter;

    if (ww == null || wc == null) {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < totalPixels; i++) {
        const v = pixelData[i] * slope + intercept;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ww = max - min || 1;
      wc = (max + min) / 2;
    }

    const lower = wc - ww / 2;
    const range = ww || 1;

    for (let i = 0; i < totalPixels; i++) {
      const modalityValue = pixelData[i] * slope + intercept;
      const normalized = ((modalityValue - lower) / range) * 255;
      const val = Math.max(0, Math.min(255, normalized)) | 0;
      const idx = i * 4;
      rgba[idx] = val;
      rgba[idx + 1] = val;
      rgba[idx + 2] = val;
      rgba[idx + 3] = 255;
    }
  }

  private convertYBR(
    pixelData: ArrayLike<number>,
    rgba: Uint8ClampedArray,
    rows: number,
    cols: number
  ): void {
    const totalPixels = rows * cols;
    const yOffset = 0;
    const cbOffset = totalPixels;
    const crOffset = totalPixels * 2;

    for (let i = 0; i < totalPixels; i++) {
      const y = pixelData[yOffset + i];
      const cb = pixelData[cbOffset + i];
      const cr = pixelData[crOffset + i];

      // ITU-R BT.601 YCbCr → RGB
      const r = y + 1.402 * cr;
      const g = y - 0.344136 * cb - 0.714136 * cr;
      const b = y + 1.772 * cb;

      const idx = i * 4;
      rgba[idx] = Math.max(0, Math.min(255, r)) | 0;
      rgba[idx + 1] = Math.max(0, Math.min(255, g)) | 0;
      rgba[idx + 2] = Math.max(0, Math.min(255, b)) | 0;
      rgba[idx + 3] = 255;
    }
  }
}
