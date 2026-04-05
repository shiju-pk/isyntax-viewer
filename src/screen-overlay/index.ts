/**
 * screen-overlay — Configurable Screen Text Overlay System
 *
 * Per-modality, per-display-mode text overlays for viewport corners/edges.
 */

// Types
export type {
  OverlayXPosition,
  OverlayYPosition,
  OverlayTagDef,
  OverlayAttribute,
  OverlayDataSource,
  OverlayDisplayMode,
  OverlayFontSize,
  OverlayStyleSettings,
  ResolvedOverlayItem,
} from './types';
export { DEFAULT_OVERLAY_STYLE, FONT_SIZE_PX } from './types';

// Config
export { getOverlayTags, registerModalityOverlay } from './ScreenOverlayConfig';

// Resolver
export { resolveOverlayTags } from './OverlayTagResolver';
export type { ViewportOverlayData, OverlayDataContext } from './OverlayTagResolver';
