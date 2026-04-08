import type { Study } from '../../core/domain/Study';
import type { Series } from '../../core/domain/Series';
import type { Instance } from '../../core/domain/Instance';
import type { StudyInfo, SeriesGroup, DicomImageMetadata } from '../../core/types';

/**
 * Maps raw StudyService / DicomMetadata outputs into canonical domain models.
 */
export function normalizeStudy(
  studyInfo: StudyInfo,
  stackId: string,
  seriesGroups: SeriesGroup[],
  metadataMap: Map<string, DicomImageMetadata>,
): Study {
  const series: Series[] = seriesGroups.map((sg, index) =>
    normalizeSeries(sg, metadataMap, index),
  );

  return {
    uid: studyInfo.studyInstanceUID,
    stackId,
    patientName: studyInfo.patientName,
    patientId: studyInfo.patientId,
    modality: studyInfo.modality,
    series,
  };
}

function normalizeSeries(
  group: SeriesGroup,
  metadataMap: Map<string, DicomImageMetadata>,
  fallbackNumber: number,
): Series {
  const firstMeta = metadataMap.get(group.imageIds[0]);

  const instances: Instance[] = group.imageIds.map((uid) => {
    const meta = metadataMap.get(uid);
    return normalizeInstance(uid, meta);
  });

  return {
    uid: group.seriesUID,
    seriesNumber: fallbackNumber + 1,
    modality: firstMeta?.modality ?? '',
    frameOfReferenceUID: firstMeta?.frameOfReferenceUID,
    instances,
  };
}

function normalizeInstance(
  uid: string,
  meta: DicomImageMetadata | undefined,
): Instance {
  return {
    uid,
    sopClassUID: meta?.sopInstanceUID ?? '',
    instanceNumber: meta?.imageNumber,
    metadata: meta ?? createEmptyMetadata(),
    isMultiFrame: (meta?.numberOfFrames ?? 1) > 1,
    numberOfFrames: meta?.numberOfFrames,
  };
}

function createEmptyMetadata(): DicomImageMetadata {
  return {
    rows: 0,
    columns: 0,
    bitsAllocated: 16,
    bitsStored: 16,
    highBit: 15,
    pixelRepresentation: 0,
    photometricInterpretation: 'MONOCHROME2',
    samplesPerPixel: 1,
    rescaleSlope: 1,
    rescaleIntercept: 0,
  };
}
