/**
 * OverlayCompositorStage — Composites DICOM 6000 overlay data on top of
 * the base image within the render pipeline.
 *
 * Sits between the ColorMapStage and CompositorStage so that overlays
 * are composited into the outputImageData before final display.
 *
 * Per ADR-001: overlays are rendered as a separate stage, allowing
 * independent toggle of visibility and per-plane color control without
 * re-rendering the base image.
 */

import type { IRenderStage, RenderContext } from '../IRenderStage';
import type { OverlayGroup, OverlayRenderOptions } from '../../../overlay-engine/types';
import { renderOverlays } from '../../../overlay-engine/OverlayRenderer';

export class OverlayCompositorStage implements IRenderStage {
  readonly name = 'OverlayCompositorStage';

  private _overlayGroup: OverlayGroup | null = null;
  private _options: Partial<OverlayRenderOptions> = {};
  private _enabled = true;

  /** Set the overlay group to render. Call when image changes. */
  setOverlayGroup(group: OverlayGroup | null): void {
    this._overlayGroup = group;
  }

  /** Set partial render options (visibility overrides, colors, frame info). */
  setOptions(options: Partial<OverlayRenderOptions>): void {
    this._options = options;
  }

  /** Enable/disable overlay rendering without removing the stage. */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  execute(context: RenderContext): void {
    if (!this._enabled) return;
    if (!this._overlayGroup || !this._overlayGroup.visible) return;

    const imgData = context.outputImageData;
    if (!imgData) return;

    // Build full render options from context and stored partial options
    const options: OverlayRenderOptions = {
      imageWidth: imgData.width,
      imageHeight: imgData.height,
      pixelLevel: this._options.pixelLevel ?? 0,
      currentFrame: this._options.currentFrame ?? 1,
      isMultiFrame: this._options.isMultiFrame ?? false,
      planeVisibility: this._options.planeVisibility,
      planeColors: this._options.planeColors,
    };

    const result = renderOverlays(this._overlayGroup, options);

    if (result.renderedPlanes.length === 0) return;

    // Composite overlay RGBA onto the output image data
    // Only overwrite pixels where the overlay alpha > 0
    const dst = imgData.data;
    const src = result.imageData.data;
    const len = Math.min(dst.length, src.length);

    for (let i = 0; i < len; i += 4) {
      const alpha = src[i + 3];
      if (alpha > 0) {
        dst[i] = src[i];       // R
        dst[i + 1] = src[i + 1]; // G
        dst[i + 2] = src[i + 2]; // B
        dst[i + 3] = 255;       // A
      }
    }
  }
}
