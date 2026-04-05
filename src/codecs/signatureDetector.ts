/**
 * Compressed stream signature detection.
 *
 * Mirrors the C++ JPGDecoder::ScaledGenericDecode signature-detection logic:
 *  1. Skip leading zero 2-byte pairs (padding).
 *  2. Read a 4-byte signature and classify the stream:
 *     - FF D8 FF E0  → JPEG  (JFIF SOI + APP0)
 *     - 00 00 00 0C  → JPEG 2000 (JP2 file-format box)
 *     - FF 4F FF 51  → JPEG 2000 (raw codestream SOC + SIZ)
 *  3. If no match, return 'unknown' (caller keeps the header-declared format).
 *
 * The C++ reads the 4 bytes as a little-endian uint32 and compares against
 * constants like 0xE0FFD8FF.  We compare byte-by-byte for clarity.
 */

const MIN_STREAM_BYTES = 20; // MIN_SIZE_OF_STREAM_IN_SHORTS * 2
const MAX_ZERO_PAIRS   = 8;  // MIN_SIZE_OF_STREAM_IN_SHORTS - 2

export type StreamCodec = 'jpeg' | 'j2k' | 'unknown';

export interface SignatureResult {
  /** Detected codec, or 'unknown' if signature not recognised. */
  codec: StreamCodec;
  /** Byte offset where the actual compressed data starts (after zero-padding). */
  dataOffset: number;
  /** Remaining data length after stripping zero-padding. */
  dataLength: number;
}

/**
 * Detect the codec of a compressed byte stream by inspecting its magic bytes.
 *
 * @param data       The raw compressed data (from iir.compressedPartition).
 * @param dataOffset Start offset within `data` (default 0).
 * @param dataLength Byte count to inspect (default data.length - dataOffset).
 */
export function detectStreamCodec(
  data: Uint8Array,
  dataOffset: number = 0,
  dataLength: number = data.length - dataOffset,
): SignatureResult {
  if (dataLength < MIN_STREAM_BYTES) {
    return { codec: 'unknown', dataOffset, dataLength };
  }

  let off = dataOffset;
  let len = dataLength;

  // Skip leading zero 2-byte pairs (C++: for i in 0..MAX_ZERO_PAIRS)
  for (let i = 0; i < MAX_ZERO_PAIRS; i++) {
    if (off + 1 >= data.length) break;
    // Check if the 2-byte value at `off` is zero (little-endian short)
    if (data[off] === 0 && data[off + 1] === 0) {
      off += 2;
      len -= 2;
      continue;
    }

    // Non-zero found — check 4-byte signature
    if (off + 3 < data.length) {
      const b0 = data[off];
      const b1 = data[off + 1];
      const b2 = data[off + 2];
      const b3 = data[off + 3];

      // JPEG: FF D8 FF E0
      if (b0 === 0xFF && b1 === 0xD8 && b2 === 0xFF && b3 === 0xE0) {
        return { codec: 'jpeg', dataOffset: off, dataLength: len };
      }
      // JPEG 2000 JP2 box: 00 00 00 0C
      if (b0 === 0x00 && b1 === 0x00 && b2 === 0x00 && b3 === 0x0C) {
        return { codec: 'j2k', dataOffset: off, dataLength: len };
      }
      // JPEG 2000 codestream: FF 4F FF 51
      if (b0 === 0xFF && b1 === 0x4F && b2 === 0xFF && b3 === 0x51) {
        return { codec: 'j2k', dataOffset: off, dataLength: len };
      }

      // No signature match — reset to original (C++ resets pData/codedDataLength)
      return { codec: 'unknown', dataOffset, dataLength };
    }
    break;
  }

  return { codec: 'unknown', dataOffset, dataLength };
}
