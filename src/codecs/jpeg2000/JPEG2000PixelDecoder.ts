/**
 * JPEG 2000 pixel decoder — wraps OpenJPEG WASM.
 *
 * Performance:
 *  - WASM module loaded lazily on first use
 *  - Decoder instance created once and reused across all decode calls
 *  - Minimal memory copies: compressed→WASM heap, decoded→new TypedArray
 */

import type { IPixelDecoder, DecodeInfo, DecodedPixels } from '../IPixelDecoder';
import type { OpenJpegModule, OpenJpegModuleFactory, J2KDecoder } from './wasm/types';
import { CodecConstants } from '../../core/constants';

let _codec: OpenJpegModule | undefined;
let _decoder: J2KDecoder | undefined;
let _initPromise: Promise<void> | undefined;

class JPEG2000PixelDecoder implements IPixelDecoder {

  async initialize(): Promise<void> {
    if (_codec) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      // Dynamic import of the Emscripten JS glue (vendored WASM build)
      const wasmUrl = new URL('./wasm/openjpegwasm_decode.wasm', import.meta.url).toString();
      const mod: any =
        await import(/* @vite-ignore */ new URL('./wasm/openjpegwasm_decode.js', import.meta.url).toString());

      // Resolve the factory — `export default` was appended to the glue file.
      const factory: OpenJpegModuleFactory =
        typeof mod.default === 'function' ? mod.default :
        typeof mod.OpenJPEGWASM === 'function' ? mod.OpenJPEGWASM :
        typeof mod === 'function'         ? mod :
        undefined as any;

      if (typeof factory !== 'function') {
        console.error('[JPEG2000PixelDecoder] Module resolved to:', mod, 'keys:', Object.keys(mod));
        throw new Error(
          `[JPEG2000PixelDecoder] WASM factory not found. Module keys: ${Object.keys(mod).join(', ')}`
        );
      }

      const instance = await factory({
        locateFile: (f: string) => (f.endsWith('.wasm') ? wasmUrl : f),
      });

      _codec = instance;
      _decoder = new instance.J2KDecoder();
    })();

    return _initPromise;
  }

  async decode(data: Uint8Array, info: DecodeInfo): Promise<DecodedPixels> {
    await this.initialize();
    const decoder = _decoder!;
    // Copy compressed data into WASM heap
    const encodedBuffer = decoder.getEncodedBuffer(data.length);
    encodedBuffer.set(data);

    // Decode (always full resolution — J2K sub-res is too slow, matching C++ behavior)
    decoder.decode();

    const frameInfo = decoder.getFrameInfo();
    const decodedBuffer = decoder.getDecodedBuffer();

    // Copy decoded data out of WASM heap into a new typed array
    const pixelData = getPixelData(frameInfo.bitsPerSample, frameInfo.isSigned, decodedBuffer);

    return {
      pixelData,
      rows: frameInfo.height,
      cols: frameInfo.width,
      planes: frameInfo.componentCount,
      bytesPerPixel: frameInfo.bitsPerSample > 8 ? 2 : 1,
    };
  }

  supportsFormat(format: string): boolean {
    const fmt = CodecConstants.instance.ImageFormat;
    return format === fmt.J2K_RGB || format === fmt.J2K_MONO;
  }

  isProgressiveFormat(): boolean {
    return false;
  }
}

function getPixelData(
  bitsPerSample: number,
  isSigned: boolean,
  decodedBuffer: Uint8Array,
): Uint8Array | Int8Array | Uint16Array | Int16Array {
  if (bitsPerSample > 8) {
    return isSigned
      ? new Int16Array(decodedBuffer.buffer, decodedBuffer.byteOffset, decodedBuffer.byteLength / 2)
      : new Uint16Array(decodedBuffer.buffer, decodedBuffer.byteOffset, decodedBuffer.byteLength / 2);
  }
  return isSigned
    ? new Int8Array(decodedBuffer.buffer, decodedBuffer.byteOffset, decodedBuffer.byteLength)
    : new Uint8Array(decodedBuffer.buffer, decodedBuffer.byteOffset, decodedBuffer.byteLength);
}

export { JPEG2000PixelDecoder };
