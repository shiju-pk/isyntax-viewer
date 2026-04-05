/**
 * Type declarations for libjpeg-turbo WASM decoder module.
 * Adapted from @cornerstonejs/codec-libjpeg-turbo-8bit type definitions.
 */

export interface FrameInfo {
  width: number;
  height: number;
  bitsPerSample: number;
  componentCount: number;
  isSigned: boolean;
}

export interface JPEGDecoder {
  getEncodedBuffer(length: number): Uint8Array;
  decode(): void;
  getDecodedBuffer(): Uint8Array;
  getFrameInfo(): FrameInfo;
}

export interface LibjpegTurboModule {
  JPEGDecoder: new () => JPEGDecoder;
}

export type LibjpegTurboModuleFactory = (moduleArgs?: Record<string, unknown>) => Promise<LibjpegTurboModule>;
