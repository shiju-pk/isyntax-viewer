/**
 * iSyntax pixel decoder adapter — wraps the existing Rice + wavelet pipeline
 * behind the IPixelDecoder interface.
 *
 * This adapter is a thin pass-through: the actual decoding still happens via
 * ISyntaxProcessor → RiceAndSnakeDecoder / RiceDecoder → ISyntaxInverter.
 * It exists so the DecoderRegistry can report whether a format is handled
 * by iSyntax decoders vs JPEG/J2K WASM decoders.
 *
 * The `decode()` method is NOT used in the normal pipeline — iSyntax data
 * flows through ISyntaxProcessor.ComputeZoomLevelView() as before.
 */

import type { IPixelDecoder, DecodeInfo, DecodedPixels } from '../IPixelDecoder';
import { CodecConstants } from '../../core/constants';

class ISyntaxPixelDecoder implements IPixelDecoder {

  async initialize(): Promise<void> {
    // No-op: iSyntax decoders are pure JS, no WASM to load.
  }

  async decode(_data: Uint8Array, _info: DecodeInfo): Promise<DecodedPixels> {
    // iSyntax data is decoded through the ISyntaxProcessor pipeline,
    // not via this method. This should never be called directly.
    throw new Error(
      'ISyntaxPixelDecoder.decode() should not be called directly. ' +
      'Use ISyntaxProcessor.ComputeZoomLevelView() instead.'
    );
  }

  supportsFormat(format: string): boolean {
    return CodecConstants.instance.ImageFormat.isISyntaxFormat(format);
  }

  isProgressiveFormat(): boolean {
    return true;
  }
}

export { ISyntaxPixelDecoder };
