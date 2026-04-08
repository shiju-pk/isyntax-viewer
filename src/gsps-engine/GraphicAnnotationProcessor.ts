/**
 * GraphicAnnotationProcessor — Converts parsed GSPS graphic/text objects
 * into the new viewer's annotation entries.
 *
 * Maps GSPS graphic types (POINT, POLYLINE, CIRCLE, ELLIPSE) and text
 * objects to tool-framework-compatible annotation entries that can be
 * rendered by the annotation system.
 *
 * Ported from legacy `graphicannotationprocessor.js` without jQuery/Dojo.
 */

import type {
  GSPSGraphicAnnotation,
  GSPSGraphicObject,
  GSPSTextObject,
  GSPSAnnotationEntry,
  GSPSApplicationResult,
  ParsedGSPSInstance,
} from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process all graphic annotations from a parsed GSPS instance and produce
 * annotation entries keyed by referenced image UID.
 *
 * @param gsps - The parsed GSPS instance.
 * @returns Map of image UID → annotation entries.
 */
export function processGraphicAnnotations(
  gsps: ParsedGSPSInstance,
): Map<string, GSPSAnnotationEntry[]> {
  const result = new Map<string, GSPSAnnotationEntry[]>();

  // Build a flat list of all image UIDs from referenced series
  const allImageUIDs = new Set<string>();
  for (const series of gsps.referencedSeries) {
    for (const uid of series.imageUIDs) {
      allImageUIDs.add(uid);
    }
  }

  for (const annotation of gsps.graphicAnnotations) {
    const entries: GSPSAnnotationEntry[] = [];

    // Process graphic objects
    for (const gObj of annotation.graphicObjects) {
      const entry = mapGraphicObject(gObj);
      if (entry) entries.push(entry);
    }

    // Process text objects
    for (const tObj of annotation.textObjects) {
      const entry = mapTextObject(tObj);
      if (entry) entries.push(entry);
    }

    if (entries.length === 0) continue;

    // Associate annotations with referenced images
    const targetUIDs = annotation.referencedImageUIDs.length > 0
      ? annotation.referencedImageUIDs
      : [...allImageUIDs]; // If no specific ref, apply to all referenced images

    for (const uid of targetUIDs) {
      const existing = result.get(uid) ?? [];
      // Clone entries for each image to avoid shared mutation
      for (const entry of entries) {
        existing.push(uid === targetUIDs[0] ? entry : cloneEntry(entry));
      }
      result.set(uid, existing);
    }
  }

  return result;
}

/**
 * Build a full GSPS application result from a parsed instance.
 */
export function buildApplicationResult(
  gsps: ParsedGSPSInstance,
): GSPSApplicationResult {
  const annotationsByImage = processGraphicAnnotations(gsps);

  // Build overlay activation layer map from graphic layers
  const overlayActivationLayers = new Map<number, boolean>();
  // Graphic layers can activate/deactivate overlay planes by name
  // This is a simplified mapping — in practice, the layer name maps to
  // overlay group indices via the OverlayActivationLayer tag
  for (let i = 0; i < gsps.graphicLayers.length; i++) {
    overlayActivationLayers.set(i, true);
  }

  // Select first VOI transform if available
  const voiTransform = gsps.voiTransforms.length > 0 ? gsps.voiTransforms[0] : null;

  // Spatial transform
  const spatialTransform = gsps.spatialTransform;

  // Shutters
  const shutters = gsps.shutters;

  // Key image UIDs (from special image processor equivalent)
  const keyImageUIDs: string[] = [];

  return {
    annotationsByImage,
    overlayActivationLayers,
    voiTransform,
    spatialTransform,
    shutters,
    presentationLutShape: gsps.presentationLutShape,
    keyImageUIDs,
  };
}

// ---------------------------------------------------------------------------
// Graphic Object → Annotation Entry mapping
// ---------------------------------------------------------------------------

function mapGraphicObject(gObj: GSPSGraphicObject): GSPSAnnotationEntry | null {
  const { graphicType, graphicData, numberOfPoints } = gObj;

  switch (graphicType) {
    case 'POINT':
      return mapPoint(graphicData);

    case 'POLYLINE':
      // POLYLINE with exactly 2 points → line/length
      if (numberOfPoints === 2) {
        return mapLine(graphicData);
      }
      return mapPolyline(graphicData, numberOfPoints);

    case 'INTERPOLATED':
      return mapPolyline(graphicData, numberOfPoints);

    case 'CIRCLE':
      return mapCircle(graphicData);

    case 'ELLIPSE':
      return mapEllipse(graphicData);

    default:
      return null;
  }
}

function mapPoint(data: number[]): GSPSAnnotationEntry {
  // POINT: 2 values [col, row]
  const x = data[0] ?? 0;
  const y = data[1] ?? 0;

  return {
    toolName: 'Probe',
    points: [{ x, y }],
    isTextOnly: false,
    sourceGraphicType: 'POINT',
  };
}

function mapLine(data: number[]): GSPSAnnotationEntry {
  // POLYLINE with 2 points: [col1, row1, col2, row2]
  return {
    toolName: 'Length',
    points: [
      { x: data[0] ?? 0, y: data[1] ?? 0 },
      { x: data[2] ?? 0, y: data[3] ?? 0 },
    ],
    isTextOnly: false,
    sourceGraphicType: 'POLYLINE',
  };
}

function mapPolyline(data: number[], _numPoints: number): GSPSAnnotationEntry {
  // Generic polyline: pairs of [col, row]
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < data.length - 1; i += 2) {
    points.push({ x: data[i], y: data[i + 1] });
  }

  return {
    toolName: 'ArrowAnnotate', // Best default mapping for generic polylines
    points,
    isTextOnly: false,
    sourceGraphicType: 'POLYLINE',
  };
}

function mapCircle(data: number[]): GSPSAnnotationEntry {
  // CIRCLE: [centerCol, centerRow, edgeCol, edgeRow]
  return {
    toolName: 'Circle',
    points: [
      { x: data[0] ?? 0, y: data[1] ?? 0 }, // center
      { x: data[2] ?? 0, y: data[3] ?? 0 }, // edge point
    ],
    isTextOnly: false,
    sourceGraphicType: 'CIRCLE',
  };
}

function mapEllipse(data: number[]): GSPSAnnotationEntry {
  // ELLIPSE: 4 points defining the major and minor axes
  // [majorCol1, majorRow1, majorCol2, majorRow2, minorCol1, minorRow1, minorCol2, minorRow2]
  // Map to bounding box corners for EllipticalROI tool
  if (data.length >= 8) {
    const majX1 = data[0], majY1 = data[1];
    const majX2 = data[2], majY2 = data[3];
    const minX1 = data[4], minY1 = data[5];
    const minX2 = data[6], minY2 = data[7];

    // Calculate center
    const cx = (majX1 + majX2) / 2;
    const cy = (majY1 + majY2) / 2;

    // Calculate semi-axes lengths
    const semiMajor = Math.sqrt((majX2 - majX1) ** 2 + (majY2 - majY1) ** 2) / 2;
    const semiMinor = Math.sqrt((minX2 - minX1) ** 2 + (minY2 - minY1) ** 2) / 2;

    // Approximate as axis-aligned bounding box
    return {
      toolName: 'EllipticalROI',
      points: [
        { x: cx - semiMajor, y: cy - semiMinor },
        { x: cx + semiMajor, y: cy + semiMinor },
      ],
      isTextOnly: false,
      sourceGraphicType: 'ELLIPSE',
    };
  }

  return {
    toolName: 'EllipticalROI',
    points: [
      { x: data[0] ?? 0, y: data[1] ?? 0 },
      { x: data[2] ?? 0, y: data[3] ?? 0 },
    ],
    isTextOnly: false,
    sourceGraphicType: 'ELLIPSE',
  };
}

// ---------------------------------------------------------------------------
// Text Object → Annotation Entry mapping
// ---------------------------------------------------------------------------

function mapTextObject(tObj: GSPSTextObject): GSPSAnnotationEntry | null {
  if (!tObj.unformattedTextValue) return null;

  const points: Array<{ x: number; y: number }> = [];

  // Use anchor point if available
  if (tObj.anchorPoint) {
    points.push({ x: tObj.anchorPoint[0], y: tObj.anchorPoint[1] });
  }
  // Otherwise use bounding box center
  else if (tObj.boundingBoxTopLeftHandCorner && tObj.boundingBoxBottomRightHandCorner) {
    const tl = tObj.boundingBoxTopLeftHandCorner;
    const br = tObj.boundingBoxBottomRightHandCorner;
    points.push({
      x: (tl[0] + br[0]) / 2,
      y: (tl[1] + br[1]) / 2,
    });
  }

  if (points.length === 0) return null;

  // Determine tool name based on anchor point visibility
  const toolName = tObj.anchorPointVisibility ? 'ArrowAnnotate' : 'TextAnnotation';

  return {
    toolName,
    points,
    label: tObj.unformattedTextValue,
    isTextOnly: !tObj.anchorPointVisibility,
    anchorPointVisible: tObj.anchorPointVisibility,
    sourceGraphicType: 'TEXT',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneEntry(entry: GSPSAnnotationEntry): GSPSAnnotationEntry {
  return {
    ...entry,
    points: entry.points.map((p) => ({ ...p })),
  };
}
