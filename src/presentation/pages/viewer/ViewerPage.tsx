import { useState, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams, useParams } from 'react-router-dom';
import TitleBar from '../../components/TitleBar/TitleBar';
import ThumbnailPanel from '../../components/Viewer/ThumbnailPanel';
import ToolPalette from '../../components/Viewer/ToolPalette';
import type { InteractionMode } from '../../../core/types';

import { Loader2 } from 'lucide-react';
import MetadataPanel from '../../components/Viewer/MetadataPanel';
import ResizeHandle from '../../components/Viewer/ResizeHandle';
import ViewportGrid from '../../components/Viewer/ViewportGrid';
import LayoutSwitcher from '../../components/Viewer/LayoutSwitcher';
import type { LayoutMode } from '../../components/Viewer/LayoutSwitcher';
import { useViewerHotkeys } from '../../hooks/useViewerHotkeys';
import { useStudyLoader } from '../../hooks/useStudyLoader';

export default function ViewerPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { studyId: paramStudyId } = useParams<{ studyId: string }>();
  const routeState = location.state as { studyId: string; stackId: string } | null;

  // Support both direct URL navigation (/view/:studyId?sid=xxx) and
  // programmatic navigation with location state (like OHIF Viewers)
  const studyId = paramStudyId || routeState?.studyId || '';
  const stackId = searchParams.get('sid') || routeState?.stackId || '';

  // Study data loading (extracted hook)
  const {
    studyInfo, metadataMap, seriesGroups,
    thumbnails, setThumbnails, initImages, setInitImages,
    studyLoading,
    servicesRef,
    gspsResult,
  } = useStudyLoader(studyId, stackId);

  const [selectedSeriesIndex, setSelectedSeriesIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showMetadata, setShowMetadata] = useState(false);
  const [thumbWidth, setThumbWidth] = useState(148);
  const [metaWidth, setMetaWidth] = useState(288);
  const [mode, setMode] = useState<InteractionMode>('pan');
  const [layout, setLayout] = useState<LayoutMode>('1x1');

  const [overlaysEnabled] = useState(true);

  // Derived values for metadata panel
  const currentInstanceUID = useMemo(() => {
    if (seriesGroups.length === 0) return '';
    const group = seriesGroups[selectedSeriesIndex];
    return group?.imageIds[selectedImageIndex] ?? '';
  }, [seriesGroups, selectedSeriesIndex, selectedImageIndex]);

  const currentMetadata = useMemo(
    () => (currentInstanceUID ? metadataMap.get(currentInstanceUID) ?? null : null),
    [metadataMap, currentInstanceUID],
  );

  const handleThumbnailClick = useCallback((seriesIndex: number, imageIndex: number) => {
    setSelectedSeriesIndex(seriesIndex);
    setSelectedImageIndex(imageIndex);
  }, []);

  const handleThumbResize = useCallback((delta: number) => {
    setThumbWidth(prev => Math.max(140, Math.min(540, prev + delta)));
  }, []);
  const handleMetaResize = useCallback((delta: number) => {
    setMetaWidth(prev => Math.max(200, Math.min(500, prev + delta)));
  }, []);
  const handleReset = useCallback(() => {
    // Reset is a no-op at page level now; each cell manages its own controller
  }, []);

  const handleLayoutChange = useCallback((newLayout: LayoutMode, _rows: number, _cols: number) => {
    setLayout(newLayout);
  }, []);

  const handleFlipHorizontal = useCallback(() => {}, []);
  const handleFlipVertical = useCallback(() => {}, []);
  const handleRotateRight90 = useCallback(() => {}, []);

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

  const handleDownloadRaw = useCallback(() => {
    // Download is a no-op at page level now; could be wired per-cell in the future
  }, []);

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

  if (!studyId || !stackId) {
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
        <ToolPalette activeMode={mode} onModeChange={setMode} onReset={handleReset} onFlipHorizontal={handleFlipHorizontal} onFlipVertical={handleFlipVertical} onRotateRight90={handleRotateRight90} onDownload={handleDownloadRaw} canDownload={true} showMetadata={showMetadata} onToggleMetadata={() => setShowMetadata(prev => !prev)} />
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
          {studyLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
                <Loader2 size={20} className="animate-spin text-blue-400" />
                <span className="text-sm text-gray-200">Fetching study metadata...</span>
              </div>
            </div>
          )}
          <ViewportGrid
            layout={layout}
            mode={mode}
            overlaysEnabled={overlaysEnabled}
            studyId={studyId}
            stackId={stackId}
            studyInfo={studyInfo}
            seriesGroups={seriesGroups}
            metadataMap={metadataMap}
            thumbnails={thumbnails}
            initImages={initImages}
            servicesRef={servicesRef}
            gspsResult={gspsResult}
            onThumbnailsUpdate={setThumbnails}
            onInitImagesUpdate={setInitImages}
            selectedSeriesIndex={selectedSeriesIndex}
            selectedImageIndex={selectedImageIndex}
          />
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
