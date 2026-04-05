/**
 * Screen Overlay — Type Definitions
 *
 * Configurable text overlays displayed on the viewport showing patient info,
 * exam details, W/L, zoom, series description, etc. Supports per-modality
 * tag sets and different display modes (full, cine, grey-level, zoom).
 */

// ---------------------------------------------------------------------------
// Overlay tag position
// ---------------------------------------------------------------------------

/** Horizontal position of an overlay text item. */
export type OverlayXPosition = 'left' | 'center' | 'right';

/** Vertical position of an overlay text item. */
export type OverlayYPosition = 'top' | 'middle' | 'bottom';

// ---------------------------------------------------------------------------
// Overlay tag definition
// ---------------------------------------------------------------------------

/** A single overlay text item configuration. */
export interface OverlayTagDef {
  /** Display label (e.g. "Accession:", "W/L:"). Empty string for no label. */
  label: string;

  /** Alternate label used in some contexts (e.g. "Frame:" vs "Image:"). */
  altLabel?: string;

  /** The attribute key used to resolve the display value. */
  attrName: OverlayAttribute;

  /**
   * Data source for the attribute value:
   * - 'exam': from StudyInfo / exam-level metadata
   * - 'series': from series-level metadata
   * - 'image': from per-image DicomImageMetadata
   * - 'viewport': from live viewport state (zoom, W/L, etc.)
   */
  source: OverlayDataSource;

  /** Horizontal position on the viewport. */
  xPosition: OverlayXPosition;

  /** Vertical position on the viewport. */
  yPosition: OverlayYPosition;
}

// ---------------------------------------------------------------------------
// Attribute keys
// ---------------------------------------------------------------------------

/** Known overlay attribute keys. */
export type OverlayAttribute =
  | 'accession'
  | 'organizationId'
  | 'modality'
  | 'datetime'
  | 'seriesDescription'
  | 'seriesNumber'
  | 'ww/wl'
  | 'NumberOfImages'
  | 'zoomFactor'
  | 'lossyCompressionRatio'
  | 'DemographicMismatch'
  | 'CineFrameRate'
  | 'imagePositionRow'
  | 'imagePositionCol'
  | 'patientName'
  | 'patientId'
  | 'institutionName'
  | 'studyDate'
  | 'studyDescription'
  | 'rotation'
  | 'flipState';

export type OverlayDataSource = 'exam' | 'series' | 'image' | 'viewport';

// ---------------------------------------------------------------------------
// Display modes
// ---------------------------------------------------------------------------

/** Display modes that control which overlay tags are shown. */
export type OverlayDisplayMode = 'full' | 'cine' | 'greyLevel' | 'zoomLevel';

// ---------------------------------------------------------------------------
// Font / style settings
// ---------------------------------------------------------------------------

export type OverlayFontSize = 'small' | 'medium' | 'large';

export interface OverlayStyleSettings {
  fontSize: OverlayFontSize;
  fontFamily: string;
  /** Fill color for overlay text (CSS color string). */
  fillColor: string;
  /** Shadow color behind text for contrast. */
  shadowColor: string;
  shadowBlur: number;
}

export const DEFAULT_OVERLAY_STYLE: OverlayStyleSettings = {
  fontSize: 'medium',
  fontFamily: 'Philips, monospace',
  fillColor: '#ffffff',
  shadowColor: '#000000',
  shadowBlur: 2,
};

export const FONT_SIZE_PX: Record<OverlayFontSize, number> = {
  small: 10,
  medium: 12,
  large: 14,
};

// ---------------------------------------------------------------------------
// Resolved overlay data (for rendering)
// ---------------------------------------------------------------------------

/** A resolved text item ready to be rendered. */
export interface ResolvedOverlayItem {
  /** The display text (label + value). */
  text: string;
  xPosition: OverlayXPosition;
  yPosition: OverlayYPosition;
}
