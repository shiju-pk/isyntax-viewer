enum ResponseType {
  InitImage,
  GetCoefficients,
}
class ServerResponse {
  type: ResponseType;
  response: Uint8Array;
  pixelLevel: number;
  constructor(
    responseType: ResponseType,
    pixelLevel: number,
    response: Uint8Array | null
  ) {
    this.type = responseType;
    this.response = response;
    this.pixelLevel = pixelLevel;
  }
}
export { ResponseType, ServerResponse };
