import type { IImageFrame } from '../../core/types';
import type { InitImageResponse } from '../../parsers/isyntax/InitImageResponse';
import { PyramidImage } from './PyramidImage';
import { CodecConstants } from '../../core/constants';

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

    const fmt = CodecConstants.instance.ImageFormat;

    if (fmt.isJPEGFormat(iir.format)) {
      // JPEG / JPEG 2000: full-resolution in a single InitImage response.
      // No wavelet levels — decoded to final pixels directly.
      this.planes = fmt.isColor(iir.format) ? 3 : 1;
      // JPEG = 8-bit always; J2K mono >8-bit → 2 bytes, else 1
      this.bytesPerPixel = 1;
      this.lowestPixelLevel = 0;
    } else {
      // iSyntax wavelet formats
      if (iir.coeffBitDepth <= 16) {
        this.bytesPerPixel = 2;
      } else {
        this.bytesPerPixel = 4;
      }

      if (
        iir.format === fmt.YBRF8 ||
        iir.format === fmt.YBRFE ||
        iir.format === fmt.YBRP8 ||
        iir.format === fmt.YBRPE
      ) {
        this.planes = 3;
      }

      if (iir.levelChecksums) {
        this.setCheckSum(iir.levelChecksums);
      }
      this.lowestPixelLevel = iir.xformLevels;
    }
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
