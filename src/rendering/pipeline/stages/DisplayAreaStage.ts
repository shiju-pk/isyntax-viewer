/**
 * DisplayAreaStage — Applies GSPS Displayed Area Selection to the image.
 *
 * If a GSPS specifies a DisplayedAreaSelectionSequence, this stage crops
 * the output image to show only the specified region. Sits before the
 * CompositorStage in the pipeline.
 */

import type { IRenderStage, RenderContext } from '../IRenderStage';

export interface DisplayArea {
  /** Top-left corner [column, row] (1-based DICOM coordinates). */
  topLeft: [number, number];
  /** Bottom-right corner [column, row] (1-based DICOM coordinates). */
  bottomRight: [number, number];
  /** Presentation size mode. */
  presentationSizeMode?: 'SCALE TO FIT' | 'TRUE SIZE' | 'MAGNIFY';
  /** Presentation pixel spacing [row, col] in mm. */
  presentationPixelSpacing?: [number, number];
}

export class DisplayAreaStage implements IRenderStage {
  readonly name = 'DisplayAreaStage';

  private _area: DisplayArea | null = null;
  private _enabled = false;

  setDisplayArea(area: DisplayArea | null): void {
    this._area = area;
    this._enabled = area !== null;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  execute(context: RenderContext): void {
    if (!this._enabled || !this._area) return;

    const imgData = context.outputImageData;
    if (!imgData) return;

    const { topLeft, bottomRight } = this._area;

    // Convert from 1-based DICOM to 0-based pixel coordinates
    const x1 = Math.max(0, topLeft[0] - 1);
    const y1 = Math.max(0, topLeft[1] - 1);
    const x2 = Math.min(imgData.width, bottomRight[0]);
    const y2 = Math.min(imgData.height, bottomRight[1]);

    const cropWidth = x2 - x1;
    const cropHeight = y2 - y1;

    if (cropWidth <= 0 || cropHeight <= 0) return;
    if (cropWidth === imgData.width && cropHeight === imgData.height) return;

    // Extract the cropped region
    const cropped = new ImageData(cropWidth, cropHeight);
    const src = imgData.data;
    const dst = cropped.data;

    for (let row = 0; row < cropHeight; row++) {
      const srcOffset = ((y1 + row) * imgData.width + x1) * 4;
      const dstOffset = row * cropWidth * 4;
      dst.set(src.subarray(srcOffset, srcOffset + cropWidth * 4), dstOffset);
    }

    context.outputImageData = cropped;
  }
}
