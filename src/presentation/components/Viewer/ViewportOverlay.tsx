import { useState, useEffect, useMemo } from 'react';
import { eventBus, RenderingEvents } from '../../../rendering';
import type { DicomImageMetadata, StudyInfo } from '../../../core/types';
import { getOrientationLabels, type OrientationLabels } from '../../../dicom/orientation';

interface ViewportOverlayProps {
  metadata: DicomImageMetadata | null;
  studyInfo: StudyInfo | null;
  imageIndex: number;
  imageCount: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

export default function ViewportOverlay({
  metadata,
  studyInfo,
  imageIndex,
  imageCount,
  imageWidth,
  imageHeight,
}: ViewportOverlayProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [windowCenter, setWindowCenter] = useState<number | undefined>(undefined);

  // Seed W/L from metadata when it changes
  useEffect(() => {
    setWindowWidth(metadata?.windowWidth);
    setWindowCenter(metadata?.windowCenter);
  }, [metadata]);

  // Listen to live camera and VOI events
  useEffect(() => {
    const onCamera = (detail: { camera: { zoom: number; rotation: number; flipH: boolean; flipV: boolean } }) => {
      setZoom(detail.camera.zoom);
      setRotation(detail.camera.rotation);
      setFlipH(detail.camera.flipH);
      setFlipV(detail.camera.flipV);
    };
    const onVOI = (detail: { windowCenter: number; windowWidth: number }) => {
      setWindowCenter(detail.windowCenter);
      setWindowWidth(detail.windowWidth);
    };

    eventBus.on(RenderingEvents.CAMERA_MODIFIED, onCamera);
    eventBus.on(RenderingEvents.VOI_MODIFIED, onVOI);
    return () => {
      eventBus.off(RenderingEvents.CAMERA_MODIFIED, onCamera);
      eventBus.off(RenderingEvents.VOI_MODIFIED, onVOI);
    };
  }, []);

  const patientName = studyInfo?.patientName ?? '';
  const patientId = studyInfo?.patientId ?? '';
  const modality = metadata?.modality ?? studyInfo?.modality ?? '';

  // Use IOP from metadata, or fall back to standard axial orientation for
  // radiology modalities that commonly imply it (CT, MR, CR, DX, etc.)
  const AXIAL_DEFAULT = [1, 0, 0, 0, 1, 0];
  const RADIOLOGY_MODALITIES = new Set([
    'CT', 'MR', 'CR', 'DX', 'MG', 'XA', 'RF', 'PT', 'NM', 'US',
  ]);
  const iop =
    metadata?.imageOrientationPatient ??
    (modality && RADIOLOGY_MODALITIES.has(modality) ? AXIAL_DEFAULT : undefined);
  const baseLabels = getOrientationLabels(iop);

  // Transform orientation labels to reflect camera rotation and flips
  const orientationLabels = useMemo((): OrientationLabels => {
    if (!baseLabels.top && !baseLabels.bottom && !baseLabels.left && !baseLabels.right) {
      return baseLabels;
    }

    // Start with [top, right, bottom, left]
    let labels = [baseLabels.top, baseLabels.right, baseLabels.bottom, baseLabels.left];

    // Apply flips (swap opposing labels)
    if (flipH) {
      [labels[1], labels[3]] = [labels[3], labels[1]]; // swap left <-> right
    }
    if (flipV) {
      [labels[0], labels[2]] = [labels[2], labels[0]]; // swap top <-> bottom
    }

    // Apply rotation: each 90° CW shifts labels clockwise around the ring
    const normRotation = ((rotation % 360) + 360) % 360;
    const steps = Math.round(normRotation / 90) % 4;
    for (let i = 0; i < steps; i++) {
      labels = [labels[3], labels[0], labels[1], labels[2]];
    }

    return { top: labels[0], right: labels[1], bottom: labels[2], left: labels[3] };
  }, [baseLabels, rotation, flipH, flipV]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 text-[11px] font-mono text-gray-300/90 leading-snug select-none">
      {/* Top-Left: Patient info */}
      <div className="absolute top-2 left-3 flex flex-col gap-0.5">
        {patientName && <span className="text-white/90 text-xs font-semibold">{patientName}</span>}
        {patientId && <span>ID: {patientId}</span>}
        {modality && <span>{modality}</span>}
        {metadata?.seriesUID && (
          <span className="text-gray-500 text-[10px] truncate max-w-48">
            Se: {metadata.seriesUID.split('.').pop()}
          </span>
        )}
      </div>

      {/* Top-Right: Image info */}
      <div className="absolute top-2 right-3 flex flex-col gap-0.5 items-end">
        <span>Im: {imageIndex + 1}/{imageCount}</span>
        {imageWidth != null && imageHeight != null && (
          <span>{imageWidth} &times; {imageHeight}</span>
        )}
        {metadata?.bitsStored != null && (
          <span>{metadata.bitsStored}-bit</span>
        )}
        {metadata?.photometricInterpretation && (
          <span>{metadata.photometricInterpretation}</span>
        )}
      </div>

      {/* Bottom-Left: W/L, Zoom */}
      <div className="absolute bottom-2 left-3 flex flex-col gap-0.5">
        {windowWidth != null && windowCenter != null && (
          <span>
            WW: {Math.round(windowWidth)} WL: {Math.round(windowCenter)}
          </span>
        )}
        <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        {metadata?.pixelSpacing && (
          <span>
            PS: {metadata.pixelSpacing[0].toFixed(3)} &times; {metadata.pixelSpacing[1].toFixed(3)} mm
          </span>
        )}
        {(metadata?.rescaleSlope !== undefined && metadata.rescaleSlope !== 1) ||
        (metadata?.rescaleIntercept !== undefined && metadata.rescaleIntercept !== 0)
          ? (
            <span>
              S: {metadata!.rescaleSlope} I: {metadata!.rescaleIntercept}
            </span>
          )
          : null}
      </div>

      {/* Bottom-Right: Compression / format info */}
      <div className="absolute bottom-2 right-3 flex flex-col gap-0.5 items-end">
        {metadata?.iSyntaxPartitionDimension != null && (
          <span>iSyntax Dim: {metadata.iSyntaxPartitionDimension}</span>
        )}
      </div>

      {/* Orientation markers at viewport edges */}
      {orientationLabels.top && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-yellow-400/80 text-xl font-bold">
          {orientationLabels.top}
        </div>
      )}
      {orientationLabels.bottom && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-yellow-400/80 text-xl font-bold">
          {orientationLabels.bottom}
        </div>
      )}
      {orientationLabels.left && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-yellow-400/80 text-xl font-bold">
          {orientationLabels.left}
        </div>
      )}
      {orientationLabels.right && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-400/80 text-xl font-bold">
          {orientationLabels.right}
        </div>
      )}
    </div>
  );
}
