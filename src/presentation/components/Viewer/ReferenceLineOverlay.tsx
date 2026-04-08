/**
 * ReferenceLineOverlay — Draws dotted reference lines on the viewport image
 * showing where other linked viewports' current slices are positioned.
 *
 * Each reference line is a horizontal dashed line at a vertical position
 * proportional to the other viewport's slice index within the series.
 * A small label shows the source viewport cell number.
 *
 * Inspired by OHIF Viewers' cross-reference line display.
 */

import { useMemo } from 'react';

/** Position info from another viewport in the linked group. */
export interface ReferencePosition {
  /** Cell index of the source viewport. */
  cellIndex: number;
  /** Current image index in the source viewport's series. */
  imageIndex: number;
  /** Total images in the source viewport's series. */
  imageCount: number;
  /** Color for this reference line. */
  color: string;
}

interface ReferenceLineOverlayProps {
  /** Reference positions from other linked viewports. */
  references: ReferencePosition[];
  /** This viewport's current image index (to skip self-position). */
  currentImageIndex: number;
  /** This viewport's image count. */
  currentImageCount: number;
}

// Distinct colors for up to 4 viewports (matching OHIF style)
export const REFERENCE_COLORS = [
  '#00ffff', // cyan
  '#ffff00', // yellow
  '#ff66ff', // magenta
  '#66ff66', // green
];

export default function ReferenceLineOverlay({
  references,
  currentImageIndex,
  currentImageCount,
}: ReferenceLineOverlayProps) {
  // Filter out references that would land on the exact same position as current
  const visibleRefs = useMemo(() => {
    if (currentImageCount <= 1) return [];
    return references.filter((ref) => {
      // Map the source position proportionally into this viewport's range
      const mappedIndex = ref.imageCount <= 1
        ? 0
        : Math.round((ref.imageIndex / (ref.imageCount - 1)) * (currentImageCount - 1));
      return mappedIndex !== currentImageIndex;
    });
  }, [references, currentImageIndex, currentImageCount]);

  if (visibleRefs.length === 0 || currentImageCount <= 1) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {visibleRefs.map((ref) => {
        // Map source position into this viewport's proportional space
        const ratio = ref.imageCount <= 1 ? 0 : ref.imageIndex / (ref.imageCount - 1);
        // Small margin so lines don't sit on the very edge
        const y = 2 + ratio * 96;

        return (
          <g key={`ref-${ref.cellIndex}`}>
            {/* Dashed reference line */}
            <line
              x1="5"
              y1={y}
              x2="95"
              y2={y}
              stroke={ref.color}
              strokeWidth="0.4"
              strokeDasharray="2 1.5"
              opacity="0.8"
            />
            {/* Small triangular marker on left edge */}
            <polygon
              points={`3,${y - 1.2} 6,${y} 3,${y + 1.2}`}
              fill={ref.color}
              opacity="0.9"
            />
            {/* Small triangular marker on right edge */}
            <polygon
              points={`97,${y - 1.2} 94,${y} 97,${y + 1.2}`}
              fill={ref.color}
              opacity="0.9"
            />
            {/* Cell label */}
            <text
              x="7"
              y={y - 1.5}
              fill={ref.color}
              fontSize="3"
              fontFamily="monospace"
              opacity="0.9"
            >
              VP {ref.cellIndex + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
