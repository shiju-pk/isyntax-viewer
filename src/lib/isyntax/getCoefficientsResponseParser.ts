import { GetCoefficientsResponse } from './getCoefficientsResponse';

class GetCoefficientsResponseParser {
  constructor() {}

  /**
   * Parses server response for GetCoefficients request and generates {@link GetCoefficientsResponse}.
   * @param {ArrayBuffer} gcrServerResponse Response from server for GetCoefficients request.
   * @return {GetCoefficientsResponse} Returns parsed GetCoefficientsResponse.
   * @throws BaseException
   */
  static parse(gcrServerResponse: Uint8Array): GetCoefficientsResponse {
    const gcr = new GetCoefficientsResponse();
    const coefficientResponseDataView = new DataView(
      gcrServerResponse.buffer,
      gcrServerResponse.byteOffset,
      gcrServerResponse.byteLength
    );
    let pos = 0;

    gcr.numberOfBlocks = coefficientResponseDataView.getInt32(pos, true);
    pos += 4;

    // currently, we support only one request per GetCoefficients request
    if (gcr.numberOfBlocks > 1) {
      throw new Error('Unsupported number of blocks');
    }

    gcr.dataLength = coefficientResponseDataView.getInt32(pos, true);
    pos += 4;

    gcr.serverResponse = gcrServerResponse;
    gcr.coefficientsOffset = pos;

    return gcr;
  }
}

export { GetCoefficientsResponseParser };
