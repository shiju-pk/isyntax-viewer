/**
 * DecoderRegistry — maps image formats to their pixel decoder.
 *
 * O(1) lookup by format string.  Auto-registers the three built-in
 * decoders (iSyntax, JPEG, JPEG 2000).
 */

import type { IPixelDecoder } from './IPixelDecoder';
import { ISyntaxPixelDecoder } from './isyntax/ISyntaxPixelDecoder';
import { JPEGPixelDecoder } from './jpeg/JPEGPixelDecoder';
import { JPEG2000PixelDecoder } from './jpeg2000/JPEG2000PixelDecoder';
import { CodecConstants } from '../core/constants';

const _decoders: IPixelDecoder[] = [];
const _formatMap = new Map<string, IPixelDecoder>();

function register(decoder: IPixelDecoder): void {
  _decoders.push(decoder);
}

function rebuildFormatMap(): void {
  const fmt = CodecConstants.instance.ImageFormat;
  const allFormats = [
    fmt.MONO, fmt.YBRF8, fmt.YBRFE, fmt.YBRP8, fmt.YBRPE,
    fmt.JPEG_RGB, fmt.JPEG_MONO, fmt.J2K_RGB, fmt.J2K_MONO,
  ];
  _formatMap.clear();
  for (const f of allFormats) {
    for (const d of _decoders) {
      if (d.supportsFormat(f)) {
        _formatMap.set(f, d);
        break;
      }
    }
  }
}

// Auto-register built-in decoders (order matters: first match wins)
register(new ISyntaxPixelDecoder());
register(new JPEGPixelDecoder());
register(new JPEG2000PixelDecoder());
rebuildFormatMap();

/**
 * Get the decoder that handles the given format string.
 * Returns undefined if no decoder is registered for the format.
 */
function getDecoder(format: string): IPixelDecoder | undefined {
  return _formatMap.get(format);
}

export const DecoderRegistry = {
  register,
  getDecoder,
  rebuildFormatMap,
} as const;
