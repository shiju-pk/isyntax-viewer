/**
 * Viewport Sync — Type Definitions
 *
 * Cross-viewport synchronization: linked scrolling by Frame of Reference UID,
 * reference line calculation and rendering.
 */

/** A viewport registration entry for linked scrolling. */
export interface LinkedViewportEntry {
  /** Viewport ID. */
  viewportId: string;

  /** Frame of Reference UID for this viewport's current series. */
  frameOfReferenceUID: string;

  /** Image Orientation Patient (6 floats: row cosines + col cosines). */
  imageOrientationPatient?: number[];

  /** Image Position Patient for the current slice [x, y, z]. */
  imagePositionPatient?: number[];

  /** Total number of images in the stack. */
  imageCount: number;

  /** Current image index (0-based). */
  currentImageIndex: number;

  /** Pixel spacing [row, col]. */
  pixelSpacing?: [number, number];

  /** Image rows. */
  rows: number;

  /** Image columns. */
  columns: number;
}

/** A reference line segment to draw on a target viewport. */
export interface ReferenceLine {
  /** Start point in canvas coordinates. */
  start: { x: number; y: number };

  /** End point in canvas coordinates. */
  end: { x: number; y: number };

  /** Source viewport ID that generated this reference line. */
  sourceViewportId: string;

  /** Color for the reference line. */
  color: string;
}

/** Callback for scroll synchronization. */
export type LinkedScrollCallback = (
  viewportId: string,
  newImageIndex: number,
) => void;

/** Callback for reference line updates. */
export type ReferenceLineCallback = (
  targetViewportId: string,
  lines: ReferenceLine[],
) => void;
