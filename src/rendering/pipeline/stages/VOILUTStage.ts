import type { IRenderStage, RenderContext } from '../IRenderStage';
import { WebGLBackend } from '../../backends/WebGLBackend';

export class VOILUTStage implements IRenderStage {
  readonly name = 'VOILUTStage';
  private _cachedOutput: ImageData | null = null;
  private _lastWC: number | undefined = undefined;
  private _lastWW: number | undefined = undefined;
  private _lastInvert: boolean = false;
  private _lastSrcData: Uint8ClampedArray | null = null;

  execute(context: RenderContext): void {
    // WebGL backend applies VOI in the fragment shader — skip CPU stage
    if (context.backend instanceof WebGLBackend) {
      context.outputImageData = context.outputImageData ?? context.imageData;
      return;
    }

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

    const invert = context.properties.invert === true;

    // Dirty-state check: skip full-frame pass if nothing changed
    if (
      this._cachedOutput &&
      this._lastWC === wc &&
      this._lastWW === ww &&
      this._lastInvert === invert &&
      this._lastSrcData === src.data &&
      this._cachedOutput.width === src.width &&
      this._cachedOutput.height === src.height
    ) {
      context.outputImageData = this._cachedOutput;
      return;
    }

    const srcData = src.data;
    const len = srcData.length;
    if (!this._cachedOutput || this._cachedOutput.width !== src.width || this._cachedOutput.height !== src.height) {
      this._cachedOutput = new ImageData(src.width, src.height);
    }
    const out = this._cachedOutput;
    const outData = out.data;

    // Precompute multiplier to replace per-pixel division
    const scale = 255 / range;

    for (let i = 0; i < len; i += 4) {
      let r = (srcData[i] - lower) * scale;
      let g = (srcData[i + 1] - lower) * scale;
      let b = (srcData[i + 2] - lower) * scale;

      r = r > 255 ? 255 : r < 0 ? 0 : r;
      g = g > 255 ? 255 : g < 0 ? 0 : g;
      b = b > 255 ? 255 : b < 0 ? 0 : b;

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

    // Update dirty-state tracking
    this._lastWC = wc;
    this._lastWW = ww;
    this._lastInvert = invert;
    this._lastSrcData = srcData;

    context.outputImageData = out;
  }
}
