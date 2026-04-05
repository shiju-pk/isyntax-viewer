/**
 * DICOM tag constants matching the proprietary viewer's dicomconstants.js
 */
export const DICOM_TAGS = {
  SOPInstanceUID: '00080018',
  SOPClassUID: '00080016',
  ImageType: '00080008',
  Modality: '00080060',
  SeriesDescription: '0008103e',
  SeriesNumber: '00200011',
  ImageNumber: '00200013',
  PatientName: '00100010',
  PatientID: '00100020',
  PatientSex: '00100040',
  StudyInstanceUID: '0020000d',
  SeriesInstanceUID: '0020000e',
  ImageRows: '00280010',
  ImageColumns: '00280011',
  PixelSpacing: '00280030',
  PhotometricInterpretation: '00280004',
  BitsAllocated: '00280100',
  BitsStored: '00280101',
  HighBit: '00280102',
  PixelRepresentation: '00280103',
  WindowCentre: '00281050',
  WindowWidth: '00281051',
  RescaleIntercept: '00281052',
  RescaleSlope: '00281053',
  ImagerPixelSpacing: '00181164',
  ImageOrientationPatient: '00200037',
  ImagePositionPatient: '00200032',
  SamplesPerPixel: '00280002',
  SeriesFrameOfRefUID: '00200052',
  iSyntaxPartitionDimension: '00730003',

  // Overlay Module (60xx group — element suffixes only, group varies 6000–601E)
  OverlayStartTag: '60',
  OverlayRows: '0010',
  OverlayColumns: '0011',
  OverlayType: '0040',
  OverlayOrigin: '0050',
  OverlayBitsAllocated: '0100',
  OverlayBitPosition: '0102',
  OverlayData: '3000',
  OverlayDescription: '0022',
  OverlaySubtype: '0045',
  OverlayLabel: '1500',
  OverlayFrameCount: '0015',
  OverlayFrameOrigin: '0051',
  OverlayActivationLayer: '1001',

  // Multi-frame Module
  NumberOfFrames: '00280008',

  // Frame of Reference Module
  FrameOfReferenceUID: '00200052',
} as const;
