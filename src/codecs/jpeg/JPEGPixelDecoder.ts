/**
 * JPEG pixel decoder — wraps libjpeg-turbo WASM (8-bit) with a pure-JS
 * fallback for 12-bit JPEG Extended (Process 2+4).
 *
 * Decode strategy:
 *  1. Try the fast WASM (libjpeg-turbo-8bit) decoder first.
 *  2. If the WASM decoder throws (e.g. 12-bit precision → exit code 622408),
 *     fall back to the pure-JS JPEG decoder from cornerstone3D which handles
 *     both 8-bit and 12/16-bit baseline JPEG.
 */

import type { IPixelDecoder, DecodeInfo, DecodedPixels } from '../IPixelDecoder';
import type { LibjpegTurboModule, LibjpegTurboModuleFactory, JPEGDecoder } from './wasm/types';
import { CodecConstants } from '../../core/constants';

// ---------------------------------------------------------------------------
// WASM (libjpeg-turbo 8-bit) state
// ---------------------------------------------------------------------------
let _codec: LibjpegTurboModule | undefined;
let _decoder: JPEGDecoder | undefined;
let _initPromise: Promise<void> | undefined;

// ---------------------------------------------------------------------------
// Pure-JS fallback (handles 12-bit JPEG Extended)
// ---------------------------------------------------------------------------
let _JpegImageClass: any;
let _jsInitPromise: Promise<void> | undefined;

async function _initJsDecoder(): Promise<void> {
  if (_JpegImageClass) return;
  if (_jsInitPromise) return _jsInitPromise;

  _jsInitPromise = (async () => {
    const mod = await import(/* @vite-ignore */ './jpeg-js-decoder.js');
    _JpegImageClass = mod.default ?? mod;
  })();

  return _jsInitPromise;
}

function _decodeWithJs(data: Uint8Array, info: DecodeInfo): DecodedPixels {
  const jpeg = new _JpegImageClass();
  jpeg.parse(data);
  // Disable internal color transform — we handle YCbCr→RGB separately
  jpeg.colorTransform = false;

  const numComponents: number = jpeg.components.length;
  const w: number = jpeg.width;
  const h: number = jpeg.height;

  let pixelData: Uint8Array | Uint16Array;
  let bytesPerPixel: number;

  if (info.bitsPerPixel > 8) {
    // 12-bit / 16-bit mono (getData16 only supports single component)
    pixelData = jpeg.getData16(w, h) as Uint16Array;
    bytesPerPixel = 2;
  } else {
    pixelData = jpeg.getData(w, h) as Uint8Array;
    bytesPerPixel = 1;
  }

  return {
    pixelData,
    rows: h,
    cols: w,
    planes: numComponents,
    bytesPerPixel,
  };
}

// ---------------------------------------------------------------------------
// JPEG SOF bit-depth detection
// ---------------------------------------------------------------------------
/**
 * Scan a JPEG byte stream for the first SOF marker (FFC0, FFC1, FFC2) and
 * return the sample precision (typically 8 or 12). Returns 0 if not found.
 */
function _detectJpegPrecision(data: Uint8Array): number {
  // Walk through JPEG markers: each marker is 0xFF followed by a type byte.
  // SOF markers: 0xFFC0 (baseline), 0xFFC1 (extended), 0xFFC2 (progressive).
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] !== 0xFF) continue;
    const marker = data[i + 1];
    // Skip padding 0xFF bytes
    if (marker === 0xFF || marker === 0x00) continue;
    // SOF0, SOF1, SOF2
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      // SOF layout: [FF Cx] [Lh Ll] [P] ...
      // P = precision byte at offset i+4
      if (i + 4 < data.length) {
        return data[i + 4];
      }
    }
    // Skip past this marker's segment (except for SOI, EOI, and RST markers which have no length)
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      // No length field
      i += 1;
      continue;
    }
    // Read segment length and skip
    if (i + 3 < data.length) {
      const segLen = (data[i + 2] << 8) | data[i + 3];
      i += 1 + segLen; // will be incremented by loop's i++
    }
  }
  return 0; // not found
}

// ---------------------------------------------------------------------------
// JPEGPixelDecoder
// ---------------------------------------------------------------------------

class JPEGPixelDecoder implements IPixelDecoder {

  async initialize(): Promise<void> {
    // Initialise both decoders in parallel so the JS fallback is ready
    const wasmInit = this._initWasm();
    const jsInit = _initJsDecoder();
    // Don't let a WASM init failure prevent the JS decoder from being ready
    await Promise.allSettled([wasmInit, jsInit]);
  }

  private async _initWasm(): Promise<void> {
    if (_codec) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      const wasmUrl = new URL('./wasm/libjpegturbowasm_decode.wasm', import.meta.url).toString();
      const mod: any =
        await import(/* @vite-ignore */ new URL('./wasm/libjpegturbowasm_decode.js', import.meta.url).toString());

      const factory: LibjpegTurboModuleFactory =
        typeof mod.default === 'function' ? mod.default :
        typeof mod.libjpegturbowasm_decode === 'function' ? mod.libjpegturbowasm_decode :
        typeof mod === 'function'         ? mod :
        undefined as any;

      if (typeof factory !== 'function') {
        console.warn('[JPEGPixelDecoder] WASM factory not found, will use JS fallback only');
        return;
      }

      const instance = await factory({
        locateFile: (f: string) => (f.endsWith('.wasm') ? wasmUrl : f),
      });

      _codec = instance;
      _decoder = new instance.JPEGDecoder();
    })();

    return _initPromise;
  }

  async decode(data: Uint8Array, info: DecodeInfo): Promise<DecodedPixels> {
    await this.initialize();

    // Detect JPEG sample precision from the SOF marker to decide which decoder to use.
    // libjpeg-turbo-8bit WASM can only handle 8-bit; 12-bit JPEG Extended (Process 2+4)
    // needs the pure-JS fallback decoder.
    const precision = _detectJpegPrecision(data);
    const needsJsFallback = precision > 8;

    if (needsJsFallback) {
      console.debug(
        `[JPEGPixelDecoder] ${precision}-bit JPEG detected, using JS decoder`
      );
      // Update bitsPerPixel so the JS decoder uses getData16 for >8-bit
      info = { ...info, bitsPerPixel: precision };
    }

    // Use WASM for 8-bit, JS for everything else
    if (!needsJsFallback && _decoder) {
      try {
        return this._decodeWasm(data, info);
      } catch (wasmErr: any) {
        console.warn(
          `[JPEGPixelDecoder] WASM decode failed (${wasmErr?.message ?? wasmErr}), ` +
          `falling back to JS decoder`
        );
      }
    }

    // Fallback: pure-JS decoder (handles 12-bit JPEG Extended)
    if (!_JpegImageClass) {
      await _initJsDecoder();
    }
    if (!_JpegImageClass) {
      throw new Error('[JPEGPixelDecoder] Neither WASM nor JS JPEG decoder available');
    }

    return _decodeWithJs(data, info);
  }

  private _decodeWasm(data: Uint8Array, info: DecodeInfo): DecodedPixels {
    const decoder = _decoder!;

    // Copy compressed data into WASM heap
    const encodedBuffer = decoder.getEncodedBuffer(data.length);
    encodedBuffer.set(data);

    // Decode
    decoder.decode();

    const frameInfo = decoder.getFrameInfo();
    const decodedBuffer = decoder.getDecodedBuffer();

    // Copy decoded data out of WASM heap
    const pixelData = info.signed
      ? new Int8Array(decodedBuffer.buffer, decodedBuffer.byteOffset, decodedBuffer.byteLength)
      : new Uint8Array(decodedBuffer.buffer, decodedBuffer.byteOffset, decodedBuffer.byteLength);

    return {
      pixelData,
      rows: frameInfo.height,
      cols: frameInfo.width,
      planes: frameInfo.componentCount,
      bytesPerPixel: 1,
    };
  }

  supportsFormat(format: string): boolean {
    const fmt = CodecConstants.instance.ImageFormat;
    return format === fmt.JPEG_RGB || format === fmt.JPEG_MONO;
  }

  isProgressiveFormat(): boolean {
    return false;
  }
}

export { JPEGPixelDecoder };
