/**
 * Patient orientation utilities adapted from Cornerstone3D
 * (cornerstone3D/packages/tools/src/utilities/orientation/)
 *
 * Original algorithm by David Clunie:
 * https://sites.google.com/site/dicomnotes/
 */

type Vec3 = [number, number, number];

/**
 * Returns the orientation label for a direction cosine vector in LPS space.
 * Handles oblique orientations by producing multi-character labels (e.g. "LA", "RPH").
 */
export function getOrientationStringLPS(vector: Vec3): string {
  let orientation = '';
  const orientationX = vector[0] < 0 ? 'R' : 'L';
  const orientationY = vector[1] < 0 ? 'A' : 'P';
  const orientationZ = vector[2] < 0 ? 'F' : 'H';

  const abs = [Math.abs(vector[0]), Math.abs(vector[1]), Math.abs(vector[2])];

  const MIN = 0.0001;
  const EPS = 0.00001;

  for (let i = 0; i < 3; i++) {
    if (
      abs[0] > MIN &&
      abs[0] > abs[1] + EPS &&
      abs[0] > abs[2] + EPS
    ) {
      orientation += orientationX;
      abs[0] = 0;
    } else if (
      abs[1] > MIN &&
      abs[1] > abs[0] + EPS &&
      abs[1] > abs[2] + EPS
    ) {
      orientation += orientationY;
      abs[1] = 0;
    } else if (
      abs[2] > MIN &&
      abs[2] > abs[0] + EPS &&
      abs[2] > abs[1] + EPS
    ) {
      orientation += orientationZ;
      abs[2] = 0;
    } else if (
      abs[0] > MIN &&
      abs[1] > MIN &&
      Math.abs(abs[0] - abs[1]) <= EPS
    ) {
      orientation += orientationX + orientationY;
      abs[0] = 0;
      abs[1] = 0;
    } else if (
      abs[0] > MIN &&
      abs[2] > MIN &&
      Math.abs(abs[0] - abs[2]) <= EPS
    ) {
      orientation += orientationX + orientationZ;
      abs[0] = 0;
      abs[2] = 0;
    } else if (
      abs[1] > MIN &&
      abs[2] > MIN &&
      Math.abs(abs[1] - abs[2]) <= EPS
    ) {
      orientation += orientationY + orientationZ;
      abs[1] = 0;
      abs[2] = 0;
    } else {
      break;
    }
  }

  return orientation;
}

/**
 * Inverts an orientation string (e.g. "L" → "R", "AP" → "PA", "H" → "F").
 */
export function invertOrientationStringLPS(orientationString: string): string {
  let inverted = '';

  for (const ch of orientationString) {
    switch (ch) {
      case 'H':
        inverted += 'F';
        break;
      case 'F':
        inverted += 'H';
        break;
      case 'R':
        inverted += 'L';
        break;
      case 'L':
        inverted += 'R';
        break;
      case 'A':
        inverted += 'P';
        break;
      case 'P':
        inverted += 'A';
        break;
      default:
        inverted += ch;
        break;
    }
  }

  return inverted;
}

export interface OrientationLabels {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

/**
 * Computes viewport edge orientation labels from DICOM ImageOrientationPatient (6 floats).
 * Returns empty strings when IOP is absent or invalid.
 */
export function getOrientationLabels(
  imageOrientationPatient?: number[]
): OrientationLabels {
  const empty: OrientationLabels = { top: '', bottom: '', left: '', right: '' };
  if (!imageOrientationPatient || imageOrientationPatient.length < 6) return empty;

  const rowDir = imageOrientationPatient.slice(0, 3) as Vec3;
  const colDir = imageOrientationPatient.slice(3, 6) as Vec3;

  // Row direction cosine points toward increasing column (right side of viewport).
  // Column direction cosine points toward increasing row (bottom of viewport).
  const right = getOrientationStringLPS(rowDir);
  const bottom = getOrientationStringLPS(colDir);

  if (!right || !bottom) return empty;

  return {
    left: invertOrientationStringLPS(right),
    right,
    top: invertOrientationStringLPS(bottom),
    bottom,
  };
}