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
    if (numberOfBits === 0) return 0;
    if (numberOfBits <= this._numberOfAvailableBits) {
      const value = this._currentValue & ((1 << numberOfBits) - 1);
      this._currentValue = this._currentValue >>> numberOfBits;
      this._numberOfAvailableBits -= numberOfBits;
      return value;
    }
    // Cross-boundary: grab remaining bits, refill, grab rest
    const lowBits = this._numberOfAvailableBits;
    const lowValue = lowBits ? (this._currentValue & ((1 << lowBits) - 1)) : 0;
    this._readNextValue();
    const highBits = numberOfBits - lowBits;
    const highValue = this._currentValue & ((1 << highBits) - 1);
    this._currentValue = this._currentValue >>> highBits;
    this._numberOfAvailableBits -= highBits;
    return (highValue << lowBits) | lowValue;
  }

  readBit(): number {
    if (this._numberOfAvailableBits === 0) {
      this._readNextValue();
    }
    const value = this._currentValue & 1;
    this._currentValue = this._currentValue >>> 1;
    --this._numberOfAvailableBits;
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
    for (;;) {
      if (this._numberOfAvailableBits === 0) {
        if (!this._readNextValue()) return numberOfTrailingZeros;
      }
      if (this._currentValue) {
        // O(1) CTZ via Math.clz32: ctz(x) = 31 - clz(x & -x)
        const isolated = this._currentValue & (-this._currentValue);
        const ctz = 31 - Math.clz32(isolated);
        const bitsToRead = ctz + 1; // include the 1-bit itself
        this._numberOfAvailableBits -= bitsToRead;
        this._currentValue = this._currentValue >>> bitsToRead;
        return numberOfTrailingZeros + ctz;
      }
      // Entire word is zero — consume all bits and continue
      numberOfTrailingZeros += this._numberOfAvailableBits;
      this._numberOfAvailableBits = 0;
    }
  }
}

export { DataViewBinaryReader };
