/**
 * GSPSApplicationService — Wires GSPS parsing results into the rendering
 * pipeline stages and the annotation tool layer.
 *
 * Orchestrates:
 * 1. GSPS graphic annotations → tool annotation manager (read-only)
 * 2. GSPS VOI transform → viewport properties
 * 3. GSPS display shutters → DisplayShutterStage
 * 4. GSPS spatial transform → viewport camera adjustments
 * 5. GSPS text annotations → TextAnnotation tool entries
 */

import type { ParsedGSPSInstance, GSPSAnnotationEntry, GSPSVOITransform, GSPSSpatialTransform } from '../gsps-engine/types';
import { buildApplicationResult } from '../gsps-engine/GraphicAnnotationProcessor';
import { annotationManager, generateAnnotationUID } from '../tools/stateManagement/AnnotationManager';
import type { Annotation } from '../tools/base/types';
import type { DisplayShutterStage } from '../rendering/pipeline/stages/DisplayShutterStage';
import type { IViewport } from '../rendering/viewports/types';
import { Logger } from '../core/logging/Logger';

const logger = Logger;

export interface GSPSApplicationOptions {
  viewport: IViewport;
  displayShutterStage?: DisplayShutterStage;
  viewportId: string;
}

/**
 * Apply a parsed GSPS instance to a viewport and its annotations.
 */
export function applyGSPS(
  gsps: ParsedGSPSInstance,
  options: GSPSApplicationOptions,
): void {
  const result = buildApplicationResult(gsps);
  const { viewport, displayShutterStage, viewportId } = options;

  // 1. Apply graphic annotations → tool annotation layer (read-only)
  for (const [imageUID, entries] of result.annotationsByImage) {
    for (const entry of entries) {
      const toolAnnotation = gspsEntryToToolAnnotation(entry, viewportId, imageUID);
      annotationManager.addAnnotation(toolAnnotation);
    }
  }

  logger.info('GSPS', `Applied ${result.annotationsByImage.size} image annotation sets`);

  // 2. Apply VOI transform
  if (result.voiTransform) {
    applyVOITransform(viewport, result.voiTransform);
    logger.info('GSPS', `Applied VOI: WC=${result.voiTransform.windowCenter} WW=${result.voiTransform.windowWidth}`);
  }

  // 3. Apply display shutters
  if (result.shutters.length > 0 && displayShutterStage) {
    displayShutterStage.setShutters(result.shutters);
    logger.info('GSPS', `Applied ${result.shutters.length} display shutters`);
  }

  // 4. Apply spatial transform
  if (result.spatialTransform) {
    applySpatialTransform(viewport, result.spatialTransform);
    logger.info('GSPS', 'Applied spatial transform');
  }

  // 5. Apply presentation LUT shape
  if (result.presentationLutShape === 'INVERSE') {
    viewport.setProperties({ invert: true });
    logger.info('GSPS', 'Applied INVERSE presentation LUT');
  }
}

/**
 * Convert a GSPS annotation entry to a tool-framework Annotation.
 * GSPS annotations are read-only (isLocked = true).
 */
function gspsEntryToToolAnnotation(
  entry: GSPSAnnotationEntry,
  viewportId: string,
  imageId: string,
): Annotation {
  return {
    annotationUID: generateAnnotationUID(),
    metadata: {
      toolName: entry.toolName,
      viewportId,
      imageId,
    },
    data: {
      handles: {
        points: entry.points.map((p) => ({ x: p.x, y: p.y })),
        activeHandleIndex: -1,
        textBox: entry.label
          ? { worldPosition: entry.points[0] ?? { x: 0, y: 0 }, text: entry.label }
          : undefined,
      },
      label: entry.label,
      cachedStats: {},
    },
    highlighted: false,
    isLocked: true, // GSPS annotations are read-only
    isVisible: true,
    invalidated: false,
  };
}

function applyVOITransform(viewport: IViewport, voi: GSPSVOITransform): void {
  viewport.setProperties({
    windowCenter: voi.windowCenter,
    windowWidth: voi.windowWidth,
  });
}

function applySpatialTransform(viewport: IViewport, spatial: GSPSSpatialTransform): void {
  const camera = viewport.getCamera();

  if (spatial.imageRotation) {
    camera.rotate(spatial.imageRotation);
  }

  if (spatial.imageHorizontalFlip) {
    camera.flipHorizontal();
  }
}

/**
 * Remove all GSPS-originated (locked) annotations for a specific image.
 */
export function removeGSPSAnnotations(imageId: string): void {
  const annotations = annotationManager.getAllAnnotationsForImage(imageId);
  for (const ann of annotations) {
    if (ann.isLocked) {
      annotationManager.removeAnnotation(ann.annotationUID);
    }
  }
}
