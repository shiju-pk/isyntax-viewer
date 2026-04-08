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
      this.convertYBR(pixelData, rgba, rows, cols, format);
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
      const fmt = context.rawFormat ?? '';
      const isJPEG = fmt === 'JPEG_MONO' || fmt === 'JPEG_RGB' ||
                     fmt === 'J2K_MONO'  || fmt === 'J2K_RGB';
      // Detect actual decoded bit depth: if rawPixelData is a Uint8Array or
      // Int8Array the server already applied VOI windowing into 8-bit JPEG.
      // >8-bit data (Uint16Array from J2K lossless) still needs proper windowing.
      const raw = context.rawPixelData;
      const decoded8bit = raw instanceof Uint8Array || raw instanceof Int8Array;

      if (isJPEG && decoded8bit) {
        // 8-bit JPEG mono: identity window (server pre-windowed)
        ww = 256;
        wc = 128;
      } else {
        // >8-bit J2K lossless / iSyntax wavelet: auto-calculate from pixel range
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
    cols: number,
    format?: string
  ): void {
    const totalPixels = rows * cols;

    // Range expansion: YBRFE/YBRPE use 1/8.0; YBRF8/YBRP8 use 1.0
    // Matches C++ SignalProcessingUtilities::YBRFE_to_RGB_Band / 1.5 rgbprocessor.js
    const rangeExpansion =
      (format === 'YBRFE' || format === 'YBRPE') ? 0.125 : 1.0;

    for (let i = 0; i < totalPixels; i++) {
      const yy  = pixelData[i] * rangeExpansion;
      const ccb = pixelData[totalPixels + i] * rangeExpansion - 128.0;
      const ccr = pixelData[totalPixels * 2 + i] * rangeExpansion - 128.0;

      const r = yy + 1.4019 * ccr + 0.5;
      const g = yy - 0.7141 * ccr - 0.3441 * ccb + 0.5;
      const b = yy + 1.7718 * ccb + 0.5;

      const idx = i * 4;
      rgba[idx] = r > 255 ? 255 : r < 0 ? 0 : r | 0;
      rgba[idx + 1] = g > 255 ? 255 : g < 0 ? 0 : g | 0;
      rgba[idx + 2] = b > 255 ? 255 : b < 0 ? 0 : b | 0;
      rgba[idx + 3] = 255;
    }
  }
}
