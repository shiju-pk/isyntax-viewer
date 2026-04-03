# isyntax-viewer — Pending Items

## Phase 6: WSI Tiling (not started)
- [ ] Activate `TileManager` infrastructure with `DecodeWorkerPool`
- [ ] Wire `WSIViewport` tile requests through `RequestPoolManager`
- [ ] Hook progressive quality events into tile loading lifecycle
- [ ] Add LOD (level-of-detail) switching based on zoom level

---

## High Priority

### Auto-create labelmap on image load
**File:** `src/presentation/components/Viewer/MainImage.tsx`
- [ ] Call `segmentationState.createLabelmap(width, height)` when `imageData` is set on the viewport
- [ ] Add the representation to the viewport via `segmentationState.addRepresentationToViewport()`
- [ ] Ensure labelmap is recreated/resized if the image changes

### Undo/Redo keyboard shortcuts
**File:** needs new `useKeyboardShortcuts` hook or listener in `MainImage.tsx`
- [ ] Wire `Ctrl+Z` → `annotationHistory.undo()` + re-render
- [ ] Wire `Ctrl+Y` / `Ctrl+Shift+Z` → `annotationHistory.redo()` + re-render
- [ ] Consider adding segmentation undo/redo (labelmap snapshot or per-stroke delta)

### Tests
- [ ] Unit tests for `ImageCache` (LRU eviction, locking, size tracking)
- [ ] Unit tests for `RequestPoolManager` (priority ordering, concurrency limits, abort)
- [ ] Unit tests for `DecodeWorkerPool` (round-robin, idle termination)
- [ ] Unit tests for `AnnotationManager` (CRUD, event emission)
- [ ] Unit tests for `HistoryMemo` (undo/redo stack, max size)
- [ ] Unit tests for `SegmentationState` (create/remove, pixel ops, segment management)
- [ ] Unit tests for `Camera2D` (worldToCanvas / canvasToWorld round-trip)
- [ ] Integration test: BrushTool paints correct pixels into labelmap
- [ ] Integration test: LengthTool annotation create → render → undo cycle

---

## Medium Priority

### ColorMapStage implementation
**File:** `src/rendering/pipeline/stages/ColorMapStage.ts`
- [ ] Implement pseudo-color / palette LUT application
- [ ] Support named colormaps (hot, cool, jet, grayscale, etc.)
- [ ] Wire colormap selection into `ViewportProperties`

### Segmentation orchestration in ViewerPage
**File:** `src/presentation/pages/viewer/ViewerPage.tsx`
- [ ] Add segmentation state (active segmentation ID, active segment index)
- [ ] Add segment list panel (create/delete/rename/recolor segments)
- [ ] Pass segmentation context to `MainImage` component
- [ ] Add segment visibility toggles
- [ ] Add segment lock toggles

### Export WebGLBackend from barrel
**File:** `src/rendering/backends/index.ts`
- [ ] Add `export { WebGLBackend } from './WebGLBackend'` to public API

---

## Low Priority / Cleanup

### Remove legacy tool system (dead code)
- [ ] Delete `src/tools/interaction/` folder (InteractionDispatcher, old PanTool, ZoomTool, WindowLevelTool)
- [ ] Remove legacy exports from `src/tools/index.ts` line 2
- [ ] Remove `ToolType` enum and `ITool` interface from `src/tools/types.ts`
- [ ] Verify no external consumers depend on legacy exports

### Remove deprecated CanvasRenderer
- [ ] Delete `src/rendering/canvas/CanvasRenderer.ts`
- [ ] Remove `export { createCanvasRenderer }` from `src/rendering/index.ts`

### Minor TODOs in codebase
- [ ] `src/codecs/isyntax/RiceDecoder.ts:74` — test `maskBits === bps` edge case

---

## Future Enhancements (not in original plan)
- [ ] FreehandROI annotation tool (draw-to-close polygon)
- [ ] Bidirectional measurement tool (longest diameter + perpendicular)
- [ ] COBB angle tool
- [ ] Segmentation export (labelmap → PNG/NIFTI)
- [ ] Annotation export/import (JSON serialization)
- [ ] Multi-viewport layout (2×2, 1×2, etc.) with synchronized views
- [ ] Thumbnail strip for multi-image navigation
- [ ] Keyboard shortcuts for tool switching (1-9 keys)
- [ ] Touch/gesture support for mobile
