import { useState, useEffect, useRef, useCallback } from 'react';
import { ISyntaxImageService } from '../../services/image/ISyntaxImageService';
import { getStudyInfoAndImageIds, getAllImageMetadata, getSeriesImageGroups, getGSPSData } from '../../services/study/StudyService';
import type { DecodedImage, DicomImageMetadata, StudyInfo, SeriesGroup } from '../../core/types';
import type { GSPSApplicationResult } from '../../gsps-engine/types';
import type { Study } from '../../core/domain/Study';
import { usePACS } from '../context/PACSContext';
import type { ISyntaxPACSAdapter } from '../../adapters/isyntax/ISyntaxPACSAdapter';

export interface StudyLoaderResult {
  studyInfo: StudyInfo | null;
  imageIds: string[];
  metadataMap: Map<string, DicomImageMetadata>;
  seriesGroups: SeriesGroup[];
  thumbnails: Map<string, ImageData>;
  setThumbnails: React.Dispatch<React.SetStateAction<Map<string, ImageData>>>;
  initImages: Map<string, DecodedImage>;
  setInitImages: React.Dispatch<React.SetStateAction<Map<string, DecodedImage>>>;
  studyLoading: boolean;
  studyError: string | null;
  currentImage: ImageData | null;
  setCurrentImage: (img: ImageData | null) => void;
  progress: { level: number; total: number } | null;
  setProgress: (p: { level: number; total: number } | null) => void;
  serviceRef: React.MutableRefObject<ISyntaxImageService | null>;
  servicesRef: React.MutableRefObject<Map<string, ISyntaxImageService>>;
  gspsResult: GSPSApplicationResult | null;
}

export function useStudyLoader(studyId: string, stackId: string): StudyLoaderResult {
  const [studyInfo, setStudyInfo] = useState<StudyInfo | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [studyLoading, setStudyLoading] = useState(true);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [metadataMap, setMetadataMap] = useState<Map<string, DicomImageMetadata>>(new Map());
  const [seriesGroups, setSeriesGroups] = useState<SeriesGroup[]>([]);
  const [thumbnails, setThumbnails] = useState<Map<string, ImageData>>(new Map());
  const [initImages, setInitImages] = useState<Map<string, DecodedImage>>(new Map());
  const [currentImage, setCurrentImage] = useState<ImageData | null>(null);
  const [progress, setProgress] = useState<{ level: number; total: number } | null>(null);
  const [studyDomain, setStudyDomain] = useState<Study | null>(null);

  const serviceRef = useRef<ISyntaxImageService | null>(null);
  const servicesRef = useRef<Map<string, ISyntaxImageService>>(new Map());
  const [gspsResult, setGspsResult] = useState<GSPSApplicationResult | null>(null);
  const { adapter } = usePACS();

  // Fetch study metadata — adapter-first with fallback
  useEffect(() => {
    if (!studyId || !stackId) return;
    let cancelled = false;
    setStudyLoading(true);

    (async () => {
      try {
        // Primary: load via adapter → domain Study model
        const study = await adapter.loadStudy(studyId, stackId);
        if (cancelled) return;
        setStudyDomain(study);

        // Derive legacy StudyInfo + imageIds from domain model for backward compat
        const ids: string[] = [];
        const groups: SeriesGroup[] = [];
        for (const series of study.series) {
          const seriesImageIds = series.instances.map((inst) => inst.uid);
          ids.push(...seriesImageIds);
          groups.push({ seriesUID: series.uid, imageIds: seriesImageIds });
        }
        const info: StudyInfo = {
          patientName: study.patientName,
          patientId: study.patientId,
          modality: study.modality,
          studyInstanceUID: study.uid,
          seriesUIDs: study.series.map((s) => s.uid),
          imageUIDs: ids,
        };
        setStudyInfo(info);
        setImageIds(ids);
        setSeriesGroups(groups);
        setStudyLoading(false);
      } catch {
        // Fallback: direct StudyService calls
        try {
          const { studyInfo: info, imageIds: ids } = await getStudyInfoAndImageIds(studyId, stackId);
          if (cancelled) return;
          setStudyInfo(info);
          setImageIds(ids);
          setStudyLoading(false);
        } catch (err: unknown) {
          if (cancelled) return;
          console.error('Failed to fetch StudyDoc:', err);
          setStudyError(err instanceof Error ? err.message : 'Failed to load study');
          setStudyLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [studyId, stackId, adapter]);

  // Fetch GSPS presentation state data
  useEffect(() => {
    if (!studyId || !stackId) return;
    let cancelled = false;
    getGSPSData(studyId, stackId)
      .then((result) => {
        if (!cancelled) setGspsResult(result);
      })
      .catch((err: unknown) => {
        console.warn('Failed to load GSPS data:', err);
      });
    return () => { cancelled = true; };
  }, [studyId, stackId]);

  // Load all image services, thumbnails and metadata once imageIds are available
  useEffect(() => {
    if (imageIds.length === 0 || !studyId || !stackId) return;
    let cancelled = false;

    getAllImageMetadata(studyId, stackId)
      .then((meta: Map<string, DicomImageMetadata>) => { if (!cancelled) setMetadataMap(meta); })
      .catch((err: unknown) => { console.warn('Failed to fetch metadata, using defaults:', err); });

    // Only fetch series groups if the adapter path didn't already set them
    if (!studyDomain) {
      getSeriesImageGroups(studyId, stackId, imageIds)
        .then((groups: SeriesGroup[]) => { if (!cancelled) setSeriesGroups(groups); })
        .catch((err: unknown) => {
          console.warn('Failed to compute series groups:', err);
          if (!cancelled) setSeriesGroups([{ seriesUID: '_all', imageIds }]);
        });
    }

    imageIds.forEach(async (instanceUID) => {
      try {
        // Use adapter's managed service when available, else create directly
        const isyntaxAdapter = adapter as ISyntaxPACSAdapter;
        const service = typeof isyntaxAdapter.getImageService === 'function'
          ? isyntaxAdapter.getImageService(studyId, instanceUID, stackId)
          : new ISyntaxImageService(studyId, instanceUID, stackId);
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
            service.loadAllLevels((level: number, total: number) => {
              if (!cancelled) setProgress({ level, total });
            }).then((finalResult: DecodedImage) => {
              if (!cancelled) {
                setCurrentImage(finalResult.imageData);
                setProgress(null);
              }
            }).catch((err: unknown) => {
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
  }, [imageIds, studyId, stackId, studyDomain, adapter]);

  // Bind metadata to services and re-render if image was already decoded
  useEffect(() => {
    if (metadataMap.size === 0 || imageIds.length === 0) return;
    servicesRef.current.forEach((service, instanceUID) => {
      const meta = metadataMap.get(instanceUID);
      if (meta) {
        service.dicomMetadata = meta;

        // If this is the currently displayed image and it was already rendered,
        // update the displayed ImageData with the re-rendered version (e.g. MLUT applied).
        if (service === serviceRef.current) {
          const cached = service.cachedResult;
          if (cached?.imageData) {
            setCurrentImage(cached.imageData);
          }
        }
      }
    });
  }, [metadataMap, imageIds]);

  return {
    studyInfo,
    imageIds,
    metadataMap,
    seriesGroups,
    thumbnails,
    setThumbnails,
    initImages,
    setInitImages,
    studyLoading,
    studyError,
    currentImage,
    setCurrentImage,
    progress,
    setProgress,
    serviceRef,
    servicesRef,
    gspsResult,
  };
}
