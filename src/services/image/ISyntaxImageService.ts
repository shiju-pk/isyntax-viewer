import type { IImageFrame, DecodedImage, ProgressCallback, DicomImageMetadata, ImageArray } from '../../core/types';
import { CodecConstants } from '../../core/constants';
import { ImageQualityStatus } from '../../core/enums/ImageQualityStatus';
import { ISyntaxImage } from '../../imaging/model/ISyntaxImage';
import { ISyntaxProcessor } from '../../imaging/processing/ISyntaxProcessor';
import { ServerResponse, ResponseType } from '../../parsers/isyntax/ServerResponse';
import { InitImageResponseParser } from '../../parsers/isyntax/InitImageResponseParser';
import type { ZoomLevelView } from '../../imaging/model/ZoomLevelView';
import { getInitImageUrl, getCoefficientsUrl } from '../../transport/endpoints/config';
import { authenticatedFetch } from '../../transport/authenticatedFetch';
import { DecodeWorkerPool } from '../../workers/DecodeWorkerPool';
import type { DecodeResult } from '../../workers/DecodeWorkerPool';
import { imageCache } from '../../cache/ImageCache';
import { requestPool, RequestType } from '../../requestPool/RequestPoolManager';
import { eventBus } from '../../rendering/events/EventBus';
import { RenderingEvents } from '../../rendering/events/RenderingEvents';
import { DecoderRegistry } from '../../codecs/DecoderRegistry';
import type { DecodeInfo } from '../../codecs/IPixelDecoder';

/** Shared worker pool — lazily initialised, shared across all ISyntaxImageService instances */
let sharedWorkerPool: DecodeWorkerPool | null = null;

function getWorkerPool(): DecodeWorkerPool {
  if (!sharedWorkerPool) {
    sharedWorkerPool = new DecodeWorkerPool();
  }
  return sharedWorkerPool;
}

/**
 * Dispose the shared worker pool (call on app shutdown).
 */
export function disposeSharedWorkerPool(): void {
  if (sharedWorkerPool) {
    sharedWorkerPool.terminate();
    sharedWorkerPool = null;
  }
}

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
  private _qualityStatus: ImageQualityStatus = ImageQualityStatus.NONE;

  /** Cached raw pixel range (min/max) for efficient rewindowing */
  private _cachedRawMin: number | undefined;
  private _cachedRawMax: number | undefined;

  /** The effective WC/WW applied to the current display (post-MLUT space) */
  private _effectiveWindowCenter: number = 128;
  private _effectiveWindowWidth: number = 256;

  /**
   * When true, decoding happens in a WebWorker (off main thread).
   * Set to false for debugging or environments without Worker support.
   */
  useWorkers: boolean = true;

  constructor(studyUID: string, instanceUID: string, stackId: string) {
    this._studyUID = studyUID;
    this._instanceUID = instanceUID;
    this._stackId = stackId;
  }

  get imageId(): string {
    return `isyntax:${this._studyUID}:${this._instanceUID}:${this._stackId}`;
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

  get qualityStatus(): ImageQualityStatus {
    return this._qualityStatus;
  }

  set dicomMetadata(meta: DicomImageMetadata | null) {
    this._dicomMetadata = meta;

    // Re-render the cached image with the new metadata (e.g. MLUT, VOI).
    // This is important when metadata arrives after initImage has already
    // rendered the image (typical for JPEG-based workflows).
    if (this._cachedResult?.rawPixelData) {
      const cached = this._cachedResult;
      const rawPixelData = cached.rawPixelData!;
      const isMonochrome =
        cached.planes === 1 ||
        cached.format === CodecConstants.instance.ImageFormat.MONO;
      if (isMonochrome) {
        cached.imageData = this._convertToImageData(
          rawPixelData,
          cached.rows,
          cached.cols,
          cached.planes,
          cached.format || 'MONO',
        );
      }
    }
  }

  get dicomMetadata(): DicomImageMetadata | null {
    return this._dicomMetadata;
  }

  /** The effective window center/width applied to the current display (post-MLUT space) */
  get effectiveVOI(): { windowCenter: number; windowWidth: number } {
    return {
      windowCenter: this._effectiveWindowCenter,
      windowWidth: this._effectiveWindowWidth,
    };
  }

  // ------------------------------------------------------------------
  // initImage
  // ------------------------------------------------------------------

  async initImage(rows: number = 512, cols: number = 512): Promise<DecodedImage> {
    const url = getInitImageUrl(this._studyUID, this._instanceUID, this._stackId);

    // Fetch through priority request pool (Interaction priority = user-visible)
    const { promise: arrayBuffer } = requestPool.addRequest<ArrayBuffer>(
      async (signal) => {
        const response = await authenticatedFetch(url, { signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch InitImage: ${response.status} ${response.statusText}`);
        }
        return response.arrayBuffer();
      },
      RequestType.Interaction,
    );

    const buffer = await arrayBuffer;

    // Keep a copy of the raw bytes for main-thread fallback.
    // The original buffer may be detached when transferred to a worker.
    const rawCopy = new Uint8Array(buffer).slice();

    let decoded: DecodedImage;

    if (this.useWorkers) {
      try {
        // Parse the small header on main thread BEFORE transferring buffer
        // to init main-thread state (needed for fallback in loadLevel).
        this._ensureMainThreadState(rawCopy);
        // Transfer the original buffer to the worker (zero-copy, no .slice())
        decoded = await this._decodeInitImageInWorker(buffer, rows, cols);
      } catch (workerErr) {
        console.warn('Worker decode failed for InitImage, falling back to main thread:', workerErr);
        // Reset main-thread state so _decodeInitImageMainThread can rebuild it
        this._iSyntaxImage = null;
        this._processor = null;
        decoded = await this._decodeInitImageMainThread(rawCopy, rows, cols);
      }
    } else {
      decoded = await this._decodeInitImageMainThread(rawCopy, rows, cols);
    }

    // Update quality status
    const fmt = CodecConstants.instance.ImageFormat;
    const format = decoded.format || '';
    if (fmt.isJPEGFormat(format)) {
      // JPEG/J2K: full resolution in one shot — no progressive levels
      this._fullyLoaded = true;
      this._cachedResult = decoded;
      this._setQualityStatus(ImageQualityStatus.FULL_RESOLUTION, 0);
    } else {
      this._setQualityStatus(ImageQualityStatus.SUBRESOLUTION, decoded.pixelLevel);
    }

    // Store in global image cache
    const cacheKey = `${this.imageId}:init`;
    imageCache.put(cacheKey, decoded.imageData);

    return decoded;
  }

  // ------------------------------------------------------------------
  // loadLevel
  // ------------------------------------------------------------------

  async loadLevel(level: number): Promise<DecodedImage> {
    // JPEG/J2K formats are fully decoded in initImage — no progressive levels
    if (this._fullyLoaded && this._cachedResult) {
      return this._cachedResult;
    }

    if (!this._iSyntaxImage && !this.useWorkers) {
      throw new Error('Image not initialized. Call initImage() first.');
    }

    const url = getCoefficientsUrl(
      this._studyUID,
      this._instanceUID,
      level,
      this._stackId,
    );

    // Coefficient fetches at Prefetch priority (progressive refinement)
    const { promise: arrayBuffer } = requestPool.addRequest<ArrayBuffer>(
      async (signal) => {
        const response = await authenticatedFetch(url, { signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch coefficients for level ${level}: ${response.status}`);
        }
        return response.arrayBuffer();
      },
      RequestType.Prefetch,
    );

    const buffer = await arrayBuffer;

    let decoded: DecodedImage;

    if (this.useWorkers) {
      try {
        // Transfer the original buffer to the worker (zero-copy, no .slice())
        decoded = await this._decodeCoefficientInWorker(buffer, level);
      } catch (workerErr) {
        console.warn(`Worker decode failed for level ${level}, falling back to main thread:`, workerErr);
        // Buffer is detached after transfer — re-fetch for main-thread fallback
        const refetchResponse = await fetch(url);
        if (!refetchResponse.ok) throw workerErr;
        const refetchBuffer = await refetchResponse.arrayBuffer();
        decoded = this._decodeCoefficientMainThread(new Uint8Array(refetchBuffer), level);
      }
    } else {
      decoded = this._decodeCoefficientMainThread(new Uint8Array(buffer), level);
    }

    // Determine quality
    const isLast = level <= 1;
    const newStatus = isLast
      ? ImageQualityStatus.FULL_RESOLUTION
      : ImageQualityStatus.INTERMEDIATE;
    this._setQualityStatus(newStatus, decoded.pixelLevel);

    // Update cache with refined image
    const cacheKey = `${this.imageId}:level-${level}`;
    imageCache.put(cacheKey, decoded.imageData);

    return decoded;
  }

  // ------------------------------------------------------------------
  // loadAllLevels
  // ------------------------------------------------------------------

  async loadAllLevels(onProgress?: ProgressCallback): Promise<DecodedImage> {
    if (!this._iSyntaxImage && !this.useWorkers) {
      throw new Error('Image not initialized. Call initImage() first.');
    }

    // Return cached result if already fully loaded
    if (this._fullyLoaded && this._cachedResult) {
      return this._cachedResult;
    }

    let result: DecodedImage | null = null;

    for (let level = this._totalLevels; level > 0; level--) {
      result = await this.loadLevel(level);

      const loaded = this._totalLevels - level + 1;
      if (onProgress) {
        onProgress(loaded, this._totalLevels);
      }

      // Emit progress event
      eventBus.emit(RenderingEvents.IMAGE_LOAD_PROGRESS as any, {
        imageId: this.imageId,
        level: loaded,
        totalLevels: this._totalLevels,
        percentComplete: Math.round((loaded / this._totalLevels) * 100),
      });
    }

    this._fullyLoaded = true;
    this._cachedResult = result;

    return result!;
  }

  // ------------------------------------------------------------------
  // Worker-based decode paths
  // ------------------------------------------------------------------

  private async _decodeInitImageInWorker(buffer: ArrayBuffer, rows: number, cols: number): Promise<DecodedImage> {
    const pool = getWorkerPool();
    const result = await pool.decode({
      type: 'initImage',
      buffer,
      level: 0,
      imageKey: this.imageId,
      rows,
      cols,
    });

    this._totalLevels = result.xformLevels ?? 0;
    this._currentLevel = this._totalLevels;

    return this._decodeResultToDecodedImage(result);
  }

  private async _decodeCoefficientInWorker(buffer: ArrayBuffer, level: number): Promise<DecodedImage> {
    const pool = getWorkerPool();
    const result = await pool.decode({
      type: 'coefficients',
      buffer,
      level,
      imageKey: this.imageId,
    });

    this._currentLevel = result.pixelLevel;
    return this._decodeResultToDecodedImage(result);
  }

  private _decodeResultToDecodedImage(result: DecodeResult): DecodedImage {
    const fmt = CodecConstants.instance.ImageFormat;
    const format = result.format || 'MONO';
    let typedArray: ImageArray;

    if (fmt.isJPEGFormat(format)) {
      // JPEG/J2K: pixel data is raw 8-bit (or 16-bit for J2K >8bpp)
      typedArray = result.bytesPerPixel === 2
        ? new Uint16Array(result.pixelData)
        : new Uint8Array(result.pixelData);

    } else {
      // iSyntax wavelet: pixel data is Int16 or Int32
      typedArray = result.bytesPerPixel === 4
        ? new Int32Array(result.pixelData)
        : new Int16Array(result.pixelData);
    }

    const imageData = this._convertToImageData(
      typedArray,
      result.rows,
      result.cols,
      result.planes,
      format,
    );

    return {
      imageData,
      pixelLevel: result.pixelLevel,
      rows: result.rows,
      cols: result.cols,
      planes: result.planes,
      format: result.format,
      rawPixelData: typedArray,
      rescaleSlope: this._dicomMetadata?.rescaleSlope,
      rescaleIntercept: this._dicomMetadata?.rescaleIntercept,
    };
  }

  // ------------------------------------------------------------------
  // Main-thread decode paths (fallback / debug)
  // ------------------------------------------------------------------

  /**
   * Initialise main-thread ISyntaxImage/Processor from a raw InitImage
   * response buffer WITHOUT performing full decode.  This is called after
   * a successful worker-based initImage so that the main-thread fallback
   * path in _decodeCoefficientMainThread has valid state.
   */
  private _ensureMainThreadState(uint8Array: Uint8Array): void {
    if (this._iSyntaxImage && this._processor) return; // already set

    const iir = InitImageResponseParser.parse(uint8Array);
    const imageFrame: IImageFrame = { rows: iir.rows, columns: iir.cols, imageId: this._instanceUID };
    this._iSyntaxImage = new ISyntaxImage(imageFrame);
    this._processor = new ISyntaxProcessor(this._iSyntaxImage);

    const fmt = CodecConstants.instance.ImageFormat;
    if (fmt.isJPEGFormat(iir.format)) {
      // JPEG/J2K — just init the image model; no wavelet state to replay
      const serverResponse = new ServerResponse(ResponseType.InitImage, 0, uint8Array);
      this._processor.ComputeZoomLevelView(serverResponse, 0);
    } else {
      // Replay the InitImage through the processor so wavelet state is ready
      const serverResponse = new ServerResponse(ResponseType.InitImage, iir.xformLevels, uint8Array);
      this._processor.ComputeZoomLevelView(serverResponse, iir.xformLevels);
    }
  }

  private async _decodeInitImageMainThread(uint8Array: Uint8Array, rows: number, cols: number): Promise<DecodedImage> {
    const imageFrame: IImageFrame = { rows, columns: cols, imageId: this._instanceUID };
    this._iSyntaxImage = new ISyntaxImage(imageFrame);
    this._processor = new ISyntaxProcessor(this._iSyntaxImage);

    const iir = InitImageResponseParser.parse(uint8Array);
    const fmt = CodecConstants.instance.ImageFormat;

    this._totalLevels = iir.xformLevels;
    this._currentLevel = iir.xformLevels;

    // Update image frame with actual dimensions from server
    imageFrame.rows = iir.rows;
    imageFrame.columns = iir.cols;
    this._iSyntaxImage = new ISyntaxImage(imageFrame);
    this._processor = new ISyntaxProcessor(this._iSyntaxImage);

    if (fmt.isJPEGFormat(iir.format)) {
      // JPEG/J2K: async WASM decode path
      const serverResponse = new ServerResponse(ResponseType.InitImage, 0, uint8Array);
      this._processor.ComputeZoomLevelView(serverResponse, 0);

      const decoded = await this._processor.ProcessInitImageResponseAsync(iir);

      const imageData = this._convertToImageData(
        decoded.pixelData,
        decoded.rows,
        decoded.cols,
        decoded.planes,
        iir.format,
      );

      return {
        imageData,
        pixelLevel: 0,
        rows: decoded.rows,
        cols: decoded.cols,
        planes: decoded.planes,
        format: iir.format,
        rawPixelData: decoded.pixelData,
        rescaleSlope: this._dicomMetadata?.rescaleSlope,
        rescaleIntercept: this._dicomMetadata?.rescaleIntercept,
      };
    }

    // iSyntax wavelet path (unchanged)
    const serverResponse = new ServerResponse(ResponseType.InitImage, this._totalLevels, uint8Array);
    const zlv = this._processor.ComputeZoomLevelView(serverResponse, this._totalLevels);

    return this._zlvToImageData(zlv);
  }

  private _decodeCoefficientMainThread(uint8Array: Uint8Array, level: number): DecodedImage {
    if (!this._iSyntaxImage || !this._processor) {
      throw new Error('Image not initialized. Call initImage() first.');
    }

    const serverResponse = new ServerResponse(ResponseType.GetCoefficients, level, uint8Array);
    const zlv = this._processor.ComputeZoomLevelView(serverResponse, level);

    this._currentLevel = this._iSyntaxImage.getBestPixelLevelAvailable();

    return this._zlvToImageData(zlv);
  }

  // ------------------------------------------------------------------
  // Quality tracking
  // ------------------------------------------------------------------

  private _setQualityStatus(newStatus: ImageQualityStatus, level: number): void {
    if (newStatus <= this._qualityStatus) return; // Only upgrade, never downgrade

    const previous = this._qualityStatus;
    this._qualityStatus = newStatus;

    eventBus.emit(RenderingEvents.IMAGE_QUALITY_CHANGED as any, {
      imageId: this.imageId,
      previousStatus: previous,
      currentStatus: newStatus,
      level: this._totalLevels - level + 1,
      totalLevels: this._totalLevels,
    });
  }

  // ------------------------------------------------------------------
  // Pixel conversion (unchanged logic)
  // ------------------------------------------------------------------

  private _zlvToImageData(zlv: ZoomLevelView): DecodedImage {
    const llData = zlv.getFullLevelLL();
    if (!llData) {
      throw new Error('No decoded data available');
    }

    const rows = zlv.levelRows;
    const cols = zlv.levelColumns;
    const planes = zlv.planes;
    const format = this._iSyntaxImage?.getImageFormat() || 'MONO';
    const meta = this._dicomMetadata;

    const imageData = this._convertToImageData(llData, rows, cols, planes, format);

    return {
      imageData,
      pixelLevel: zlv.pixelLevel,
      rows,
      cols,
      planes,
      format,
      rawPixelData: llData,
      rescaleSlope: meta?.rescaleSlope,
      rescaleIntercept: meta?.rescaleIntercept,
    };
  }

  private _convertToImageData(
    pixelData: ImageArray,
    rows: number,
    cols: number,
    planes: number,
    format: string,
  ): ImageData {
    const imageData = new ImageData(cols, rows);
    const rgba = imageData.data;
    const meta = this._dicomMetadata;

    if (planes === 1 || format === CodecConstants.instance.ImageFormat.MONO) {
      const totalPixels = rows * cols;

      // Linear modality LUT (rescale slope/intercept)
      const slope = meta?.rescaleSlope ?? 1;
      const intercept = meta?.rescaleIntercept ?? 0;

      // Non-linear Modality LUT (0028,3000) is applied SERVER-SIDE during
      // .dts consolidation (DICOMLUTHelper::ExtractDICOMLUTFromTags).
      // Pixel values arriving here are already MLUT-transformed.
      // Client-side pipeline: storedValue → rescaleSlope/Intercept → VOI window → 0-255.

      // Determine window/level
      let ww = meta?.windowWidth;
      let wc = meta?.windowCenter;

      const isJPEG = CodecConstants.instance.ImageFormat.isJPEGFormat(format);

      // Detect actual decoded bit depth from the TypedArray:
      //   Uint8Array / Int8Array  → 8-bit  (server pre-windowed JPEG)
      //   Uint16Array / Int16Array → >8-bit (J2K lossless, original pixel values)
      const decoded8bit = (pixelData instanceof Uint8Array || pixelData instanceof Int8Array);

      // When the server delivers 8-bit JPEG from a higher bit-depth source
      // (e.g. 12/16-bit), the DICOM WC/WW values are for the original stored
      // pixel depth.  Scale them to the 8-bit range so they match the actual
      // pixel values from the JPEG decoder.
      // Do NOT scale for >8-bit decoded data (J2K lossless) — the pixel values
      // are still in the original DICOM range and the DICOM WC/WW applies directly.
      const bitsStored = meta?.bitsStored ?? 8;
      if (isJPEG && decoded8bit && bitsStored > 8 && ww != null && wc != null) {
        const scale = (Math.pow(2, bitsStored) - 1) / 255;
        ww = ww / scale;
        wc = wc / scale;
      }

      // Determine raw pixel range (used for auto-WW/WC and LUT sizing)
      let rawMin = pixelData[0];
      let rawMax = rawMin;
      for (let i = 1; i < totalPixels; i++) {
        const v = pixelData[i];
        if (v < rawMin) rawMin = v;
        else if (v > rawMax) rawMax = v;
      }

      // Cache raw pixel range for efficient rewindowing
      this._cachedRawMin = rawMin;
      this._cachedRawMax = rawMax;

      if (ww == null || wc == null) {
        if (isJPEG && decoded8bit) {
          // 8-bit JPEG mono: the server already applied VOI windowing when
          // encoding 16-bit (or higher) source data into 8-bit JPEG.  Pixel
          // values are display-ready.  Use an identity window so pixel value N
          // maps to display value N, avoiding the brightness shift that
          // auto-stretching the actual pixel range would cause.
          ww = 256;
          wc = 128;
        } else {
          // >8-bit J2K lossless / iSyntax wavelet: auto-calculate WW/WC from
          // pixel data range (linear modality space)
          const minMod = rawMin * slope + intercept;
          const maxMod = rawMax * slope + intercept;
          ww = Math.abs(maxMod - minMod) || 1;
          wc = (maxMod + minMod) / 2;
        }
      }

      // Store the effective WC/WW for viewport initialisation
      this._effectiveWindowCenter = wc;
      this._effectiveWindowWidth = ww;

      const lower = wc - ww / 2;
      const range = ww || 1;

      // Build a LUT indexed by raw pixel value for O(1) per-pixel windowing.
      // Pipeline: storedValue → linear rescale → VOI window → 0-255
      const lutSize = rawMax - rawMin + 1;
      const invRange = 255 / range;
      const lut = new Uint8Array(lutSize);
      for (let i = 0; i < lutSize; i++) {
        const mv = (rawMin + i) * slope + intercept;
        let norm = (mv - lower) * invRange;
        norm = norm > 255 ? 255 : norm < 0 ? 0 : norm | 0;
        lut[i] = norm;
      }

      // Apply LUT — single array lookup per pixel, no FP math
      const lutOffset = -rawMin; // shift raw value to 0-based LUT index
      for (let i = 0; i < totalPixels; i++) {
        const val = lut[pixelData[i] + lutOffset];
        const idx = i << 2;
        rgba[idx] = val;
        rgba[idx + 1] = val;
        rgba[idx + 2] = val;
        rgba[idx + 3] = 255;
      }
    } else {
      const fmtConst = CodecConstants.instance.ImageFormat;

      if (fmtConst.isJPEGFormat(format)) {
        // JPEG / J2K: pixel-interleaved RGB (R,G,B,...) from WASM decoder.
        // libjpeg-turbo converts YCbCr→RGB internally during decompression.
        const totalPixels = rows * cols;
        for (let i = 0; i < totalPixels; i++) {
          const srcIdx = i * 3;
          const dstIdx = i << 2;
          rgba[dstIdx]     = pixelData[srcIdx];
          rgba[dstIdx + 1] = pixelData[srcIdx + 1];
          rgba[dstIdx + 2] = pixelData[srcIdx + 2];
          rgba[dstIdx + 3] = 255;
        }
      } else {
        // iSyntax YBR → RGB conversion (3-plane planar: [Y...][Cb...][Cr...])
        // Matches C++ SignalProcessingUtilities::YBRFE_to_RGB_Band / 1.5 rgbprocessor.js
        const totalPixels = rows * cols;

        // Range expansion: YBRFE/YBRPE use 1/8.0; YBRF8/YBRP8 use 1.0
        const rangeExpansion =
          (format === fmtConst.YBRFE || format === fmtConst.YBRPE) ? 0.125 : 1.0;

        for (let i = 0; i < totalPixels; i++) {
          const yy  = pixelData[i] * rangeExpansion;
          const ccb = pixelData[totalPixels + i] * rangeExpansion - 128.0;
          const ccr = pixelData[totalPixels * 2 + i] * rangeExpansion - 128.0;

          const r = yy + 1.4019 * ccr + 0.5;
          const g = yy - 0.7141 * ccr - 0.3441 * ccb + 0.5;
          const b = yy + 1.7718 * ccb + 0.5;

          const idx = i << 2;
          rgba[idx]     = r > 255 ? 255 : r < 0 ? 0 : r | 0;
          rgba[idx + 1] = g > 255 ? 255 : g < 0 ? 0 : g | 0;
          rgba[idx + 2] = b > 255 ? 255 : b < 0 ? 0 : b | 0;
          rgba[idx + 3] = 255;
        }
      }
    }

    return imageData;
  }

  /**
   * Re-window a monochrome image using new WC/WW values.
   * Uses the raw pixel data from the cached result to produce a fresh ImageData
   * with the specified window applied. Returns null for non-monochrome images
   * or when raw pixel data is unavailable.
   */
  rewindow(windowCenter: number, windowWidth: number): ImageData | null {
    const cached = this._cachedResult;
    if (!cached?.rawPixelData) return null;

    const fmt = CodecConstants.instance.ImageFormat;
    const isMonochrome =
      cached.planes === 1 || cached.format === fmt.MONO;
    if (!isMonochrome) return null;

    const { rawPixelData, rows, cols } = cached;
    const totalPixels = rows * cols;
    const meta = this._dicomMetadata;
    // Non-linear Modality LUT (0028,3000) is applied SERVER-SIDE during
    // .dts consolidation — pixel values are already MLUT-transformed.
    // Client-side pipeline: storedValue → rescaleSlope/Intercept → VOI window → 0-255.
    const slope = meta?.rescaleSlope ?? 1;
    const intercept = meta?.rescaleIntercept ?? 0;

    const lower = windowCenter - windowWidth / 2;
    const range = windowWidth || 1;
    const invRange = 255 / range;

    // Use cached raw pixel range (or compute if not available)
    let rawMin: number;
    let rawMax: number;
    if (this._cachedRawMin !== undefined && this._cachedRawMax !== undefined) {
      rawMin = this._cachedRawMin;
      rawMax = this._cachedRawMax;
    } else {
      rawMin = rawPixelData[0];
      rawMax = rawMin;
      for (let i = 1; i < totalPixels; i++) {
        const v = rawPixelData[i];
        if (v < rawMin) rawMin = v;
        else if (v > rawMax) rawMax = v;
      }
      this._cachedRawMin = rawMin;
      this._cachedRawMax = rawMax;
    }

    // Pipeline: storedValue → linear rescale → VOI window → 0-255
    const lutSize = rawMax - rawMin + 1;
    const lut = new Uint8Array(lutSize);
    for (let i = 0; i < lutSize; i++) {
      const mv = (rawMin + i) * slope + intercept;
      let norm = (mv - lower) * invRange;
      norm = norm > 255 ? 255 : norm < 0 ? 0 : norm | 0;
      lut[i] = norm;
    }

    const imageData = new ImageData(cols, rows);
    const rgba = imageData.data;
    const lutOffset = -rawMin;
    for (let i = 0; i < totalPixels; i++) {
      const val = lut[rawPixelData[i] + lutOffset];
      const idx = i << 2;
      rgba[idx] = val;
      rgba[idx + 1] = val;
      rgba[idx + 2] = val;
      rgba[idx + 3] = 255;
    }

    // Update effective VOI state
    this._effectiveWindowCenter = windowCenter;
    this._effectiveWindowWidth = windowWidth;

    // Update cached imageData so progressive loading picks it up
    cached.imageData = imageData;
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
