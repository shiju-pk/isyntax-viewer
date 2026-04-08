import { useState, useEffect, useMemo, useCallback } from 'react';
import { Ruler, Triangle, Circle, Square, X } from 'lucide-react';
import { annotationManager, AnnotationEvents } from '../../../tools/stateManagement/AnnotationManager';
import { eventBus } from '../../../rendering/events/EventBus';
import type { Annotation } from '../../../tools/base/types';

interface MeasurementStatsPanelProps {
  imageId: string | undefined;
  pixelSpacing?: [number, number];
  onClose: () => void;
  width?: number;
}

const TOOL_ICONS: Record<string, typeof Ruler> = {
  Length: Ruler,
  Angle: Triangle,
  EllipticalROI: Circle,
  RectangleROI: Square,
  Circle: Circle,
};

function formatMeasurement(ann: Annotation, pixelSpacing?: [number, number]): string {
  const stats = ann.data.cachedStats;
  if (!stats) return '—';

  const length = stats['length'] as number | undefined;
  const angle = stats['angle'] as number | undefined;
  const area = stats['area'] as number | undefined;
  const mean = stats['mean'] as number | undefined;
  const stdDev = stats['stdDev'] as number | undefined;

  const parts: string[] = [];

  if (length != null) {
    const hasCal = pixelSpacing && pixelSpacing[0] > 0;
    const value = hasCal ? length * pixelSpacing![0] : length;
    const unit = hasCal ? 'mm' : 'px';
    parts.push(`${value.toFixed(2)} ${unit}`);
  }

  if (angle != null) {
    parts.push(`${angle.toFixed(1)}°`);
  }

  if (area != null) {
    const hasCal = pixelSpacing && pixelSpacing[0] > 0;
    const value = hasCal ? area * pixelSpacing![0] * pixelSpacing![1] : area;
    const unit = hasCal ? 'mm²' : 'px²';
    parts.push(`Area: ${value.toFixed(2)} ${unit}`);
  }

  if (mean != null) {
    parts.push(`Mean: ${mean.toFixed(1)}`);
  }

  if (stdDev != null) {
    parts.push(`SD: ${stdDev.toFixed(1)}`);
  }

  return parts.length > 0 ? parts.join(' | ') : '—';
}

export default function MeasurementStatsPanel({
  imageId,
  pixelSpacing,
  onClose,
  width = 280,
}: MeasurementStatsPanelProps) {
  const [version, setVersion] = useState(0);

  // Re-render when annotations change
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    eventBus_on(AnnotationEvents.ANNOTATION_ADDED, bump);
    eventBus_on(AnnotationEvents.ANNOTATION_MODIFIED, bump);
    eventBus_on(AnnotationEvents.ANNOTATION_COMPLETED, bump);
    eventBus_on(AnnotationEvents.ANNOTATION_REMOVED, bump);
    return () => {
      eventBus_off(AnnotationEvents.ANNOTATION_ADDED, bump);
      eventBus_off(AnnotationEvents.ANNOTATION_MODIFIED, bump);
      eventBus_off(AnnotationEvents.ANNOTATION_COMPLETED, bump);
      eventBus_off(AnnotationEvents.ANNOTATION_REMOVED, bump);
    };
  }, []);

  const annotations = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version; // dependency to trigger recompute
    if (!imageId) return [];
    return annotationManager.getAllAnnotationsForImage(imageId).filter((a) => a.isVisible);
  }, [imageId, version]);

  const measurementAnnotations = annotations.filter((a) => {
    const tool = a.metadata.toolName;
    return ['Length', 'Angle', 'EllipticalROI', 'RectangleROI', 'Circle', 'Probe'].includes(tool);
  });

  return (
    <div
      className="flex flex-col bg-gray-900 border-l border-gray-800 overflow-hidden"
      style={{ width }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Measurements
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {measurementAnnotations.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">
            No measurements on this image.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {measurementAnnotations.map((ann) => {
              const Icon = TOOL_ICONS[ann.metadata.toolName] ?? Ruler;
              return (
                <div
                  key={ann.annotationUID}
                  className={`flex items-start gap-2 px-2.5 py-2 rounded-md text-xs transition-colors ${
                    ann.highlighted
                      ? 'bg-blue-900/30 border border-blue-700/50'
                      : 'bg-gray-800/40 border border-transparent hover:bg-gray-800/60'
                  }`}
                >
                  <Icon size={14} className="text-green-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-400 font-medium">
                      {ann.metadata.toolName}
                      {ann.data.label && (
                        <span className="text-gray-500 ml-1">— {ann.data.label}</span>
                      )}
                    </div>
                    <div className="text-gray-200 font-mono tabular-nums mt-0.5">
                      {formatMeasurement(ann, pixelSpacing)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary footer */}
      {measurementAnnotations.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-800 text-[10px] text-gray-500">
          {measurementAnnotations.length} measurement{measurementAnnotations.length !== 1 ? 's' : ''}
          {pixelSpacing ? ' (calibrated)' : ' (uncalibrated)'}
        </div>
      )}
    </div>
  );
}

function eventBus_on(event: string, handler: () => void) {
  (eventBus as any).target.addEventListener(event, handler);
}

function eventBus_off(event: string, handler: () => void) {
  (eventBus as any).target.removeEventListener(event, handler);
}
