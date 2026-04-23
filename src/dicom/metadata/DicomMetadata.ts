import type { DicomImageMetadata, ModalityLUT, StudyInfo } from '../../core/types';
import { DICOM_TAGS } from '../tags/DicomTags';
import { NON_IMAGE_SOP_CLASSES } from '../sop/SopClassRegistry';

// Multi-value tags that have val1, val2, ... attributes
const MULTI_VALUE_TAGS: Record<string, number> = {
  [DICOM_TAGS.PixelSpacing]: 2,
  [DICOM_TAGS.ImagerPixelSpacing]: 2,
  [DICOM_TAGS.ImageOrientationPatient]: 6,
  [DICOM_TAGS.ImagePositionPatient]: 3,
  [DICOM_TAGS.WindowWidth]: 1,
  [DICOM_TAGS.WindowCentre]: 1,
};

export function getDefaultMetadata(): DicomImageMetadata {
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

  // Check for multi-value — first try known tags, then fallback to nbE attribute
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

  // Generic multi-value: nbE attribute (e.g., overlay origin 60000050)
  const nbE = element.getAttribute('nbE');
  if (nbE) {
    const count = Number(nbE);
    if (count > 0) {
      const values: string[] = [];
      for (let i = 1; i <= count; i++) {
        const v = element.getAttribute(`val${i}`);
        if (v != null) {
          values.push(v);
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
    case DICOM_TAGS.NumberOfFrames:
      meta.numberOfFrames = Number(value);
      break;
    case DICOM_TAGS.FrameOfReferenceUID:
      meta.frameOfReferenceUID = value as string;
      break;
    default:
      // Collect overlay 60xx tags into overlayAttributes map
      if (tag.startsWith(DICOM_TAGS.OverlayStartTag)) {
        if (!meta.overlayAttributes) {
          meta.overlayAttributes = {};
        }
        meta.overlayAttributes[tag] = value;
      }
      break;
  }
}

/**
 * Parse a ModalityLUTSequence (0028,3000) from a StudyDoc XML sqElement.
 * Actual XML structure from the server:
 *   <sqElement tag="00283000">
 *     <val1 nbE="4">
 *       <element tag="00283002" nbE="3" val1="256" val2="0" val3="8"/>
 *       <element tag="00283003" val="HITACHI DR LUT"/>
 *       <element tag="00283004" val="US"/>
 *       <binary tag="00283006" Encode="base64" val="AwADAAMA..."/>
 *     </val1>
 *   </sqElement>
 */
function parseModalityLUTSequence(seqElement: Element): ModalityLUT | undefined {
  // First sequence item is <val1> (could also be <item> in some formats)
  const item = seqElement.querySelector('val1') ?? seqElement.querySelector('item');
  if (!item) return undefined;

  let descriptor: number[] | undefined;
  let lutData: number[] | undefined;

  const children = item.children;
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const tag = el.getAttribute('tag');

    if (tag === DICOM_TAGS.LUTDescriptor && el.tagName === 'element') {
      const val = extractElementValue(el);
      if (Array.isArray(val) && val.length === 3) {
        descriptor = val.map(Number);
      }
    } else if (tag === DICOM_TAGS.LUTData) {
      if (el.tagName === 'binary') {
        // Base64-encoded OW data (uint16 LE values)
        const b64 = el.getAttribute('val') || el.textContent || '';
        if (b64) {
          const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const count = raw.length >> 1; // 2 bytes per uint16
          lutData = new Array(count);
          const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
          for (let k = 0; k < count; k++) {
            lutData[k] = dv.getUint16(k * 2, true); // little-endian
          }
        }
      } else {
        // Fallback: multi-value element (val1, val2, ...)
        const val = extractElementValue(el);
        if (Array.isArray(val)) {
          lutData = val.map(Number);
        }
      }
    }
  }

  if (!descriptor || !lutData) return undefined;

  // Per DICOM spec: numEntries of 0 means 65536
  let numEntries = descriptor[0];
  if (numEntries === 0) numEntries = 65536;

  return {
    numEntries,
    firstValueMapped: descriptor[1],
    numBitsPerEntry: descriptor[2],
    lut: lutData,
  };
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
        const tagName = el.tagName;

        if (tagName === 'sqElement') {
          const tag = el.getAttribute('tag');
          if (tag === DICOM_TAGS.ModalityLUTSequence) {
            const lutSeq = parseModalityLUTSequence(el);
            if (lutSeq) meta.modalityLUT = lutSeq;
          }
          continue;
        }

        if (tagName !== 'element') continue;
        const tag = el.getAttribute('tag');
        if (tag === DICOM_TAGS.ModalityLUTSequence) {
          const lutSeq = parseModalityLUTSequence(el);
          if (lutSeq) meta.modalityLUT = lutSeq;
          continue;
        }
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

    // Clone template metadata for this series (deep-clone overlayAttributes)
    const template = templateMap.get(parentSeries);
    const meta: DicomImageMetadata = template
      ? { ...template, overlayAttributes: template.overlayAttributes ? { ...template.overlayAttributes } : undefined }
      : getDefaultMetadata();

    // Apply idelta overrides (children can be <element>, <diff>, or <binDiff> tags)
    const elements = idelta.children;
    for (let j = 0; j < elements.length; j++) {
      const el = elements[j];
      const tagName = el.tagName;

      if (tagName === 'sqElement') {
        const tag = el.getAttribute('tag');
        if (tag === DICOM_TAGS.ModalityLUTSequence) {
          const op = el.getAttribute('op');
          if (op === '-') {
            meta.modalityLUT = undefined;
          } else {
            const lutSeq = parseModalityLUTSequence(el);
            if (lutSeq) meta.modalityLUT = lutSeq;
          }
        }
        continue;
      }

      if (tagName === 'element' || tagName === 'diff') {
        const op = el.getAttribute('op');
        const tag = el.getAttribute('tag');
        if (!tag) continue;

        if (op === '-') {
          // Remove: clear this tag from overlay attributes if it's a 60xx tag
          if (tag.startsWith(DICOM_TAGS.OverlayStartTag) && meta.overlayAttributes) {
            delete meta.overlayAttributes[tag];
          }
          if (tag === DICOM_TAGS.ModalityLUTSequence) {
            meta.modalityLUT = undefined;
          }
          continue;
        }

        if (tag === DICOM_TAGS.ModalityLUTSequence) {
          const lutSeq = parseModalityLUTSequence(el);
          if (lutSeq) meta.modalityLUT = lutSeq;
          continue;
        }

        const value = extractElementValue(el);
        if (value) {
          applyTagToMetadata(meta, tag, value);
        }
      } else if (tagName === 'binDiff') {
        // Binary diff: contains base64-encoded (possibly zlib-compressed) data
        // Used for overlay pixel data (60003000) and other binary tags
        const op = el.getAttribute('op');
        const tag = el.getAttribute('tag');
        if (!tag) continue;

        if (op === '-') {
          // Remove binary tag
          if (tag.startsWith(DICOM_TAGS.OverlayStartTag) && meta.overlayAttributes) {
            delete meta.overlayAttributes[tag];
          }
          continue;
        }

        // Store the raw binDiff element info for overlay data
        if (tag.startsWith(DICOM_TAGS.OverlayStartTag)) {
          if (!meta.overlayAttributes) {
            meta.overlayAttributes = {};
          }
          const encode = el.getAttribute('Encode') || '';
          const binVal = el.getAttribute('val') || el.textContent || '';
          // Store as an object so the overlay parser can decode it
          meta.overlayAttributes[tag] = {
            __binDiff: true,
            encode,
            data: binVal,
          };
        }
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

const GSPS_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.11.1';

/**
 * Extract GSPS (Grayscale Softcopy Presentation State) attribute maps from
 * the study XML. Returns an array of flat attribute maps — one per GSPS
 * series template — suitable for `parseGSPSInstance()`.
 *
 * Each map contains all DICOM tags from the template (including nested
 * sqElement sequences and binary data as base64 strings).
 */
export function extractGSPSAttributeMaps(
  studyXml: Document,
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const seriesElements = studyXml.getElementsByTagName('series');

  for (let i = 0; i < seriesElements.length; i++) {
    const seriesEl = seriesElements[i];
    const templates = seriesEl.getElementsByTagName('template');
    if (templates.length === 0) continue;

    const templateEl = templates[0];
    const sopClassUID = getSOPClassUIDFromTemplate(templateEl);
    if (sopClassUID !== GSPS_SOP_CLASS_UID) continue;

    const attrs = templateElementToAttributeMap(templateEl);
    result.push(attrs);
  }

  return result;
}

/**
 * Identify GSPS series UIDs from _study.xml.
 * Returns a map of seriesUID → template attribute map for each GSPS series.
 */
function identifyGSPSSeries(
  studyXml: Document,
): Map<string, Record<string, unknown>> {
  const gspsSeriesMap = new Map<string, Record<string, unknown>>();
  const seriesElements = studyXml.getElementsByTagName('series');

  for (let i = 0; i < seriesElements.length; i++) {
    const seriesEl = seriesElements[i];
    const seriesUID = seriesEl.getAttribute('name') || '';
    const templates = seriesEl.getElementsByTagName('template');
    if (templates.length === 0) continue;

    const templateEl = templates[0];
    const sopClassUID = getSOPClassUIDFromTemplate(templateEl);
    if (sopClassUID !== GSPS_SOP_CLASS_UID) continue;

    const attrs = templateElementToAttributeMap(templateEl);
    gspsSeriesMap.set(seriesUID, attrs);
    console.info('[GSPS] Found GSPS series in _study.xml:', seriesUID,
      'template keys:', Object.keys(attrs).length);
  }

  return gspsSeriesMap;
}

/**
 * Convert an <idelta> element into a flat attribute map, handling
 * <element>, <diff>, <sqElement>, <binary>, and <binDiff> children.
 * Operations: op="+" adds, op="*" modifies, op="-" removes (returned as null).
 */
function ideltaElementToAttributeMap(
  idelta: Element,
): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  for (let i = 0; i < idelta.children.length; i++) {
    const child = idelta.children[i];
    const tag = child.getAttribute('tag');
    if (!tag) continue;

    const tagLower = tag.toLowerCase();
    const op = child.getAttribute('op');

    // op="-" means delete — store null sentinel so we can remove from template
    if (op === '-') {
      attrs[tagLower] = null;
      continue;
    }

    if (child.tagName === 'element' || child.tagName === 'diff') {
      const val = extractElementValue(child);
      if (val !== null) {
        attrs[tagLower] = val;
      }
    } else if (child.tagName === 'binary' || child.tagName === 'binDiff') {
      const val = child.getAttribute('val') || child.textContent || '';
      attrs[tagLower] = val;
    } else if (child.tagName === 'sqElement') {
      const items: Record<string, unknown>[] = [];
      for (let j = 0; j < child.children.length; j++) {
        const valChild = child.children[j];
        if (valChild.tagName.startsWith('val')) {
          items.push(templateElementToAttributeMap(valChild));
        }
      }
      attrs[tagLower] = items;
    }
  }

  return attrs;
}

/**
 * Merge idelta attributes on top of a template attribute map.
 * A null value in overrides means the tag was deleted (op="-").
 */
function mergeAttributes(
  template: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...template };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * Extract GSPS instance attribute maps by merging _study.xml templates
 * with per-instance ideltas from _images.xml.
 *
 * Returns one attribute map per GSPS instance (template + idelta merged).
 * If no ideltas are found for a GSPS series, the template alone is returned.
 *
 * @param studyXml  Parsed _study.xml document.
 * @param imageXmlList  Array of parsed _images.xml documents.
 * @returns Array of flat attribute maps suitable for `parseGSPSInstance()`.
 */
export function extractGSPSInstanceMaps(
  studyXml: Document,
  imageXmlList: Document[],
): Record<string, unknown>[] {
  // Diagnostic: dump series structure
  const allSeries = studyXml.getElementsByTagName('series');
  console.info('[GSPS] _study.xml has', allSeries.length, 'series');
  for (let s = 0; s < allSeries.length; s++) {
    const se = allSeries[s];
    const uid = se.getAttribute('name') || '(no name)';
    const templates = se.getElementsByTagName('template');
    let sopClass = '(no template)';
    if (templates.length > 0) {
      sopClass = getSOPClassUIDFromTemplate(templates[0]) || '(no SOP)';
    }
    console.info(`[GSPS]   series[${s}]: uid=${uid}, sopClass=${sopClass}`);
  }
  // Also check for GSPS-like tags in _images.xml ideltas
  for (let ix = 0; ix < imageXmlList.length; ix++) {
    const ideltas = imageXmlList[ix].getElementsByTagName('idelta');
    console.info(`[GSPS] _images.xml[${ix}] has`, ideltas.length, 'ideltas');
    for (let id = 0; id < ideltas.length; id++) {
      const idelta = ideltas[id];
      const parent = idelta.getAttribute('parent') || '(no parent)';
      // Check ALL tags from each idelta
      const allTags: string[] = [];
      const gspsTagsFound: string[] = [];
      for (let c = 0; c < idelta.children.length; c++) {
        const child = idelta.children[c];
        const tag = child.getAttribute('tag') || '';
        allTags.push(`${child.tagName}:${tag}`);
        if (tag.startsWith('0070') || tag.startsWith('0073')) {
          gspsTagsFound.push(tag);
        }
      }
      console.info(`[GSPS]   idelta[${id}] parent=${parent} childCount=${idelta.children.length} tags:`, allTags.join(', '));
      if (gspsTagsFound.length > 0) {
        console.info(`[GSPS]   idelta[${id}] ** HAS GSPS TAGS **:`, gspsTagsFound);
      }
    }
  }
  // Check template content for each series
  for (let s = 0; s < allSeries.length; s++) {
    const se = allSeries[s];
    const templates = se.getElementsByTagName('template');
    if (templates.length > 0) {
      const tmpl = templates[0];
      const tmplTags: string[] = [];
      for (let c = 0; c < tmpl.children.length; c++) {
        const child = tmpl.children[c];
        const tag = child.getAttribute('tag') || '';
        tmplTags.push(`${child.tagName}:${tag}`);
        // Dump 0073xxxx iSite PS tags in detail
        if (tag.startsWith('0073')) {
          const val = child.getAttribute('val') || child.textContent || '';
          const tagName = child.tagName;
          const truncated = val.length > 500 ? val.substring(0, 500) + '...' : val;
          console.info(`[GSPS]   iSite PS tag ${tag} (${tagName}): "${truncated}"`);
        }
      }
      console.info(`[GSPS]   series[${s}] template tags:`, tmplTags.join(', '));
    }
  }

  const gspsSeriesMap = identifyGSPSSeries(studyXml);
  if (gspsSeriesMap.size === 0) {
    console.info('[GSPS] No GSPS series found in _study.xml');
    return [];
  }

  const result: Record<string, unknown>[] = [];
  const seriesWithIdeltas = new Set<string>();

  // Scan all _images.xml documents for ideltas belonging to GSPS series
  for (const imagesXml of imageXmlList) {
    const ideltas = imagesXml.getElementsByTagName('idelta');
    for (let i = 0; i < ideltas.length; i++) {
      const idelta = ideltas[i];
      const parentSeries = idelta.getAttribute('parent') || '';
      const templateAttrs = gspsSeriesMap.get(parentSeries);
      if (!templateAttrs) continue;

      seriesWithIdeltas.add(parentSeries);
      const overrides = ideltaElementToAttributeMap(idelta);
      const merged = mergeAttributes(templateAttrs, overrides);
      result.push(merged);

      console.info('[GSPS] Merged idelta for series:', parentSeries,
        'override keys:', Object.keys(overrides).length,
        'merged keys:', Object.keys(merged).length);
    }
  }

  // For GSPS series with NO ideltas, include the template as-is
  for (const [seriesUID, templateAttrs] of gspsSeriesMap) {
    if (!seriesWithIdeltas.has(seriesUID)) {
      result.push(templateAttrs);
      console.info('[GSPS] Using template-only for series (no ideltas):', seriesUID);
    }
  }

  console.info('[GSPS] Total GSPS instance maps extracted:', result.length);
  return result;
}

/**
 * Convert a <template> element (with <element>, <sqElement>, <binary> children)
 * into a flat attribute map suitable for GSPSParser.
 */
function templateElementToAttributeMap(
  parent: Element,
): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    const tag = child.getAttribute('tag');
    if (!tag) continue;

    const tagLower = tag.toLowerCase();

    if (child.tagName === 'element') {
      const val = extractElementValue(child);
      if (val !== null) {
        attrs[tagLower] = val;
      }
    } else if (child.tagName === 'binary') {
      const encode = child.getAttribute('Encode') || 'base64';
      const val = child.getAttribute('val') || child.textContent || '';
      attrs[tagLower] = val; // store raw base64 string
    } else if (child.tagName === 'sqElement') {
      // Parse sequence: each <val1>, <val2>, ... child is a sequence item
      const items: Record<string, unknown>[] = [];
      for (let j = 0; j < child.children.length; j++) {
        const valChild = child.children[j];
        if (valChild.tagName.startsWith('val')) {
          items.push(templateElementToAttributeMap(valChild));
        }
      }
      attrs[tagLower] = items;
    }
  }

  return attrs;
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
