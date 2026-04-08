/**
 * ViewportGrid — Renders a CSS grid of ViewportCell panes based on the
 * current LayoutMode (1x1, 1x2, 2x1, 2x2).
 *
 * Auto-fill behavior (inspired by OHIF Viewers hanging protocols):
 *  - When layout changes → automatically distribute available images across
 *    all cells, preferring different series first (like OHIF's
 *    matchedDisplaySetsIndex 0, 1, 2, …).
 *  - On initial load → cell 0 auto-loads the first image.
 *  - Thumbnail click → overrides only the active cell.
 *
 * The grid tracks:
 *  - Which cell is "active" (highlighted, receives thumbnail clicks)
 *  - Per-cell image assignments (series + image index)
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ViewportCell from './ViewportCell';
import type { ViewportCellAssignment } from './ViewportCell';
import type { LayoutMode } from './LayoutSwitcher';
import { getLayoutDimensions } from './LayoutSwitcher';
import type { InteractionMode, DicomImageMetadata, StudyInfo, SeriesGroup, DecodedImage } from '../../../core/types';
import type { GSPSApplicationResult } from '../../../gsps-engine/types';
import { ISyntaxImageService } from '../../../services/image/ISyntaxImageService';
import { LinkedScrollManager } from '../../../viewport-sync';
import type { LinkedViewportEntry } from '../../../viewport-sync';
import { REFERENCE_COLORS } from './ReferenceLineOverlay';
import type { ReferencePosition } from './ReferenceLineOverlay';

export interface ViewportGridProps {
  layout: LayoutMode;
  mode: InteractionMode;
  overlaysEnabled: boolean;

  // Study data
  studyId: string;
  stackId: string;
  studyInfo: StudyInfo | null;
  seriesGroups: SeriesGroup[];
  metadataMap: Map<string, DicomImageMetadata>;
  thumbnails: Map<string, ImageData>;
  initImages: Map<string, DecodedImage>;
  servicesRef: React.MutableRefObject<Map<string, ISyntaxImageService>>;
  gspsResult: GSPSApplicationResult | null;

  // Shared state updaters
  onThumbnailsUpdate: React.Dispatch<React.SetStateAction<Map<string, ImageData>>>;
  onInitImagesUpdate: React.Dispatch<React.SetStateAction<Map<string, DecodedImage>>>;

  // The selected series/image from the parent (used to assign to active cell)
  selectedSeriesIndex: number;
  selectedImageIndex: number;
}

/**
 * Build an ordered list of image slots to distribute across viewport cells.
 * Strategy (matching OHIF hanging protocol behaviour):
 *  1. First pass: take image 0 from each series (cross-series spread).
 *  2. Second pass: take remaining images from each series in order.
 * This ensures a 2x2 grid with 4 series shows one image per series,
 * while a study with 1 series still fills cells with different images.
 */
function buildAutoFillSlots(
  seriesGroups: SeriesGroup[],
): ViewportCellAssignment[] {
  if (seriesGroups.length === 0) return [];

  const slots: ViewportCellAssignment[] = [];

  // Pass 1 — first image of each series (cross-series spread)
  for (let s = 0; s < seriesGroups.length; s++) {
    if (seriesGroups[s].imageIds.length > 0) {
      slots.push({ seriesIndex: s, imageIndex: 0 });
    }
  }

  // Pass 2 — remaining images from each series
  for (let s = 0; s < seriesGroups.length; s++) {
    const count = seriesGroups[s].imageIds.length;
    for (let i = 1; i < count; i++) {
      slots.push({ seriesIndex: s, imageIndex: i });
    }
  }

  return slots;
}

export default function ViewportGrid({
  layout,
  mode,
  overlaysEnabled,
  studyId,
  stackId,
  studyInfo,
  seriesGroups,
  metadataMap,
  thumbnails,
  initImages,
  servicesRef,
  gspsResult,
  onThumbnailsUpdate,
  onInitImagesUpdate,
  selectedSeriesIndex,
  selectedImageIndex,
}: ViewportGridProps) {
  const { rows, cols } = getLayoutDimensions(layout);
  const cellCount = rows * cols;

  const [activeCell, setActiveCell] = useState(0);
  const [cellAssignments, setCellAssignments] = useState<Map<number, ViewportCellAssignment>>(
    () => new Map()
  );

  // Track whether the user has manually overridden a cell via thumbnail click
  // so we don't clobber it during auto-fill on layout change.
  const userOverrideRef = useRef(false);

  // Build the full ordered slot list for auto-fill
  const autoFillSlots = useMemo(
    () => buildAutoFillSlots(seriesGroups),
    [seriesGroups],
  );

  // --- Auto-fill on layout change or when study data arrives ---
  // Runs when: layout changes, seriesGroups load, or auto-fill slots update.
  useEffect(() => {
    if (autoFillSlots.length === 0) return;

    const next = new Map<number, ViewportCellAssignment>();
    for (let i = 0; i < cellCount; i++) {
      if (i < autoFillSlots.length) {
        next.set(i, autoFillSlots[i]);
      }
      // Cells beyond available images stay empty (null assignment)
    }

    setCellAssignments(next);
    // Reset active cell to 0 on layout change
    setActiveCell(0);
    userOverrideRef.current = false;
  }, [layout, autoFillSlots, cellCount]);

  // --- Thumbnail click → assign to active cell only ---
  const prevSelRef = useRef({ s: selectedSeriesIndex, i: selectedImageIndex });
  useEffect(() => {
    const prev = prevSelRef.current;
    // Only react to actual changes (not the initial render)
    if (prev.s === selectedSeriesIndex && prev.i === selectedImageIndex) return;
    prevSelRef.current = { s: selectedSeriesIndex, i: selectedImageIndex };

    setCellAssignments(old => {
      const next = new Map(old);
      next.set(activeCell, { seriesIndex: selectedSeriesIndex, imageIndex: selectedImageIndex });
      return next;
    });
    userOverrideRef.current = true;
  }, [selectedSeriesIndex, selectedImageIndex, activeCell]);

  const handleActivate = useCallback((cellIndex: number) => {
    setActiveCell(cellIndex);
  }, []);

  // ---- Linked Scrolling ----
  const scrollManagerRef = useRef<LinkedScrollManager>(new LinkedScrollManager());

  // Enable linking automatically when multi-viewport layout is active
  useEffect(() => {
    const mgr = scrollManagerRef.current;
    if (cellCount > 1) {
      mgr.enableLinking('cell-0');
    } else {
      mgr.disableLinking();
    }
  }, [cellCount]);

  // Register / update viewport entries whenever assignments or metadata change
  useEffect(() => {
    const mgr = scrollManagerRef.current;

    // Build a set of currently registered cell IDs to unregister stale ones
    const activeCellIds = new Set<string>();

    for (let i = 0; i < cellCount; i++) {
      const assignment = cellAssignments.get(i);
      if (!assignment) continue;

      const group = seriesGroups[assignment.seriesIndex];
      if (!group) continue;

      const instanceUID = group.imageIds[assignment.imageIndex] ?? '';
      const meta = instanceUID ? metadataMap.get(instanceUID) : undefined;
      const cellId = `cell-${i}`;
      activeCellIds.add(cellId);

      const entry: LinkedViewportEntry = {
        viewportId: cellId,
        frameOfReferenceUID: meta?.frameOfReferenceUID || studyId || '_unknown',
        imageCount: group.imageIds.length,
        currentImageIndex: assignment.imageIndex,
        rows: meta?.rows ?? 512,
        columns: meta?.columns ?? 512,
        pixelSpacing: meta?.pixelSpacing as [number, number] | undefined,
      };

      // Register or update
      mgr.registerViewport(entry);
    }

    // Unregister cells that are no longer in the grid
    for (let i = cellCount; i < 4; i++) {
      mgr.unregisterViewport(`cell-${i}`);
    }
  }, [cellAssignments, cellCount, seriesGroups, metadataMap]);

  // Cleanup on unmount
  useEffect(() => {
    const mgr = scrollManagerRef.current;
    return () => { mgr.dispose(); };
  }, []);

  // Handle in-cell navigation (e.g. scrollbar, mouse wheel) with linked scrolling
  const handleCellNavigate = useCallback((cellIndex: number, seriesIndex: number, imageIndex: number) => {
    setCellAssignments(prev => {
      const next = new Map(prev);
      next.set(cellIndex, { seriesIndex, imageIndex });

      // Notify linked scroll manager
      const mgr = scrollManagerRef.current;
      if (mgr.isLinked) {
        const cellId = `cell-${cellIndex}`;
        mgr.onMasterScroll(cellId, imageIndex);

        // Apply synced positions to other cells
        for (let i = 0; i < 4; i++) {
          if (i === cellIndex) continue;
          const otherAssignment = next.get(i);
          if (!otherAssignment) continue;

          const otherCellId = `cell-${i}`;
          const otherEntry = mgr.getViewport(otherCellId);
          if (otherEntry && otherEntry.currentImageIndex !== otherAssignment.imageIndex) {
            next.set(i, { ...otherAssignment, imageIndex: otherEntry.currentImageIndex });
          }
        }
      }

      return next;
    });
  }, []);

  // Clamp active cell when layout shrinks
  useEffect(() => {
    if (activeCell >= cellCount) {
      setActiveCell(0);
    }
  }, [cellCount, activeCell]);

  // Build cell indices
  const cellIndices = useMemo(() => Array.from({ length: cellCount }, (_, i) => i), [cellCount]);

  // Compute reference positions for each cell (positions from other cells to draw as reference lines)
  const referencePositionsMap = useMemo(() => {
    const map = new Map<number, ReferencePosition[]>();
    if (cellCount <= 1) return map;

    for (let target = 0; target < cellCount; target++) {
      const refs: ReferencePosition[] = [];
      const targetAssignment = cellAssignments.get(target);
      if (!targetAssignment) { map.set(target, refs); continue; }

      for (let source = 0; source < cellCount; source++) {
        if (source === target) continue;
        const srcAssignment = cellAssignments.get(source);
        if (!srcAssignment) continue;

        const srcGroup = seriesGroups[srcAssignment.seriesIndex];
        if (!srcGroup) continue;

        refs.push({
          cellIndex: source,
          imageIndex: srcAssignment.imageIndex,
          imageCount: srcGroup.imageIds.length,
          color: REFERENCE_COLORS[source % REFERENCE_COLORS.length],
        });
      }
      map.set(target, refs);
    }
    return map;
  }, [cellCount, cellAssignments, seriesGroups]);

  return (
    <div
      className="flex-1 min-h-0 min-w-0"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '0',
      }}
    >
      {cellIndices.map((idx) => (
        <ViewportCell
          key={`cell-${idx}`}
          cellIndex={idx}
          isActive={idx === activeCell}
          onActivate={handleActivate}
          assignment={cellAssignments.get(idx) ?? null}
          studyId={studyId}
          stackId={stackId}
          studyInfo={studyInfo}
          seriesGroups={seriesGroups}
          metadataMap={metadataMap}
          thumbnails={thumbnails}
          initImages={initImages}
          servicesRef={servicesRef}
          gspsResult={gspsResult}
          overlaysEnabled={overlaysEnabled}
          mode={mode}
          onThumbnailsUpdate={onThumbnailsUpdate}
          onInitImagesUpdate={onInitImagesUpdate}
          onNavigate={handleCellNavigate}
          referencePositions={referencePositionsMap.get(idx)}
        />
      ))}
    </div>
  );
}
