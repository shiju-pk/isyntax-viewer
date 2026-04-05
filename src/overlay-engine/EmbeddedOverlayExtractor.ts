/**
 * EmbeddedOverlayExtractor — Extracts overlay data from pixel data high bits.
 *
 * Some DICOM images store overlay data in unused high bits of the pixel data
 * (when OverlayBitPosition > 0). This module extracts those bits into
 * standalone overlay data arrays that can be rendered by OverlayRenderer.
 *
 * Per DICOM standard, embedded overlays use bits above BitsStored in the
 * pixel data word. For example, if BitsAllocated=16, BitsStored=12,
 * HighBit=11, then bits 12-15 could contain embedded overlay data.
 */

import type { OverlayPlane, OverlayGroup } from './types';

/**
 * Extract embedded overlay data from pixel data for all planes that have
 * bitPosition > 0 and no standalone overlay data.
 *
 * @param group - The parsed overlay group (mutated in place).
 * @param pixelData - The raw pixel data (16-bit words).
 * @param bitsAllocated - DICOM BitsAllocated (typically 16).
 * @param imageRows - Number of pixel rows.
 * @param imageCols - Number of pixel columns.
 * @param numFrames - Number of frames (1 for single-frame images).
 */
export function extractEmbeddedOverlays(
  group: OverlayGroup,
  pixelData: Int16Array | Uint16Array | Int32Array,
  bitsAllocated: number,
  imageRows: number,
  imageCols: number,
  numFrames: number = 1,
): void {
  for (let i = 0; i < group.planes.length; i++) {
    const plane = group.planes[i];
    if (!plane) continue;

    // Only process embedded overlays (bitPosition > 0) that lack standalone data
    if (plane.bitPosition <= 0 || plane.data !== null) continue;

    plane.data = extractPlaneBits(
      plane,
      pixelData,
      bitsAllocated,
      imageRows,
      imageCols,
      numFrames,
    );
  }
}

/**
 * Extract a single plane's overlay bits from the pixel data.
 *
 * Each pixel word is examined at the bit position specified by the plane.
 * The overlay occupies exactly (plane.rows * plane.columns * plane.frameCount)
 * pixels, starting at the overlay origin within each frame.
 */
function extractPlaneBits(
  plane: OverlayPlane,
  pixelData: Int16Array | Uint16Array | Int32Array,
  _bitsAllocated: number,
  imageRows: number,
  imageCols: number,
  numFrames: number,
): Uint8Array {
  const overlayRows = plane.rows || imageRows;
  const overlayCols = plane.columns || imageCols;
  const frameCount = plane.frameCount || 1;
  const frameSize = overlayRows * overlayCols;
  const totalBits = frameSize * frameCount;

  // Pack extracted bits into a byte array (8 bits per byte)
  const byteCount = Math.ceil(totalBits / 8);
  const result = new Uint8Array(byteCount);

  const bitMask = 1 << plane.bitPosition;

  // Origin is 1-based per DICOM
  const originRow = (plane.origin[0] || 1) - 1;
  const originCol = (plane.origin[1] || 1) - 1;
  const pixelsPerFrame = imageRows * imageCols;

  let bitIndex = 0;

  for (let frame = 0; frame < frameCount; frame++) {
    const frameOffset = (plane.frameOrigin - 1 + frame) * pixelsPerFrame;

    for (let row = 0; row < overlayRows; row++) {
      for (let col = 0; col < overlayCols; col++) {
        const pixelIndex = frameOffset + (originRow + row) * imageCols + (originCol + col);

        if (pixelIndex < pixelData.length) {
          const pixelWord = pixelData[pixelIndex];
          const overlayBit = (pixelWord & bitMask) !== 0 ? 1 : 0;

          // Pack into bytes (LSB-first to match DICOM overlay data convention)
          const byteIdx = Math.floor(bitIndex / 8);
          const bitOffset = bitIndex % 8;
          if (overlayBit) {
            result[byteIdx] |= (1 << bitOffset);
          }
        }

        bitIndex++;
      }
    }
  }

  return result;
}

/**
 * Strip embedded overlay bits from pixel data to prevent them from
 * affecting the displayed image (they would appear as bright noise).
 *
 * Call this after extracting embedded overlays and before rendering the image.
 *
 * @param pixelData - Raw pixel data (modified in place).
 * @param bitsStored - DICOM BitsStored.
 * @param bitsAllocated - DICOM BitsAllocated.
 */
export function stripEmbeddedOverlayBits(
  pixelData: Int16Array | Uint16Array,
  bitsStored: number,
  bitsAllocated: number,
): void {
  if (bitsStored >= bitsAllocated) return;

  // Create a mask that keeps only the stored bits
  const mask = (1 << bitsStored) - 1;

  for (let i = 0; i < pixelData.length; i++) {
    pixelData[i] = pixelData[i] & mask;
  }
}
