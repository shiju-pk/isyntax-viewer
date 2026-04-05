/**
 * Pixel decoder interface — abstracts format-specific decode logic.
 * Mirrors the C++ PixelInterface factory pattern.
 */

/** Information needed by the decoder about the compressed data. */
export interface DecodeInfo {
  format: string;
  rows: number;
  cols: number;
  bitsPerPixel: number;
  signed: boolean;
}

/** Result returned by a pixel decoder. */
export interface DecodedPixels {
  /** Decoded pixel data — type depends on format and bit depth. */
  pixelData: Uint8Array | Int8Array | Uint16Array | Int16Array;
  rows: number;
  cols: number;
  /** Number of pixel planes (1 = mono, 3 = color). */
  planes: number;
  /** Bytes per pixel element (1, 2, or 4). */
  bytesPerPixel: number;
}

export interface IPixelDecoder {
  /** Lazy initialization (e.g. load WASM module). Called once, idempotent. */
  initialize(): Promise<void>;

  /** Decode compressed pixel data. */
  decode(data: Uint8Array, info: DecodeInfo): Promise<DecodedPixels>;

  /** Returns true if this decoder handles the given format string. */
  supportsFormat(format: string): boolean;

  /** Returns true if the format supports progressive refinement (wavelet levels). */
  isProgressiveFormat(): boolean;
}
