/**
 * OverlayRenderer — Converts parsed overlay planes into renderable RGBA ImageData.
 *
 * Handles:
 * - Bit-unpacking from packed byte arrays (1 bit per overlay pixel)
 * - Multi-frame overlay frame selection
 * - Overlay origin offset (non-1,1 origins)
 * - Overlay rescaling when overlay dimensions differ from image dimensions
 * - Per-plane coloring with the 16-color palette
 * - Compositing multiple planes into a single output ImageData
 *
 * Ported from legacy `dicomoverlay.js` with no framework dependencies.
 */

import type {
  OverlayPlane,
  OverlayGroup,
  OverlayRenderOptions,
  RenderedOverlay,
} from './types';
import { isValidPlane, planeAppliesToFrame } from './OverlayParser';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render all visible overlay planes into a single composited RGBA ImageData.
 *
 * @param group - The parsed overlay group.
 * @param options - Rendering parameters (image size, frame, visibility).
 * @returns A `RenderedOverlay` with composited pixel data.
 */
export function renderOverlays(
  group: OverlayGroup,
  options: OverlayRenderOptions,
): RenderedOverlay {
  const { imageWidth, imageHeight, pixelLevel, currentFrame, isMultiFrame } = options;
  const output = new Uint8ClampedArray(imageWidth * imageHeight * 4);
  const renderedPlanes: number[] = [];
  const invalidPlanes: number[] = [];

  for (let i = 0; i < group.planes.length; i++) {
    const plane = group.planes[i];
    if (!plane) continue;

    // Check visibility: use override if provided, else use activationLayer
    const visible = options.planeVisibility?.[i] ?? plane.activationLayer;
    if (!visible) continue;

    // Validate plane
    if (!isValidPlane(plane)) {
      invalidPlanes.push(i);
      continue;
    }

    // Check multi-frame applicability
    if (!planeAppliesToFrame(plane, currentFrame, isMultiFrame)) continue;

    // Determine color (override or default)
    const colorStr = options.planeColors?.[i] ?? plane.color;
    const [r, g, b] = hexToRGB(colorStr);

    // Get the overlay bit array for the current frame
    const overlayBits = extractFrameBits(plane, currentFrame, isMultiFrame);
    if (!overlayBits) {
      invalidPlanes.push(i);
      continue;
    }

    // Validate data size
    const frameSize = plane.rows * plane.columns;
    const numberOfFrames = isMultiFrame ? plane.frameCount : 1;
    const expectedBytes = (frameSize * numberOfFrames) / 8;
    const tolerance = 1; // BoneXpert overlays can be a few bits short
    if (plane.data && expectedBytes - plane.data.length >= tolerance && !isValidPlane(plane)) {
      invalidPlanes.push(i);
      continue;
    }

    // Determine if rescaling is needed
    const overlayRows = plane.rows >> pixelLevel || plane.rows;
    const overlayCols = plane.columns >> pixelLevel || plane.columns;

    let finalBits: Uint8Array;
    if (overlayRows > imageHeight || overlayCols > imageWidth) {
      finalBits = downSampleOverlay(overlayBits, plane.rows, plane.columns, imageHeight, imageWidth);
    } else {
      finalBits = overlayBits;
    }

    // Composite this plane onto the output buffer with origin offset
    compositePlane(
      output,
      finalBits,
      plane,
      imageWidth,
      imageHeight,
      pixelLevel,
      r, g, b,
    );

    renderedPlanes.push(i);
  }

  const imageData = new ImageData(output, imageWidth, imageHeight);

  return {
    imageData,
    width: imageWidth,
    height: imageHeight,
    renderedPlanes,
    invalidPlanes,
  };
}

// ---------------------------------------------------------------------------
// Bit extraction
// ---------------------------------------------------------------------------

/**
 * Extract overlay bits for a single frame from the packed byte array.
 * Each bit in the data represents one overlay pixel.
 *
 * @returns An array where each element is 0 or 1, representing the overlay pixels.
 */
function extractFrameBits(
  plane: OverlayPlane,
  frameIndex: number,
  isMultiFrame: boolean,
): Uint8Array | null {
  if (!plane.data || plane.data.length === 0) return null;

  const frameSize = plane.rows * plane.columns;
  const startBit = isMultiFrame
    ? frameSize * (frameIndex - plane.frameOrigin)
    : 0;
  const endBit = startBit + frameSize;

  return extractBitsFromBytes(plane.data, Math.floor(startBit / 8), endBit);
}

/**
 * Extract individual bits from a packed byte array.
 *
 * @param data - Packed byte array where each byte contains 8 overlay pixels.
 * @param startByte - Byte offset to start extraction.
 * @param totalBits - Total number of bits to extract from the start.
 * @returns Uint8Array where each element is 0 or 1.
 */
export function extractBitsFromBytes(
  data: Uint8Array,
  startByte: number,
  totalBits: number,
): Uint8Array {
  const numBits = totalBits - startByte * 8;
  const result = new Uint8Array(numBits > 0 ? numBits : 0);

  let bitIndex = 0;
  for (let byteIdx = startByte; byteIdx < data.length && bitIndex < result.length; byteIdx++) {
    const byte = data[byteIdx];
    for (let bit = 0; bit < 8 && bitIndex < result.length; bit++) {
      // LSB-first bit ordering (DICOM standard for overlay data)
      result[bitIndex++] = (byte >> bit) & 1;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Compositing
// ---------------------------------------------------------------------------

/**
 * Composite a single overlay plane's bits onto the RGBA output buffer,
 * respecting the overlay origin offset.
 *
 * Ported from legacy dicomoverlay.js draw() method.
 */
function compositePlane(
  output: Uint8ClampedArray,
  overlayBits: Uint8Array,
  plane: OverlayPlane,
  imageWidth: number,
  imageHeight: number,
  pixelLevel: number,
  r: number,
  g: number,
  b: number,
): void {
  // Calculate image and overlay start indices based on origin
  let imgRowStart = 0;
  let imgColStart = 0;
  let ovlRowStart = 0;
  let ovlColStart = 0;

  const originRow = plane.origin[0];
  const originCol = plane.origin[1];

  if (originRow > 0) {
    imgRowStart = (originRow >> pixelLevel) - 1;
    if (imgRowStart < 0) imgRowStart = 0;
  } else {
    ovlRowStart = ((-originRow) >> pixelLevel) + 1;
  }

  if (originCol > 0) {
    imgColStart = (originCol >> pixelLevel) - 1;
    if (imgColStart < 0) imgColStart = 0;
  } else {
    ovlColStart = ((-originCol) >> pixelLevel) + 1;
  }

  const overlayColumns = Math.min(imageWidth, plane.columns);
  const overlayRows = Math.min(imageHeight, plane.rows);

  let imageIdx = imgRowStart * imageWidth + imgColStart;
  let ovlIdx = ovlRowStart * overlayColumns + ovlColStart;
  let imgRow = imgRowStart;
  let ovlRow = ovlRowStart;

  const imageEnd = imageWidth * imageHeight;

  while (imageIdx < imageEnd && ovlIdx < overlayBits.length) {
    // Check if we're within the current row bounds
    if (imageIdx < imageWidth * (imgRow + 1) && ovlIdx < overlayColumns * (ovlRow + 1)) {
      const pixelValue = overlayBits[ovlIdx];
      const outputIdx = imageIdx * 4;

      // Only write if the overlay pixel is ON and no other plane has written here
      if (pixelValue && output[outputIdx + 3] === 0) {
        output[outputIdx] = r;
        output[outputIdx + 1] = g;
        output[outputIdx + 2] = b;
        output[outputIdx + 3] = 255;
      }

      imageIdx++;
      ovlIdx++;
    } else {
      // Move to next row
      imgRow++;
      ovlRow++;
      imageIdx = imgRow * imageWidth + imgColStart;
      ovlIdx = ovlRow * overlayColumns + ovlColStart;
    }
  }
}

// ---------------------------------------------------------------------------
// Downsampling
// ---------------------------------------------------------------------------

/**
 * Simple nearest-neighbor downsample of overlay bit data.
 */
function downSampleOverlay(
  bits: Uint8Array,
  srcRows: number,
  srcCols: number,
  dstRows: number,
  dstCols: number,
): Uint8Array {
  const result = new Uint8Array(dstRows * dstCols);
  const rowRatio = srcRows / dstRows;
  const colRatio = srcCols / dstCols;

  for (let r = 0; r < dstRows; r++) {
    const srcRow = Math.floor(r * rowRatio);
    for (let c = 0; c < dstCols; c++) {
      const srcCol = Math.floor(c * colRatio);
      const srcIdx = srcRow * srcCols + srcCol;
      result[r * dstCols + c] = bits[srcIdx] ?? 0;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
}
