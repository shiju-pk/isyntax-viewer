import type { IImageFrame } from './types';
import type { InitImageResponse } from './initImageResponse';
import { PyramidImage } from './pyramidImage';
import { CodecConstants } from './codecConstants';

class ISyntaxImage extends PyramidImage {
  private _checkSums: number[];
  dtsImageVersion: number;
  _iir: InitImageResponse | null;
  constructor(imageFrame: IImageFrame) {
    super(imageFrame);
    this._checkSums = [];
    this.dtsImageVersion = 0;
    this._iir = null;
  }
  initializeFromIIR(iir: InitImageResponse): void {
    this._iir = iir;
    this.dtsImageVersion = iir.version;
    if (iir.coeffBitDepth <= 16) {
      this.bytesPerPixel = 2;
    } else {
      this.bytesPerPixel = 4;
    }

    if (
      iir.format === CodecConstants.instance.ImageFormat.YBRF8 ||
      iir.format === CodecConstants.instance.ImageFormat.YBRFE ||
      iir.format === CodecConstants.instance.ImageFormat.YBRP8 ||
      iir.format === CodecConstants.instance.ImageFormat.YBRPE
    ) {
      this.planes = 3;
    }

    if (iir.levelChecksums) {
      this.setCheckSum(iir.levelChecksums);
    }
    this.lowestPixelLevel = iir.xformLevels;
  }
  getImageFormat(): string | undefined {
    return this._iir ? this._iir.format : undefined;
  }

  getIIR(): InitImageResponse | null {
    return this._iir;
  }

  getCheckSum(pixelLevel: number): number {
    return this._checkSums[pixelLevel];
  }

  setCheckSum(checksums: number[]): void {
    this._checkSums = checksums;
  }

  getInitImagePixelLevel(): number {
    return this.lowestPixelLevel;
  }
  dispose(): void {
    super.dispose();
    this._iir = null;
    this._checkSums = [];
  }

  static STENTOR_DTSIMAGE_VERSION1_0 = 0x00010000;
  static STENTOR_DTSIMAGE_VERSION1_1 = 0x00010001;
  static STENTOR_DTSIMAGE_VERSION2_0 = 0x00020000;
  static STENTOR_DTSIMAGE_VERSION2_2 = 0x00020002;
  static STENTOR_DTSIMAGE_VERSION2_3 = 0x00020003;
  static STENTOR_DTSIMAGE_VERSION3_0 = 0x00030000;
  static STENTOR_DTSIMAGE_VERSION4_0 = 0x00040000;
}

export { ISyntaxImage };
