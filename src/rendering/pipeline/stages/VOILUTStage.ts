import type { IRenderStage, RenderContext } from '../IRenderStage';

export class VOILUTStage implements IRenderStage {
  readonly name = 'VOILUTStage';

  execute(context: RenderContext): void {
    const src = context.outputImageData ?? context.imageData;
    if (!src) return;

    const wc = context.properties.windowCenter;
    const ww = context.properties.windowWidth;

    if (wc === undefined || ww === undefined) {
      // No VOI transform needed
      context.outputImageData = src;
      return;
    }

    const lower = wc - ww / 2;
    const upper = wc + ww / 2;
    const range = upper - lower;

    if (range <= 0) {
      context.outputImageData = src;
      return;
    }

    const srcData = src.data;
    const len = srcData.length;
    const out = new ImageData(src.width, src.height);
    const outData = out.data;

    const invert = context.properties.invert === true;

    for (let i = 0; i < len; i += 4) {
      // Apply W/L to each RGB channel
      let r = ((srcData[i] - lower) / range) * 255;
      let g = ((srcData[i + 1] - lower) / range) * 255;
      let b = ((srcData[i + 2] - lower) / range) * 255;

      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));

      if (invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      outData[i] = r;
      outData[i + 1] = g;
      outData[i + 2] = b;
      outData[i + 3] = srcData[i + 3]; // preserve alpha
    }

    context.outputImageData = out;
  }
}
