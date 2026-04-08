import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Ruler, Triangle, Circle, Square, ArrowUpRight, Crosshair,
  Pen, Type, Trash2, Eye, EyeOff, X, MousePointer2,
} from 'lucide-react';
import { annotationManager, AnnotationEvents } from '../../../tools/stateManagement/AnnotationManager';
import { eventBus } from '../../../rendering/events/EventBus';
import type { Annotation } from '../../../tools/base/types';

interface AnnotationListPanelProps {
  imageId: string | undefined;
  onClose: () => void;
  width?: number;
}

const TOOL_ICON_MAP: Record<string, typeof Ruler> = {
  Length: Ruler,
  Angle: Triangle,
  CobbAngle: Triangle,
  EllipticalROI: Circle,
  RectangleROI: Square,
  Circle: Circle,
  ArrowAnnotate: ArrowUpRight,
  Probe: Crosshair,
  Freehand: Pen,
  TextAnnotation: Type,
  SelectionTool: MousePointer2,
};

function eventBus_on(event: string, handler: () => void) {
  (eventBus as any).target.addEventListener(event, handler);
}

function eventBus_off(event: string, handler: () => void) {
  (eventBus as any).target.removeEventListener(event, handler);
}

export default function AnnotationListPanel({
  imageId,
  onClose,
  width = 260,
}: AnnotationListPanelProps) {
  const [version, setVersion] = useState(0);

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
    version;
    if (!imageId) return [];
    return annotationManager.getAllAnnotationsForImage(imageId);
  }, [imageId, version]);

  const handleDelete = useCallback((uid: string) => {
    annotationManager.removeAnnotation(uid);
  }, []);

  const handleToggleVisibility = useCallback((ann: Annotation) => {
    ann.isVisible = !ann.isVisible;
    annotationManager.triggerAnnotationModified(ann);
  }, []);

  const handleSelect = useCallback((ann: Annotation) => {
    // Deselect all, then highlight this one
    if (!imageId) return;
    const all = annotationManager.getAllAnnotationsForImage(imageId);
    for (const a of all) {
      if (a.highlighted) {
        a.highlighted = false;
        annotationManager.triggerAnnotationModified(a);
      }
    }
    ann.highlighted = true;
    annotationManager.triggerAnnotationModified(ann);
  }, [imageId]);

  return (
    <div
      className="flex flex-col bg-gray-900 border-l border-gray-800 overflow-hidden"
      style={{ width }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Annotations
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {annotations.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-6">
            No annotations on this image.
          </p>
        ) : (
          <div className="flex flex-col">
            {annotations.map((ann) => {
              const Icon = TOOL_ICON_MAP[ann.metadata.toolName] ?? Ruler;
              return (
                <div
                  key={ann.annotationUID}
                  onClick={() => handleSelect(ann)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-gray-800/50 transition-colors ${
                    ann.highlighted
                      ? 'bg-blue-900/20 border-l-2 border-l-blue-500'
                      : 'hover:bg-gray-800/40 border-l-2 border-l-transparent'
                  }`}
                >
                  <Icon
                    size={14}
                    className={`shrink-0 ${ann.isVisible ? 'text-green-400' : 'text-gray-600'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-gray-400 font-medium truncate">
                      {ann.metadata.toolName}
                    </div>
                    {ann.data.label && (
                      <div className="text-[10px] text-gray-500 truncate">
                        {ann.data.label}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(ann);
                    }}
                    className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
                    title={ann.isVisible ? 'Hide' : 'Show'}
                  >
                    {ann.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ann.annotationUID);
                    }}
                    className="p-1 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition-colors shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-800 text-[10px] text-gray-600">
        {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
