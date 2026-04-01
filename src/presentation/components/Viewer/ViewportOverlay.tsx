import { useState, useEffect } from 'react';
import { eventBus, RenderingEvents } from '../../../rendering';
import type { DicomImageMetadata, StudyInfo } from '../../../core/types';

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
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [windowCenter, setWindowCenter] = useState<number | undefined>(undefined);

  // Seed W/L from metadata when it changes
  useEffect(() => {
    setWindowWidth(metadata?.windowWidth);
    setWindowCenter(metadata?.windowCenter);
  }, [metadata]);

  // Listen to live camera and VOI events
  useEffect(() => {
    const onCamera = (detail: { camera: { zoom: number } }) => {
      setZoom(detail.camera.zoom);
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
  const orientationLabels = getOrientationLabels(metadata?.imageOrientationPatient);

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
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-yellow-400/80 text-xs font-bold">
          {orientationLabels.top}
        </div>
      )}
      {orientationLabels.bottom && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-yellow-400/80 text-xs font-bold">
          {orientationLabels.bottom}
        </div>
      )}
      {orientationLabels.left && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-yellow-400/80 text-xs font-bold">
          {orientationLabels.left}
        </div>
      )}
      {orientationLabels.right && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-400/80 text-xs font-bold">
          {orientationLabels.right}
        </div>
      )}
    </div>
  );
}

interface OrientationLabels {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

function getOrientationLabels(
  imageOrientationPatient?: number[]
): OrientationLabels {
  const empty: OrientationLabels = { top: '', bottom: '', left: '', right: '' };
  if (!imageOrientationPatient || imageOrientationPatient.length < 6) return empty;

  const rowDir = imageOrientationPatient.slice(0, 3);
  const colDir = imageOrientationPatient.slice(3, 6);

  const left = majorAxisLabel(rowDir);
  const top = majorAxisLabel(colDir);

  if (!left || !top) return empty;

  return {
    left,
    right: oppositeLabel(left),
    top,
    bottom: oppositeLabel(top),
  };
}

function majorAxisLabel(direction: number[]): string {
  const absX = Math.abs(direction[0]);
  const absY = Math.abs(direction[1]);
  const absZ = Math.abs(direction[2]);

  const threshold = 0.5;

  if (absX > absY && absX > absZ && absX > threshold) {
    return direction[0] > 0 ? 'L' : 'R';
  }
  if (absY > absX && absY > absZ && absY > threshold) {
    return direction[1] > 0 ? 'P' : 'A';
  }
  if (absZ > absX && absZ > absY && absZ > threshold) {
    return direction[2] > 0 ? 'S' : 'I';
  }
  return '';
}

function oppositeLabel(label: string): string {
  const map: Record<string, string> = {
    L: 'R', R: 'L',
    A: 'P', P: 'A',
    S: 'I', I: 'S',
  };
  return map[label] ?? '';
}
