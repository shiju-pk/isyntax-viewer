import type { ImageArray } from '../types';

/**
 * Abstract codec interface for image decoding/encoding.
 * Implementations: iSyntax, JPEG, JPEG2000, etc.
 */
export interface ICodec {
  readonly name: string;
  decode(data: Uint8Array, ...args: unknown[]): { resultBuffer: ImageArray };
}
