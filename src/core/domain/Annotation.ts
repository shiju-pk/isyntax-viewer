/**
 * Persisted annotation model — tool-agnostic representation
 * suitable for serialization to/from a PACS backend.
 */
export interface Annotation {
  id: string;
  type: AnnotationType;
  studyUID: string;
  seriesUID: string;
  instanceUID: string;
  frameIndex?: number;
  label?: string;
  description?: string;
  data: AnnotationData;
  createdAt: string;
  modifiedAt: string;
  createdBy?: string;
}

export type AnnotationType =
  | 'length'
  | 'angle'
  | 'ellipticalROI'
  | 'rectangleROI'
  | 'circle'
  | 'freehand'
  | 'arrowAnnotate'
  | 'probe'
  | 'textAnnotation'
  | 'cobbAngle';

export interface AnnotationData {
  /** Tool-specific handles / control points */
  handles: Record<string, unknown>;
  /** Computed measurement value, if any */
  measurementValue?: number;
  measurementUnit?: string;
  /** Text content for text annotations */
  text?: string;
}
