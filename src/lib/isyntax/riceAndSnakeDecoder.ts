import type { ImageArray } from './codecConstants';
import { CodecConstants } from './codecConstants';
import { DataViewBinaryReader } from './dataViewBinaryReader';
import type { InitImageResponse } from './initImageResponse';
import { ISyntaxImage } from './iSyntaxImage';
import type { ZoomLevelView } from './zoomLevelView';

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

    const decodeBlock = () => {
      do {
        if (maskBits !== bps) {
          mask = binaryReader.readBits(maskBits);
          sVal = binaryReader.scanToNext1();
          if (sVal & 0x01) {
            sVal = ~sVal >> 1;
          } else {
            sVal = sVal >> 1;
          }
          currentValue = (sVal << maskBits) | mask;
        } else {
          sign = binaryReader.readBit();
          currentValue = binaryReader.readBits(bps);
          if (sign) {
            currentValue = -currentValue;
          }
        }

        if (rowIsEven) {
          decodedBuffer[outputIndex++] = previousValue =
            currentValue + previousValue;
          checksum += previousValue;
          if (--colCount === 0) {
            rowIsEven = false;
            colCount = cols;
          }
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
              previousValueCopy = decodedBuffer[colIndexOfOddRow--] +=
                previousValue;
              checksum += previousValue;
              previousValue = previousValueCopy;
            } while (--colCount);
            colCount = cols;
          }
        }
      } while (--sampleCount);
    };

    const decodePlane = () => {
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
        decodeBlock();
      } while (--blockIndex);

      if ((sampleCount = numberOfElementsInOutput & 0xf)) {
        maskBits = binaryReader.readBits(5);
        decodeBlock();
      }
    };

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

    const dataLength = [];
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
        decodePlane();

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
