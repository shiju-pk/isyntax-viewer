export interface IImageFrame {
  rows: number;
  columns: number;
  imageId: string;
}

export type ImageArray = Uint8Array | Int8Array | Uint16Array | Int16Array | Int32Array;
export type ImageArrayConstructor =
  | Uint8ArrayConstructor
  | Int8ArrayConstructor
  | Uint16ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor;

export enum ImageType {
  ISYNTAX = 0,
  RESCALED = 1,
}

export interface DecodedImage {
  imageData: ImageData;
  pixelLevel: number;
  rows: number;
  cols: number;
  planes: number;
  format: string;
  rawPixelData?: ImageArray;
  rescaleSlope?: number;
  rescaleIntercept?: number;
}

export type ProgressCallback = (level: number, totalLevels: number) => void;
