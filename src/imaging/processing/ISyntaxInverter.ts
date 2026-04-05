import type { ImageArray } from '../../core/types';
import type { ISyntaxImage } from '../model/ISyntaxImage';
import type { ZoomLevelView } from '../model/ZoomLevelView';

// Module-level grow-only pool for hTempArray to avoid per-call allocations
let _pooledInt16: Int16Array | null = null;
let _pooledInt32: Int32Array | null = null;

function getPooledHTemp(rows: number, is16bit: boolean): ImageArray {
  if (is16bit) {
    if (!_pooledInt16 || _pooledInt16.length < rows) {
      _pooledInt16 = new Int16Array(rows);
    }
    return _pooledInt16;
  } else {
    if (!_pooledInt32 || _pooledInt32.length < rows) {
      _pooledInt32 = new Int32Array(rows);
    }
    return _pooledInt32;
  }
}

class ISyntaxInvertor {
  static z5_3_synthesize(
    outputImage: ImageArray,
    rows: number,
    cols: number,
    spanOutput: number,
    LL: ImageArray,
    spanLL: number,
    LH: ImageArray,
    HL: ImageArray,
    HH: ImageArray,
    spanLHHLHH: number,
    pixelLevel: number,
    imageUID: string
  ): number {
    let sum: number,
      rowsOfLows: number,
      colsOfLows: number,
      hTempArray: ImageArray,
      locationOfLL: number,
      locationOfLHHLHH: number,
      valueOfHLMinusOne: number,
      valueOfHHMinusOne: number,
      valueOfHL: number,
      valueOfHH: number,
      indexOfHBuffer: number,
      valueOfH: number,
      valueOfHOdd: number,
      valueOfHMinus2: number,
      valueOfL: number,
      valueOfLMinus2: number,
      outputLocationEven: number,
      outputValueAtEvenLocation: number,
      outputValueAtEvenLocationMinus2: number,
      twoTimesSpanOutput: number,
      rowIndex: number,
      valueOfHPreviousCol: number,
      outputLocationPreviousRow: number,
      outputValueAtPreviousRow: number,
      colIndex: number,
      outputLocation: number,
      outputLocationMinusSpan: number,
      outputValueTemp: number,
      rowSizeIsEven: boolean,
      colSizeIsEven: boolean,
      lastRowIndex: number,
      lastColIndex: number;

    rowSizeIsEven = !(rows & 0x1);
    colSizeIsEven = !(cols & 0x1);

    lastRowIndex = rows - 1;
    lastColIndex = cols - 1;

    sum = 0;

    rowsOfLows = ((rows + 1) / 2) | 0;
    colsOfLows = ((cols + 1) / 2) | 0;

    if (outputImage instanceof Int16Array) {
      hTempArray = getPooledHTemp(rows, true);
    } else if (outputImage instanceof Int32Array) {
      hTempArray = getPooledHTemp(rows, false);
    } else {
      throw new Error(`Invalid buffer type: ${pixelLevel}, ${imageUID}`);
    }

    locationOfLL = 0;
    locationOfLHHLHH = 0;
    valueOfHLMinusOne = 0;
    valueOfHHMinusOne = 0;
    valueOfHL = HL[locationOfLHHLHH];
    valueOfHH = HH[locationOfLHHLHH];

    indexOfHBuffer = 0;
    valueOfH = 0;
    valueOfHOdd = 0;
    valueOfHMinus2 = 0;
    valueOfL = LL[locationOfLL] - ((valueOfHL + 1) >> 1);
    locationOfLL += spanLL;
    valueOfLMinus2 = 0;
    hTempArray[indexOfHBuffer++] = valueOfH =
      LH[locationOfLHHLHH] - ((valueOfHH + 1) >> 1);
    locationOfLHHLHH += spanLHHLHH;

    outputLocationEven = 0;
    outputValueAtEvenLocation = 0;
    outputValueAtEvenLocationMinus2 = 0;

    outputImage[outputLocationEven] = outputValueAtEvenLocation =
      valueOfL - ((valueOfH + 1) >> 1);
    sum += outputValueAtEvenLocation;
    twoTimesSpanOutput = spanOutput << 1;
    outputLocationEven += twoTimesSpanOutput;

    for (rowIndex = 2; rowIndex < lastRowIndex; rowIndex += 2) {
      valueOfHLMinusOne = valueOfHL;
      valueOfHL = HL[locationOfLHHLHH];
      valueOfLMinus2 = valueOfL;
      valueOfL = LL[locationOfLL] - ((valueOfHLMinusOne + valueOfHL + 2) >> 2);
      locationOfLL += spanLL;

      valueOfHHMinusOne = valueOfHH;
      valueOfHH = HH[locationOfLHHLHH];
      valueOfHMinus2 = valueOfH;
      hTempArray[indexOfHBuffer++] = valueOfH =
        LH[locationOfLHHLHH] - ((valueOfHHMinusOne + valueOfHH + 2) >> 2);
      locationOfLHHLHH += spanLHHLHH;

      outputValueAtEvenLocationMinus2 = outputValueAtEvenLocation;
      outputImage[outputLocationEven] = outputValueAtEvenLocation =
        valueOfL - ((valueOfH + 1) >> 1);
      sum += outputValueAtEvenLocation;

      hTempArray[indexOfHBuffer++] = valueOfHOdd =
        valueOfHHMinusOne + ((valueOfHMinus2 + valueOfH) >> 1);
      outputImage[outputLocationEven - spanOutput] = outputValueTemp =
        valueOfHLMinusOne +
        ((valueOfLMinus2 + valueOfL) >> 1) -
        ((valueOfHOdd + 1) >> 1);
      sum += outputValueTemp;
      outputLocationEven += twoTimesSpanOutput;
    }

    if (rowSizeIsEven) {
      hTempArray[indexOfHBuffer] = valueOfHOdd = valueOfHH + valueOfH;
      outputImage[outputLocationEven - spanOutput] = outputValueTemp =
        valueOfHL + valueOfL - ((valueOfHOdd + 1) >> 1);
      sum += outputValueTemp;
    } else {
      valueOfLMinus2 = valueOfL;
      valueOfL = LL[locationOfLL] - ((valueOfHL + 1) >> 1);
      valueOfHMinus2 = valueOfH;
      hTempArray[indexOfHBuffer++] = valueOfH =
        LH[locationOfLHHLHH] - ((valueOfHH + 1) >> 1);

      outputValueAtEvenLocationMinus2 = outputValueAtEvenLocation;
      outputImage[outputLocationEven] = outputValueAtEvenLocation =
        valueOfL - ((valueOfH + 1) >> 1);
      sum += outputValueAtEvenLocation;

      hTempArray[indexOfHBuffer] = valueOfHOdd =
        valueOfHH + ((valueOfHMinus2 + valueOfH) >> 1);
      outputImage[outputLocationEven - spanOutput] = outputValueTemp =
        valueOfHL +
        ((valueOfLMinus2 + valueOfL) >> 1) -
        ((valueOfHOdd + 1) >> 1);
      sum += outputValueTemp;
    }

    valueOfHPreviousCol = 0;
    outputLocationPreviousRow = 0;
    outputValueAtPreviousRow = 0;

    for (colIndex = 2; colIndex < lastColIndex; colIndex += 2) {
      locationOfLL = colIndex >> 1;
      locationOfLHHLHH = locationOfLL;
      valueOfHL = HL[locationOfLHHLHH];
      valueOfHH = HH[locationOfLHHLHH];

      indexOfHBuffer = 0;
      valueOfL = LL[locationOfLL] - ((valueOfHL + 1) >> 1);
      locationOfLL += spanLL;

      valueOfH = LH[locationOfLHHLHH] - ((valueOfHH + 1) >> 1);
      locationOfLHHLHH += spanLHHLHH;

      outputLocationEven = colIndex;

      valueOfHPreviousCol = hTempArray[indexOfHBuffer];
      outputImage[outputLocationEven] = outputValueAtEvenLocation =
        valueOfL - ((valueOfHPreviousCol + valueOfH + 2) >> 2);
      sum += outputValueAtEvenLocation;
      hTempArray[indexOfHBuffer++] = valueOfH;

      outputImage[outputLocationEven - 1] = outputValueTemp =
        valueOfHPreviousCol +
        ((outputImage[outputLocationEven - 2] + outputValueAtEvenLocation) >>
          1);
      sum += outputValueTemp;

      outputLocationEven += twoTimesSpanOutput;

      for (rowIndex = 2; rowIndex < lastRowIndex; rowIndex += 2) {
        valueOfHLMinusOne = valueOfHL;
        valueOfHL = HL[locationOfLHHLHH];
        valueOfLMinus2 = valueOfL;
        valueOfL =
          LL[locationOfLL] - ((valueOfHLMinusOne + valueOfHL + 2) >> 2);

        valueOfHHMinusOne = valueOfHH;
        valueOfHH = HH[locationOfLHHLHH];
        valueOfHMinus2 = valueOfH;
        valueOfH =
          LH[locationOfLHHLHH] - ((valueOfHHMinusOne + valueOfHH + 2) >> 2);
        locationOfLHHLHH += spanLHHLHH;
        locationOfLL += spanLL;

        valueOfHPreviousCol = hTempArray[indexOfHBuffer];
        outputValueAtEvenLocationMinus2 = outputValueAtEvenLocation;
        outputImage[outputLocationEven] = outputValueAtEvenLocation =
          valueOfL - ((valueOfHPreviousCol + valueOfH + 2) >> 2);
        sum += outputValueAtEvenLocation;
        hTempArray[indexOfHBuffer++] = valueOfH;

        outputImage[outputLocationEven - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationEven - 2] + outputValueAtEvenLocation) >>
            1);
        sum += outputValueTemp;

        outputLocationPreviousRow = outputLocationEven - spanOutput;
        valueOfHOdd = valueOfHHMinusOne + ((valueOfHMinus2 + valueOfH) >> 1);
        valueOfHPreviousCol = hTempArray[indexOfHBuffer];
        outputImage[outputLocationPreviousRow] = outputValueAtPreviousRow =
          valueOfHLMinusOne +
          ((valueOfLMinus2 + valueOfL) >> 1) -
          ((valueOfHPreviousCol + valueOfHOdd + 2) >> 2);
        sum += outputValueAtPreviousRow;

        hTempArray[indexOfHBuffer++] = valueOfHOdd;

        outputImage[outputLocationPreviousRow - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationPreviousRow - 2] +
            outputValueAtPreviousRow) >>
            1);
        sum += outputValueTemp;

        outputLocationEven += twoTimesSpanOutput;
      }

      if (rowSizeIsEven) {
        valueOfHPreviousCol = hTempArray[indexOfHBuffer];
        hTempArray[indexOfHBuffer] = valueOfHOdd = valueOfHH + valueOfH;
        outputLocationPreviousRow = outputLocationEven - spanOutput;
        outputImage[outputLocationPreviousRow] = outputValueAtPreviousRow =
          valueOfHL + valueOfL - ((valueOfHPreviousCol + valueOfHOdd + 2) >> 2);
        sum += outputValueAtPreviousRow;
        outputImage[outputLocationPreviousRow - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationPreviousRow - 2] +
            outputValueAtPreviousRow) >>
            1);
        sum += outputValueTemp;
      } else {
        valueOfLMinus2 = valueOfL;
        valueOfL = LL[locationOfLL] - ((valueOfHL + 1) >> 1);

        valueOfHMinus2 = valueOfH;
        valueOfH = LH[locationOfLHHLHH] - ((valueOfHH + 1) >> 1);

        valueOfHPreviousCol = hTempArray[indexOfHBuffer];
        outputValueAtEvenLocationMinus2 = outputValueAtEvenLocation;
        outputImage[outputLocationEven] = outputValueAtEvenLocation =
          valueOfL - ((valueOfHPreviousCol + valueOfH + 2) >> 2);
        sum += outputValueAtEvenLocation;
        hTempArray[indexOfHBuffer++] = valueOfH;

        outputImage[outputLocationEven - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationEven - 2] + outputValueAtEvenLocation) >>
            1);
        sum += outputValueTemp;

        outputLocationPreviousRow = outputLocationEven - spanOutput;
        valueOfHPreviousCol = hTempArray[indexOfHBuffer];
        hTempArray[indexOfHBuffer] = valueOfHOdd =
          valueOfHH + ((valueOfHMinus2 + valueOfH) >> 1);

        outputImage[outputLocationPreviousRow] = outputValueAtPreviousRow =
          valueOfHL +
          ((valueOfLMinus2 + valueOfL) >> 1) -
          ((valueOfHPreviousCol + valueOfHOdd + 2) >> 2);
        sum += outputValueAtPreviousRow;

        outputImage[outputLocationPreviousRow - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationPreviousRow - 2] +
            outputValueAtPreviousRow) >>
            1);
        sum += outputValueTemp;
      }
    }

    if (colSizeIsEven) {
      indexOfHBuffer = 0;
      outputLocation = lastColIndex;
      outputImage[outputLocation] = outputValueTemp =
        hTempArray[indexOfHBuffer++] + outputImage[outputLocation - 1];
      sum += outputValueTemp;

      outputLocation += twoTimesSpanOutput;
      outputLocationMinusSpan = outputLocation - spanOutput;
      for (rowIndex = 2; rowIndex < lastRowIndex; rowIndex += 2) {
        outputImage[outputLocation] = outputValueTemp =
          hTempArray[indexOfHBuffer++] + outputImage[outputLocation - 1];
        sum += outputValueTemp;
        outputImage[outputLocationMinusSpan] = outputValueTemp =
          hTempArray[indexOfHBuffer++] +
          outputImage[outputLocationMinusSpan - 1];
        sum += outputValueTemp;
        outputLocation += twoTimesSpanOutput;
        outputLocationMinusSpan = outputLocation - spanOutput;
      }

      if (rowSizeIsEven) {
        outputImage[outputLocationMinusSpan] = outputValueTemp =
          hTempArray[indexOfHBuffer] + outputImage[outputLocationMinusSpan - 1];
        sum += outputValueTemp;
      } else {
        outputImage[outputLocation] = outputValueTemp =
          hTempArray[indexOfHBuffer++] + outputImage[outputLocation - 1];
        sum += outputValueTemp;

        outputImage[outputLocationMinusSpan] = outputValueTemp =
          hTempArray[indexOfHBuffer] + outputImage[outputLocationMinusSpan - 1];
        sum += outputValueTemp;
      }
    } else {
      locationOfLL = colIndex >> 1;
      locationOfLHHLHH = locationOfLL;
      valueOfHL = HL[locationOfLHHLHH];

      indexOfHBuffer = 0;
      valueOfL = LL[locationOfLL] - ((valueOfHL + 1) >> 1);
      locationOfLL += spanLL;

      locationOfLHHLHH += spanLHHLHH;

      outputLocationEven = colIndex;

      valueOfHPreviousCol = hTempArray[indexOfHBuffer++];
      outputImage[outputLocationEven] = outputValueAtEvenLocation =
        valueOfL - ((valueOfHPreviousCol + 1) >> 1);
      sum += outputValueAtEvenLocation;

      outputImage[outputLocationEven - 1] = outputValueTemp =
        valueOfHPreviousCol +
        ((outputImage[outputLocationEven - 2] + outputValueAtEvenLocation) >>
          1);
      sum += outputValueTemp;

      outputLocationEven += twoTimesSpanOutput;

      for (rowIndex = 2; rowIndex < lastRowIndex; rowIndex += 2) {
        valueOfHLMinusOne = valueOfHL;
        valueOfHL = HL[locationOfLHHLHH];
        valueOfLMinus2 = valueOfL;
        valueOfL =
          LL[locationOfLL] - ((valueOfHLMinusOne + valueOfHL + 2) >> 2);

        locationOfLHHLHH += spanLHHLHH;
        locationOfLL += spanLL;

        valueOfHPreviousCol = hTempArray[indexOfHBuffer++];
        outputValueAtEvenLocationMinus2 = outputValueAtEvenLocation;
        outputImage[outputLocationEven] = outputValueAtEvenLocation =
          valueOfL - ((valueOfHPreviousCol + 1) >> 1);
        sum += outputValueAtEvenLocation;

        outputImage[outputLocationEven - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationEven - 2] + outputValueAtEvenLocation) >>
            1);
        sum += outputValueTemp;

        outputLocationPreviousRow = outputLocationEven - spanOutput;
        valueOfHPreviousCol = hTempArray[indexOfHBuffer++];
        outputImage[outputLocationPreviousRow] = outputValueAtPreviousRow =
          valueOfHLMinusOne +
          ((valueOfLMinus2 + valueOfL) >> 1) -
          ((valueOfHPreviousCol + 1) >> 1);
        sum += outputValueAtPreviousRow;

        outputImage[outputLocationPreviousRow - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationPreviousRow - 2] +
            outputValueAtPreviousRow) >>
            1);
        sum += outputValueTemp;

        outputLocationEven += twoTimesSpanOutput;
      }

      if (rowSizeIsEven) {
        valueOfHPreviousCol = hTempArray[indexOfHBuffer];
        outputLocationPreviousRow = outputLocationEven - spanOutput;
        outputImage[outputLocationPreviousRow] = outputValueAtPreviousRow =
          valueOfHL + valueOfL - ((valueOfHPreviousCol + 1) >> 1);
        sum += outputValueAtPreviousRow;
        outputImage[outputLocationPreviousRow - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationPreviousRow - 2] +
            outputValueAtPreviousRow) >>
            1);
        sum += outputValueTemp;
      } else {
        valueOfLMinus2 = valueOfL;
        valueOfL = LL[locationOfLL] - ((valueOfHL + 1) >> 1);

        valueOfHPreviousCol = hTempArray[indexOfHBuffer++];
        outputValueAtEvenLocationMinus2 = outputValueAtEvenLocation;
        outputImage[outputLocationEven] = outputValueAtEvenLocation =
          valueOfL - ((valueOfHPreviousCol + 1) >> 1);
        sum += outputValueAtEvenLocation;

        outputImage[outputLocationEven - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationEven - 2] + outputValueAtEvenLocation) >>
            1);
        sum += outputValueTemp;

        outputLocationPreviousRow = outputLocationEven - spanOutput;
        valueOfHPreviousCol = hTempArray[indexOfHBuffer];

        outputImage[outputLocationPreviousRow] = outputValueAtPreviousRow =
          valueOfHL +
          ((valueOfLMinus2 + valueOfL) >> 1) -
          ((valueOfHPreviousCol + 1) >> 1);
        sum += outputValueAtPreviousRow;

        outputImage[outputLocationPreviousRow - 1] = outputValueTemp =
          valueOfHPreviousCol +
          ((outputImage[outputLocationPreviousRow - 2] +
            outputValueAtPreviousRow) >>
            1);
        sum += outputValueTemp;
      }
    }

    return sum;
  }
  static InvertISyntax(
    iSyntaxImage: ISyntaxImage,
    pixelLevel: number
  ): ZoomLevelView {
    const zlv = iSyntaxImage.getZoomLevelView(pixelLevel);
    const nextHigherResolutionPixelLevel = pixelLevel - 1;
    let nextHighResolutionZLV: ZoomLevelView | undefined;
    if (
      !(nextHighResolutionZLV = iSyntaxImage.getZoomLevelView(
        nextHigherResolutionPixelLevel
      ))
    ) {
      nextHighResolutionZLV = iSyntaxImage.createZoomLevelView(
        nextHigherResolutionPixelLevel
      );
    }

    if (nextHighResolutionZLV.hasFullLevel()) {
      return nextHighResolutionZLV;
    }

    const outputSize = iSyntaxImage.findDimension(
      nextHigherResolutionPixelLevel
    );
    const outputRows = outputSize[0];
    const outputCols = outputSize[1];
    const bytesPerSample = iSyntaxImage.bytesPerPixel;
    const planes = iSyntaxImage.planes;
    const outputSizePerPlane = outputCols * outputRows;
    const outputSizeInBytesPerPlane = outputSizePerPlane * bytesPerSample;
    const outputSizeInBytes = outputSizeInBytesPerPlane * planes;
    if (!zlv) {
      throw new Error(`ZoomLevelView not found for pixel level ${pixelLevel}`);
    }
    const lCols = zlv.levelColumns;

    const outputImage = new ArrayBuffer(outputSizeInBytes);
    const TypedArray = bytesPerSample === 2 ? Int16Array : Int32Array;
    const outputBuffer = new TypedArray(outputImage);
    const highCoefficients = zlv.getFullLevelCoefficients();
    const fullLevelLL = zlv.getFullLevelLL();
    if (!fullLevelLL || !highCoefficients) {
      throw new Error(`Missing coefficients for pixel level ${pixelLevel}`);
    }
    let sum = 0;
    if (planes === 1) {
      sum = this.z5_3_synthesize(
        outputBuffer,
        outputRows,
        outputCols,
        outputCols,
        fullLevelLL,
        lCols,
        highCoefficients,
        new TypedArray(highCoefficients.buffer, lCols * bytesPerSample),
        new TypedArray(highCoefficients.buffer, lCols * 2 * bytesPerSample),
        lCols * 3,
        nextHigherResolutionPixelLevel,
        iSyntaxImage.imageFrame.imageId
      );
    } else {
      const llElementsPerPlane = lCols * zlv!.levelRows;
      const coefficientsPerPlane = llElementsPerPlane * 3;
      const lLPlanarOffsetInBytes = llElementsPerPlane * bytesPerSample;
      const coefficientsPlanarOffsetInBytes =
        coefficientsPerPlane * bytesPerSample;
      let bufferOffset = 0;
      let fullLevelLLBufferOffset = 0;
      let highCoefficientsBufferOffset = 0;
      const highCoefficientsSpan = lCols * 3;
      const hLOffset = lCols * bytesPerSample;
      const hhOffset = hLOffset << 1;
      for (let index = 0; index < planes; index++) {
        const outputBufferPerPlane = new TypedArray(
          outputImage,
          bufferOffset,
          outputSizePerPlane
        );
        bufferOffset += outputSizeInBytesPerPlane;

        const fullLevelLLPerPlane = new TypedArray(
          fullLevelLL.buffer,
          fullLevelLLBufferOffset,
          llElementsPerPlane
        );
        fullLevelLLBufferOffset += lLPlanarOffsetInBytes;

        const highCoefficientsPerPlane = new TypedArray(
          highCoefficients.buffer,
          highCoefficientsBufferOffset,
          coefficientsPerPlane
        );

        const highCoefficientsPerPlaneHL = new TypedArray(
          highCoefficientsPerPlane.buffer,
          highCoefficientsBufferOffset + hLOffset
        );

        const highCoefficientsPerPlaneHH = new TypedArray(
          highCoefficientsPerPlane.buffer,
          highCoefficientsBufferOffset + hhOffset
        );

        highCoefficientsBufferOffset += coefficientsPlanarOffsetInBytes;
        const sumPerPlane = this.z5_3_synthesize(
          outputBufferPerPlane,
          outputRows,
          outputCols,
          outputCols,
          fullLevelLLPerPlane,
          lCols,
          highCoefficientsPerPlane,
          highCoefficientsPerPlaneHL,
          highCoefficientsPerPlaneHH,
          highCoefficientsSpan,
          nextHigherResolutionPixelLevel,
          iSyntaxImage.imageFrame.imageId
        );
        if (index === 0) {
          sum = sumPerPlane;
        }
      }
    }
    if (
      (sum & 0xffffffff) !==
      (iSyntaxImage.getCheckSum(nextHigherResolutionPixelLevel) & 0xffffffff)
    ) {
      throw new Error(`Checksum failed: ${sum}`);
    }
    iSyntaxImage.onFullLevelLLAvailable(
      outputBuffer,
      nextHigherResolutionPixelLevel
    );
    return nextHighResolutionZLV;
  }
}

export { ISyntaxInvertor };
