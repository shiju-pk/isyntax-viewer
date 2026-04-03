import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import TitleBar from '../../components/TitleBar/TitleBar';
import ThumbnailPanel from '../../components/Viewer/ThumbnailPanel';
import MainImage from '../../components/Viewer/MainImage';
import ToolPalette from '../../components/Viewer/ToolPalette';
import { ISyntaxImageService } from '../../../services/image/ISyntaxImageService';
import type { DecodedImage, InteractionMode, DicomImageMetadata, StudyInfo, SeriesGroup } from '../../../core/types';
import type { ICanvasController } from '../../../core/interfaces';
import { getStudyInfoAndImageIds, getAllImageMetadata, getSeriesImageGroups } from '../../../services/study/StudyService';

import { Loader2, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react';
import MetadataPanel from '../../components/Viewer/MetadataPanel';
import ResizeHandle from '../../components/Viewer/ResizeHandle';
import ViewportOverlay from '../../components/Viewer/ViewportOverlay';

export default function ViewerPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routeState = location.state as { studyId: string; stackId: string } | null;

  const [studyId] = useState<string>(routeState?.studyId || '');
  const [stackId] = useState<string>(searchParams.get('sid') || routeState?.stackId || '');
  const [studyInfo, setStudyInfo] = useState<StudyInfo | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [studyLoading, setStudyLoading] = useState(true);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSeriesIndex, setSelectedSeriesIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState<ImageData | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<string, ImageData>>(new Map());
  const [initImages, setInitImages] = useState<Map<string, DecodedImage>>(new Map());
  const [seriesGroups, setSeriesGroups] = useState<SeriesGroup[]>([]);
  const [showMetadata, setShowMetadata] = useState(false);
  const [thumbWidth, setThumbWidth] = useState(148);
  const [metaWidth, setMetaWidth] = useState(288);
  const [mode, setMode] = useState<InteractionMode>('pan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ level: number; total: number } | null>(null);

  const [metadataMap, setMetadataMap] = useState<Map<string, DicomImageMetadata>>(new Map());

  const controllerRef = useRef<ICanvasController | null>(null);
  const serviceRef = useRef<ISyntaxImageService | null>(null);
  const servicesRef = useRef<Map<string, ISyntaxImageService>>(new Map());

  useEffect(() => {
    if (!studyId || !stackId) return;
    let cancelled = false;
    setStudyLoading(true);
    getStudyInfoAndImageIds(studyId, stackId)
      .then(({ studyInfo: info, imageIds: ids }) => {
        if (cancelled) return;
        setStudyInfo(info);
        setImageIds(ids);
        setStudyLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to fetch StudyDoc:', err);
        setError(err instanceof Error ? err.message : 'Failed to load study');
        setStudyLoading(false);
      });
    return () => { cancelled = true; };
  }, [studyId, stackId]);

  useEffect(() => {
    if (imageIds.length === 0 || !studyId || !stackId) return;
    let cancelled = false;
    getAllImageMetadata(studyId, stackId)
      .then((meta) => { if (!cancelled) setMetadataMap(meta); })
      .catch((err) => { console.warn('Failed to fetch metadata, using defaults:', err); });
    getSeriesImageGroups(studyId, stackId, imageIds)
      .then((groups) => { if (!cancelled) setSeriesGroups(groups); })
      .catch((err) => {
        console.warn('Failed to compute series groups:', err);
        if (!cancelled) setSeriesGroups([{ seriesUID: '_all', imageIds }]);
      });
    imageIds.forEach(async (instanceUID) => {
      try {
        const service = new ISyntaxImageService(studyId, instanceUID, stackId);
        servicesRef.current.set(instanceUID, service);
        const initResult = await service.initImage();
        if (cancelled) return;
        setThumbnails((prev) => new Map(prev).set(instanceUID, initResult.imageData));
        setInitImages((prev) => new Map(prev).set(instanceUID, initResult));
        if (instanceUID === imageIds[0]) {
          serviceRef.current = service;
          setCurrentImage(initResult.imageData);

          // Auto-start progressive loading for the first image
          if (service.totalLevels > 0 && !service.isFullyLoaded) {
            setProgress({ level: 0, total: service.totalLevels });
            service.loadAllLevels((level, total) => {
              if (!cancelled) setProgress({ level, total });
            }).then((finalResult) => {
              if (!cancelled) {
                setCurrentImage(finalResult.imageData);
                setProgress(null);
              }
            }).catch((err) => {
              if (!cancelled) {
                setProgress(null);
                console.error('Progressive load error for first image:', err);
              }
            });
          }
        }
      } catch (err) {
        console.error(`Failed to load InitImage for ${instanceUID}:`, err);
      }
    });
    return () => {
      cancelled = true;
      servicesRef.current.forEach((s) => s.dispose());
      servicesRef.current.clear();
    };
  }, [imageIds, studyId, stackId]);

  useEffect(() => {
    if (metadataMap.size === 0 || imageIds.length === 0) return;
    servicesRef.current.forEach((service, instanceUID) => {
      const meta = metadataMap.get(instanceUID);
      if (meta) service.dicomMetadata = meta;
    });
  }, [metadataMap, imageIds]);

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

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    navigateImage(Number(e.target.value));
  }, [navigateImage]);

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
          {(loading || progress || error || studyLoading) && (
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
              {progress && !loading && !studyLoading && (
                <div className="bg-gray-900/80 backdrop-blur-sm px-5 py-3 rounded-lg">
                  <div className="text-xs text-gray-300 mb-1.5">Enhancing image resolution…</div>
                  <div className="w-56 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(progress.level / progress.total) * 100}%` }} />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 text-right tabular-nums">{Math.round((progress.level / progress.total) * 100)}% ({progress.level}/{progress.total})</div>
                </div>
              )}
              {error && (
                <div className="bg-red-900/80 backdrop-blur-sm px-4 py-2 rounded-lg text-red-200 text-sm pointer-events-auto">{error}</div>
              )}
            </div>
          )}
          <div className="relative flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 relative" onWheel={handleImageWheel}>
              <MainImage
                imageData={currentImage}
                mode={mode}
                imageId={(() => {
                  if (seriesGroups.length === 0) return undefined;
                  const group = seriesGroups[selectedSeriesIndex];
                  return group?.imageIds[selectedImageIndex];
                })()}
                onControllerReady={handleControllerReady}
              />
              <ViewportOverlay
                metadata={(() => {
                  if (seriesGroups.length === 0) return null;
                  const group = seriesGroups[selectedSeriesIndex];
                  if (!group) return null;
                  const uid = group.imageIds[selectedImageIndex];
                  return uid ? metadataMap.get(uid) ?? null : null;
                })()}
                studyInfo={studyInfo}
                imageIndex={selectedIndex}
                imageCount={imageIds.length}
                imageWidth={currentImage?.width ?? null}
                imageHeight={currentImage?.height ?? null}
              />
            </div>
            {/* Image position scrollbar — right side of viewport */}
            {currentSeriesImageCount > 1 && (
              <div className="flex flex-col items-center w-8 shrink-0 bg-gray-900/60 border-l border-gray-700/50 select-none py-1 gap-0.5">
                <button
                  onClick={() => navigateImage(0)}
                  disabled={selectedImageIndex === 0}
                  title="First image"
                  aria-label="First image"
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronsUp size={14} />
                </button>
                <button
                  onClick={() => navigateImage(selectedImageIndex - 1)}
                  disabled={selectedImageIndex === 0}
                  title="Previous image"
                  aria-label="Previous image"
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronUp size={14} />
                </button>
                <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full px-0.5">
                  <input
                    type="range"
                    min={0}
                    max={currentSeriesImageCount - 1}
                    value={selectedImageIndex}
                    onChange={handleSliderChange}
                    title={`Image ${selectedImageIndex + 1} / ${currentSeriesImageCount}`}
                    aria-label={`Image ${selectedImageIndex + 1} of ${currentSeriesImageCount}`}
                    style={{
                      writingMode: 'vertical-lr',
                      height: '100%',
                      width: '18px',
                      accentColor: '#3b82f6',
                      cursor: 'pointer',
                    }}
                  />
                </div>
                <button
                  onClick={() => navigateImage(selectedImageIndex + 1)}
                  disabled={selectedImageIndex >= currentSeriesImageCount - 1}
                  title="Next image"
                  aria-label="Next image"
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => navigateImage(currentSeriesImageCount - 1)}
                  disabled={selectedImageIndex >= currentSeriesImageCount - 1}
                  title="Last image"
                  aria-label="Last image"
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronsDown size={14} />
                </button>
                <span className="text-[11px] text-gray-500 tabular-nums leading-none mt-0.5">
                  {selectedImageIndex + 1}/{currentSeriesImageCount}
                </span>
              </div>
            )}
          </div>
        </div>
        {showMetadata && (
          <>
            <ResizeHandle side="right" onResize={handleMetaResize} />
            <MetadataPanel
              studyInfo={studyInfo}
              metadata={(() => {
                if (seriesGroups.length === 0) return null;
                const group = seriesGroups[selectedSeriesIndex];
                if (!group) return null;
                const uid = group.imageIds[selectedImageIndex];
                return uid ? metadataMap.get(uid) ?? null : null;
              })()}
              instanceUID={(() => {
                if (seriesGroups.length === 0) return '';
                const group = seriesGroups[selectedSeriesIndex];
                if (!group) return '';
                return group.imageIds[selectedImageIndex] || '';
              })()}
              onClose={() => setShowMetadata(false)}
              width={metaWidth}
            />
          </>
        )}
      </div>
    </div>
  );
}
