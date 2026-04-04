export interface DicomImageMetadata {
  // Image Pixel Module
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  highBit: number;
  pixelRepresentation: number;
  photometricInterpretation: string;
  samplesPerPixel: number;
  // VOI LUT Module
  windowWidth?: number;
  windowCenter?: number;
  // Modality LUT Module
  rescaleSlope: number;
  rescaleIntercept: number;
  // Image Plane Module
  pixelSpacing?: [number, number];
  imageOrientationPatient?: number[];
  imagePositionPatient?: number[];
  // Identity
  sopInstanceUID?: string;
  seriesUID?: string;
  modality?: string;
  imageNumber?: number;
  iSyntaxPartitionDimension?: number;
}

export interface StudyInfo {
  patientName: string;
  patientId: string;
  modality: string;
  studyInstanceUID: string;
  seriesUIDs: string[];
  imageUIDs: string[];
}

export interface SeriesGroup {
  seriesUID: string;
  imageIds: string[];
}

export interface StudyDoc {
  studyXml: Document | null;
  imagesXml: Document | null;
  imageXmlList: Document[];
  ancillaryXml: Document | null;
  updateXml: Document | null;
}
