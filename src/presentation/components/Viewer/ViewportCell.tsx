/**
 * ViewportCell — Self-contained viewport pane for the multi-viewport grid.
 *
 * Each cell owns its own MainImage, ViewportOverlay, and image-scrollbar.
 * The parent (ViewportGrid) tells it which image to display and whether it
 * is the "active" cell (highlighted border, receives tool events).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MainImage from './MainImage';
import ViewportOverlay from './ViewportOverlay';
import ImageScrollbar from './ImageScrollbar';
import ReferenceLineOverlay from './ReferenceLineOverlay';
import type { ReferencePosition } from './ReferenceLineOverlay';
import { ISyntaxImageService } from '../../../services/image/ISyntaxImageService';
import type { InteractionMode, DicomImageMetadata, StudyInfo, SeriesGroup, DecodedImage } from '../../../core/types';
import type { ICanvasController } from '../../../core/interfaces';
import type { OverlayGroup } from '../../../overlay-engine/types';
import type { GSPSApplicationResult } from '../../../gsps-engine/types';
import { parseOverlayGroup } from '../../../overlay-engine/OverlayParser';
import { eventBus } from '../../../rendering/events/EventBus';
import { RenderingEvents } from '../../../rendering/events/RenderingEvents';
import { Loader2, X, RefreshCw } from 'lucide-react';
import OrientationMarkerOverlay from './OrientationMarkerOverlay';

export interface ViewportCellAssignment {
  seriesIndex: number;
  imageIndex: number;
}

export interface ViewportCellProps {
  /** Unique index of this cell in the grid. */
  cellIndex: number;
  /** Whether this cell is the active/focused cell. */
  isActive: boolean;
  /** Callback when the user clicks this cell to make it active. */
  onActivate: (cellIndex: number) => void;
  /** The series+image assignment for this cell (null = empty). */
  assignment: ViewportCellAssignment | null;

  // Shared study-level data
  studyId: string;
  stackId: string;
  studyInfo: StudyInfo | null;
  seriesGroups: SeriesGroup[];
  metadataMap: Map<string, DicomImageMetadata>;
  thumbnails: Map<string, ImageData>;
  initImages: Map<string, DecodedImage>;
  servicesRef: React.MutableRefObject<Map<string, ISyntaxImageService>>;
  gspsResult: GSPSApplicationResult | null;
  overlaysEnabled: boolean;

  // Tool state
  mode: InteractionMode;

  // Callbacks to update shared state
  onThumbnailsUpdate: React.Dispatch<React.SetStateAction<Map<string, ImageData>>>;
  onInitImagesUpdate: React.Dispatch<React.SetStateAction<Map<string, DecodedImage>>>;
  /** Notify parent about image navigation within a series */
  onNavigate?: (cellIndex: number, seriesIndex: number, imageIndex: number) => void;
  /** Reference positions from other linked viewports for drawing reference lines */
  referencePositions?: ReferencePosition[];
}

export default function ViewportCell({
  cellIndex,
  isActive,
  onActivate,
  assignment,
  studyId,
  stackId,
  studyInfo,
  seriesGroups,
  metadataMap,
  thumbnails,
  initImages,
  servicesRef,
  gspsResult,
  overlaysEnabled,
  mode,
  onThumbnailsUpdate,
  onInitImagesUpdate,
  onNavigate,
  referencePositions = [],
}: ViewportCellProps) {
  const [currentImage, setCurrentImage] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ level: number; total: number } | null>(null);
  const [progressVisible, setProgressVisible] = useState(false);

  const controllerRef = useRef<ICanvasController | null>(null);
  const serviceRef = useRef<ISyntaxImageService | null>(null);
  const gspsVOIAppliedRef = useRef(false);
  const gspsVOIAppliedUIDRef = useRef('');
  const currentImageRef = useRef<ImageData | null>(null);

  // Derive instance UID from assignment
  const currentInstanceUID = useMemo(() => {
    if (!assignment || seriesGroups.length === 0) return '';
    const group = seriesGroups[assignment.seriesIndex];
    return group?.imageIds[assignment.imageIndex] ?? '';
  }, [assignment, seriesGroups]);

  const currentMetadata = useMemo(
    () => (currentInstanceUID ? metadataMap.get(currentInstanceUID) ?? null : null),
    [metadataMap, currentInstanceUID],
  );

  // Parse DICOM 6000 overlay group
  const overlayGroup = useMemo<OverlayGroup | null>(() => {
    if (!currentMetadata?.overlayAttributes) return null;
    const attrs = currentMetadata.overlayAttributes;
    const hasOverlayData = Object.keys(attrs).some(k => k.startsWith('60'));
    if (!hasOverlayData) return null;
    try {
      return parseOverlayGroup(attrs);
    } catch (err) {
      console.error('[Overlay] Failed to parse overlay group:', err);
      return null;
    }
  }, [currentMetadata]);

  // Effective VOI
  const effectiveVOI = useMemo(() => {
    if (!currentImage) return undefined;
    const service = serviceRef.current;
    if (!service) return undefined;
    return service.effectiveVOI;
  }, [currentImage]);

  // Delay showing progress bar
  useEffect(() => {
    if (!progress) { setProgressVisible(false); return; }
    const timer = setTimeout(() => setProgressVisible(true), 300);
    return () => clearTimeout(timer);
  }, [progress]);

  // Apply GSPS VOI transform
  useEffect(() => {
    // Reset the applied flag when instance changes so GSPS VOI re-applies per image
    if (currentInstanceUID !== gspsVOIAppliedUIDRef.current) {
      gspsVOIAppliedRef.current = false;
      gspsVOIAppliedUIDRef.current = currentInstanceUID;
    }

    const voi = gspsResult?.voiTransform;
    if (!voi || !currentImage) return;
    if (gspsVOIAppliedRef.current) return;
    const service = serviceRef.current;
    if (!service) return;
    const rewindowed = service.rewindow(voi.windowCenter, voi.windowWidth);
    if (rewindowed) {
      gspsVOIAppliedRef.current = true;
      setCurrentImage(rewindowed);
      console.info('[GSPS] Applied VOI transform: WC=%d WW=%d', voi.windowCenter, voi.windowWidth);
    }
  }, [gspsResult, currentImage, currentInstanceUID]);

  // Listen for WindowLevel tool VOI changes
  useEffect(() => {
    const handler = (evt: { viewportId: string; windowCenter: number; windowWidth: number }) => {
      const service = serviceRef.current;
      if (!service) return;
      const currentVOI = service.effectiveVOI;
      if (evt.windowCenter === currentVOI.windowCenter && evt.windowWidth === currentVOI.windowWidth) return;
      const rewindowed = service.rewindow(evt.windowCenter, evt.windowWidth);
      if (rewindowed) setCurrentImage(rewindowed);
    };
    eventBus.on(RenderingEvents.VOI_MODIFIED, handler);
    return () => eventBus.off(RenderingEvents.VOI_MODIFIED, handler);
  }, []);

  // Listen for reset/fit-to-window events from ToolPalette
  useEffect(() => {
    const handleReset = () => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      const meta = currentInstanceUID ? metadataMap.get(currentInstanceUID) : null;
      ctrl.reset(meta?.windowCenter, meta?.windowWidth);
    };
    const handleFit = () => {
      controllerRef.current?.fitToWindow();
    };
    const handleFlipH = () => {
      controllerRef.current?.flipHorizontal();
    };
    const handleFlipV = () => {
      controllerRef.current?.flipVertical();
    };
    const handleRotate90 = () => {
      controllerRef.current?.rotateRight90();
    };
    eventBus.on(RenderingEvents.VIEWPORT_RESET, handleReset);
    eventBus.on(RenderingEvents.VIEWPORT_FIT, handleFit);
    eventBus.on(RenderingEvents.FLIP_HORIZONTAL, handleFlipH);
    eventBus.on(RenderingEvents.FLIP_VERTICAL, handleFlipV);
    eventBus.on(RenderingEvents.ROTATE_RIGHT_90, handleRotate90);
    return () => {
      eventBus.off(RenderingEvents.VIEWPORT_RESET, handleReset);
      eventBus.off(RenderingEvents.VIEWPORT_FIT, handleFit);
      eventBus.off(RenderingEvents.FLIP_HORIZONTAL, handleFlipH);
      eventBus.off(RenderingEvents.FLIP_VERTICAL, handleFlipV);
      eventBus.off(RenderingEvents.ROTATE_RIGHT_90, handleRotate90);
    };
  }, [currentInstanceUID, metadataMap]);

  // Keep ref in sync for stale-closure-safe reads
  currentImageRef.current = currentImage;

  // ---------- Effect 1: Sync cached init images from useStudyLoader ----------
  // Lightweight effect that picks up image data once useStudyLoader finishes
  // loading. Has NO cleanup, so it never cancels anything. This fixes the
  // race where auto-fill assignment arrives before the init image.
  useEffect(() => {
    if (!currentInstanceUID) return;
    // Already have an image displayed — nothing to sync
    if (currentImageRef.current) return;

    const cached = initImages.get(currentInstanceUID);
    if (!cached) return;

    // Pick up the cached init image
    setCurrentImage(cached.imageData);
    setLoading(false);

    // Ensure service ref is set
    const service = servicesRef.current.get(currentInstanceUID);
    if (service) {
      serviceRef.current = service;

      // Kick off progressive loading if the main effect hasn't done it yet
      if (!service.isFullyLoaded && service.totalLevels > 0) {
        setProgress({ level: 0, total: service.totalLevels });
        service.loadAllLevels((level, total) => {
          setProgress({ level, total });
        }).then((finalResult) => {
          setCurrentImage(finalResult.imageData);
          setProgress(null);
        }).catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to enhance image');
          setProgress(null);
        });
      }
    }
  }, [initImages, currentInstanceUID]);

  // ---------- Effect 2: Load image when assignment changes ----------
  // Only depends on [currentInstanceUID, studyId, stackId] — NOT initImages.
  // This prevents initImages updates from cancelling in-flight progressive loads.
  useEffect(() => {
    if (!assignment || !currentInstanceUID || !studyId || !stackId) {
      setCurrentImage(null);
      serviceRef.current = null;
      return;
    }

    // Check if we already have a cached init image
    const cached = initImages.get(currentInstanceUID);
    if (cached) {
      // Init data available — display it and proceed to progressive load
      setCurrentImage(cached.imageData);
      setLoading(false);
    }

    // If the service was already created by useStudyLoader but init image
    // hasn't arrived yet, show loading — Effect 1 will pick it up later.
    const existingService = servicesRef.current.get(currentInstanceUID);
    if (existingService && !cached) {
      setLoading(true);
      return; // Effect 1 will handle the rest when initImages updates
    }

    let cancelled = false;

    const loadImage = async () => {
      setError(null);
      setProgress(null);

      // Get or create service
      let service = existingService;
      if (!service) {
        service = new ISyntaxImageService(studyId, currentInstanceUID, stackId);
        const meta = metadataMap.get(currentInstanceUID);
        if (meta) service.dicomMetadata = meta;
        servicesRef.current.set(currentInstanceUID, service);

        if (!cached) {
          setLoading(true);
          try {
            const initResult = await service.initImage();
            if (cancelled) return;
            setCurrentImage(initResult.imageData);
            onThumbnailsUpdate(prev => new Map(prev).set(currentInstanceUID, initResult.imageData));
            onInitImagesUpdate(prev => new Map(prev).set(currentInstanceUID, initResult));
            setLoading(false);
          } catch (err) {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : 'Failed to load image');
            setLoading(false);
            return;
          }
        }
      }

      serviceRef.current = service;

      if (service.isFullyLoaded && service.cachedResult) {
        if (!cancelled) setCurrentImage(service.cachedResult.imageData);
        return;
      }

      // Progressive loading
      if (service.totalLevels > 0) {
        try {
          setProgress({ level: 0, total: service.totalLevels });
          const finalResult = await service.loadAllLevels((level, total) => {
            if (!cancelled) setProgress({ level, total });
          });
          if (!cancelled) {
            setCurrentImage(finalResult.imageData);
            setProgress(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to enhance image');
            setProgress(null);
          }
        }
      }
    };

    loadImage();
    return () => { cancelled = true; };
  }, [currentInstanceUID, studyId, stackId]);

  // Retry handler
  const handleRetryLoad = useCallback(() => {
    const service = serviceRef.current;
    if (!service || service.isFullyLoaded) return;
    setError(null);
    if (service.totalLevels > 0) {
      setProgress({ level: 0, total: service.totalLevels });
      service.loadAllLevels((level, total) => { setProgress({ level, total }); })
        .then((finalResult) => {
          setCurrentImage(finalResult.imageData);
          setProgress(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to enhance image');
          setProgress(null);
        });
    }
  }, []);

  const handleControllerReady = useCallback((controller: ICanvasController) => {
    controllerRef.current = controller;
  }, []);

  // Series navigation
  const currentSeriesImageCount = assignment
    ? (seriesGroups[assignment.seriesIndex]?.imageIds.length ?? 0)
    : 0;

  const navigateImage = useCallback((targetIndex: number) => {
    if (!assignment || seriesGroups.length === 0) return;
    const group = seriesGroups[assignment.seriesIndex];
    if (!group) return;
    const clamped = Math.max(0, Math.min(group.imageIds.length - 1, targetIndex));
    if (clamped === assignment.imageIndex) return;
    onNavigate?.(cellIndex, assignment.seriesIndex, clamped);
  }, [assignment, seriesGroups, cellIndex, onNavigate]);

  const handleImageWheel = useCallback((e: React.WheelEvent) => {
    if (mode === 'zoom') return;
    if (currentSeriesImageCount <= 1) return;
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 1 : -1;
    if (assignment) navigateImage(assignment.imageIndex + delta);
  }, [mode, currentSeriesImageCount, assignment, navigateImage]);

  // Compute flat imageIndex and imageCount for overlay display
  const flatImageIndex = useMemo(() => {
    if (!assignment) return 0;
    let idx = 0;
    for (let s = 0; s < assignment.seriesIndex; s++) {
      idx += seriesGroups[s]?.imageIds.length ?? 0;
    }
    return idx + assignment.imageIndex;
  }, [assignment, seriesGroups]);

  const totalImageCount = useMemo(() => {
    return seriesGroups.reduce((sum, g) => sum + g.imageIds.length, 0);
  }, [seriesGroups]);

  return (
    <div
      className={`relative flex flex-col min-h-0 min-w-0 bg-black transition-colors ${
        isActive
          ? 'border-2 border-blue-500'
          : 'border border-gray-600 hover:border-gray-400'
      }`}
      onClick={() => onActivate(cellIndex)}
    >
      {/* Status overlays */}
      {(loading || (progress && progressVisible) || error) && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          {loading && (
            <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
              <Loader2 size={20} className="animate-spin text-blue-400" />
              <span className="text-sm text-gray-200">Loading image...</span>
            </div>
          )}
          {progress && progressVisible && !loading && (
            <div className="bg-gray-900/80 backdrop-blur-sm px-5 py-3 rounded-lg">
              <div className="text-xs text-gray-300 mb-1.5">Enhancing image resolution…</div>
              <div className="w-56 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(progress.level / progress.total) * 100}%` }} />
              </div>
              <div className="text-[11px] text-gray-500 mt-1 text-right tabular-nums">
                {Math.round((progress.level / progress.total) * 100)}% ({progress.level}/{progress.total})
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-3 bg-red-900/80 backdrop-blur-sm px-4 py-2.5 rounded-lg text-red-200 text-sm pointer-events-auto">
              <span>{error}</span>
              <button onClick={handleRetryLoad} title="Retry" className="p-1.5 rounded-md hover:bg-red-800 text-red-300 hover:text-red-100 transition-colors">
                <RefreshCw size={14} />
              </button>
              <button onClick={() => setError(null)} title="Dismiss" className="p-1.5 rounded-md hover:bg-red-800 text-red-300 hover:text-red-100 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Viewport content */}
      <div className="relative flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 relative" onWheel={handleImageWheel}>
          {assignment ? (
            <>
              <MainImage
                imageData={currentImage}
                mode={mode}
                imageId={currentInstanceUID || undefined}
                onControllerReady={handleControllerReady}
                overlayGroup={overlaysEnabled ? overlayGroup : null}
                gspsResult={gspsResult}
                pixelSpacing={currentMetadata?.pixelSpacing}
                windowCenter={effectiveVOI?.windowCenter}
                windowWidth={effectiveVOI?.windowWidth}
              />
              <ViewportOverlay
                metadata={currentMetadata}
                studyInfo={studyInfo}
                imageIndex={flatImageIndex}
                imageCount={totalImageCount}
                imageWidth={currentImage?.width ?? null}
                imageHeight={currentImage?.height ?? null}
              />
              {referencePositions.length > 0 && assignment && currentSeriesImageCount > 1 && (
                <ReferenceLineOverlay
                  references={referencePositions}
                  currentImageIndex={assignment.imageIndex}
                  currentImageCount={currentSeriesImageCount}
                />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm select-none">
              <span>Click a thumbnail to load</span>
            </div>
          )}
        </div>
        {assignment && currentSeriesImageCount > 1 && (
          <ImageScrollbar
            imageIndex={assignment.imageIndex}
            imageCount={currentSeriesImageCount}
            onNavigate={navigateImage}
          />
        )}
      </div>

      {/* Active cell indicator label */}
      {isActive && (
        <div className="absolute top-1 left-1 bg-blue-600/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-30 select-none">
          Active
        </div>
      )}
    </div>
  );
}
