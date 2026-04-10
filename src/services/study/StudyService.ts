import { getStudyDocUrl } from '../../transport/endpoints/config';
import { authenticatedFetch } from '../../transport/authenticatedFetch';
import { parseStudyDoc } from '../../parsers/studydoc/StudyDocParser';
import type { DicomImageMetadata, StudyInfo, StudyDoc, SeriesGroup } from '../../core/types';
import {
  extractImageMetadata,
  extractStudyInfo,
  extractImageUIDsFromImagesXml,
  getImageSeriesUIDs,
  extractGSPSAttributeMaps,
} from '../../dicom/metadata/DicomMetadata';
import { parseGSPSInstance } from '../../gsps-engine/GSPSParser';
import { buildApplicationResult } from '../../gsps-engine/GraphicAnnotationProcessor';
import type { GSPSApplicationResult } from '../../gsps-engine/types';

/**
 * Cache for parsed StudyDoc data keyed by `${studyUID}::${stackId}`.
 */
const studyDocCache = new Map<string, StudyDoc>();

/**
 * Cache for extracted image metadata keyed by `${studyUID}::${stackId}`.
 */
const metadataCache = new Map<string, Map<string, DicomImageMetadata>>();

function cacheKey(studyUID: string, stackId: string): string {
  return `${studyUID}::${stackId}`;
}

/**
 * Fetch and parse the StudyDoc for a given study.
 * Results are cached so subsequent calls for the same study are instant.
 */
export async function fetchStudyDoc(
  studyUID: string,
  stackId: string
): Promise<StudyDoc> {
  const key = cacheKey(studyUID, stackId);

  const cached = studyDocCache.get(key);
  if (cached) return cached;

  const url = getStudyDocUrl(studyUID, stackId);
  const response = await authenticatedFetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch StudyDoc: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const doc = parseStudyDoc(arrayBuffer);

  studyDocCache.set(key, doc);
  return doc;
}

/**
 * Get all image metadata for a study.
 * Fetches the StudyDoc if not already cached.
 */
export async function getAllImageMetadata(
  studyUID: string,
  stackId: string
): Promise<Map<string, DicomImageMetadata>> {
  const key = cacheKey(studyUID, stackId);

  const cached = metadataCache.get(key);
  if (cached) return cached;

  const doc = await fetchStudyDoc(studyUID, stackId);

  if (!doc.studyXml && !doc.imagesXml) {
    console.warn('StudyDoc missing both studyXml and imagesXml');
    return new Map();
  }

  // Merge metadata from all image XML documents
  const allMetadata = new Map<string, DicomImageMetadata>();

  if (doc.imageXmlList.length > 0 && doc.studyXml) {
    for (const imgXml of doc.imageXmlList) {
      const partial = extractImageMetadata(doc.studyXml, imgXml);
      partial.forEach((meta, uid) => allMetadata.set(uid, meta));
    }
  } else if (doc.studyXml && doc.imagesXml) {
    const partial = extractImageMetadata(doc.studyXml, doc.imagesXml);
    partial.forEach((meta, uid) => allMetadata.set(uid, meta));
  }

  metadataCache.set(key, allMetadata);
  return allMetadata;
}

/**
 * Get DICOM metadata for a specific image instance.
 * Fetches the StudyDoc if not already cached.
 */
export async function getInstanceMetadata(
  studyUID: string,
  stackId: string,
  instanceUID: string
): Promise<DicomImageMetadata | null> {
  const allMeta = await getAllImageMetadata(studyUID, stackId);
  return allMeta.get(instanceUID) || null;
}

/**
 * Fetch StudyDoc and extract study info + image UIDs.
 * Image UIDs come from _images.xml idelta elements (preferred),
 * falling back to _study.xml SOPInstanceUID tags.
 */
export async function getStudyInfoAndImageIds(
  studyUID: string,
  stackId: string
): Promise<{ studyInfo: StudyInfo; imageIds: string[] }> {
  const doc = await fetchStudyDoc(studyUID, stackId);

  // Extract study-level info from _study.xml
  let studyInfo: StudyInfo = {
    patientName: '',
    patientId: '',
    modality: '',
    studyInstanceUID: studyUID,
    seriesUIDs: [],
    imageUIDs: [],
  };

  if (doc.studyXml) {
    studyInfo = extractStudyInfo(doc.studyXml);
  }

  // Build image series filter from _study.xml
  const imageSeriesUIDs = doc.studyXml
    ? getImageSeriesUIDs(doc.studyXml)
    : undefined;

  // Collect image UIDs from _images.xml, filtered to exclude PS series
  const imageIds: string[] = [];
  if (doc.imageXmlList.length > 0) {
    for (const imgXml of doc.imageXmlList) {
      const uids = extractImageUIDsFromImagesXml(imgXml, imageSeriesUIDs);
      for (const uid of uids) {
        if (!imageIds.includes(uid)) {
          imageIds.push(uid);
        }
      }
    }
  } else if (doc.imagesXml) {
    const uids = extractImageUIDsFromImagesXml(doc.imagesXml, imageSeriesUIDs);
    for (const uid of uids) {
      if (!imageIds.includes(uid)) {
        imageIds.push(uid);
      }
    }
  }

  // Fallback: use image UIDs from _study.xml if none found in _images.xml
  if (imageIds.length === 0 && studyInfo.imageUIDs.length > 0) {
    imageIds.push(...studyInfo.imageUIDs);
  }

  return { studyInfo, imageIds };
}

/**
 * Clear cached data for a study (e.g., on navigation away).
 */
export function clearStudyDocCache(studyUID?: string, stackId?: string): void {
  if (studyUID && stackId) {
    const key = cacheKey(studyUID, stackId);
    studyDocCache.delete(key);
    metadataCache.delete(key);
  } else {
    studyDocCache.clear();
    metadataCache.clear();
  }
}

/**
 * Group image UIDs by their series UID using DICOM metadata.
 * Returns an array of SeriesGroup in XML document order.
 * Falls back to a single group if metadata is unavailable.
 */
export async function getSeriesImageGroups(
  studyUID: string,
  stackId: string,
  imageIds: string[]
): Promise<SeriesGroup[]> {
  const meta = await getAllImageMetadata(studyUID, stackId);

  // Build ordered groups keyed by seriesUID
  const groupMap = new Map<string, string[]>();
  for (const uid of imageIds) {
    const m = meta.get(uid);
    const seriesUID = m?.seriesUID || '_unknown';
    let list = groupMap.get(seriesUID);
    if (!list) {
      list = [];
      groupMap.set(seriesUID, list);
    }
    list.push(uid);
  }

  // Sort images within each series by Instance Number (0020,0013)
  return Array.from(groupMap.entries()).map(([seriesUID, ids]) => ({
    seriesUID,
    imageIds: ids.sort((a, b) => {
      const numA = meta.get(a)?.imageNumber ?? Number.MAX_SAFE_INTEGER;
      const numB = meta.get(b)?.imageNumber ?? Number.MAX_SAFE_INTEGER;
      return numA - numB;
    }),
  }));
}

/**
 * Extract and parse GSPS data from the study document.
 * Returns the processed GSPS application result (annotations, VOI, spatial transforms)
 * or null if no GSPS is present.
 */
export async function getGSPSData(
  studyUID: string,
  stackId: string,
): Promise<GSPSApplicationResult | null> {
  const doc = await fetchStudyDoc(studyUID, stackId);
  if (!doc.studyXml) return null;

  const attributeMaps = extractGSPSAttributeMaps(doc.studyXml);
  if (attributeMaps.length === 0) return null;

  // Parse the first (best) GSPS instance
  const parsed = parseGSPSInstance(attributeMaps[0]);
  return buildApplicationResult(parsed);
}
