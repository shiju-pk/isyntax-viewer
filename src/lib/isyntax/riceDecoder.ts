import type { ImageArray } from './codecConstants';
import { CodecConstants } from './codecConstants';
import type { GetCoefficientsResponse } from './getCoefficientsResponse';
import type { ZoomLevelView } from './zoomLevelView';
import { ISyntaxImage } from './iSyntaxImage';
import { DataViewBinaryReader } from './dataViewBinaryReader';

class RiceDecoder {
  static decode(
    gcr: GetCoefficientsResponse,
    zlv: ZoomLevelView,
    iSyntaxImage: ISyntaxImage
  ): { resultBuffer: ImageArray } {
    let decodedBuffer: ImageArray,
      numPartitions: number,
      partitionLength: Uint32Array,
      partitionIndex: number,
      partitionSize: number,
      partitionSize_1: number,
      numRowPartitions: number,
      numColPartitions: number,
      partitionRowIndex: number,
      partitionColIndex: number,
      partitionRowStart: number,
      partitionColStart: number,
      outputSpan: number,
      partitionRowStartInBuffer: number,
      hlStart: number,
      hhStart: number,
      lhOffset: number,
      hlOffset: number,
      hhOffset: number,
      offset: number,
      coderCode: number,
      lhbps: number,
      hlbps: number,
      hhbps: number,
      bps: number,
      defaultSamplesPerBlock: number,
      rowCount: number,
      quadrantCount: number,
      partitionStartOffset: number,
      numberOfCodedBlocksWithDefaultSampleCount: number,
      sampleCountInNonDefaultSizedBlock: number,
      sampleCount: number,
      outputIndex: number,
      maskBits: number,
      mask: number,
      sVal: number,
      blockIndex: number,
      sign: number,
      dataLength: number[],
      index: number,
      planeIndex: number,
      planeOffset: number;

    const rows = zlv.levelRows;
    const cols = zlv.levelColumns;
    const planes = zlv.planes;

    function decodeBlock() {
      do {
        if (maskBits !== bps) {
          mask = binaryReader.readBits(maskBits);
          sVal = binaryReader.scanToNext1();
          if (sVal & 0x01) {
            // odd value, which means the actual value is negative
            sVal = ~sVal >> 1; // equivalent to: sval = -(sval+1)/2
          } else {
            sVal = sVal >> 1; // equivalent to: sval = sval/2
          }
          decodedBuffer[offset++] = (sVal << maskBits) | mask;
        } else {
          // TODO: Test maskBits === bps
          sign = binaryReader.readBit();
          sVal = binaryReader.readBits(bps);
          if (sign) {
            sVal = -sVal;
          }
          decodedBuffer[offset++] = sVal;
        }
      } while (--sampleCount);
    }

    const iir = iSyntaxImage.getIIR();
    if (!iir) {
      throw new Error('InitImageResponse is null');
    }
    const checkCoderCode =
      iir.version >= ISyntaxImage.STENTOR_DTSIMAGE_VERSION4_0;
    const buffers = zlv.getBuffersToDecode(3);
    const decodedBufferArray = buffers.buffersToDecode;
    const outputBuffer = buffers.resultBuffer;

    if (!gcr.serverResponse) {
      throw new Error('serverResponse is null');
    }
    const binaryReader = new DataViewBinaryReader(
      gcr.serverResponse,
      gcr.coefficientsOffset
    );

    numPartitions = binaryReader.readInt32();
    partitionLength = new Uint32Array(new ArrayBuffer(numPartitions << 2));
    for (partitionIndex = 0; partitionIndex < numPartitions; ++partitionIndex) {
      partitionLength[partitionIndex] = binaryReader.readInt32();
    }

    partitionSize = this.GetPartitionDimension(
      iir.rows,
      iir.cols
    );
    partitionSize_1 = partitionSize - 1;
    numRowPartitions = ((rows + partitionSize_1) / partitionSize) >> 0;
    numColPartitions = ((cols + partitionSize_1) / partitionSize) >> 0;
    // Sanity check
    if (numPartitions !== numRowPartitions * numColPartitions) {
      throw new Error(
        'Invalid number of partitions' +
          numPartitions +
          ' !== ' +
          numRowPartitions +
          ' * ' +
          numColPartitions
      );
    }
    partitionIndex = 0;
    let partitionRows = partitionSize;
    let partitionCols = partitionSize;
    outputSpan = 3 * cols;
    partitionRowStartInBuffer = 0;
    hlStart = cols;
    hhStart = cols << 1;
    lhOffset = 0;
    defaultSamplesPerBlock = 16;
    rowCount = 0;
    quadrantCount = 0;
    partitionStartOffset = binaryReader.getCurrentOffsetInBytes(); // byte offset

    for (
      partitionRowIndex = 0, partitionRowStart = 0;
      partitionRowIndex < numRowPartitions;
      ++partitionRowIndex, partitionRowStart += partitionSize
    ) {
      if (partitionRowStart + partitionSize > rows) {
        // We are dealing with the last row of partitions
        partitionRows = rows - partitionRowStart;
      }
      partitionRowStartInBuffer = partitionRowStart * outputSpan;

      for (
        partitionColIndex = 0,
          partitionColStart = 0,
          partitionCols = partitionSize;
        partitionColIndex < numColPartitions;
        ++partitionColIndex,
          partitionColStart += partitionSize,
          ++partitionIndex
      ) {
        if (partitionColStart + partitionSize > cols) {
          partitionCols = cols - partitionColStart;
        }

        // Seek the stream to partition start
        binaryReader.seek(partitionStartOffset);
        planeOffset = partitionStartOffset;
        // Increment the start for next partition.
        partitionStartOffset += partitionLength[partitionIndex];

        // Get partition header, which is the dataLength of each plane.
        dataLength = [];
        for (index = 0; index < planes; ++index) {
          // Read data length, 4 bytes
          dataLength[index] = binaryReader.readInt32();
          planeOffset += 4;
        }

        if (checkCoderCode) {
          // Read coder code - 1 byte
          coderCode = binaryReader.readBits(8);
          planeOffset += 1;
          if (
            CodecConstants.instance.CoderCode.getCoderCode(coderCode) !==
            CodecConstants.instance.CoderCode.RICE
          ) {
            throw new Error('Unsupported coder code: ' + coderCode);
          }
        }

        numberOfCodedBlocksWithDefaultSampleCount = partitionCols >> 4;
        sampleCountInNonDefaultSizedBlock = partitionCols & 0xf;

        // From this point onwards, the code follows the algorithm in
        // RiceDecoder<DataType>::Decode( ... )
        for (planeIndex = 0; planeIndex < planes; ++planeIndex) {
          // Calculate the starting offsets for each quadrant
          lhOffset = partitionRowStartInBuffer + partitionColStart;
          hlOffset = hlStart + lhOffset;
          hhOffset = hhStart + lhOffset;

          decodedBuffer = decodedBufferArray[planeIndex];

          lhbps = binaryReader.readBits(5);
          hlbps = binaryReader.readBits(5);
          hhbps = binaryReader.readBits(5);

          sampleCount = 0;
          outputIndex = 0;
          maskBits = 0;
          mask = 0;
          sVal = 0;

          rowCount = partitionRows;
          do {
            quadrantCount = 3;
            do {
              switch (quadrantCount) {
                case 3:
                  offset = lhOffset;
                  bps = lhbps;
                  break;
                case 2:
                  offset = hlOffset;
                  bps = hlbps;
                  break;
                case 1:
                  offset = hhOffset;
                  bps = hhbps;
                  break;
              }

              if (numberOfCodedBlocksWithDefaultSampleCount) {
                blockIndex = numberOfCodedBlocksWithDefaultSampleCount;
                do {
                  maskBits = binaryReader.readBits(5);
                  sampleCount = defaultSamplesPerBlock;
                  decodeBlock();
                } while (--blockIndex);
              }
              if ((sampleCount = sampleCountInNonDefaultSizedBlock)) {
                // We are dealing with the last block that does not have the default number of samples.
                maskBits = binaryReader.readBits(5);
                decodeBlock();
              }
            } while (--quadrantCount);

            // We are done decoding one row.
            // Increment the output offset to the next row.
            lhOffset += outputSpan;
            hlOffset += outputSpan;
            hhOffset += outputSpan;
          } while (--rowCount);

          // This is required since the decode may not read the last block
          if (planeIndex < planes - 1) {
            planeOffset += dataLength[planeIndex];
            binaryReader.seek(planeOffset);
          }
        }
      }
    }
    zlv.setFullLevelCoefficients(outputBuffer);

    return { resultBuffer: outputBuffer };
  }

  static GetPartitionDimension(rows: number, columns: number): number {
    const maxVal = Math.max(rows, columns);
    if (maxVal <= 768) {
      return 16;
    } else if (maxVal <= 1024) {
      return 32;
    } else {
      return 64;
    }
  }
}
export { RiceDecoder };
