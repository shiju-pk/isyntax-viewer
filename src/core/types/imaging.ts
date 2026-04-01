export interface IImageFrame {
  rows: number;
  columns: number;
  imageId: string;
}

export type ImageArray = Int16Array | Int32Array;
export type ImageArrayConstructor =
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
