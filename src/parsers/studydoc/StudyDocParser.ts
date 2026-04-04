import pako from 'pako';
import type { StudyDoc } from '../../core/types';

const SIZEOF_INT32 = 4;

/**
 * Read a little-endian int32 from a Uint8Array at the given offset.
 */
function readIntLE(arr: Uint8Array, off: number): number {
  return (
    (arr[off]) |
    (arr[off + 1] << 8) |
    (arr[off + 2] << 16) |
    (arr[off + 3] << 24)
  );
}

/**
 * Parse the binary StudyDoc response from the iSyntaxStudy endpoint.
 * Ported from the Java/Groovy reference implementation.
 *
 * Binary format per entity:
 *   int32 sizeOfXmlEntity
 *   int32 dtsffVersionSize  +  byte[dtsffVersionSize] version string
 *   int8  isCompressed
 *   int32 uriSize  +  byte[uriSize] uri string
 *   int32 allocatedSize
 *   int32 CRC
 *   int32 dataLength
 *   If dataLength > 0:
 *     int32 uncompressedDataLength        (counted within dataLength)
 *     byte[2] zlib header (skip)
 *     byte[dataLength - 6] raw deflate data
 */
export function parseStudyDoc(arrayBuffer: ArrayBuffer): StudyDoc {
  const doc: StudyDoc = { studyXml: null, imagesXml: null, imageXmlList: [], ancillaryXml: null, updateXml: null };
  const responseData = new Uint8Array(arrayBuffer);
  const domParser = new DOMParser();

  if (responseData.length < 8) {
    console.warn('StudyDoc: response empty or too small');
    return doc;
  }

  let idx = 0;
  const noOfEntities = readIntLE(responseData, idx);
  idx += 4;

  for (let e = 0; e < noOfEntities && idx < responseData.length; e++) {
    if (idx + 4 > responseData.length) break;

    // sizeOfXmlEntity
    const sizeOfXmlEntity = readIntLE(responseData, idx);
    idx += 4;

    // dtsffVersionSize + version string
    const dtsffVersionSize = readIntLE(responseData, idx);
    idx += 4;
    if (dtsffVersionSize > 0) idx += dtsffVersionSize;

    if (idx >= responseData.length) break;

    // isCompressed
    const isCompressed = responseData[idx];
    idx += 1;
    if (isCompressed < 0) break;

    // uriSize + uri
    const uriSize = readIntLE(responseData, idx);
    idx += 4;
    if (uriSize < 0 || idx + uriSize > responseData.length) break;

    const uri = new TextDecoder('utf-8').decode(responseData.subarray(idx, idx + uriSize));
    idx += uriSize;

    // allocatedSize, CRC, dataLength
    const allocatedSize = readIntLE(responseData, idx);
    idx += 4;
    const CRC = readIntLE(responseData, idx);
    idx += 4;
    const dataLength = readIntLE(responseData, idx);
    idx += 4;

    if (dataLength > 0) {
      // Skip 4-byte uncompressedDataLength + 2-byte zlib header
      const compressedOffset = idx + 4 + 2;
      const compressedLen = dataLength - 6;

      if (
        compressedOffset + compressedLen <= responseData.length &&
        compressedLen > 0
      ) {
        try {
          const compressedData = responseData.subarray(
            compressedOffset,
            compressedOffset + compressedLen
          );
          const inflated = pako.inflateRaw(compressedData);
          const xmlData = new TextDecoder('utf-8').decode(inflated);
          const uriLower = uri.toLowerCase();

          if (uriLower.includes('_study.xml')) {
            doc.studyXml = domParser.parseFromString(`<root>${xmlData}</root>`, 'text/xml');
          } else if (uriLower.includes('_images.xml')) {
            const parsed = domParser.parseFromString(`<root>${xmlData}</root>`, 'text/xml');
            doc.imageXmlList.push(parsed);
            if (!doc.imagesXml) {
              doc.imagesXml = parsed;
            }
          } else if (uriLower.includes('_ancillary.xml')) {
            doc.ancillaryXml = domParser.parseFromString(`<root>${xmlData}</root>`, 'text/xml');
          } else if (uriLower.includes('_update.xml')) {
            doc.updateXml = domParser.parseFromString(`<root>${xmlData}</root>`, 'text/xml');
          }
        } catch (ex) {
          console.error('StudyDoc decompress error:', ex);
        }
      }

      // Advance idx past the entire data block
      idx += dataLength;
    }
  }

  // Apply ancillary overrides to study XML (PACS metadata updates)
  if (doc.studyXml && doc.ancillaryXml) {
    mergeAncillaryIntoStudy(doc.studyXml, doc.ancillaryXml);
  }

  // Apply _Update.xml sdelta overrides to study XML
  if (doc.studyXml && doc.updateXml) {
    applyUpdateDiffs(doc.studyXml, doc.updateXml);
  }

  return doc;
}

/**
 * Merge _ancillary.xml overrides into _study.xml.
 * The ancillary component contains updated metadata from the PACS server
 * (e.g., corrected patient names, series descriptions) that should take
 * precedence over the original _study.xml values.
 *
 * Merge strategy:
 *  1. Study-level <element> tags in ancillary override matching tags in study.
 *  2. <series name="X"> in ancillary: its direct <element> children and
 *     <template> children override the corresponding series in study.
 *     If the series doesn't exist in study, it is added.
 */
function mergeAncillaryIntoStudy(studyXml: Document, ancillaryXml: Document): void {
  const studyRoot = studyXml.documentElement; // <root>
  const ancRoot = ancillaryXml.documentElement;

  // 1. Merge study-level elements (direct <element> children of <root> or <xmlStudy>)
  const ancStudyContainer = ancRoot.getElementsByTagName('xmlStudy')[0] || ancRoot;
  const studyContainer = studyRoot.getElementsByTagName('xmlStudy')[0] || studyRoot;

  for (let i = 0; i < ancStudyContainer.children.length; i++) {
    const ancChild = ancStudyContainer.children[i];

    if (ancChild.tagName === 'element') {
      const tag = ancChild.getAttribute('tag');
      if (!tag) continue;
      // Find and update matching element in study, or add new one
      let found = false;
      for (let j = 0; j < studyContainer.children.length; j++) {
        const studyChild = studyContainer.children[j];
        if (studyChild.tagName === 'element' && studyChild.getAttribute('tag') === tag) {
          // Copy all attributes from ancillary element
          for (let a = 0; a < ancChild.attributes.length; a++) {
            const attr = ancChild.attributes[a];
            studyChild.setAttribute(attr.name, attr.value);
          }
          found = true;
          break;
        }
      }
      if (!found) {
        studyContainer.appendChild(ancChild.cloneNode(true));
      }
    } else if (ancChild.tagName === 'series') {
      mergeAncillarySeries(studyContainer, ancChild);
    }
  }
}

/**
 * Merge a single <series> element from ancillary into the study container.
 */
function mergeAncillarySeries(studyContainer: Element, ancSeries: Element): void {
  const seriesName = ancSeries.getAttribute('name');
  if (!seriesName) return;

  // Find matching series in study
  const studySeries = studyContainer.getElementsByTagName('series');
  let targetSeries: Element | null = null;
  for (let i = 0; i < studySeries.length; i++) {
    if (studySeries[i].getAttribute('name') === seriesName) {
      targetSeries = studySeries[i];
      break;
    }
  }

  if (!targetSeries) {
    // Series doesn't exist in study — add it
    studyContainer.appendChild(ancSeries.cloneNode(true));
    return;
  }

  // Merge direct <element> children of the series
  for (let i = 0; i < ancSeries.children.length; i++) {
    const ancChild = ancSeries.children[i];

    if (ancChild.tagName === 'element') {
      const tag = ancChild.getAttribute('tag');
      if (!tag) continue;
      let found = false;
      // Only look at direct element children (not inside <template>)
      for (let j = 0; j < targetSeries.children.length; j++) {
        const studyChild = targetSeries.children[j];
        if (studyChild.tagName === 'element' && studyChild.getAttribute('tag') === tag) {
          for (let a = 0; a < ancChild.attributes.length; a++) {
            const attr = ancChild.attributes[a];
            studyChild.setAttribute(attr.name, attr.value);
          }
          found = true;
          break;
        }
      }
      if (!found) {
        targetSeries.appendChild(ancChild.cloneNode(true));
      }
    } else if (ancChild.tagName === 'template') {
      // Merge template elements
      const studyTemplates = targetSeries.getElementsByTagName('template');
      if (studyTemplates.length > 0) {
        mergeTemplateElements(studyTemplates[0], ancChild);
      } else {
        targetSeries.appendChild(ancChild.cloneNode(true));
      }
    }
  }
}

/**
 * Merge <element> children from ancillary template into study template.
 */
function mergeTemplateElements(studyTemplate: Element, ancTemplate: Element): void {
  for (let i = 0; i < ancTemplate.children.length; i++) {
    const ancEl = ancTemplate.children[i];
    if (ancEl.tagName !== 'element') continue;
    const tag = ancEl.getAttribute('tag');
    if (!tag) continue;

    let found = false;
    for (let j = 0; j < studyTemplate.children.length; j++) {
      const studyEl = studyTemplate.children[j];
      if (studyEl.tagName === 'element' && studyEl.getAttribute('tag') === tag) {
        for (let a = 0; a < ancEl.attributes.length; a++) {
          const attr = ancEl.attributes[a];
          studyEl.setAttribute(attr.name, attr.value);
        }
        found = true;
        break;
      }
    }
    if (!found) {
      studyTemplate.appendChild(ancEl.cloneNode(true));
    }
  }
}

/**
 * Apply _Update.xml sdelta diffs to _study.xml.
 *
 * Mirrors the Xerces3 SAX merge workflow used by the reference Java/C++
 * implementation. The _Update.xml contains one or more <sdelta> elements
 * (study-level deltas) with <diff> children that represent metadata
 * corrections applied after the original study was created.
 *
 * Format:
 *   <sdelta datetime="..." user="...">
 *     <diff op="*" tag="00100010" val="PATIENT^NAME"/>
 *     <diff op="+" tag="NEWTAG" val="VALUE"/>
 *     <diff op="-" tag="REMOVEDTAG"/>
 *   </sdelta>
 *
 * Diff operations (SAX merge semantics):
 *   op="*"  Modify — find all existing <element> nodes with matching tag
 *           and update their val attribute. If none exist, insert a new
 *           <element> at the study level (the tag may have been absent
 *           from the original _Study.xml).
 *   op="+"  Add — always insert a new <element> node (never merge into
 *           an existing one). Used for tags that were not present before.
 *   op="-"  Delete — remove all <element> nodes with matching tag from
 *           the document tree.
 *
 * Multiple <sdelta> blocks are applied in document order so that later
 * corrections win over earlier ones.
 */
function applyUpdateDiffs(studyXml: Document, updateXml: Document): void {
  const studyRoot = studyXml.documentElement;
  const sdeltas = updateXml.getElementsByTagName('sdelta');

  for (let s = 0; s < sdeltas.length; s++) {
    const sdelta = sdeltas[s];

    // Only process direct <diff> children of this <sdelta>
    for (let d = 0; d < sdelta.children.length; d++) {
      const diff = sdelta.children[d];
      if (diff.tagName !== 'diff') continue;

      const op = diff.getAttribute('op');
      const tag = diff.getAttribute('tag');
      if (!tag) continue;

      if (op === '-') {
        // Delete: remove ALL <element> nodes with matching tag
        const elements = studyRoot.getElementsByTagName('element');
        for (let i = elements.length - 1; i >= 0; i--) {
          if (elements[i].getAttribute('tag') === tag) {
            elements[i].parentNode?.removeChild(elements[i]);
          }
        }
      } else if (op === '+') {
        // Add: always insert a new <element> node
        const val = diff.getAttribute('val');
        if (!val) continue;
        const newEl = studyXml.createElement('element');
        newEl.setAttribute('tag', tag);
        newEl.setAttribute('val', val.trim());
        // Copy any multi-value attributes (val1, val2, ...)
        for (let a = 0; a < diff.attributes.length; a++) {
          const attr = diff.attributes[a];
          if (attr.name !== 'op' && attr.name !== 'tag' && attr.name !== 'val') {
            newEl.setAttribute(attr.name, attr.value);
          }
        }
        studyRoot.appendChild(newEl);
      } else {
        // Modify (op="*" or unrecognised op): update existing, add if absent
        const val = diff.getAttribute('val');
        if (!val) continue;
        const trimmedVal = val.trim();

        let found = false;
        const elements = studyRoot.getElementsByTagName('element');
        for (let i = 0; i < elements.length; i++) {
          if (elements[i].getAttribute('tag') === tag) {
            elements[i].setAttribute('val', trimmedVal);
            // Sync any multi-value attributes from the diff
            for (let a = 0; a < diff.attributes.length; a++) {
              const attr = diff.attributes[a];
              if (attr.name !== 'op' && attr.name !== 'tag') {
                elements[i].setAttribute(attr.name, attr.value.trim());
              }
            }
            found = true;
          }
        }
        if (!found) {
          // Tag absent in _Study.xml — insert at study level
          const newEl = studyXml.createElement('element');
          newEl.setAttribute('tag', tag);
          newEl.setAttribute('val', trimmedVal);
          for (let a = 0; a < diff.attributes.length; a++) {
            const attr = diff.attributes[a];
            if (attr.name !== 'op' && attr.name !== 'tag') {
              newEl.setAttribute(attr.name, attr.value.trim());
            }
          }
          studyRoot.appendChild(newEl);
        }
      }
    }
  }
}
