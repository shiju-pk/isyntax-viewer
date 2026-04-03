/**
 * Core types for the segmentation system.
 *
 * Pattern inspired by cornerstone3D:
 *   - Segmentation = data model (segments + representation data)
 *   - SegmentationRepresentation = per-viewport binding
 *   - Segment = individual label with color, visibility, locked status
 *   - Labelmap = 2D pixel buffer (Uint8Array), values = segment indices
 *   - Contour = array of Point2 path arrays
 */

import type { Point2 } from '../../tools/base/types';

// ─── Enums ──────────────────────────────────────────────────────

export enum SegmentationRepresentationType {
  Labelmap = 'Labelmap',
  Contour = 'Contour',
}

// ─── Color LUT ──────────────────────────────────────────────────

/** [R, G, B, A] each 0-255 */
export type ColorRGBA = [number, number, number, number];

/** Indexed by segment index: colorLUT[segmentIndex] → RGBA */
export type ColorLUT = ColorRGBA[];

// ─── Segment ────────────────────────────────────────────────────

export interface Segment {
  segmentIndex: number;
  label: string;
  color: ColorRGBA;
  visible: boolean;
  locked: boolean;
  active: boolean;
}

// ─── Labelmap Data ──────────────────────────────────────────────

export interface LabelmapData {
  /** Pixel buffer: each value is a segment index (0 = background) */
  buffer: Uint8Array;
  /** Image width this labelmap corresponds to */
  width: number;
  /** Image height this labelmap corresponds to */
  height: number;
}

// ─── Contour Data ───────────────────────────────────────────────

export interface ContourPath {
  /** Ordered points forming the contour path (world coordinates) */
  points: Point2[];
  /** Whether the path is closed */
  closed: boolean;
}

export interface ContourData {
  /** segmentIndex → list of contour paths */
  contours: Map<number, ContourPath[]>;
}

// ─── Segmentation ───────────────────────────────────────────────

export interface Segmentation {
  segmentationId: string;
  label: string;
  /** imageId this segmentation is associated with (undefined = global) */
  imageId?: string;
  segments: Map<number, Segment>;
  /** Active segment index (the one being painted) */
  activeSegmentIndex: number;
  /** Representation data keyed by type */
  representationData: {
    [SegmentationRepresentationType.Labelmap]?: LabelmapData;
    [SegmentationRepresentationType.Contour]?: ContourData;
  };
}

// ─── Segmentation Representation (per-viewport binding) ─────────

export interface SegmentationRepresentation {
  segmentationId: string;
  type: SegmentationRepresentationType;
  visible: boolean;
  active: boolean;
  colorLUTIndex: number;
  config: SegmentationDisplayConfig;
}

// ─── Display Configuration ──────────────────────────────────────

export interface SegmentationDisplayConfig {
  /** Opacity of the filled region overlay (0-1) */
  fillAlpha: number;
  /** Whether to render outlines around labeled regions */
  outlineEnabled: boolean;
  /** Outline width in pixels */
  outlineWidth: number;
  /** Outline opacity (0-1) */
  outlineAlpha: number;
  /** Whether to render fill */
  fillEnabled: boolean;
}

export const DEFAULT_SEGMENTATION_DISPLAY_CONFIG: Readonly<SegmentationDisplayConfig> = {
  fillAlpha: 0.4,
  outlineEnabled: true,
  outlineWidth: 2,
  outlineAlpha: 0.9,
  fillEnabled: true,
};

// ─── Brush Configuration ────────────────────────────────────────

export interface BrushConfiguration {
  /** Brush radius in world-space pixels */
  radius: number;
  /** Brush shape */
  shape: 'circle' | 'square';
}

export const DEFAULT_BRUSH_CONFIG: Readonly<BrushConfiguration> = {
  radius: 10,
  shape: 'circle',
};

// ─── Threshold Configuration ────────────────────────────────────

export interface ThresholdConfiguration {
  /** Only paint pixels with value >= lower */
  lower: number;
  /** Only paint pixels with value <= upper */
  upper: number;
}

// ─── Events ─────────────────────────────────────────────────────

export const SegmentationEvents = {
  SEGMENTATION_ADDED: 'SEGMENTATION:ADDED',
  SEGMENTATION_MODIFIED: 'SEGMENTATION:MODIFIED',
  SEGMENTATION_REMOVED: 'SEGMENTATION:REMOVED',
  SEGMENTATION_DATA_MODIFIED: 'SEGMENTATION:DATA_MODIFIED',
  SEGMENTATION_RENDERED: 'SEGMENTATION:RENDERED',
  ACTIVE_SEGMENT_CHANGED: 'SEGMENTATION:ACTIVE_SEGMENT_CHANGED',
} as const;
