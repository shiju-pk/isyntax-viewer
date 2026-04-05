/**
 * ScreenOverlayConfig — Per-modality and per-display-mode overlay tag configuration.
 *
 * Defines which text overlay items are shown in each viewport corner/edge
 * for different display modes (full, cine, grey-level change, zoom change).
 *
 * Ported from legacy `screenoverlayconfig.js` without framework dependencies.
 */

import type { OverlayTagDef, OverlayDisplayMode } from './types';

// ---------------------------------------------------------------------------
// Default tag sets (matches legacy layout)
// ---------------------------------------------------------------------------

/** Full display mode — all standard text overlays. */
const FULL_TAGS: OverlayTagDef[] = [
  { label: 'Acc#:', attrName: 'accession', source: 'exam', xPosition: 'left', yPosition: 'top' },
  { label: '', attrName: 'organizationId', source: 'exam', xPosition: 'left', yPosition: 'top' },
  { label: '', attrName: 'modality', source: 'exam', xPosition: 'left', yPosition: 'top' },
  { label: '', attrName: 'datetime', source: 'exam', xPosition: 'left', yPosition: 'top' },
  { label: '', attrName: 'imagePositionRow', source: 'viewport', xPosition: 'left', yPosition: 'middle' },
  { label: 'W/L:', attrName: 'ww/wl', source: 'viewport', xPosition: 'left', yPosition: 'bottom' },
  { label: 'Im:', attrName: 'NumberOfImages', altLabel: 'Fr:', source: 'viewport', xPosition: 'left', yPosition: 'bottom' },
  { label: 'Se:', attrName: 'seriesDescription', source: 'series', xPosition: 'left', yPosition: 'bottom' },
  { label: 'Ser:', attrName: 'seriesNumber', source: 'series', xPosition: 'left', yPosition: 'bottom' },
  { label: 'Zoom:', attrName: 'zoomFactor', source: 'viewport', xPosition: 'right', yPosition: 'bottom' },
  { label: 'Ratio:', attrName: 'lossyCompressionRatio', source: 'series', xPosition: 'right', yPosition: 'bottom' },
  { label: '', attrName: 'imagePositionCol', source: 'viewport', xPosition: 'center', yPosition: 'top' },
  { label: '', attrName: 'DemographicMismatch', source: 'viewport', xPosition: 'center', yPosition: 'middle' },
];

/** Cine display mode — minimal overlays during cine playback. */
const CINE_TAGS: OverlayTagDef[] = [
  { label: 'Im:', attrName: 'NumberOfImages', altLabel: 'Fr:', source: 'viewport', xPosition: 'left', yPosition: 'bottom' },
];

/** Grey-level change mode — only W/L overlay. */
const GREY_LEVEL_TAGS: OverlayTagDef[] = [
  { label: 'W/L:', attrName: 'ww/wl', source: 'viewport', xPosition: 'left', yPosition: 'bottom' },
];

/** Zoom-level change mode — only zoom factor overlay. */
const ZOOM_LEVEL_TAGS: OverlayTagDef[] = [
  { label: 'Zoom:', attrName: 'zoomFactor', source: 'viewport', xPosition: 'right', yPosition: 'bottom' },
];

// ---------------------------------------------------------------------------
// Per-modality overrides (extensible)
// ---------------------------------------------------------------------------

type ModalityOverrides = Partial<Record<OverlayDisplayMode, OverlayTagDef[]>>;

/**
 * Modality-specific overlay configuration overrides.
 * If a modality has no entry here, the default tag set is used.
 * Add entries here to customize overlays for specific modalities.
 */
const MODALITY_OVERRIDES: Record<string, ModalityOverrides> = {
  // Example: US modality might show different tags
  // 'US': { full: [...] },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the overlay tag definitions for a given modality and display mode.
 *
 * @param modality - DICOM modality string (e.g. 'CT', 'MR', 'CR').
 * @param mode - Current display mode.
 * @returns Array of overlay tag definitions to render.
 */
export function getOverlayTags(
  modality: string,
  mode: OverlayDisplayMode = 'full',
): OverlayTagDef[] {
  // Check for modality-specific overrides
  const overrides = MODALITY_OVERRIDES[modality.toUpperCase()];
  if (overrides?.[mode]) {
    return overrides[mode]!;
  }

  // Fall back to default tag sets
  switch (mode) {
    case 'cine':
      return CINE_TAGS;
    case 'greyLevel':
      return GREY_LEVEL_TAGS;
    case 'zoomLevel':
      return ZOOM_LEVEL_TAGS;
    case 'full':
    default:
      return FULL_TAGS;
  }
}

/**
 * Register a modality-specific overlay configuration.
 *
 * @param modality - DICOM modality string.
 * @param mode - Display mode to override.
 * @param tags - Custom tag definitions.
 */
export function registerModalityOverlay(
  modality: string,
  mode: OverlayDisplayMode,
  tags: OverlayTagDef[],
): void {
  const key = modality.toUpperCase();
  if (!MODALITY_OVERRIDES[key]) {
    MODALITY_OVERRIDES[key] = {};
  }
  MODALITY_OVERRIDES[key]![mode] = tags;
}
