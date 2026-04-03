/**
 * Image quality status for progressive loading.
 *
 * Pattern inspired by cornerstone3D's ImageQualityStatus enum.
 * Values are ordered — higher = better quality. Use numeric comparison:
 *   if (newStatus > currentStatus) { update viewport }
 */

export enum ImageQualityStatus {
  /** No image data yet */
  NONE = 0,
  /** Coarsest wavelet level (InitImage result) */
  SUBRESOLUTION = 1,
  /** Intermediate refinement (some coefficient levels loaded) */
  INTERMEDIATE = 4,
  /** Lossy representation (JPEG/J2K compressed — all coefficients, some precision loss) */
  LOSSY = 7,
  /** Full wavelet reconstruction — all levels decoded */
  FULL_RESOLUTION = 8,
}
