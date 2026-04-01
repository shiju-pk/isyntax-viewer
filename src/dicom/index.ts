// DICOM layer — tags, metadata extraction, SOP class support
export { DICOM_TAGS } from './tags/DicomTags';
export { NON_IMAGE_SOP_CLASSES, IMAGE_SOP_CLASSES } from './sop/SopClassRegistry';
export {
  getDefaultMetadata,
  extractImageMetadata,
  getImageMetadataForInstance,
  getImageSeriesUIDs,
  extractStudyInfo,
  extractImageUIDsFromImagesXml,
} from './metadata/DicomMetadata';
