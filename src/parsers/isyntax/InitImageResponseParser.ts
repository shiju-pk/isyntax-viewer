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
    iir.version = iirDataView.getInt32(pos, true);
    pos += 4;

    iir.format = fmt.getImageFormat(iirDataView.getInt32(pos, true));
    pos += 4;

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
      // Header continues with rows, cols, then compressed partition:
      //   [rows:i16] [cols:i16] [partitionLength:u32] [raw JPEG/J2K bytes]
      iir.rows = iirDataView.getInt16(pos, true);
      pos += 2;

      iir.cols = iirDataView.getInt16(pos, true);
      pos += 2;

      // Compressed partition: 4-byte length prefix then raw compressed data
      const partitionLength = iirDataView.getUint32(pos, true);
      pos += 4;

      if (partitionLength > 0 && pos + partitionLength <= initImageServerResponse.byteLength) {
        iir.compressedPartition = initImageServerResponse.subarray(pos, pos + partitionLength);
        iir.compressedPartitionLength = partitionLength;
      }

      // JPEG/J2K has no wavelet levels — full resolution in one shot
      iir.xformLevels = 0;
      iir.coeffBitDepth = 0;
      iir.serverResponse = initImageServerResponse;

    } else {
      throw new Error('Unsupported image format: ' + iir.format);
    }

    return iir;
  }
}

export { InitImageResponseParser };
