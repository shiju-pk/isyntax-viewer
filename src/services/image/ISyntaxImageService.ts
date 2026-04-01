import type { IImageFrame, DecodedImage, ProgressCallback, DicomImageMetadata, ImageArray } from '../../core/types';
import { CodecConstants } from '../../core/constants';
import { ISyntaxImage } from '../../imaging/model/ISyntaxImage';
import { ISyntaxProcessor } from '../../imaging/processing/ISyntaxProcessor';
import { ServerResponse, ResponseType } from '../../parsers/isyntax/ServerResponse';
import { InitImageResponseParser } from '../../parsers/isyntax/InitImageResponseParser';
import type { ZoomLevelView } from '../../imaging/model/ZoomLevelView';
import { getInitImageUrl, getCoefficientsUrl } from '../../transport/endpoints/config';

export class ISyntaxImageService {
  private _iSyntaxImage: ISyntaxImage | null = null;
  private _processor: ISyntaxProcessor | null = null;
  private _studyUID: string;
  private _instanceUID: string;
  private _stackId: string;
  private _totalLevels: number = 0;
  private _currentLevel: number = -1;
  private _fullyLoaded: boolean = false;
  private _cachedResult: DecodedImage | null = null;
  private _dicomMetadata: DicomImageMetadata | null = null;

  constructor(studyUID: string, instanceUID: string, stackId: string) {
    this._studyUID = studyUID;
    this._instanceUID = instanceUID;
    this._stackId = stackId;
  }

  get totalLevels(): number {
    return this._totalLevels;
  }

  get currentLevel(): number {
    return this._currentLevel;
  }

  get isInitialized(): boolean {
    return this._iSyntaxImage !== null;
  }

  get isFullyLoaded(): boolean {
    return this._fullyLoaded;
  }

  get cachedResult(): DecodedImage | null {
    return this._cachedResult;
  }

  set dicomMetadata(meta: DicomImageMetadata | null) {
    this._dicomMetadata = meta;
  }

  get dicomMetadata(): DicomImageMetadata | null {
    return this._dicomMetadata;
  }

  async initImage(rows: number = 512, cols: number = 512): Promise<DecodedImage> {
    const url = getInitImageUrl(this._studyUID, this._instanceUID, this._stackId);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch InitImage: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const imageFrame: IImageFrame = { rows, columns: cols, imageId: this._instanceUID };
    this._iSyntaxImage = new ISyntaxImage(imageFrame);
    this._processor = new ISyntaxProcessor(this._iSyntaxImage);

    const serverResponse = new ServerResponse(ResponseType.InitImage, 0, uint8Array);
    const iir = InitImageResponseParser.parse(uint8Array);

    this._totalLevels = iir.xformLevels;
    this._currentLevel = iir.xformLevels;

    // Update image frame with actual dimensions from server
    imageFrame.rows = iir.rows;
    imageFrame.columns = iir.cols;
    this._iSyntaxImage = new ISyntaxImage(imageFrame);
    this._processor = new ISyntaxProcessor(this._iSyntaxImage);

    const zlv = this._processor.ComputeZoomLevelView(serverResponse, this._totalLevels);

    return this._zlvToImageData(zlv);
  }

  async loadLevel(level: number): Promise<DecodedImage> {
    if (!this._iSyntaxImage || !this._processor) {
      throw new Error('Image not initialized. Call initImage() first.');
    }

    const planes = this._iSyntaxImage.planes;
    const version = this._iSyntaxImage.dtsImageVersion;

    const url = getCoefficientsUrl(
      this._studyUID,
      this._instanceUID,
      level,
      this._stackId,
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch coefficients for level ${level}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const serverResponse = new ServerResponse(ResponseType.GetCoefficients, level, uint8Array);
    const zlv = this._processor.ComputeZoomLevelView(serverResponse, level);

    this._currentLevel = this._iSyntaxImage.getBestPixelLevelAvailable();

    return this._zlvToImageData(zlv);
  }

  async loadAllLevels(onProgress?: ProgressCallback): Promise<DecodedImage> {
    if (!this._iSyntaxImage || !this._processor) {
      throw new Error('Image not initialized. Call initImage() first.');
    }

    // Return cached result if already fully loaded
    if (this._fullyLoaded && this._cachedResult) {
      return this._cachedResult;
    }

    let result: DecodedImage | null = null;

    for (let level = this._totalLevels; level > 0; level--) {
      result = await this.loadLevel(level);
      if (onProgress) {
        onProgress(this._totalLevels - level + 1, this._totalLevels);
      }
    }

    this._fullyLoaded = true;
    this._cachedResult = result;

    return result!;
  }

  private _zlvToImageData(zlv: ZoomLevelView): DecodedImage {
    const llData = zlv.getFullLevelLL();
    if (!llData) {
      throw new Error('No decoded data available');
    }

    const rows = zlv.levelRows;
    const cols = zlv.levelColumns;
    const planes = zlv.planes;
    const format = this._iSyntaxImage?.getImageFormat() || 'MONO';

    const imageData = this._convertToImageData(llData, rows, cols, planes, format);

    return {
      imageData,
      pixelLevel: zlv.pixelLevel,
      rows,
      cols,
      planes,
      format,
    };
  }

  private _convertToImageData(
    pixelData: ImageArray,
    rows: number,
    cols: number,
    planes: number,
    format: string
  ): ImageData {
    const imageData = new ImageData(cols, rows);
    const rgba = imageData.data;
    const meta = this._dicomMetadata;

    if (planes === 1 || format === CodecConstants.instance.ImageFormat.MONO) {
      const totalPixels = rows * cols;

      // Apply Modality LUT (rescale slope/intercept) if available
      const slope = meta?.rescaleSlope ?? 1;
      const intercept = meta?.rescaleIntercept ?? 0;

      // Determine window/level
      let ww = meta?.windowWidth;
      let wc = meta?.windowCenter;

      if (ww == null || wc == null) {
        // Auto-calculate from pixel data if DICOM metadata not available
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

      const lower = wc - ww / 2;
      const upper = wc + ww / 2;
      const range = upper - lower || 1;

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
    } else {
      // YBR → RGB conversion (3-plane interleaved)
      const totalPixels = rows * cols;
      const yPlane = pixelData.subarray(0, totalPixels);
      const cbPlane = pixelData.subarray(totalPixels, totalPixels * 2);
      const crPlane = pixelData.subarray(totalPixels * 2, totalPixels * 3);

      for (let i = 0; i < totalPixels; i++) {
        const y = yPlane[i];
        const cb = cbPlane[i];
        const cr = crPlane[i];

        // YCbCr to RGB conversion (ITU-R BT.601)
        const r = y + 1.402 * cr;
        const g = y - 0.344136 * cb - 0.714136 * cr;
        const b = y + 1.772 * cb;

        const idx = i * 4;
        rgba[idx] = Math.max(0, Math.min(255, r)) | 0;
        rgba[idx + 1] = Math.max(0, Math.min(255, g)) | 0;
        rgba[idx + 2] = Math.max(0, Math.min(255, b)) | 0;
        rgba[idx + 3] = 255;
      }
    }

    return imageData;
  }

  dispose(): void {
    if (this._iSyntaxImage) {
      this._iSyntaxImage.dispose();
      this._iSyntaxImage = null;
    }
    this._processor = null;
  }
}
