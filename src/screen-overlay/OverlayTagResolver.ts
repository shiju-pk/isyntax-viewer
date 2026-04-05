/**
 * OverlayTagResolver — Resolves overlay attribute keys to display strings.
 *
 * Takes the attribute key from OverlayTagDef and resolves it against
 * available data sources (exam info, series metadata, image metadata,
 * viewport state) to produce the final display string.
 */

import type { OverlayAttribute, OverlayDataSource, ResolvedOverlayItem, OverlayTagDef } from './types';
import type { DicomImageMetadata, StudyInfo } from '@core/types';

// ---------------------------------------------------------------------------
// Data source interfaces
// ---------------------------------------------------------------------------

/** Viewport-level live state provided by the rendering engine. */
export interface ViewportOverlayData {
  windowWidth?: number;
  windowCenter?: number;
  zoomFactor?: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  currentImageIndex: number;
  totalImages: number;
  isMultiFrame?: boolean;
  currentFrame?: number;
  totalFrames?: number;
  cineFrameRate?: number;
  demographicMismatch?: boolean;
}

/** All data sources bundled for resolution. */
export interface OverlayDataContext {
  studyInfo: StudyInfo | null;
  imageMetadata: DicomImageMetadata | null;
  viewport: ViewportOverlayData;
  seriesDescription?: string;
  seriesNumber?: string | number;
  lossyCompressionRatio?: string;
  accessionNumber?: string;
  organizationId?: string;
  institutionName?: string;
  studyDate?: string;
  studyDescription?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an array of overlay tag definitions into display-ready text items.
 *
 * @param tags - The tag definitions to resolve.
 * @param context - All available data sources.
 * @returns Array of resolved items with text and position.
 */
export function resolveOverlayTags(
  tags: OverlayTagDef[],
  context: OverlayDataContext,
): ResolvedOverlayItem[] {
  const items: ResolvedOverlayItem[] = [];

  for (const tag of tags) {
    const value = resolveAttribute(tag.attrName, tag.source, context, tag.altLabel);
    if (value === null || value === undefined || value === '') continue;

    const text = tag.label ? `${tag.label} ${value}` : value;
    items.push({
      text,
      xPosition: tag.xPosition,
      yPosition: tag.yPosition,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Attribute resolution
// ---------------------------------------------------------------------------

function resolveAttribute(
  attrName: OverlayAttribute,
  _source: OverlayDataSource,
  ctx: OverlayDataContext,
  altLabel?: string,
): string | null {
  switch (attrName) {
    case 'accession':
      return ctx.accessionNumber ?? null;

    case 'organizationId':
      return ctx.organizationId ?? ctx.institutionName ?? null;

    case 'modality':
      return ctx.imageMetadata?.modality ?? ctx.studyInfo?.modality ?? null;

    case 'datetime':
      return ctx.studyDate ?? null;

    case 'seriesDescription':
      return ctx.seriesDescription ?? null;

    case 'seriesNumber':
      return ctx.seriesNumber != null ? String(ctx.seriesNumber) : null;

    case 'ww/wl': {
      const ww = ctx.viewport.windowWidth;
      const wc = ctx.viewport.windowCenter;
      if (ww == null || wc == null) return null;
      return `${Math.round(ww)} / ${Math.round(wc)}`;
    }

    case 'NumberOfImages': {
      const vp = ctx.viewport;
      if (vp.isMultiFrame && vp.totalFrames) {
        const label = altLabel ?? 'Fr:';
        return `${label} ${vp.currentFrame ?? 1} / ${vp.totalFrames}`;
      }
      return `${vp.currentImageIndex + 1} / ${vp.totalImages}`;
    }

    case 'zoomFactor': {
      const z = ctx.viewport.zoomFactor;
      if (z == null) return null;
      return `${(z * 100).toFixed(0)}%`;
    }

    case 'lossyCompressionRatio':
      return ctx.lossyCompressionRatio ?? null;

    case 'DemographicMismatch':
      return ctx.viewport.demographicMismatch ? 'DEMOGRAPHIC MISMATCH' : null;

    case 'CineFrameRate': {
      const fps = ctx.viewport.cineFrameRate;
      return fps != null ? `${fps} fps` : null;
    }

    case 'imagePositionRow':
      return null; // Handled by orientation labels in ViewportOverlay

    case 'imagePositionCol':
      return null; // Handled by orientation labels in ViewportOverlay

    case 'patientName':
      return ctx.studyInfo?.patientName ?? null;

    case 'patientId':
      return ctx.studyInfo?.patientId ?? null;

    case 'institutionName':
      return ctx.institutionName ?? null;

    case 'studyDate':
      return ctx.studyDate ?? null;

    case 'studyDescription':
      return ctx.studyDescription ?? null;

    case 'rotation': {
      const r = ctx.viewport.rotation;
      return r != null && r !== 0 ? `${r}°` : null;
    }

    case 'flipState': {
      const parts: string[] = [];
      if (ctx.viewport.flipH) parts.push('H');
      if (ctx.viewport.flipV) parts.push('V');
      return parts.length > 0 ? `Flip: ${parts.join('+')}` : null;
    }

    default:
      return null;
  }
}
