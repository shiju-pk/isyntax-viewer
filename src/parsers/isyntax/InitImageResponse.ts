class InitImageResponse {
  version: number;
  format: string;
  rows: number;
  cols: number;
  quantLevel: number;
  quantValue: number;
  xformLevels: number;
  partitionSize: number;
  coeffBitDepth: number;
  levelChecksums: number[] | null;
  dataLength: number;
  serverResponse: Uint8Array | null;
  coeffsOffset: number;
  /** Raw JPEG/J2K compressed partition (mirrors C++ m_JPEGPartition). Null for iSyntax formats. */
  compressedPartition: Uint8Array | null;
  /** Length of the compressed partition in bytes (mirrors C++ m_JPEGPartitionLengthInBytes). */
  compressedPartitionLength: number;

  constructor() {
    this.version = 0;
    this.format = '';
    this.rows = 0;
    this.cols = 0;
    this.quantLevel = 0;
    this.quantValue = 0;
    this.xformLevels = 0;
    this.partitionSize = 0;
    this.coeffBitDepth = 0;
    this.levelChecksums = null;
    this.dataLength = 0;
    this.serverResponse = null;
    this.coeffsOffset = 0;
    this.compressedPartition = null;
    this.compressedPartitionLength = 0;
  }

  onDecode(): void {
    this.serverResponse = null;
  }
}

export { InitImageResponse };
