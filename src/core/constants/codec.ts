// CodecConstants.ts

/** Represents different image formats. */
export class ImageFormat {
  MONO = 'MONO';
  YBRF8 = 'YBRF8';
  YBRFE = 'YBRFE';
  YBRP8 = 'YBRP8';
  YBRPE = 'YBRPE';
  JPEG_RGB = 'JPEG_RGB';
  JPEG_MONO = 'JPEG_MONO';
  J2K_RGB = 'J2K_RGB';
  J2K_MONO = 'J2K_MONO';

  private _imageFormatArray: string[] = [
    this.MONO,
    this.YBRF8,
    this.YBRFE,
    this.YBRP8,
    this.YBRPE,
    this.JPEG_RGB,
    this.JPEG_MONO,
    this.J2K_RGB,
    this.J2K_MONO,
  ];

  getImageFormat(intFormat: number): string {
    return this._imageFormatArray[intFormat];
  }
}

/** Represents different coder codes. */
export class CoderCode {
  UNCOMPRESSED = 'UNCOMPRESSED';
  RICE = 'RICE';
  ARITHMETIC = 'ARITHMETIC';
  PREFIX_ENCODED = 'PREFIX_ENCODED';

  private _coderCodes: string[] = [
    'invalid',
    this.UNCOMPRESSED,
    this.RICE,
    this.ARITHMETIC,
    this.PREFIX_ENCODED,
  ];

  getCoderCode(intCode: number): string {
    return this._coderCodes[intCode];
  }
}

/**
 * The main CodecConstants class that provides
 * a single instance and access to ImageFormat and CoderCode.
 */
export class CodecConstants {
  static instance: CodecConstants = new CodecConstants();

  ImageFormat: ImageFormat;
  CoderCode: CoderCode;

  private constructor() {
    this.ImageFormat = new ImageFormat();
    this.CoderCode = new CoderCode();
  }
}
export default CodecConstants;
