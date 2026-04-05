/**
 * ImageSequencer — Sorts and sequences images within a series.
 *
 * Supports multiple sorting strategies based on DICOM metadata:
 * - Instance number (default)
 * - Image position (for CT/MR spatial ordering)
 * - Acquisition number + instance number
 * - Custom comparator
 *
 * Ported from legacy `imagesequencer.js`, `imagesorter.js`,
 * `ctimagesequencer.js` without framework dependencies.
 */

import type { DicomImageMetadata } from '@core/types';

// ---------------------------------------------------------------------------
// Sorting strategies
// ---------------------------------------------------------------------------

export type SortStrategy =
  | 'instanceNumber'
  | 'imagePosition'
  | 'acquisitionThenInstance'
  | 'custom';

export interface ImageSequencerOptions {
  /** Sorting strategy to use. Default: 'instanceNumber'. */
  strategy?: SortStrategy;

  /** Custom comparator function (used when strategy is 'custom'). */
  comparator?: (a: SequencerEntry, b: SequencerEntry) => number;
}

/** An entry in the sequencer — ties an image ID to its metadata. */
export interface SequencerEntry {
  imageId: string;
  metadata: DicomImageMetadata;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sort an array of image entries according to the specified strategy.
 *
 * @param entries - Image entries with metadata.
 * @param options - Sorting options.
 * @returns A new sorted array (does not mutate input).
 */
export function sequenceImages(
  entries: SequencerEntry[],
  options: ImageSequencerOptions = {},
): SequencerEntry[] {
  const strategy = options.strategy ?? 'instanceNumber';
  const sorted = [...entries];

  switch (strategy) {
    case 'instanceNumber':
      sorted.sort(compareByInstanceNumber);
      break;

    case 'imagePosition':
      sorted.sort(compareByImagePosition);
      break;

    case 'acquisitionThenInstance':
      sorted.sort(compareByAcquisitionThenInstance);
      break;

    case 'custom':
      if (options.comparator) {
        sorted.sort(options.comparator);
      }
      break;
  }

  return sorted;
}

/**
 * Detect the best sorting strategy for a series based on its metadata.
 *
 * @param modality - DICOM modality string.
 * @param entries - Sample of entries to inspect.
 * @returns Recommended sorting strategy.
 */
export function detectSortStrategy(
  modality: string | undefined,
  entries: SequencerEntry[],
): SortStrategy {
  const mod = modality?.toUpperCase() ?? '';

  // CT and MR benefit from spatial (image position) sorting
  if ((mod === 'CT' || mod === 'MR' || mod === 'PT') && hasImagePositionData(entries)) {
    return 'imagePosition';
  }

  // Default to instance number
  return 'instanceNumber';
}

/**
 * Convenience: sort image IDs given a metadata lookup function.
 *
 * @param imageIds - Array of image identifiers.
 * @param getMetadata - Function to retrieve metadata for an image ID.
 * @param options - Sorting options.
 * @returns Sorted image IDs.
 */
export function sortImageIds(
  imageIds: string[],
  getMetadata: (imageId: string) => DicomImageMetadata | null,
  options: ImageSequencerOptions = {},
): string[] {
  const entries: SequencerEntry[] = [];
  for (const id of imageIds) {
    const meta = getMetadata(id);
    if (meta) {
      entries.push({ imageId: id, metadata: meta });
    }
  }

  const sorted = sequenceImages(entries, options);
  return sorted.map((e) => e.imageId);
}

// ---------------------------------------------------------------------------
// Comparators
// ---------------------------------------------------------------------------

function compareByInstanceNumber(a: SequencerEntry, b: SequencerEntry): number {
  const numA = a.metadata.imageNumber ?? 0;
  const numB = b.metadata.imageNumber ?? 0;
  return numA - numB;
}

function compareByImagePosition(a: SequencerEntry, b: SequencerEntry): number {
  const posA = a.metadata.imagePositionPatient;
  const posB = b.metadata.imagePositionPatient;

  if (!posA || !posB) {
    // Fall back to instance number if position is missing
    return compareByInstanceNumber(a, b);
  }

  // Compute distance along the normal vector for sorting.
  // Use the image orientation to determine the slice direction.
  const iopA = a.metadata.imageOrientationPatient;

  if (iopA && iopA.length === 6) {
    // Normal vector = row × col
    const nx = iopA[1] * iopA[5] - iopA[2] * iopA[4];
    const ny = iopA[2] * iopA[3] - iopA[0] * iopA[5];
    const nz = iopA[0] * iopA[4] - iopA[1] * iopA[3];

    // Project position onto normal
    const distA = posA[0] * nx + posA[1] * ny + posA[2] * nz;
    const distB = posB[0] * nx + posB[1] * ny + posB[2] * nz;

    const diff = distA - distB;
    if (Math.abs(diff) > 0.001) return diff;
  }

  // Fall back to Z position, then instance number
  const zDiff = posA[2] - posB[2];
  if (Math.abs(zDiff) > 0.001) return zDiff;

  return compareByInstanceNumber(a, b);
}

function compareByAcquisitionThenInstance(a: SequencerEntry, b: SequencerEntry): number {
  // acquisitionNumber is not in DicomImageMetadata yet, so fall back
  // to instance number. This can be extended when the type is augmented.
  return compareByInstanceNumber(a, b);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasImagePositionData(entries: SequencerEntry[]): boolean {
  // Check if at least some entries have image position data
  const sample = entries.slice(0, Math.min(5, entries.length));
  return sample.some((e) => e.metadata.imagePositionPatient != null);
}
