class DataViewBinaryReader {
  private _dataView: DataView;
  private _positionInDataView: number;
  private _maxPositionToReadAsInt: number;
  private _numberOfAvailableBits: number;
  private _currentValue: number;

  constructor(arrayBuffer: Uint8Array, startPosition: number) {
    const arrayBufferLength = arrayBuffer.byteLength;

    if (arrayBufferLength - startPosition < 4) {
      throw new Error('DataViewBinaryReader: arrayBuffer is too small');
    }

    this._dataView = new DataView(
      arrayBuffer.buffer,
      arrayBuffer.byteOffset,
      arrayBuffer.byteLength
    );
    this._positionInDataView = startPosition;
    this._maxPositionToReadAsInt = arrayBufferLength - 4;
    this._numberOfAvailableBits = 32;
    this._currentValue = this._dataView.getInt32(
      this._positionInDataView,
      true
    );
  }

  private _readNextValue(): boolean {
    const dataView = this._dataView;
    const arrayBufferLength = dataView.byteLength;

    this._positionInDataView += 4;
    let positionInDataView = this._positionInDataView;

    if (positionInDataView < this._maxPositionToReadAsInt) {
      this._currentValue = dataView.getInt32(positionInDataView, true);
      this._numberOfAvailableBits = 32;
      return true;
    } else if (positionInDataView < arrayBufferLength) {
      let currentValue = 0;
      let numberOfAvailableBits = 0;
      for (; positionInDataView < arrayBufferLength; ++positionInDataView) {
        currentValue |=
          dataView.getInt8(positionInDataView) << numberOfAvailableBits;
        numberOfAvailableBits += 8;
      }
      this._positionInDataView = positionInDataView;
      this._numberOfAvailableBits = numberOfAvailableBits;
      this._currentValue = currentValue;
      return true;
    }

    return false;
  }

  getCurrentOffsetInBytes(): number {
    let offset;
    if (this._numberOfAvailableBits > 24) {
      offset = this._positionInDataView;
    } else if (this._numberOfAvailableBits > 16) {
      offset = this._positionInDataView + 1;
    } else if (this._numberOfAvailableBits > 8) {
      offset = this._positionInDataView + 2;
    } else {
      offset = this._positionInDataView + 3;
    }
    return offset;
  }

  seek(offsetInBytes: number): void {
    if (this._positionInDataView === offsetInBytes) {
      if (this._numberOfAvailableBits === 32) {
        return;
      }
      this._positionInDataView -= 4;
      this._readNextValue();
    } else {
      this._positionInDataView = offsetInBytes - 4;
      this._readNextValue();
    }
  }

  readBits(numberOfBits: number): number {
    let value = 0;
    let restOfTheBitsValue;
    let numberOfAvailableBits;
    let currentValue;
    if (numberOfBits) {
      if (numberOfBits <= this._numberOfAvailableBits) {
        currentValue = this._currentValue;
        value = currentValue & ((1 << numberOfBits) - 1);
        this._currentValue = currentValue >>> numberOfBits;
        this._numberOfAvailableBits -= numberOfBits;
      } else {
        numberOfAvailableBits = this._numberOfAvailableBits;
        if (numberOfAvailableBits) {
          value = this._currentValue & ((1 << numberOfAvailableBits) - 1);
          this._readNextValue();
          restOfTheBitsValue = this.readBits(
            numberOfBits - numberOfAvailableBits
          );
          value = (restOfTheBitsValue << numberOfAvailableBits) | value;
        } else {
          this._readNextValue();
          value = this.readBits(numberOfBits);
        }
      }
    }
    return value;
  }

  readBit(): number {
    let value = 0;
    let currentValue;

    if (this._numberOfAvailableBits) {
      currentValue = this._currentValue;
      value = currentValue & 0x01;
      this._currentValue = currentValue >>> 1;
      --this._numberOfAvailableBits;
    } else {
      this._readNextValue();
      value = this.readBit();
    }
    return value;
  }

  readInt32(): number {
    let value;
    if (this._numberOfAvailableBits === 32) {
      value = this._currentValue;
      this._readNextValue();
    } else {
      value = this.readBits(32);
    }
    return value;
  }

  readSignedValue(numberOfBits: number): number {
    let value = this.readBits(numberOfBits);
    const signBit = value & 1;
    value = value >>> 1;
    if (signBit) {
      value = -value;
    }
    return value;
  }

  scanToNext1(): number {
    let numberOfTrailingZeros = 0;
    let bitsToRead;
    let value;
    let currentValue;
    if (this._numberOfAvailableBits) {
      bitsToRead = 0;
      if (this._currentValue) {
        currentValue = this._currentValue;
        if (currentValue & 0x1) {
          --this._numberOfAvailableBits;
          this._currentValue = currentValue >>> 1;
        } else {
          value = (currentValue ^ (currentValue - 1)) >>> 1;
          for (; value; ++numberOfTrailingZeros) {
            value = value >>> 1;
          }
          bitsToRead = numberOfTrailingZeros + 1;
          this._numberOfAvailableBits -= bitsToRead;
          this._currentValue = currentValue >>> bitsToRead;
        }
      } else {
        numberOfTrailingZeros = this._numberOfAvailableBits;
        this._readNextValue();
        numberOfTrailingZeros += this.scanToNext1();
      }
    } else {
      if (this._readNextValue()) {
        numberOfTrailingZeros = this.scanToNext1();
      }
    }
    return numberOfTrailingZeros;
  }
}

export { DataViewBinaryReader };
