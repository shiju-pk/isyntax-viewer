class GetCoefficientsResponse {
  numberOfBlocks: number;
  dataLength: number;
  serverResponse: Uint8Array | null;
  coefficientsOffset: number;

  constructor() {
    this.numberOfBlocks = 0;
    this.dataLength = 0;
    this.serverResponse = null;
    this.coefficientsOffset = 0;
  }
}

export { GetCoefficientsResponse };
