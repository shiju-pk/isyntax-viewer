import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import TitleBar from '../TitleBar/TitleBar';
import ThumbnailPanel from './ThumbnailPanel';
import MainImage from './MainImage';
import ToolPalette from './ToolPalette';
import { ISyntaxImageService, type DecodedImage } from '../../lib/isyntaxImageLoader';
import type { InteractionMode, CanvasController } from '../../lib/canvasRenderer';
import { getStudyInfoAndImageIds, getAllImageMetadata } from '../../lib/studyDocService';
import type { DicomImageMetadata, StudyInfo } from '../../lib/dicomMetadata';
import { Loader2 } from 'lucide-react';

export default function ViewerPage() {
  const location = useLocation();
  const routeState = location.state as { studyId: string; stackId: string } | null;

  const [studyId, setStudyId] = useState<string>(routeState?.studyId || '');
  const [stackId, setStackId] = useState<string>(routeState?.stackId || '');
  const [studyInfo, setStudyInfo] = useState<StudyInfo | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [studyLoading, setStudyLoading] = useState(true);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState<ImageData | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<number, ImageData>>(new Map());
  const [initImages, setInitImages] = useState<Map<number, DecodedImage>>(new Map());
  const [mode, setMode] = useState<InteractionMode>('pan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ level: number; total: number } | null>(null);

  const [metadataMap, setMetadataMap] = useState<Map<string, DicomImageMetadata>>(new Map());

  const controllerRef = useRef<CanvasController | null>(null);
  const serviceRef = useRef<ISyntaxImageService | null>(null);
  const servicesRef = useRef<Map<number, ISyntaxImageService>>(new Map());

  // Phase 1: Fetch StudyDoc to get imageIds and study info
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

  // Phase 2: Once imageIds are available, fetch metadata and init images
  useEffect(() => {
    if (imageIds.length === 0 || !studyId || !stackId) return;
    let cancelled = false;

    // Fetch DICOM metadata (non-blocking, already cached from phase 1)
    getAllImageMetadata(studyId, stackId)
      .then((meta) => {
        if (!cancelled) setMetadataMap(meta);
      })
      .catch((err) => {
        console.warn('Failed to fetch metadata, using defaults:', err);
      });

    // Fire InitImage for all imageIds to populate thumbnails
    imageIds.forEach(async (instanceUID, index) => {
      try {
        const service = new ISyntaxImageService(studyId, instanceUID, stackId);
        servicesRef.current.set(index, service);

        const initResult = await service.initImage();
        if (cancelled) return;

        setThumbnails((prev) => new Map(prev).set(index, initResult.imageData));
        setInitImages((prev) => new Map(prev).set(index, initResult));

        // Auto-select first image into main viewport
        if (index === 0) {
          serviceRef.current = service;
          setCurrentImage(initResult.imageData);
        }
      } catch (err) {
        console.error(`Failed to load InitImage for index ${index}:`, err);
      }
    });

    return () => {
      cancelled = true;
      servicesRef.current.forEach((s) => s.dispose());
      servicesRef.current.clear();
    };
  }, [imageIds, studyId, stackId]);

  // When metadata arrives, attach it to all existing services
  useEffect(() => {
    if (metadataMap.size === 0 || imageIds.length === 0) return;
    servicesRef.current.forEach((service, index) => {
      const instanceUID = imageIds[index];
      const meta = metadataMap.get(instanceUID);
      if (meta) {
        service.dicomMetadata = meta;
      }
    });
  }, [metadataMap, imageIds]);

  // On thumbnail click: show init image immediately, then progressively load coefficients
  const handleThumbnailClick = useCallback(async (index: number) => {
    if (imageIds.length === 0) return;
    setSelectedIndex(index);
    setError(null);
    setProgress(null);

    // Show the cached init image immediately in main viewport
    const cached = initImages.get(index);
    if (cached) {
      setCurrentImage(cached.imageData);
    }

    // Get or create the service for this image
    let service = servicesRef.current.get(index);
    if (!service) {
      const instanceUID = imageIds[index];
      service = new ISyntaxImageService(studyId, instanceUID, stackId);
      // Attach DICOM metadata if available
      const meta = metadataMap.get(instanceUID);
      if (meta) service.dicomMetadata = meta;
      servicesRef.current.set(index, service);

      // If we don't have an init image yet, fetch it first
      if (!cached) {
        setLoading(true);
        try {
          const initResult = await service.initImage();
          setCurrentImage(initResult.imageData);
          setThumbnails((prev) => new Map(prev).set(index, initResult.imageData));
          setInitImages((prev) => new Map(prev).set(index, initResult));
          setLoading(false);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to load image';
          setError(msg);
          setLoading(false);
          return;
        }
      }
    }

    serviceRef.current = service;

    // If already fully loaded, show cached result and skip progressive loading
    if (service.isFullyLoaded && service.cachedResult) {
      setCurrentImage(service.cachedResult.imageData);
      return;
    }

    // Progressive loading: fetch coefficient levels highest → lowest
    if (service.totalLevels > 0) {
      try {
        setProgress({ level: 0, total: service.totalLevels });
        const finalResult = await service.loadAllLevels((level, total) => {
          setProgress({ level, total });
        });
        setCurrentImage(finalResult.imageData);
        setProgress(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to enhance image';
        setError(msg);
        setProgress(null);
        console.error('Progressive load error:', err);
      }
    }
  }, [imageIds, studyId, stackId, initImages, metadataMap]);

  const handleControllerReady = (controller: CanvasController) => {
    controllerRef.current = controller;
  };

  const handleReset = () => {
    controllerRef.current?.reset();
  };

  const handleDownloadRaw = useCallback(() => {
    if (!currentImage || imageIds.length === 0) return;

    const instanceUID = imageIds[selectedIndex];
    const { width, height, data } = currentImage;

    // Build raw file: 16-byte header + RGBA pixel data
    // Header: width(4) + height(4) + channels(4) + reserved(4)
    const header = new ArrayBuffer(16);
    const headerView = new DataView(header);
    headerView.setUint32(0, width, true);
    headerView.setUint32(4, height, true);
    headerView.setUint32(8, 4, true); // RGBA channels
    headerView.setUint32(12, 0, true); // reserved

    const blob = new Blob([header, data.buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${instanceUID}_${width}x${height}.raw`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentImage, imageIds, selectedIndex]);

  if (!routeState) {
    return (
      <div className="flex flex-col min-h-screen">
        <TitleBar title="iSyntax Viewer" showBackButton />
        <div className="flex-1 flex items-center justify-center text-gray-400">
          No study selected. Go back to worklist.
        </div>
      </div>
    );
  }

  const titleName = studyInfo?.patientName || 'Loading...';

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar title={`${titleName} — ${studyId}`} showBackButton />

      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnail Panel */}
        {studyLoading ? (
          <div className="flex items-center justify-center w-37 shrink-0 bg-gray-900/50 border-r border-gray-800">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
        ) : (
          <ThumbnailPanel
            imageIds={imageIds}
            selectedIndex={selectedIndex}
            thumbnails={thumbnails}
            onThumbnailClick={handleThumbnailClick}
          />
        )}

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col relative bg-black">
          {/* Tool Palette */}
          <div className="absolute top-3 right-3 z-10">
            <ToolPalette
              activeMode={mode}
              onModeChange={setMode}
              onReset={handleReset}
              onDownload={handleDownloadRaw}
              canDownload={currentImage !== null}
            />
          </div>

          {/* Status Overlay */}
          {(loading || progress || error || studyLoading) && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              {studyLoading && (
                <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <Loader2 size={18} className="animate-spin text-blue-400" />
                  <span className="text-sm text-gray-200">Fetching study metadata...</span>
                </div>
              )}
              {loading && !studyLoading && (
                <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <Loader2 size={18} className="animate-spin text-blue-400" />
                  <span className="text-sm text-gray-200">Loading image...</span>
                </div>
              )}
              {progress && !loading && !studyLoading && (
                <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">
                    Enhancing: level {progress.level}/{progress.total}
                  </div>
                  <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.level / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {error && (
                <div className="bg-red-900/80 backdrop-blur-sm px-4 py-2 rounded-lg text-red-200 text-sm pointer-events-auto">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Canvas */}
          <MainImage
            imageData={currentImage}
            mode={mode}
            onControllerReady={handleControllerReady}
          />

          {/* Info Bar */}
          <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gray-900/70 backdrop-blur-sm text-xs text-gray-400 flex gap-4 flex-wrap">
            <span>Image: {selectedIndex + 1}/{imageIds.length}</span>
            {currentImage && <span>{currentImage.width} × {currentImage.height}</span>}
            {serviceRef.current?.isInitialized && (
              <span>Level: {serviceRef.current.currentLevel}</span>
            )}
            {(() => {
              const meta = serviceRef.current?.dicomMetadata;
              if (!meta) return null;
              return (
                <>
                  {meta.windowWidth != null && meta.windowCenter != null && (
                    <span>W/L: {meta.windowWidth}/{meta.windowCenter}</span>
                  )}
                  {meta.rescaleSlope !== 1 || meta.rescaleIntercept !== 0 ? (
                    <span>RS: {meta.rescaleSlope} RI: {meta.rescaleIntercept}</span>
                  ) : null}
                  {meta.pixelSpacing && (
                    <span>PS: {meta.pixelSpacing[0].toFixed(3)}×{meta.pixelSpacing[1].toFixed(3)}</span>
                  )}
                  <span>{meta.photometricInterpretation}</span>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
