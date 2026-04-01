import pako from 'pako';

const SIZEOF_INT32 = 4;

export interface StudyDoc {
  studyXml: Document | null;
  imagesXml: Document | null;
  imageXmlList: Document[];
}

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
  const doc: StudyDoc = { studyXml: null, imagesXml: null, imageXmlList: [] };
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
          }
        } catch (ex) {
          console.error('StudyDoc decompress error:', ex);
        }
      }

      // Advance idx past the entire data block
      idx += dataLength;
    }
  }

  return doc;
}
