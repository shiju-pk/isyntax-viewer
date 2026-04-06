import { CodecConstants } from '../../core/constants';
import { InitImageResponse } from './InitImageResponse';

class InitImageResponseParser {
  constructor() {}

  static parse(initImageServerResponse: Uint8Array): InitImageResponse {
    const iir = new InitImageResponse();
    const fmt = CodecConstants.instance.ImageFormat;

    const iirDataView = new DataView(
      initImageServerResponse.buffer,
      initImageServerResponse.byteOffset,
      initImageServerResponse.byteLength
    );
    let pos = 0;

    // --- Common header (all formats) ---
    // Diagnostic: hex dump of first 64 bytes to debug server response layout
    const dumpLen = Math.min(64, initImageServerResponse.byteLength);
    const hexBytes = Array.from(initImageServerResponse.subarray(0, dumpLen))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    console.debug(`[InitImageParser] Raw first ${dumpLen} bytes:`, hexBytes,
      `totalLen=${initImageServerResponse.byteLength}`);

    iir.version = iirDataView.getInt32(pos, true);
    pos += 4;

    const rawFormatInt = iirDataView.getInt32(pos, true);
    iir.format = fmt.getImageFormat(rawFormatInt);
    pos += 4;

    console.debug(`[InitImageParser] version=0x${iir.version.toString(16)}, formatInt=${rawFormatInt}, format=${iir.format}`);

    if (fmt.isISyntaxFormat(iir.format)) {
      // --- iSyntax wavelet format (MONO / YBR*) ---
      iir.rows = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.cols = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.quantLevel = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.quantValue = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.xformLevels = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.partitionSize = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.coeffBitDepth = iirDataView.getInt16(pos, true);
      pos += 2;

      const numCheckSums = iirDataView.getInt32(pos, true);
      pos += 4;

      iir.levelChecksums = [];
      for (let index = 0; index < numCheckSums; ++index) {
        iir.levelChecksums[index] = iirDataView.getInt32(pos, true);
        pos += 4;
      }

      iir.dataLength = iirDataView.getInt32(pos, true);
      pos += 4;

      iir.serverResponse = initImageServerResponse;
      iir.coeffsOffset = pos;

    } else if (fmt.isJPEGFormat(iir.format)) {
      // --- JPEG / JPEG 2000 format ---
      // Parse the standard iSyntax header fields (same layout as wavelet).
      iir.rows = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.cols = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.quantLevel = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.quantValue = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.xformLevels = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.partitionSize = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.coeffBitDepth = iirDataView.getInt16(pos, true);
      pos += 2;

      const numCheckSums = iirDataView.getInt32(pos, true);
      pos += 4;

      iir.levelChecksums = [];
      for (let index = 0; index < numCheckSums; ++index) {
        iir.levelChecksums[index] = iirDataView.getInt32(pos, true);
        pos += 4;
      }

      iir.dataLength = iirDataView.getInt32(pos, true);
      pos += 4;

      const headerEnd = pos;

      // Robust extraction: scan the raw response from byte 8 (after version+format)
      // for JPEG (FF D8) or J2K (FF 4F / 00 00 00 0C) magic bytes.
      // This handles any header layout variation.
      const sigOffset = InitImageResponseParser._findCompressedDataStart(
        initImageServerResponse, 8,
      );

      if (sigOffset >= 0) {
        iir.compressedPartition = initImageServerResponse.subarray(sigOffset);
        iir.compressedPartitionLength = initImageServerResponse.byteLength - sigOffset;
      } else {
        // No signature found — fall back to header-derived offset
        const compressedLength = iir.dataLength > 0
          ? iir.dataLength
          : (initImageServerResponse.byteLength - headerEnd);

        if (compressedLength > 0 && headerEnd + compressedLength <= initImageServerResponse.byteLength) {
          iir.compressedPartition = initImageServerResponse.subarray(headerEnd, headerEnd + compressedLength);
          iir.compressedPartitionLength = compressedLength;
        } else if (initImageServerResponse.byteLength > headerEnd) {
          iir.compressedPartition = initImageServerResponse.subarray(headerEnd);
          iir.compressedPartitionLength = initImageServerResponse.byteLength - headerEnd;
        }
      }

      iir.serverResponse = initImageServerResponse;
      iir.coeffsOffset = headerEnd;

      // Diagnostic: remove after confirming JPEG/J2K parsing works
      const cpHex = iir.compressedPartition
        ? Array.from(iir.compressedPartition.subarray(0, Math.min(16, iir.compressedPartition.length)))
            .map(b => b.toString(16).padStart(2, '0')).join(' ')
        : 'null';
      console.debug(
        '[InitImageParser] JPEG/J2K:',
        `format=${iir.format}, rows=${iir.rows}, cols=${iir.cols},`,
        `dataLength=${iir.dataLength}, sigOffset=${sigOffset}, headerEnd=${headerEnd},`,
        `compressedPartitionLen=${iir.compressedPartitionLength},`,
        `first16=${cpHex}`,
      );

    } else {
      throw new Error('Unsupported image format: ' + iir.format);
    }

    return iir;
  }

  /**
   * Scan raw bytes for the start of JPEG or JPEG 2000 compressed data.
   * Returns the byte offset of the first match, or -1 if not found.
   *
   * Signatures:
   *  - JPEG:  FF D8 FF  (SOI + any marker)
   *  - J2K codestream: FF 4F FF 51  (SOC + SIZ)
   *  - JP2 file box:   00 00 00 0C 6A 50  (JP2 signature box)
   */
  static _findCompressedDataStart(data: Uint8Array, startOffset: number): number {
    const len = data.length;
    for (let i = startOffset; i < len - 2; i++) {
      // JPEG SOI: FF D8 FF
      if (data[i] === 0xFF && data[i + 1] === 0xD8 && data[i + 2] === 0xFF) {
        return i;
      }
      // J2K codestream SOC: FF 4F FF 51
      if (i + 3 < len &&
          data[i] === 0xFF && data[i + 1] === 0x4F &&
          data[i + 2] === 0xFF && data[i + 3] === 0x51) {
        return i;
      }
      // JP2 file format box: 00 00 00 0C 6A 50 (length=12, type='jP')
      if (i + 5 < len &&
          data[i] === 0x00 && data[i + 1] === 0x00 &&
          data[i + 2] === 0x00 && data[i + 3] === 0x0C &&
          data[i + 4] === 0x6A && data[i + 5] === 0x50) {
        return i;
      }
    }
    return -1;
  }
}

export { InitImageResponseParser };
