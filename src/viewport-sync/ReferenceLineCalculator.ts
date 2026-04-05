/**
 * ReferenceLineCalculator — Computes cross-reference lines between viewports.
 *
 * Given a source viewport's slice plane and a target viewport's display,
 * calculates the intersection line where the source slice plane crosses
 * the target's image plane. This line is rendered on the target viewport
 * to show the spatial relationship between the two views.
 *
 * Ported from legacy `linkmanager.js` reference line logic.
 */

import type { LinkedViewportEntry, ReferenceLine } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate reference lines for a target viewport given all source viewports.
 *
 * @param targetEntry - The viewport to draw reference lines on.
 * @param sourceEntries - All other viewports that might produce reference lines.
 * @returns Array of reference line segments in the target viewport's coordinate space.
 */
export function calculateReferenceLines(
  targetEntry: LinkedViewportEntry,
  sourceEntries: LinkedViewportEntry[],
): ReferenceLine[] {
  const lines: ReferenceLine[] = [];

  if (!targetEntry.imageOrientationPatient || !targetEntry.imagePositionPatient) {
    return lines;
  }

  for (const source of sourceEntries) {
    if (source.viewportId === targetEntry.viewportId) continue;
    if (source.frameOfReferenceUID !== targetEntry.frameOfReferenceUID) continue;
    if (!source.imageOrientationPatient || !source.imagePositionPatient) continue;

    const line = computeIntersectionLine(targetEntry, source);
    if (line) {
      lines.push(line);
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Intersection calculation
// ---------------------------------------------------------------------------

/**
 * Compute the intersection of the source slice plane with the target image plane.
 *
 * Both planes are defined by their Image Position Patient (IPP) and
 * Image Orientation Patient (IOP). The intersection is projected into
 * the target viewport's 2D coordinate system.
 */
function computeIntersectionLine(
  target: LinkedViewportEntry,
  source: LinkedViewportEntry,
): ReferenceLine | null {
  const tIOP = target.imageOrientationPatient!;
  const tIPP = target.imagePositionPatient!;
  const sIOP = source.imageOrientationPatient!;
  const sIPP = source.imagePositionPatient!;

  // Target plane vectors
  const tRowX = tIOP[0], tRowY = tIOP[1], tRowZ = tIOP[2];
  const tColX = tIOP[3], tColY = tIOP[4], tColZ = tIOP[5];

  // Target normal vector (row × col)
  const tNx = tRowY * tColZ - tRowZ * tColY;
  const tNy = tRowZ * tColX - tRowX * tColZ;
  const tNz = tRowX * tColY - tRowY * tColX;

  // Source plane vectors
  const sRowX = sIOP[0], sRowY = sIOP[1], sRowZ = sIOP[2];
  const sColX = sIOP[3], sColY = sIOP[4], sColZ = sIOP[5];

  // Source normal vector
  const sNx = sRowY * sColZ - sRowZ * sColY;
  const sNy = sRowZ * sColX - sRowX * sColZ;
  const sNz = sRowX * sColY - sRowY * sColX;

  // Check if planes are parallel (dot product of normals ≈ ±1)
  const dotNormals = tNx * sNx + tNy * sNy + tNz * sNz;
  if (Math.abs(Math.abs(dotNormals) - 1.0) < 0.001) {
    // Planes are parallel — no intersection line
    return null;
  }

  // Direction of intersection line = cross product of the two normals
  const dirX = tNy * sNz - tNz * sNy;
  const dirY = tNz * sNx - tNx * sNz;
  const dirZ = tNx * sNy - tNy * sNx;

  // Normalize direction
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
  if (dirLen < 1e-10) return null;

  const ndX = dirX / dirLen;
  const ndY = dirY / dirLen;
  const ndZ = dirZ / dirLen;

  // Find a point on the intersection line.
  // The source plane equation: sN · (P - sIPP) = 0
  // We need a point P that lies on both the target plane and source plane.
  // Project source IPP onto target plane to get the closest point.
  const diffX = sIPP[0] - tIPP[0];
  const diffY = sIPP[1] - tIPP[1];
  const diffZ = sIPP[2] - tIPP[2];

  // Distance from source IPP to target plane along target normal
  const distToTargetPlane = diffX * tNx + diffY * tNy + diffZ * tNz;

  // Project source IPP onto target plane
  const projX = sIPP[0] - distToTargetPlane * tNx;
  const projY = sIPP[1] - distToTargetPlane * tNy;
  const projZ = sIPP[2] - distToTargetPlane * tNz;

  // Convert projected point to target image 2D coordinates
  const relX = projX - tIPP[0];
  const relY = projY - tIPP[1];
  const relZ = projZ - tIPP[2];

  const tPS = target.pixelSpacing ?? [1, 1];
  const centerCol = (relX * tRowX + relY * tRowY + relZ * tRowZ) / tPS[1];
  const centerRow = (relX * tColX + relY * tColY + relZ * tColZ) / tPS[0];

  // Direction of intersection line in target 2D coordinates
  const lineDirCol = (ndX * tRowX + ndY * tRowY + ndZ * tRowZ) / tPS[1];
  const lineDirRow = (ndX * tColX + ndY * tColY + ndZ * tColZ) / tPS[0];

  const lineLen = Math.sqrt(lineDirCol * lineDirCol + lineDirRow * lineDirRow);
  if (lineLen < 1e-10) return null;

  // Extend line across the entire target image
  const extent = Math.max(target.columns, target.rows);
  const startCol = centerCol - (lineDirCol / lineLen) * extent;
  const startRow = centerRow - (lineDirRow / lineLen) * extent;
  const endCol = centerCol + (lineDirCol / lineLen) * extent;
  const endRow = centerRow + (lineDirRow / lineLen) * extent;

  // Clip to target image bounds [0, columns] × [0, rows]
  const clipped = clipLineToRect(
    startCol, startRow, endCol, endRow,
    0, 0, target.columns, target.rows,
  );

  if (!clipped) return null;

  return {
    start: { x: clipped.x1, y: clipped.y1 },
    end: { x: clipped.x2, y: clipped.y2 },
    sourceViewportId: source.viewportId,
    color: '#00ffff',
  };
}

// ---------------------------------------------------------------------------
// Line clipping (Cohen-Sutherland)
// ---------------------------------------------------------------------------

const INSIDE = 0;
const LEFT = 1;
const RIGHT = 2;
const BOTTOM = 4;
const TOP = 8;

function computeOutCode(
  x: number, y: number,
  xmin: number, ymin: number, xmax: number, ymax: number,
): number {
  let code = INSIDE;
  if (x < xmin) code |= LEFT;
  else if (x > xmax) code |= RIGHT;
  if (y < ymin) code |= TOP;
  else if (y > ymax) code |= BOTTOM;
  return code;
}

function clipLineToRect(
  x1: number, y1: number, x2: number, y2: number,
  xmin: number, ymin: number, xmax: number, ymax: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  let outcode1 = computeOutCode(x1, y1, xmin, ymin, xmax, ymax);
  let outcode2 = computeOutCode(x2, y2, xmin, ymin, xmax, ymax);
  let accept = false;

  for (let iter = 0; iter < 20; iter++) {
    if (!(outcode1 | outcode2)) {
      accept = true;
      break;
    }
    if (outcode1 & outcode2) break;

    const outcodeOut = outcode1 ? outcode1 : outcode2;
    let x = 0, y = 0;

    if (outcodeOut & BOTTOM) {
      x = x1 + (x2 - x1) * (ymax - y1) / (y2 - y1);
      y = ymax;
    } else if (outcodeOut & TOP) {
      x = x1 + (x2 - x1) * (ymin - y1) / (y2 - y1);
      y = ymin;
    } else if (outcodeOut & RIGHT) {
      y = y1 + (y2 - y1) * (xmax - x1) / (x2 - x1);
      x = xmax;
    } else if (outcodeOut & LEFT) {
      y = y1 + (y2 - y1) * (xmin - x1) / (x2 - x1);
      x = xmin;
    }

    if (outcodeOut === outcode1) {
      x1 = x; y1 = y;
      outcode1 = computeOutCode(x1, y1, xmin, ymin, xmax, ymax);
    } else {
      x2 = x; y2 = y;
      outcode2 = computeOutCode(x2, y2, xmin, ymin, xmax, ymax);
    }
  }

  return accept ? { x1, y1, x2, y2 } : null;
}
