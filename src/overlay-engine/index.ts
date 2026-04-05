/**
 * overlay-engine — DICOM 6000-group Overlay Engine
 *
 * Parses, renders, and manages DICOM overlay planes (groups 6000–601E).
 * Supports standalone overlays (60xx,3000) and embedded overlays
 * (high bits of pixel data).
 */

// Types
export type {
  OverlayType,
  OverlayPlane,
  OverlayGroup,
  OverlayRenderOptions,
  RenderedOverlay,
} from './types';
export { DEFAULT_OVERLAY_COLORS } from './types';

// Parser
export {
  parseOverlayGroup,
  isValidPlane,
  planeAppliesToFrame,
} from './OverlayParser';

// Renderer
export {
  renderOverlays,
  extractBitsFromBytes,
} from './OverlayRenderer';

// Embedded overlay extraction
export {
  extractEmbeddedOverlays,
  stripEmbeddedOverlayBits,
} from './EmbeddedOverlayExtractor';

// State management
export { OverlayState } from './OverlayState';
export type { OverlayStateChangeCallback } from './OverlayState';
