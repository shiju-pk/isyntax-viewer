/**
 * Type declarations for OpenJPEG WASM decoder module.
 * Adapted from @cornerstonejs/codec-openjpeg type definitions.
 */

export interface FrameInfo {
  width: number;
  height: number;
  bitsPerSample: number;
  componentCount: number;
  isSigned: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface J2KDecoder {
  getEncodedBuffer(length: number): Uint8Array;
  decode(): void;
  getDecodedBuffer(): Uint8Array;
  getFrameInfo(): FrameInfo;
  getImageOffset(): Point;
  getNumDecompositions(): number;
  getNumLayers(): number;
  getProgressionOrder(): number;
  getIsReversible(): boolean;
  getBlockDimensions(): Size;
  getTileSize(): Size;
  getTileOffset(): Point;
  getColorSpace(): number;
}

export interface OpenJpegModule {
  J2KDecoder: new () => J2KDecoder;
}

export type OpenJpegModuleFactory = (moduleArgs?: Record<string, unknown>) => Promise<OpenJpegModule>;
