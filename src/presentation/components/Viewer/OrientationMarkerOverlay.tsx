import React, { useMemo } from 'react';

interface OrientationMarkerOverlayProps {
  imageOrientationPatient?: number[];
  rotation?: number;       // degrees clockwise (0, 90, 180, 270)
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}

/**
 * Computes the anatomical direction letter for a given direction cosine component.
 *
 * DICOM convention:
 *  +x = Left (L),  −x = Right (R)
 *  +y = Posterior (P), −y = Anterior (A)
 *  +z = Head/Superior (H), −z = Feet/Inferior (F)
 */
function directionToLetters(x: number, y: number, z: number): string {
  let result = '';
  const threshold = 0.0001;

  if (Math.abs(x) > threshold) result += x > 0 ? 'L' : 'R';
  if (Math.abs(y) > threshold) result += y > 0 ? 'P' : 'A';
  if (Math.abs(z) > threshold) result += z > 0 ? 'H' : 'F';

  return result || '?';
}

/**
 * Derives the 4 viewport edge labels (top, right, bottom, left)
 * from the DICOM ImageOrientationPatient (row + column direction cosines),
 * accounting for rotation and flips applied by the user.
 */
function computeOrientationLabels(
  iop: number[],
  rotation: number,
  flipH: boolean,
  flipV: boolean,
): { top: string; right: string; bottom: string; left: string } {
  if (iop.length < 6) return { top: '?', right: '?', bottom: '?', left: '?' };

  // Row direction cosines = direction of increasing column index
  let rowX = iop[0], rowY = iop[1], rowZ = iop[2];
  // Column direction cosines = direction of increasing row index
  let colX = iop[3], colY = iop[4], colZ = iop[5];

  // Apply horizontal flip (mirrors the row direction)
  if (flipH) {
    rowX = -rowX; rowY = -rowY; rowZ = -rowZ;
  }
  // Apply vertical flip (mirrors the column direction)
  if (flipV) {
    colX = -colX; colY = -colY; colZ = -colZ;
  }

  // Apply rotation (swap and negate row/col cosines)
  const steps = ((rotation % 360) + 360) % 360 / 90;
  for (let i = 0; i < steps; i++) {
    // 90° clockwise: new_row = old_col, new_col = -old_row
    const tmpX = rowX, tmpY = rowY, tmpZ = rowZ;
    rowX = colX; rowY = colY; rowZ = colZ;
    colX = -tmpX; colY = -tmpY; colZ = -tmpZ;
  }

  // Labels: opposite directions for each axis
  const right = directionToLetters(rowX, rowY, rowZ);
  const left = directionToLetters(-rowX, -rowY, -rowZ);
  const bottom = directionToLetters(colX, colY, colZ);
  const top = directionToLetters(-colX, -colY, -colZ);

  return { top, right, bottom, left };
}

/**
 * Renders DICOM-standard orientation markers (L/R/A/P/H/F) on the
 * four edges of the viewport image.
 */
export default function OrientationMarkerOverlay({
  imageOrientationPatient,
  rotation = 0,
  flipHorizontal = false,
  flipVertical = false,
}: OrientationMarkerOverlayProps) {
  const labels = useMemo(() => {
    if (!imageOrientationPatient || imageOrientationPatient.length < 6) return null;
    return computeOrientationLabels(imageOrientationPatient, rotation, flipHorizontal, flipVertical);
  }, [imageOrientationPatient, rotation, flipHorizontal, flipVertical]);

  if (!labels) return null;

  const labelClass = 'absolute text-white text-xs font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] pointer-events-none select-none';

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top center */}
      <span className={`${labelClass} top-1 left-1/2 -translate-x-1/2`}>
        {labels.top}
      </span>
      {/* Bottom center */}
      <span className={`${labelClass} bottom-1 left-1/2 -translate-x-1/2`}>
        {labels.bottom}
      </span>
      {/* Left center */}
      <span className={`${labelClass} left-1 top-1/2 -translate-y-1/2`}>
        {labels.left}
      </span>
      {/* Right center */}
      <span className={`${labelClass} right-1 top-1/2 -translate-y-1/2`}>
        {labels.right}
      </span>
    </div>
  );
}
