import type { ImageArray, ImageArrayConstructor } from './codecConstants';
import { ImageType } from './codecConstants';

class ZoomLevelView {
  pixelLevel: number;
  levelRows: number;
  levelColumns: number;
  bytesPerPixel: number;
  planes: number;
  type: ImageType;

  private _lowPartitions: ImageArray | null;
  private _highPartitions: ImageArray | null;

  constructor(
    pixelLevel: number,
    levelRows: number,
    levelCols: number,
    bytesPerPixel: number,
    planes: number = 1
  ) {
    this.pixelLevel = pixelLevel;
    this.levelRows = levelRows;
    this.levelColumns = levelCols;
    this.bytesPerPixel = bytesPerPixel;
    this.planes = planes;
    this.type = ImageType.ISYNTAX;
    this._lowPartitions = null;
    this._highPartitions = null;
  }

  setFullLevelLL(lowLevelData: ImageArray, type?: ImageType): void {
    this._lowPartitions = lowLevelData;
    if (type !== undefined) {
      this.type = type;
    }
  }

  getFullLevelLL(): ImageArray | null {
    return this._lowPartitions;
  }

  setFullLevelCoefficients(highCoefficients: ImageArray): void {
    if (this.type !== ImageType.ISYNTAX) {
      throw new Error('Invalid image type');
    }
    this._highPartitions = highCoefficients;
  }

  getFullLevelCoefficients(): ImageArray | null {
    return this._highPartitions;
  }

  removeFullLevelCoefficients(): void {
    this._highPartitions = null;
  }
  hasFullLevelLL(): boolean {
    return !!this._lowPartitions;
  }

  hasFullLevelHighCoefficients(): boolean {
    return !!this._highPartitions;
  }

  hasFullLevel(): boolean {
    return this.hasFullLevelLL() && this.hasFullLevelHighCoefficients();
  }

  getBuffersToDecode(quadrants: number): {
    resultBuffer: ImageArray;
    buffersToDecode: ImageArray[];
  } {
    const planes = this.planes;
    let numberOfElementsInOutputPerPlane = this.levelRows * this.levelColumns;

    if (quadrants) {
      numberOfElementsInOutputPerPlane *= quadrants;
    }

    const numberOfElementsInOutput = planes * numberOfElementsInOutputPerPlane;
    let outputBufferSize: number;
    let outputBufferSizePerPlane: number;
    let TypedArray: ImageArrayConstructor;

    if (this.bytesPerPixel === 2) {
      outputBufferSize = numberOfElementsInOutput << 1;
      outputBufferSizePerPlane = numberOfElementsInOutputPerPlane << 1;
      TypedArray = Int16Array;
    } else {
      outputBufferSize = numberOfElementsInOutput << 2;
      outputBufferSizePerPlane = numberOfElementsInOutputPerPlane << 2;
      TypedArray = Int32Array;
    }

    const arrayBuffer = new ArrayBuffer(outputBufferSize);
    const outputBuffer = new TypedArray(arrayBuffer);
    const decodedBufferArray: ImageArray[] = [];
    let offset = 0;

    for (let index = 0; index < planes; ++index) {
      decodedBufferArray[index] = new TypedArray(
        arrayBuffer,
        offset,
        numberOfElementsInOutputPerPlane
      );
      offset += outputBufferSizePerPlane;
    }

    return {
      resultBuffer: outputBuffer,
      buffersToDecode: decodedBufferArray,
    };
  }
  getSize(): number {
    let totalImageSize = 0;

    if (this._highPartitions) {
      totalImageSize = this._highPartitions.byteLength;
    }
    if (this._lowPartitions) {
      totalImageSize += this._lowPartitions.byteLength;
    }

    return totalImageSize;
  }
  dispose(): void {
    this._lowPartitions = null;
    this._highPartitions = null;
  }
}

export { ZoomLevelView };
