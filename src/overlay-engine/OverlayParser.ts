/**
 * OverlayParser — Extracts DICOM 6000-group overlay planes from metadata.
 *
 * Parses tags (60xx,0010) through (60xx,3000) for up to 16 overlay groups,
 * handling both standalone overlay data and embedded overlay detection.
 *
 * Ported from legacy `overlaygroup.js` / `overlayattributes.js` with
 * modernized TypeScript types and no framework dependencies.
 */

import pako from 'pako';
import type { OverlayPlane, OverlayGroup, OverlayType } from './types';
import { DEFAULT_OVERLAY_COLORS } from './types';

// ---------------------------------------------------------------------------
// DICOM 60xx group tag element IDs (last 4 hex digits)
// ---------------------------------------------------------------------------

const OVERLAY_ELEMENTS = {
  Rows:               '0010',
  Columns:            '0011',
  Type:               '0040',
  Origin:             '0050',
  BitsAllocated:      '0100',
  BitPosition:        '0102',
  Data:               '3000',
  Description:        '0022',
  Subtype:            '0045',
  Label:              '1500',
  FrameCount:         '0015',
  FrameOrigin:        '0051',
  ActivationLayer:    '1001',
} as const;

/** Tag prefix for overlay groups: '60' */
const OVERLAY_GROUP_PREFIX = '60';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse all overlay planes from a DICOM metadata attribute map.
 *
 * The metadata is expected to be a flat map of `{ [dicomTag]: value }` where
 * tags follow the format `GGGGeeee` (8-char hex). Overlay tags are in groups
 * `60000000`–`601E3000`.
 *
 * @param attributes - Flat DICOM attribute map (tag → value).
 * @returns An `OverlayGroup` containing all discovered planes.
 */
export function parseOverlayGroup(
  attributes: Record<string, unknown>,
): OverlayGroup {
  const planes: (OverlayPlane | undefined)[] = new Array(16).fill(undefined);
  let hasAnyOverlay = false;

  // Iterate all attributes and pick out 60xx tags
  for (const tag of Object.keys(attributes)) {
    if (!tag.startsWith(OVERLAY_GROUP_PREFIX)) continue;

    // Tag format: GGggeeee — first 4 chars are group, last 4 are element
    const groupHex = tag.substring(2, 4); // the 'gg' part of '60gg'
    const element = tag.substring(4, 8);   // last 4 hex digits
    const groupNumber = parseInt(groupHex, 10);
    const groupIndex = Math.floor(groupNumber / 2);

    if (groupIndex < 0 || groupIndex > 15) continue;

    // Lazily create the plane
    if (!planes[groupIndex]) {
      planes[groupIndex] = createDefaultPlane(groupIndex);
    }
    const plane = planes[groupIndex]!;

    const value = attributes[tag];

    switch (element) {
      case OVERLAY_ELEMENTS.Rows:
        plane.rows = toNumber(value, 0);
        hasAnyOverlay = true;
        break;

      case OVERLAY_ELEMENTS.Columns:
        plane.columns = toNumber(value, 0);
        hasAnyOverlay = true;
        break;

      case OVERLAY_ELEMENTS.Type:
        plane.type = (String(value).toUpperCase() === 'R' ? 'R' : 'G') as OverlayType;
        break;

      case OVERLAY_ELEMENTS.Origin:
        plane.origin = parseOrigin(value);
        break;

      case OVERLAY_ELEMENTS.BitsAllocated:
        plane.bitsAllocated = toNumber(value, 1);
        break;

      case OVERLAY_ELEMENTS.BitPosition:
        plane.bitPosition = toNumber(value, 0);
        break;

      case OVERLAY_ELEMENTS.Data:
        plane.data = decodeOverlayData(value);
        hasAnyOverlay = true;
        break;

      case OVERLAY_ELEMENTS.Description:
        plane.description = String(value ?? '');
        break;

      case OVERLAY_ELEMENTS.Subtype:
        plane.subtype = String(value ?? '');
        break;

      case OVERLAY_ELEMENTS.Label:
        plane.label = String(value ?? '');
        break;

      case OVERLAY_ELEMENTS.FrameCount:
        plane.frameCount = toNumber(value, 1);
        break;

      case OVERLAY_ELEMENTS.FrameOrigin:
        plane.frameOrigin = toNumber(value, 1);
        break;

      case OVERLAY_ELEMENTS.ActivationLayer:
        plane.activationLayer = !!value;
        break;

      default:
        // Unrecognized element — skip
        break;
    }
  }

  return { planes, visible: hasAnyOverlay };
}

/**
 * Validate a single overlay plane for rendering eligibility.
 *
 * @returns `true` if the plane has sufficient data to render.
 */
export function isValidPlane(plane: OverlayPlane): boolean {
  if (plane.columns <= 0 || plane.rows <= 0) return false;
  if (plane.origin[0] === 0 && plane.origin[1] === 0) return false;

  // Embedded overlays don't need standalone data
  if (plane.bitPosition > 0) return true;

  // Standalone overlays need data
  return plane.data !== null && plane.data.length > 0;
}

/**
 * Check if a plane applies to a specific frame in a multi-frame image.
 *
 * @param plane - The overlay plane.
 * @param frameIndex - 1-based frame index.
 * @param isMultiFrame - Whether the image is multi-frame.
 */
export function planeAppliesToFrame(
  plane: OverlayPlane,
  frameIndex: number,
  isMultiFrame: boolean,
): boolean {
  if (!isMultiFrame) return true;
  return (
    plane.frameOrigin <= frameIndex &&
    frameIndex <= plane.frameOrigin + plane.frameCount - 1
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createDefaultPlane(groupIndex: number): OverlayPlane {
  return {
    groupIndex,
    rows: 0,
    columns: 0,
    type: 'G',
    origin: [1, 1],
    bitsAllocated: 1,
    bitPosition: 0,
    data: null,
    description: '',
    subtype: '',
    label: '',
    roiArea: 0,
    roiMean: 0,
    roiStandardDeviation: 0,
    frameCount: 1,
    frameOrigin: 1,
    color: DEFAULT_OVERLAY_COLORS[groupIndex] ?? '#FFFFFF',
    activationLayer: true,
  };
}

function toNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseOrigin(value: unknown): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [Number(value[0]) || 1, Number(value[1]) || 1];
  }
  if (Array.isArray(value) && value.length === 1) {
    const v = Number(value[0]) || 1;
    return [v, v];
  }
  if (typeof value === 'string') {
    const parts = value.split('\\');
    if (parts.length >= 2) {
      return [Number(parts[0]) || 1, Number(parts[1]) || 1];
    }
  }
  return [1, 1];
}

/**
 * Decode overlay data from various formats:
 *   - Uint8Array / ArrayBuffer — raw bytes
 *   - string — base64-encoded, possibly with 4-byte size header + zlib
 *   - { __binDiff, encode, data } — binDiff object from metadata extraction
 *
 * Ported from legacy `_unzipAndDecode` in `overlaygroup.js`.
 */
function decodeOverlayData(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);

  // Handle binDiff object from metadata extraction
  if (value && typeof value === 'object' && (value as Record<string, unknown>).__binDiff) {
    const binObj = value as { encode: string; data: string };
    return decodeBinDiffData(binObj.data, binObj.encode);
  }

  if (typeof value !== 'string' || value.length === 0) return null;

  return decodeBinDiffData(value, 'base64');
}

/**
 * Decode base64 (or base64z) overlay data.
 *
 * - base64: plain base64 with optional 4-byte size header + zlib
 * - base64z: base64 wrapping zlib-compressed data
 */
function decodeBinDiffData(data: string, encode: string): Uint8Array | null {
  if (!data || data.length === 0) return null;

  try {
    // Base64 decode
    const binaryStr = atob(data);
    const byteArray = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      byteArray[i] = binaryStr.charCodeAt(i);
    }

    const encodeLower = encode.toLowerCase();

    // base64z: the payload may be zlib-compressed, optionally preceded by
    // a 4-byte LE size header (common in iSyntax studydoc format).
    if (encodeLower === 'base64z') {
      // Try full-buffer inflate first (pure zlib without header)
      try {
        return pako.inflate(byteArray);
      } catch { /* fall through */ }

      try {
        return pako.inflateRaw(byteArray);
      } catch { /* fall through */ }

      // Try 4-byte size header + zlib (e.g. header bytes 78 9C / 78 DA at offset 4)
      if (byteArray.length > 4) {
        const payload = byteArray.subarray(4);
        try {
          return pako.inflate(payload);
        } catch { /* fall through */ }

        try {
          return pako.inflateRaw(payload);
        } catch { /* fall through */ }
      }

      // Not compressed — return raw
      return byteArray;
    }

    // Plain base64: try 4-byte size header + zlib pattern from legacy format
    if (byteArray.length > 6) {
      const payload = byteArray.subarray(4);
      try {
        // Skip 2-byte zlib header
        return pako.inflateRaw(payload.subarray(2));
      } catch {
        try {
          return pako.inflate(payload);
        } catch {
          // Fall through to try full-buffer decompression
        }
      }
    }

    // Try decompressing the full buffer (zlib with or without header)
    try {
      return pako.inflate(byteArray);
    } catch {
      try {
        return pako.inflateRaw(byteArray);
      } catch {
        // Not compressed — return raw bytes
        return byteArray;
      }
    }
  } catch {
    return null;
  }
}
