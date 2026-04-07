import type { IRenderStage, RenderContext } from '../IRenderStage';
import { WebGLBackend } from '../../backends/WebGLBackend';

/**
 * VOILUTStage — handles only photometric inversion (MONOCHROME1 / user-toggle).
 *
 * Window/Level (VOI-LUT) is applied during pixel-data conversion in the
 * ISyntaxImageService (_convertToImageData / rewindow).  The ImageData that
 * arrives here is already display-ready (0-255).  Applying WW/WC a second
 * time would compress the gray range and cause dark images.
 *
 * The invert flag is still handled here so that MONOCHROME1 images and
 * user-requested inversion work correctly.
 */
export class VOILUTStage implements IRenderStage {
  readonly name = 'VOILUTStage';
  private _cachedOutput: ImageData | null = null;
  private _lastInvert: boolean = false;
  private _lastSrcData: Uint8ClampedArray | null = null;

  execute(context: RenderContext): void {
    // WebGL backend applies invert in the fragment shader — skip CPU stage
    if (context.backend instanceof WebGLBackend) {
      context.outputImageData = context.outputImageData ?? context.imageData;
      return;
    }

    const src = context.outputImageData ?? context.imageData;
    if (!src) return;

    const invert = context.properties.invert === true;

    if (!invert) {
      // No inversion needed — pass through
      context.outputImageData = src;
      return;
    }

    // Dirty-state check: skip full-frame pass if nothing changed
    if (
      this._cachedOutput &&
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

    for (let i = 0; i < len; i += 4) {
      outData[i] = 255 - srcData[i];
      outData[i + 1] = 255 - srcData[i + 1];
      outData[i + 2] = 255 - srcData[i + 2];
      outData[i + 3] = srcData[i + 3]; // preserve alpha
    }

    // Update dirty-state tracking
    this._lastInvert = invert;
    this._lastSrcData = srcData;

    context.outputImageData = out;
  }
}
