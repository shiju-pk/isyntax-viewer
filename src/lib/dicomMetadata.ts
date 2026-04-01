/**
 * DICOM tag constants matching the proprietary viewer's dicomconstants.js
 */
const DICOM_TAGS = {
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
} as const;

/**
 * Non-image SOP Class UIDs (Presentation States, Encapsulated PDFs, etc.)
 * Series with these SOPClassUIDs in their template should be excluded
 * from the image list.
 */
const NON_IMAGE_SOP_CLASSES = new Set([
  '1.2.840.10008.5.1.4.1.1.11.1',   // Grayscale Softcopy Presentation State
  '1.2.840.10008.5.1.4.1.1.104.1',  // Encapsulated PDF
]);

// Multi-value tags that have val1, val2, ... attributes
const MULTI_VALUE_TAGS: Record<string, number> = {
  [DICOM_TAGS.PixelSpacing]: 2,
  [DICOM_TAGS.ImagerPixelSpacing]: 2,
  [DICOM_TAGS.ImageOrientationPatient]: 6,
  [DICOM_TAGS.ImagePositionPatient]: 3,
  [DICOM_TAGS.WindowWidth]: 1,
  [DICOM_TAGS.WindowCentre]: 1,
};

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

function getDefaultMetadata(): DicomImageMetadata {
  return {
    rows: 0,
    columns: 0,
    bitsAllocated: 16,
    bitsStored: 16,
    highBit: 15,
    pixelRepresentation: 1,
    photometricInterpretation: 'MONOCHROME2',
    samplesPerPixel: 1,
    rescaleSlope: 1,
    rescaleIntercept: 0,
  };
}

/**
 * Extract a DICOM attribute value from an XML element node.
 * Handles both single-value (val="...") and multi-value (val1="...", val2="...") attributes.
 */
function extractElementValue(element: Element): string | string[] | null {
  const tag = element.getAttribute('tag');
  const val = element.getAttribute('val');

  if (val) {
    return val;
  }

  // Check for multi-value
  if (tag) {
    const multiCount = MULTI_VALUE_TAGS[tag];
    if (multiCount) {
      if (multiCount === 1) {
        return element.getAttribute('val1');
      }
      const values: string[] = [];
      for (let i = 1; i <= multiCount; i++) {
        const v = element.getAttribute(`val${i}`);
        if (v) {
          values.push(v);
        } else {
          break;
        }
      }
      return values.length > 0 ? values : null;
    }
  }

  return null;
}

/**
 * Apply a DICOM element to a DicomImageMetadata object.
 */
function applyTagToMetadata(
  meta: DicomImageMetadata,
  tag: string,
  value: string | string[]
): void {
  switch (tag) {
    case DICOM_TAGS.SOPInstanceUID:
      meta.sopInstanceUID = value as string;
      break;
    case DICOM_TAGS.Modality:
      meta.modality = value as string;
      break;
    case DICOM_TAGS.ImageRows:
      meta.rows = Number(value);
      break;
    case DICOM_TAGS.ImageColumns:
      meta.columns = Number(value);
      break;
    case DICOM_TAGS.BitsAllocated:
      meta.bitsAllocated = Number(value);
      break;
    case DICOM_TAGS.BitsStored:
      meta.bitsStored = Number(value);
      break;
    case DICOM_TAGS.HighBit:
      meta.highBit = Number(value);
      break;
    case DICOM_TAGS.PixelRepresentation:
      meta.pixelRepresentation = Number(value);
      break;
    case DICOM_TAGS.PhotometricInterpretation:
      meta.photometricInterpretation = value as string;
      break;
    case DICOM_TAGS.SamplesPerPixel:
      meta.samplesPerPixel = Number(value);
      break;
    case DICOM_TAGS.WindowWidth:
      meta.windowWidth = Number(Array.isArray(value) ? value[0] : value);
      break;
    case DICOM_TAGS.WindowCentre:
      meta.windowCenter = Number(Array.isArray(value) ? value[0] : value);
      break;
    case DICOM_TAGS.RescaleSlope:
      meta.rescaleSlope = Number(value);
      break;
    case DICOM_TAGS.RescaleIntercept:
      meta.rescaleIntercept = Number(value);
      break;
    case DICOM_TAGS.PixelSpacing:
    case DICOM_TAGS.ImagerPixelSpacing:
      if (Array.isArray(value) && value.length === 2) {
        meta.pixelSpacing = [Number(value[0]), Number(value[1])];
      }
      break;
    case DICOM_TAGS.ImageOrientationPatient:
      if (Array.isArray(value) && value.length === 6) {
        meta.imageOrientationPatient = value.map(Number);
      }
      break;
    case DICOM_TAGS.ImagePositionPatient:
      if (Array.isArray(value) && value.length === 3) {
        meta.imagePositionPatient = value.map(Number);
      }
      break;
    case DICOM_TAGS.ImageNumber:
      meta.imageNumber = Number(value);
      break;
    case DICOM_TAGS.iSyntaxPartitionDimension:
      meta.iSyntaxPartitionDimension = Number(value);
      break;
  }
}

/**
 * Extract template (default) metadata for a series from _study.xml.
 * The study XML structure is:
 *   <xmlStudy>
 *     <series name="seriesUID">
 *       <element tag="..." val="..."/>
 *       <template>
 *         <element tag="..." val="..."/>
 *       </template>
 *     </series>
 *   </xmlStudy>
 */
function extractTemplateMetadata(
  studyXml: Document,
  seriesUID?: string
): Map<string, DicomImageMetadata> {
  const seriesMap = new Map<string, DicomImageMetadata>();
  const seriesElements = studyXml.getElementsByTagName('series');

  for (let i = 0; i < seriesElements.length; i++) {
    const seriesEl = seriesElements[i];
    const seriesName = seriesEl.getAttribute('name') || `series_${i}`;

    if (seriesUID && seriesName !== seriesUID) continue;

    const meta = getDefaultMetadata();
    meta.seriesUID = seriesName;

    // Extract template elements
    const templates = seriesEl.getElementsByTagName('template');
    if (templates.length > 0) {
      const templateEl = templates[0];
      const elements = templateEl.children;
      for (let j = 0; j < elements.length; j++) {
        const el = elements[j];
        if (el.tagName !== 'element') continue;
        const tag = el.getAttribute('tag');
        const value = extractElementValue(el);
        if (tag && value) {
          applyTagToMetadata(meta, tag, value);
        }
      }
    }

    seriesMap.set(seriesName, meta);
  }

  return seriesMap;
}

/**
 * Extract per-image metadata from _images.xml, merging with template metadata.
 * The images XML structure is:
 *   <xmlImages>
 *     <idelta parent="seriesUID">
 *       <element tag="..." val="..."/>
 *     </idelta>
 *   </xmlImages>
 *
 * Each idelta overrides the template metadata for that series.
 */
export function extractImageMetadata(
  studyXml: Document,
  imagesXml: Document,
  instanceUID?: string
): Map<string, DicomImageMetadata> {
  const templateMap = extractTemplateMetadata(studyXml);
  const imageMap = new Map<string, DicomImageMetadata>();

  const ideltaElements = imagesXml.getElementsByTagName('idelta');

  for (let i = ideltaElements.length - 1; i >= 0; i--) {
    const idelta = ideltaElements[i];
    const parentSeries = idelta.getAttribute('parent') || '';

    // Clone template metadata for this series
    const template = templateMap.get(parentSeries);
    const meta: DicomImageMetadata = template
      ? { ...template }
      : getDefaultMetadata();

    // Apply idelta overrides (children can be <element> or <diff> tags)
    const elements = idelta.children;
    for (let j = 0; j < elements.length; j++) {
      const el = elements[j];
      if (el.tagName !== 'element' && el.tagName !== 'diff') continue;
      // op="-" means the tag is removed (undefined in reference code)
      const op = el.getAttribute('op');
      if (op === '-') continue;
      const tag = el.getAttribute('tag');
      const value = extractElementValue(el);
      if (tag && value) {
        applyTagToMetadata(meta, tag, value);
      }
    }

    if (meta.sopInstanceUID) {
      // If looking for a specific instance, check match
      if (instanceUID && meta.sopInstanceUID !== instanceUID) {
        imageMap.set(meta.sopInstanceUID, meta);
        continue;
      }
      imageMap.set(meta.sopInstanceUID, meta);
    }
  }

  return imageMap;
}

/**
 * Get metadata for a specific image instance.
 */
export function getImageMetadataForInstance(
  studyXml: Document,
  imagesXml: Document,
  instanceUID: string
): DicomImageMetadata | null {
  const allMetadata = extractImageMetadata(studyXml, imagesXml);
  return allMetadata.get(instanceUID) || null;
}

/**
 * Study-level information extracted from StudyDoc.
 */
export interface StudyInfo {
  patientName: string;
  patientId: string;
  modality: string;
  studyInstanceUID: string;
  seriesUIDs: string[];
  imageUIDs: string[];
}

/**
 * Extract a tag value from XML text using simple element search.
 */
function getTagValueFromDoc(doc: Document, tagName: string): string {
  const elements = doc.getElementsByTagName('element');
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.getAttribute('tag') === tagName) {
      return el.getAttribute('val') || '';
    }
  }
  return '';
}

/**
 * Extract all values for a given tag from an XML document.
 */
function getAllTagValues(doc: Document, tagName: string): string[] {
  const values: string[] = [];
  const elements = doc.getElementsByTagName('element');
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.getAttribute('tag') === tagName) {
      const val = el.getAttribute('val');
      if (val && !values.includes(val)) {
        values.push(val);
      }
    }
  }
  return values;
}

/**
 * Get the SOPClassUID from a <template> element.
 * Looks for <element tag="00080016" val="..."/> inside the template.
 */
function getSOPClassUIDFromTemplate(templateEl: Element): string {
  const children = templateEl.children;
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (el.tagName === 'element' && el.getAttribute('tag') === DICOM_TAGS.SOPClassUID) {
      return el.getAttribute('val') || '';
    }
  }
  return '';
}

/**
 * Build a set of series UIDs that contain actual images (not presentation states or PDFs).
 * Iterates <series> elements in _study.xml, checks the <template> SOPClassUID,
 * and only includes series whose SOPClassUID is NOT in NON_IMAGE_SOP_CLASSES.
 */
export function getImageSeriesUIDs(studyXml: Document): Set<string> {
  const imageSeriesUIDs = new Set<string>();
  const seriesElements = studyXml.getElementsByTagName('series');

  for (let i = 0; i < seriesElements.length; i++) {
    const seriesEl = seriesElements[i];
    const seriesUID = seriesEl.getAttribute('name') || '';

    const templates = seriesEl.getElementsByTagName('template');
    if (templates.length > 0) {
      const sopClassUID = getSOPClassUIDFromTemplate(templates[0]);
      if (!NON_IMAGE_SOP_CLASSES.has(sopClassUID)) {
        imageSeriesUIDs.add(seriesUID);
      }
    } else {
      // No template — assume it's an image series
      imageSeriesUIDs.add(seriesUID);
    }
  }

  return imageSeriesUIDs;
}

/**
 * Extract study-level info (patient, modality, series, images) from the StudyDoc.
 * Image UIDs are extracted only from image series (not presentation state series).
 */
export function extractStudyInfo(studyXml: Document): StudyInfo {
  const imageSeriesUIDs = getImageSeriesUIDs(studyXml);

  // Collect SOPInstanceUIDs only from image series templates
  const imageUIDs: string[] = [];
  const seriesElements = studyXml.getElementsByTagName('series');
  for (let i = 0; i < seriesElements.length; i++) {
    const seriesEl = seriesElements[i];
    const seriesUID = seriesEl.getAttribute('name') || '';
    if (!imageSeriesUIDs.has(seriesUID)) continue;

    const templates = seriesEl.getElementsByTagName('template');
    if (templates.length > 0) {
      const children = templates[0].children;
      for (let j = 0; j < children.length; j++) {
        const el = children[j];
        if (el.tagName === 'element' && el.getAttribute('tag') === DICOM_TAGS.SOPInstanceUID) {
          const val = el.getAttribute('val');
          if (val && !imageUIDs.includes(val)) {
            imageUIDs.push(val);
          }
        }
      }
    }
  }

  return {
    patientName: getTagValueFromDoc(studyXml, DICOM_TAGS.PatientName),
    patientId: getTagValueFromDoc(studyXml, DICOM_TAGS.PatientID),
    modality: getTagValueFromDoc(studyXml, DICOM_TAGS.Modality),
    studyInstanceUID: getTagValueFromDoc(studyXml, DICOM_TAGS.StudyInstanceUID),
    seriesUIDs: [...imageSeriesUIDs],
    imageUIDs,
  };
}

/**
 * Extract ordered image UIDs from _images.xml idelta elements.
 * Only includes UIDs from series that are actual image series (not PS).
 * The imageSeriesUIDs set determines which series are image series.
 * If not provided, all idelta entries are included (legacy behavior).
 */
export function extractImageUIDsFromImagesXml(
  imagesXml: Document,
  imageSeriesUIDs?: Set<string>
): string[] {
  const uids: string[] = [];
  const ideltas = imagesXml.getElementsByTagName('idelta');
  for (let i = 0; i < ideltas.length; i++) {
    const idelta = ideltas[i];

    // Filter: only include idelta entries whose parent series is an image series
    if (imageSeriesUIDs) {
      const parentSeries = idelta.getAttribute('parent') || '';
      if (!imageSeriesUIDs.has(parentSeries)) {
        continue;
      }
    }

    // Children can be <element> or <diff> tags
    const children = idelta.children;
    for (let j = 0; j < children.length; j++) {
      const el = children[j];
      if (
        (el.tagName === 'element' || el.tagName === 'diff') &&
        el.getAttribute('tag') === DICOM_TAGS.SOPInstanceUID
      ) {
        // op="-" means removed
        if (el.getAttribute('op') === '-') continue;
        const val = el.getAttribute('val');
        if (val && !uids.includes(val)) {
          uids.push(val);
        }
      }
    }
  }
  return uids;
}

export { DICOM_TAGS, getDefaultMetadata };
export type { DicomImageMetadata as DicomMetadata };
