import { CodecConstants } from '../../core/constants';
import { InitImageResponse } from './InitImageResponse';

class InitImageResponseParser {
  constructor() {}

  static parse(initImageServerResponse: Uint8Array): InitImageResponse {
    const iir = new InitImageResponse();

    const iirDataView = new DataView(
      initImageServerResponse.buffer,
      initImageServerResponse.byteOffset,
      initImageServerResponse.byteLength
    );
    let pos = 0;

    iir.version = iirDataView.getInt32(pos, true);
    pos += 4;

    iir.format = CodecConstants.instance.ImageFormat.getImageFormat(
      iirDataView.getInt32(pos, true)
    );
    // only MONO and RGB are supported currently.
    if (
      iir.format === CodecConstants.instance.ImageFormat.MONO ||
      iir.format === CodecConstants.instance.ImageFormat.YBRF8 ||
      iir.format === CodecConstants.instance.ImageFormat.YBRFE ||
      iir.format === CodecConstants.instance.ImageFormat.YBRP8 ||
      iir.format === CodecConstants.instance.ImageFormat.YBRPE
    ) {
      pos += 4;

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
    } else {
      throw new Error('Unsupported image format: ' + iir.format);
    }

    return iir;
  }
}

export { InitImageResponseParser };
