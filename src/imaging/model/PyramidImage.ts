import { ZoomLevelView } from './ZoomLevelView';
import { ImageHelper } from './ImageHelper';
import type { IImageFrame, ImageArray } from '../../core/types';
class PyramidImage {
  private _zoomLevelViews: (ZoomLevelView | null)[];
  lowestPixelLevel: number;
  bytesPerPixel: number;
  stickyPixelLevel: number;
  planes: number;
  type: string;
  imageFrame: IImageFrame;
  constructor(imageFrame: IImageFrame) {
    this.imageFrame = imageFrame;
    this._zoomLevelViews = [];
    this.lowestPixelLevel = this.findFloorLevel(128);
    this.bytesPerPixel = 2;
    this.stickyPixelLevel = 0;
    this.planes = 1;
    this.type = 'I';
  }
  private static _createZoomLevelView(
    pyramidImage: PyramidImage,
    pixelLevel: number
  ): ZoomLevelView {
    const levelDimension = pyramidImage.findDimension(pixelLevel);
    const zlv = new ZoomLevelView(
      pixelLevel,
      levelDimension[0],
      levelDimension[1],
      pyramidImage.bytesPerPixel,
      pyramidImage.planes
    );
    pyramidImage._zoomLevelViews[pixelLevel] = zlv;
    return zlv;
  }

  findDimension(level: number): [number, number] {
    const imageHeight = this.imageFrame.rows;
    const imageWidth = this.imageFrame.columns;
    return ImageHelper.findDimension(level, imageWidth, imageHeight);
  }
  getZoomLevelView(pixelLevel: number): ZoomLevelView | undefined {
    return this._zoomLevelViews[pixelLevel] ?? undefined;
  }

  hasZoomLevelView(pixelLevel: number): boolean {
    return !!this._zoomLevelViews[pixelLevel];
  }

  createZoomLevelView(pixelLevel: number): ZoomLevelView {
    return PyramidImage._createZoomLevelView(this, pixelLevel);
  }
  findFloorLevel(dimension: number): number {
    const imageHeight = this.imageFrame.rows;
    const imageWidth = this.imageFrame.columns;
    return ImageHelper.findFloorLevel(dimension, imageWidth, imageHeight);
  }
  findCeilingLevel(size: { height: number; width: number }): number {
    let level = -1;
    const height = size.height;
    const width = size.width;

    if (height < 128 || width < 128) {
      return this.lowestPixelLevel;
    }

    for (level = this.lowestPixelLevel; level; --level) {
      const levelDim = this.findDimension(level);
      if (levelDim[0] >= height || levelDim[1] >= width) {
        break;
      }
    }
    return level;
  }
  getBestZoomLevelViewAvailable(): ZoomLevelView | undefined {
    let bestZLV: ZoomLevelView | undefined;
    const lowestPixelLevel = this.lowestPixelLevel;
    const zoomLevelViews = this._zoomLevelViews;

    for (let index = 0; index <= lowestPixelLevel; ++index) {
      const zlv = zoomLevelViews[index];
      if (zlv) {
        bestZLV = zlv;
        break;
      }
    }
    return bestZLV;
  }

  getBestPixelLevelAvailable(): number {
    const bestZLV = this.getBestZoomLevelViewAvailable();
    if (bestZLV) {
      return bestZLV.pixelLevel;
    }
    return -1;
  }

  getCurrentSize(): number {
    let totalSize1 = 0;
    try {
      const zoomLevelViews = this._zoomLevelViews;
      if (zoomLevelViews) {
        zoomLevelViews.forEach((zlv) => {
          if (zlv) {
            totalSize1 += zlv.getSize();
          }
        });
      }
    } catch (e: unknown) {
      console.log(String(e));
    }
    return totalSize1;
  }
  onFullLevelLLAvailable(
    lowCoefficients: ImageArray,
    pixelLevel: number
  ): void {
    const zlv = this.getZoomLevelView(pixelLevel);
    if (zlv) {
      zlv.setFullLevelLL(lowCoefficients);
      const lowerLevelZLV = this.getZoomLevelView(pixelLevel + 1);
      if (lowerLevelZLV) {
        lowerLevelZLV.removeFullLevelCoefficients();
      }
      this._reduceMemoryFootPrint();
    }
  }

  protected _reduceMemoryFootPrint(): void {
    const bestZLV = this.getBestZoomLevelViewAvailable();
    if (!bestZLV) return;
    const bestPixelLevel = bestZLV.pixelLevel;
    const zoomLevelViews = this._zoomLevelViews;
    const numberOfZLV = zoomLevelViews.length;
    const indexToRemoveFrom = bestPixelLevel + 1;

    for (let index = indexToRemoveFrom; index < numberOfZLV; ++index) {
      if (index !== this.stickyPixelLevel) {
        const zlv = zoomLevelViews[index];
        if (zlv) {
          zlv.dispose();
          zoomLevelViews[index] = null;
        }
      }
    }
  }
  dispose(): void {
    const zoomLevelViews = this._zoomLevelViews;
    if (zoomLevelViews) {
      zoomLevelViews.forEach((zlv) => {
        if (zlv) {
          zlv.dispose();
        }
      });
      this._zoomLevelViews = [];
    }
  }
}
export { PyramidImage };
