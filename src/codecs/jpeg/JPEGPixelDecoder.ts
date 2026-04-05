/**
 * JPEG pixel decoder — wraps libjpeg-turbo WASM.
 *
 * Performance:
 *  - WASM module loaded lazily on first use
 *  - Decoder instance created once and reused across all decode calls
 *  - Minimal memory copies: compressed→WASM heap, decoded→new TypedArray
 *  - 8-bit output only (libjpeg-turbo-8bit)
 */

import type { IPixelDecoder, DecodeInfo, DecodedPixels } from '../IPixelDecoder';
import type { LibjpegTurboModule, LibjpegTurboModuleFactory, JPEGDecoder } from './wasm/types';
import { CodecConstants } from '../../core/constants';

let _codec: LibjpegTurboModule | undefined;
let _decoder: JPEGDecoder | undefined;
let _initPromise: Promise<void> | undefined;

class JPEGPixelDecoder implements IPixelDecoder {

  async initialize(): Promise<void> {
    if (_codec) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      const wasmUrl = new URL('./wasm/libjpegturbowasm_decode.wasm', import.meta.url).toString();
      const { default: factory }: { default: LibjpegTurboModuleFactory } =
        await import(/* @vite-ignore */ new URL('./wasm/libjpegturbowasm_decode.js', import.meta.url).toString());

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
      bytesPerPixel: 1, // libjpeg-turbo-8bit always outputs 8-bit
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
