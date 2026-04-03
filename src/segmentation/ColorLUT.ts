/**
 * ColorLUT — default color lookup table for segmentation labels.
 *
 * Index 0 is always transparent (background).
 * 255 is reserved for brush preview.
 * Provides 254 distinct, high-contrast colors for segments.
 */

import type { ColorRGBA, ColorLUT } from './types';

/**
 * Generate a high-contrast color palette using golden-angle hue distribution.
 * This avoids adjacent segments having similar colors.
 */
function generateDefaultLUT(count: number): ColorLUT {
  const lut: ColorLUT = [];

  // Index 0: transparent background
  lut.push([0, 0, 0, 0]);

  const goldenAngle = 137.508;

  for (let i = 1; i < count; i++) {
    const hue = (i * goldenAngle) % 360;
    const saturation = 0.7 + (i % 3) * 0.1; // 0.7-0.9
    const lightness = 0.5 + (i % 2) * 0.1;  // 0.5-0.6
    const [r, g, b] = hslToRgb(hue / 360, saturation, lightness);
    lut.push([r, g, b, 255]);
  }

  return lut;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Default 256-entry color LUT (index 0 = background, 255 = preview) */
export const DEFAULT_COLOR_LUT: Readonly<ColorLUT> = generateDefaultLUT(256);

// ─── LUT Registry ────────────────────────────────────────────────

const colorLUTs: ColorLUT[] = [
  [...DEFAULT_COLOR_LUT], // index 0 = default
];

export function addColorLUT(lut: ColorLUT, index?: number): number {
  if (index !== undefined) {
    // Pad array if needed
    while (colorLUTs.length <= index) {
      colorLUTs.push([...DEFAULT_COLOR_LUT]);
    }
    colorLUTs[index] = lut;
    return index;
  }
  colorLUTs.push(lut);
  return colorLUTs.length - 1;
}

export function getColorLUT(index: number): ColorLUT {
  return colorLUTs[index] ?? colorLUTs[0];
}

export function removeColorLUT(index: number): void {
  if (index > 0 && index < colorLUTs.length) {
    colorLUTs[index] = [...DEFAULT_COLOR_LUT];
  }
}

export function getSegmentColor(lutIndex: number, segmentIndex: number): ColorRGBA {
  const lut = getColorLUT(lutIndex);
  return lut[segmentIndex] ?? [200, 200, 200, 255];
}

export function setSegmentColor(
  lutIndex: number,
  segmentIndex: number,
  color: ColorRGBA,
): void {
  const lut = getColorLUT(lutIndex);
  if (lut && segmentIndex >= 0 && segmentIndex < lut.length) {
    lut[segmentIndex] = color;
  }
}
