import type { ImageArray } from '../../core/types';
import { CodecConstants } from '../../core/constants';
import { DataViewBinaryReader } from '../../parsers/binary/DataViewBinaryReader';
import type { InitImageResponse } from '../../parsers/isyntax/InitImageResponse';
import { ISyntaxImage } from '../../imaging/model/ISyntaxImage';
import type { ZoomLevelView } from '../../imaging/model/ZoomLevelView';

class RiceAndSnakeDecoder {
  static decode(
    iir: InitImageResponse,
    zlv: ZoomLevelView,
    iSyntaxImage: ISyntaxImage
  ): { resultBuffer: ImageArray } {
    let numberOfElementsInOutput: number,
      decodedBuffer: ImageArray,
      binaryReader: DataViewBinaryReader,
      coderCode: number,
      bps: number,
      firstBps: number,
      firstValue: number,
      sampleCount: number,
      outputIndex: number,
      maskBits: number,
      mask: number,
      sVal: number,
      colCount: number,
      rowIsEven: boolean,
      previousValue: number,
      currentValue: number,
      sign: number,
      blockIndex: number,
      colIndexOfOddRow: number,
      previousValueCopy: number,
      checksum: number = 0,
      planeIndex: number,
      offset: number,
      index: number;

    const pixelLevel = zlv.pixelLevel;
    const cols = zlv.levelColumns;
    const rows = zlv.levelRows;
    const planes = zlv.planes;

    const buffers = zlv.getBuffersToDecode(1);
    const decodedBufferArray = buffers.buffersToDecode;
    const outputBuffer = buffers.resultBuffer;
    const numberOfElementsInOutputPerPlane = decodedBufferArray[0].length;
    const numberOfCodedBlocksWithDefaultSampleCount =
      numberOfElementsInOutputPerPlane >> 4;
    const defaultSamplesPerBlock = 16;

    offset = iir.coeffsOffset;
    if (!iir.serverResponse) {
      throw new Error('serverResponse is null');
    }
    binaryReader = new DataViewBinaryReader(iir.serverResponse, offset);

    const dataLength = new Int32Array(planes);
    for (index = 0; index < planes; ++index) {
      dataLength[index] = binaryReader.readInt32();
      offset += 4;
    }
    if (iir.version < ISyntaxImage.STENTOR_DTSIMAGE_VERSION4_0) {
      throw Error('Unsupported image format: ' + iir.format);
    } else {
      coderCode = binaryReader.readBits(8);
      offset += 1;
      if (
        CodecConstants.instance.CoderCode.getCoderCode(coderCode) !==
        CodecConstants.instance.CoderCode.RICE
      ) {
        throw Error('Unsupported coder code: ' + coderCode);
      }

      for (planeIndex = 0; planeIndex < planes; ++planeIndex) {
        decodedBuffer = decodedBufferArray[planeIndex];
        numberOfElementsInOutput = numberOfElementsInOutputPerPlane;

        // --- inlined decodePlane ---
        checksum = 0;
        previousValueCopy = 0;
        bps = binaryReader.readBits(5);
        firstBps = binaryReader.readBits(5);
        firstValue = binaryReader.readSignedValue(firstBps);
        blockIndex = numberOfCodedBlocksWithDefaultSampleCount;
        sampleCount = 0;
        outputIndex = 0;
        maskBits = 0;
        mask = 0;
        sVal = 0;
        colCount = cols;
        rowIsEven = true;
        previousValue = firstValue;

        do {
          maskBits = binaryReader.readBits(5);
          sampleCount = defaultSamplesPerBlock;
          // --- inlined decodeBlock ---
          do {
            if (maskBits !== bps) {
              mask = binaryReader.readBits(maskBits);
              sVal = binaryReader.scanToNext1();
              currentValue = (sVal & 1) ? (~sVal >> 1) : (sVal >> 1);
              currentValue = (currentValue << maskBits) | mask;
            } else {
              sign = binaryReader.readBit();
              currentValue = binaryReader.readBits(bps);
              if (sign) currentValue = -currentValue;
            }
            if (rowIsEven) {
              decodedBuffer[outputIndex++] = previousValue = currentValue + previousValue;
              checksum += previousValue;
              if (--colCount === 0) { rowIsEven = false; colCount = cols; }
            } else {
              decodedBuffer[outputIndex] = currentValue;
              checksum += currentValue;
              if (--colCount) {
                ++outputIndex;
              } else {
                rowIsEven = true;
                colCount = cols;
                colIndexOfOddRow = outputIndex++;
                do {
                  previousValueCopy = decodedBuffer[colIndexOfOddRow--] += previousValue;
                  checksum += previousValue;
                  previousValue = previousValueCopy;
                } while (--colCount);
                colCount = cols;
              }
            }
          } while (--sampleCount);
        } while (--blockIndex);

        if ((sampleCount = numberOfElementsInOutput & 0xf)) {
          maskBits = binaryReader.readBits(5);
          // --- inlined decodeBlock (non-default block) ---
          do {
            if (maskBits !== bps) {
              mask = binaryReader.readBits(maskBits);
              sVal = binaryReader.scanToNext1();
              currentValue = (sVal & 1) ? (~sVal >> 1) : (sVal >> 1);
              currentValue = (currentValue << maskBits) | mask;
            } else {
              sign = binaryReader.readBit();
              currentValue = binaryReader.readBits(bps);
              if (sign) currentValue = -currentValue;
            }
            if (rowIsEven) {
              decodedBuffer[outputIndex++] = previousValue = currentValue + previousValue;
              checksum += previousValue;
              if (--colCount === 0) { rowIsEven = false; colCount = cols; }
            } else {
              decodedBuffer[outputIndex] = currentValue;
              checksum += currentValue;
              if (--colCount) {
                ++outputIndex;
              } else {
                rowIsEven = true;
                colCount = cols;
                colIndexOfOddRow = outputIndex++;
                do {
                  previousValueCopy = decodedBuffer[colIndexOfOddRow--] += previousValue;
                  checksum += previousValue;
                  previousValue = previousValueCopy;
                } while (--colCount);
                colCount = cols;
              }
            }
          } while (--sampleCount);
        }

        if (
          planeIndex === 0 &&
          (checksum & 0xffffffff) !==
            (iir.levelChecksums![pixelLevel] & 0xffffffff)
        ) {
          throw Error('Checksum mismatch');
        }

        if (planeIndex < planes - 1) {
          offset += dataLength[planeIndex];
          binaryReader.seek(offset);
        }
      }

      iSyntaxImage.onFullLevelLLAvailable(outputBuffer, pixelLevel);
      iir.onDecode();
      return { resultBuffer: outputBuffer };
    }
  }
}

export { RiceAndSnakeDecoder };
