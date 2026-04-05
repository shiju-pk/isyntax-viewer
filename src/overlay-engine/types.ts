/**
 * DICOM 6000-group Overlay Engine — Type Definitions
 *
 * Supports up to 16 overlay planes per DICOM standard (groups 6000–601E).
 * Handles both standalone overlay data (tag 60xx,3000) and embedded overlays
 * where overlay bits are packed into unused high bits of the pixel data.
 */

// ---------------------------------------------------------------------------
// Overlay Plane (single group)
// ---------------------------------------------------------------------------

/** Type of overlay plane: Graphics or Region-of-Interest */
export type OverlayType = 'G' | 'R';

/** A single parsed overlay plane from one 60xx group. */
export interface OverlayPlane {
  /** Overlay group index 0–15 (derived from DICOM group 6000+2*index). */
  groupIndex: number;

  /** Number of rows in the overlay. */
  rows: number;

  /** Number of columns in the overlay. */
  columns: number;

  /** 'G' = Graphics, 'R' = ROI. */
  type: OverlayType;

  /**
   * Row/column offset of the first overlay pixel relative to the image.
   * DICOM (60xx,0050) — 1-based [row, column].
   */
  origin: [number, number];

  /** Bits allocated per overlay pixel (always 1 for standard overlays). */
  bitsAllocated: number;

  /**
   * Bit position within the pixel data word where the overlay is stored.
   * - 0 means overlay data comes from tag (60xx,3000).
   * - > 0 means the overlay is *embedded* in the pixel data high bits.
   */
  bitPosition: number;

  /**
   * Raw overlay data as a byte array.
   * Each bit in this array represents one overlay pixel (1 = on, 0 = off).
   * `null` when the overlay is embedded in pixel data (bitPosition > 0).
   */
  data: Uint8Array | null;

  /** Human-readable description (60xx,0022). */
  description: string;

  /** Overlay subtype (60xx,0045). */
  subtype: string;

  /** Overlay label (60xx,1500). */
  label: string;

  /** ROI area in pixels — valid only when type === 'R'. */
  roiArea: number;

  /** ROI mean pixel value — valid only when type === 'R'. */
  roiMean: number;

  /** ROI standard deviation — valid only when type === 'R'. */
  roiStandardDeviation: number;

  // -- Multi-frame overlay support --

  /** Number of overlay frames (default 1). */
  frameCount: number;

  /** 1-based frame number in the multi-frame image to which this overlay applies (default 1). */
  frameOrigin: number;

  // -- Display --

  /** CSS color string for this plane (e.g. '#FF86FF'). */
  color: string;

  /**
   * Whether this overlay plane is activated via a Graphic Layer
   * (from GSPS OverlayActivationLayer). `true` = render, `false` = hidden.
   */
  activationLayer: boolean;
}

// ---------------------------------------------------------------------------
// Overlay Group (all planes for one image)
// ---------------------------------------------------------------------------

/** Collection of all overlay planes for one DICOM image. */
export interface OverlayGroup {
  /** Sparse array indexed by group index 0–15. */
  planes: (OverlayPlane | undefined)[];

  /** Master visibility toggle (true if any plane data is present). */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Rendering options
// ---------------------------------------------------------------------------

/** Options for rendering overlays onto a canvas / ImageData. */
export interface OverlayRenderOptions {
  /** Target image width in pixels (at the current pixel level). */
  imageWidth: number;

  /** Target image height in pixels (at the current pixel level). */
  imageHeight: number;

  /**
   * Pixel-level (power-of-2 downscale exponent).
   * 0 = full resolution, 1 = half, 2 = quarter, etc.
   */
  pixelLevel: number;

  /** Current frame index (1-based) — for multi-frame overlay filtering. */
  currentFrame: number;

  /** Whether the image is multi-frame. */
  isMultiFrame: boolean;

  /** Per-plane visibility overrides (indexed by group index). `undefined` = use activationLayer. */
  planeVisibility?: (boolean | undefined)[];

  /** Per-plane color overrides (indexed by group index). `undefined` = use plane.color. */
  planeColors?: (string | undefined)[];
}

// ---------------------------------------------------------------------------
// Rendered overlay result
// ---------------------------------------------------------------------------

/** The composited overlay image ready to be drawn on top of the base image. */
export interface RenderedOverlay {
  /** RGBA pixel buffer — same dimensions as the target image. */
  imageData: ImageData;

  /** Width matching OverlayRenderOptions.imageWidth. */
  width: number;

  /** Height matching OverlayRenderOptions.imageHeight. */
  height: number;

  /** List of group indices that contributed to this render. */
  renderedPlanes: number[];

  /** List of group indices that were skipped due to validation failures. */
  invalidPlanes: number[];
}

// ---------------------------------------------------------------------------
// Default overlay palette (matches legacy 16-color palette)
// ---------------------------------------------------------------------------

export const DEFAULT_OVERLAY_COLORS: readonly string[] = [
  '#FF86FF', // group 0
  '#00BFFF', // group 1
  '#FF7F00', // group 2
  '#59F859', // group 3
  '#FFFF00', // group 4
  '#4EA63A', // group 5
  '#FF00FF', // group 6
  '#00FFBF', // group 7
  '#FFBE00', // group 8
  '#8000FF', // group 9
  '#BF8430', // group 10
  '#C000FF', // group 11
  '#C0FF00', // group 12
  '#3F00FF', // group 13
  '#990000', // group 14
  '#FF0000', // group 15
] as const;
