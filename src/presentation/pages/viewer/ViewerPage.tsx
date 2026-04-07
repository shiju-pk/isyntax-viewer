import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import TitleBar from '../../components/TitleBar/TitleBar';
import ThumbnailPanel from '../../components/Viewer/ThumbnailPanel';
import MainImage from '../../components/Viewer/MainImage';
import ToolPalette from '../../components/Viewer/ToolPalette';
import { ISyntaxImageService } from '../../../services/image/ISyntaxImageService';
import type { InteractionMode } from '../../../core/types';
import type { ICanvasController } from '../../../core/interfaces';

import { Loader2, X, RefreshCw } from 'lucide-react';
import MetadataPanel from '../../components/Viewer/MetadataPanel';
import ResizeHandle from '../../components/Viewer/ResizeHandle';
import ViewportOverlay from '../../components/Viewer/ViewportOverlay';
import ImageScrollbar from '../../components/Viewer/ImageScrollbar';
import LayoutSwitcher from '../../components/Viewer/LayoutSwitcher';
import type { LayoutMode } from '../../components/Viewer/LayoutSwitcher';
import { useViewerHotkeys } from '../../hooks/useViewerHotkeys';
import { useStudyLoader } from '../../hooks/useStudyLoader';
import { parseOverlayGroup } from '../../../overlay-engine/OverlayParser';
import type { OverlayGroup } from '../../../overlay-engine/types';
import type { GSPSApplicationResult } from '../../../gsps-engine/types';
import { eventBus } from '../../../rendering/events/EventBus';
import { RenderingEvents } from '../../../rendering/events/RenderingEvents';

export default function ViewerPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routeState = location.state as { studyId: string; stackId: string } | null;

  const studyId = routeState?.studyId || '';
  const stackId = searchParams.get('sid') || routeState?.stackId || '';

  // Study data loading (extracted hook)
  const {
    studyInfo, imageIds, metadataMap, seriesGroups,
    thumbnails, setThumbnails, initImages, setInitImages,
    studyLoading, studyError,
    currentImage, setCurrentImage, progress, setProgress,
    serviceRef, servicesRef,
    gspsResult,
  } = useStudyLoader(studyId, stackId);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSeriesIndex, setSelectedSeriesIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showMetadata, setShowMetadata] = useState(false);
  const [thumbWidth, setThumbWidth] = useState(148);
  const [metaWidth, setMetaWidth] = useState(288);
  const [mode, setMode] = useState<InteractionMode>('pan');
  const [layout, setLayout] = useState<LayoutMode>('1x1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(studyError);
  const [progressVisible, setProgressVisible] = useState(false);

  const controllerRef = useRef<ICanvasController | null>(null);

  // Sync study-level error into local error state
  useEffect(() => {
    if (studyError) setError(studyError);
  }, [studyError]);

  const [overlaysEnabled, setOverlaysEnabled] = useState(true);

  // Track the effective VOI (Window Center/Width) from the image service.
  // Updated when a new image loads or when the WindowLevel tool changes values.
  const effectiveVOI = useMemo(() => {
    if (!currentImage) return undefined;
    const service = serviceRef.current;
    if (!service) return undefined;
    return service.effectiveVOI;
  }, [currentImage]);

  // Derived values — eliminates repeated inline lookups in JSX
  const currentInstanceUID = useMemo(() => {
    if (seriesGroups.length === 0) return '';
    const group = seriesGroups[selectedSeriesIndex];
    return group?.imageIds[selectedImageIndex] ?? '';
  }, [seriesGroups, selectedSeriesIndex, selectedImageIndex]);

  const currentMetadata = useMemo(
    () => (currentInstanceUID ? metadataMap.get(currentInstanceUID) ?? null : null),
    [metadataMap, currentInstanceUID],
  );

  // Parse DICOM 6000 overlay group from metadata (compositing is done in the render pipeline)
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

  // Apply GSPS VOI transform by re-windowing the raw pixel data
  const gspsVOIAppliedRef = useRef(false);
  useEffect(() => {
    const voi = gspsResult?.voiTransform;
    if (!voi || !currentImage) return;
    if (gspsVOIAppliedRef.current) return; // already applied for this study

    const service = serviceRef.current;
    if (!service) return;

    const rewindowed = service.rewindow(voi.windowCenter, voi.windowWidth);
    if (rewindowed) {
      gspsVOIAppliedRef.current = true;
      setCurrentImage(rewindowed);
    }
  }, [gspsResult, currentImage]);

  // Reset GSPS applied flag when switching images
  useEffect(() => {
    gspsVOIAppliedRef.current = false;
  }, [currentInstanceUID]);

  // Listen for WindowLevel tool VOI changes and re-window from raw pixel data.
  // This keeps the MLUT + VOI-LUT pipeline single-pass (matching AWV/cornerstone3D).
  useEffect(() => {
    const handler = (evt: { viewportId: string; windowCenter: number; windowWidth: number }) => {
      const service = serviceRef.current;
      if (!service) return;
      // Skip if values match the currently applied VOI (avoids redundant rewindow
      // from property-sync effects and prevents infinite render loops).
      const currentVOI = service.effectiveVOI;
      if (evt.windowCenter === currentVOI.windowCenter && evt.windowWidth === currentVOI.windowWidth) return;

      const rewindowed = service.rewindow(evt.windowCenter, evt.windowWidth);
      if (rewindowed) {
        setCurrentImage(rewindowed);
      }
    };
    eventBus.on(RenderingEvents.VOI_MODIFIED, handler);
    return () => eventBus.off(RenderingEvents.VOI_MODIFIED, handler);
  }, []);

  // Delay showing progress bar by 300ms to avoid flicker for fast loads
  useEffect(() => {
    if (!progress) {
      setProgressVisible(false);
      return;
    }
    const timer = setTimeout(() => setProgressVisible(true), 300);
    return () => clearTimeout(timer);
  }, [progress]);

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

  const handleThumbnailClick = useCallback(async (seriesIndex: number, imageIndex: number) => {
    if (seriesGroups.length === 0) return;
    const group = seriesGroups[seriesIndex];
    if (!group) return;
    const instanceUID = group.imageIds[imageIndex];
    if (!instanceUID) return;
    let flatIndex = 0;
    for (let s = 0; s < seriesIndex; s++) flatIndex += seriesGroups[s].imageIds.length;
    flatIndex += imageIndex;
    setSelectedSeriesIndex(seriesIndex);
    setSelectedImageIndex(imageIndex);
    setSelectedIndex(flatIndex);
    setError(null);
    setProgress(null);
    const cached = initImages.get(instanceUID);
    if (cached) setCurrentImage(cached.imageData);
    let service = servicesRef.current.get(instanceUID);
    if (!service) {
      service = new ISyntaxImageService(studyId, instanceUID, stackId);
      const meta = metadataMap.get(instanceUID);
      if (meta) service.dicomMetadata = meta;
      servicesRef.current.set(instanceUID, service);
      if (!cached) {
        setLoading(true);
        try {
          const initResult = await service.initImage();
          setCurrentImage(initResult.imageData);
          setThumbnails((prev) => new Map(prev).set(instanceUID, initResult.imageData));
          setInitImages((prev) => new Map(prev).set(instanceUID, initResult));
          setLoading(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load image');
          setLoading(false);
          return;
        }
      }
    }
    serviceRef.current = service;
    if (service.isFullyLoaded && service.cachedResult) {
      setCurrentImage(service.cachedResult.imageData);
      return;
    }
    if (service.totalLevels > 0) {
      try {
        setProgress({ level: 0, total: service.totalLevels });
        const finalResult = await service.loadAllLevels((level, total) => { setProgress({ level, total }); });
        setCurrentImage(finalResult.imageData);
        setProgress(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to enhance image');
        setProgress(null);
        console.error('Progressive load error:', err);
      }
    }
  }, [seriesGroups, studyId, stackId, initImages, metadataMap]);

  const handleThumbResize = useCallback((delta: number) => {
    setThumbWidth(prev => Math.max(140, Math.min(540, prev + delta)));
  }, []);
  const handleMetaResize = useCallback((delta: number) => {
    setMetaWidth(prev => Math.max(200, Math.min(500, prev + delta)));
  }, []);
  const handleControllerReady = (controller: ICanvasController) => { controllerRef.current = controller; };
  const handleReset = () => {
    controllerRef.current?.reset();
  };

  const handleLayoutChange = useCallback((newLayout: LayoutMode, _rows: number, _cols: number) => {
    setLayout(newLayout);
  }, []);

  const handleFlipHorizontal = useCallback(() => {
    controllerRef.current?.flipHorizontal();
  }, []);

  const handleFlipVertical = useCallback(() => {
    controllerRef.current?.flipVertical();
  }, []);

  const handleRotateRight90 = useCallback(() => {
    controllerRef.current?.rotateRight90();
  }, []);

  // --- Image traversal helpers ---
  const currentSeriesImageCount = seriesGroups[selectedSeriesIndex]?.imageIds.length ?? 0;

  const navigateImage = useCallback((targetIndex: number) => {
    if (seriesGroups.length === 0) return;
    const group = seriesGroups[selectedSeriesIndex];
    if (!group) return;
    const clamped = Math.max(0, Math.min(group.imageIds.length - 1, targetIndex));
    if (clamped === selectedImageIndex) return;
    handleThumbnailClick(selectedSeriesIndex, clamped);
  }, [seriesGroups, selectedSeriesIndex, selectedImageIndex, handleThumbnailClick]);

  const handleImageWheel = useCallback((e: React.WheelEvent) => {
    // Only navigate images when NOT in zoom mode (zoom mode uses wheel for zoom)
    if (mode === 'zoom') return;
    if (currentSeriesImageCount <= 1) return;
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 1 : -1;
    navigateImage(selectedImageIndex + delta);
  }, [mode, currentSeriesImageCount, selectedImageIndex, navigateImage]);

  const handleDownloadRaw = useCallback(() => {
    if (!currentImage || imageIds.length === 0) return;
    const instanceUID = imageIds[selectedIndex];
    const { width, height } = currentImage;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(currentImage, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${instanceUID}_${width}x${height}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [currentImage, imageIds, selectedIndex]);

  // --- Keyboard shortcuts ---
  useViewerHotkeys({
    setMode,
    navigateImage,
    selectedImageIndex,
    maxImageIndex: currentSeriesImageCount - 1,
    onReset: handleReset,
    onFlipHorizontal: handleFlipHorizontal,
    onFlipVertical: handleFlipVertical,
    onRotateRight90: handleRotateRight90,
    onToggleMetadata: () => setShowMetadata(prev => !prev),
    onDownload: handleDownloadRaw,
  });

  if (!routeState) {
    return (
      <div className="flex flex-col min-h-screen">
        <TitleBar title="iSyntax Viewer" showBackButton />
        <div className="flex-1 flex items-center justify-center text-gray-400">No study selected. Go back to worklist.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar title="" showBackButton>
        {studyInfo?.patientName && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mr-4 shrink-0">
            <span className="font-medium text-gray-200 truncate max-w-48">{studyInfo.patientName}</span>
            {studyInfo.modality && <><span className="text-gray-600">•</span><span>{studyInfo.modality}</span></>}
          </div>
        )}
        <LayoutSwitcher activeLayout={layout} onLayoutChange={handleLayoutChange} />
        <ToolPalette activeMode={mode} onModeChange={setMode} onReset={handleReset} onFlipHorizontal={handleFlipHorizontal} onFlipVertical={handleFlipVertical} onRotateRight90={handleRotateRight90} onDownload={handleDownloadRaw} canDownload={currentImage !== null} showMetadata={showMetadata} onToggleMetadata={() => setShowMetadata(prev => !prev)} />
      </TitleBar>
      <div className="flex flex-1 overflow-hidden">
        {studyLoading ? (
          <div className="flex items-center justify-center w-37 shrink-0 bg-gray-900/50 border-r border-gray-800">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
        ) : (
          <ThumbnailPanel seriesGroups={seriesGroups} selectedSeriesIndex={selectedSeriesIndex} selectedImageIndex={selectedImageIndex} thumbnails={thumbnails} onSelect={handleThumbnailClick} width={thumbWidth} />
        )}
        <ResizeHandle side="left" onResize={handleThumbResize} />
        <div className="flex-1 flex flex-col relative bg-black">
          {(loading || (progress && progressVisible) || error || studyLoading) && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              {studyLoading && (
                <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <Loader2 size={20} className="animate-spin text-blue-400" />
                  <span className="text-sm text-gray-200">Fetching study metadata...</span>
                </div>
              )}
              {loading && !studyLoading && (
                <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <Loader2 size={20} className="animate-spin text-blue-400" />
                  <span className="text-sm text-gray-200">Loading image...</span>
                </div>
              )}
              {progress && progressVisible && !loading && !studyLoading && (
                <div className="bg-gray-900/80 backdrop-blur-sm px-5 py-3 rounded-lg">
                  <div className="text-xs text-gray-300 mb-1.5">Enhancing image resolution…</div>
                  <div className="w-56 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(progress.level / progress.total) * 100}%` }} />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 text-right tabular-nums">{Math.round((progress.level / progress.total) * 100)}% ({progress.level}/{progress.total})</div>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-3 bg-red-900/80 backdrop-blur-sm px-4 py-2.5 rounded-lg text-red-200 text-sm pointer-events-auto">
                  <span>{error}</span>
                  <button
                    onClick={handleRetryLoad}
                    title="Retry"
                    className="p-1.5 rounded-md hover:bg-red-800 text-red-300 hover:text-red-100 transition-colors"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={() => setError(null)}
                    title="Dismiss"
                    className="p-1.5 rounded-md hover:bg-red-800 text-red-300 hover:text-red-100 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="relative flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 relative" onWheel={handleImageWheel}>
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
                imageIndex={selectedIndex}
                imageCount={imageIds.length}
                imageWidth={currentImage?.width ?? null}
                imageHeight={currentImage?.height ?? null}
              />
            </div>
            {/* Image position scrollbar — right side of viewport */}
            {currentSeriesImageCount > 1 && (
              <ImageScrollbar
                imageIndex={selectedImageIndex}
                imageCount={currentSeriesImageCount}
                onNavigate={navigateImage}
              />
            )}
          </div>
        </div>
        {showMetadata && (
          <>
            <ResizeHandle side="right" onResize={handleMetaResize} />
            <MetadataPanel
              studyInfo={studyInfo}
              metadata={currentMetadata}
              instanceUID={currentInstanceUID}
              onClose={() => setShowMetadata(false)}
              width={metaWidth}
            />
          </>
        )}
      </div>
    </div>
  );
}
