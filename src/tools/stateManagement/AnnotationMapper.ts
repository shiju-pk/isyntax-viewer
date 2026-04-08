/**
 * AnnotationMapper — bidirectional mapping between the tool-framework
 * Annotation (tools/base/types) and the domain Annotation (core/domain).
 *
 * Tool annotations are transient, in-memory objects used for rendering.
 * Domain annotations are persistence-ready models for save/load.
 */

import type { Annotation as ToolAnnotation, Point2 } from '../base/types';
import type {
  Annotation as DomainAnnotation,
  AnnotationType,
  AnnotationData,
} from '../../core/domain/Annotation';

const TOOL_TO_DOMAIN_TYPE: Record<string, AnnotationType> = {
  Length: 'length',
  Angle: 'angle',
  EllipticalROI: 'ellipticalROI',
  RectangleROI: 'rectangleROI',
  Circle: 'circle',
  Freehand: 'freehand',
  ArrowAnnotate: 'arrowAnnotate',
  Probe: 'probe',
  TextAnnotation: 'textAnnotation',
  CobbAngle: 'cobbAngle',
};

const DOMAIN_TO_TOOL_TYPE: Record<AnnotationType, string> = {
  length: 'Length',
  angle: 'Angle',
  ellipticalROI: 'EllipticalROI',
  rectangleROI: 'RectangleROI',
  circle: 'Circle',
  freehand: 'Freehand',
  arrowAnnotate: 'ArrowAnnotate',
  probe: 'Probe',
  textAnnotation: 'TextAnnotation',
  cobbAngle: 'CobbAngle',
};

/**
 * Convert a tool-framework annotation into a persisted domain annotation.
 */
export function toolToDomain(
  tool: ToolAnnotation,
  studyUID: string,
  seriesUID: string,
): DomainAnnotation {
  const type = TOOL_TO_DOMAIN_TYPE[tool.metadata.toolName] ?? 'length';
  const points = tool.data.handles.points.map((p) => ({ x: p.x, y: p.y }));

  const data: AnnotationData = {
    handles: { points },
    text: tool.data.label,
  };

  // Copy cached stats as measurement value if available
  if (tool.data.cachedStats) {
    const length = tool.data.cachedStats['length'] as number | undefined;
    const angle = tool.data.cachedStats['angle'] as number | undefined;
    const area = tool.data.cachedStats['area'] as number | undefined;
    data.measurementValue = length ?? angle ?? area;
    data.measurementUnit = length != null ? 'mm' : angle != null ? 'deg' : area != null ? 'mm²' : undefined;
  }

  const now = new Date().toISOString();
  return {
    id: tool.annotationUID,
    type,
    studyUID,
    seriesUID,
    instanceUID: tool.metadata.imageId ?? '',
    label: tool.data.label,
    data,
    createdAt: now,
    modifiedAt: now,
  };
}

/**
 * Convert a persisted domain annotation back to a tool-framework annotation.
 */
export function domainToTool(
  domain: DomainAnnotation,
  viewportId: string,
): ToolAnnotation {
  const toolName = DOMAIN_TO_TOOL_TYPE[domain.type] ?? 'Length';
  const handles = domain.data.handles as { points?: Array<{ x: number; y: number }> };
  const points: Point2[] = (handles.points ?? []).map((p) => ({ x: p.x, y: p.y }));

  return {
    annotationUID: domain.id,
    metadata: {
      toolName,
      viewportId,
      imageId: domain.instanceUID,
    },
    data: {
      handles: {
        points,
        activeHandleIndex: -1,
        textBox: domain.data.text
          ? { worldPosition: points[0] ?? { x: 0, y: 0 }, text: domain.data.text }
          : undefined,
      },
      cachedStats: domain.data.measurementValue != null
        ? { [domain.type]: domain.data.measurementValue }
        : undefined,
      label: domain.label,
    },
    highlighted: false,
    isLocked: false,
    isVisible: true,
    invalidated: false,
  };
}

/**
 * Convert a batch of tool annotations to domain annotations.
 */
export function toolBatchToDomain(
  tools: ToolAnnotation[],
  studyUID: string,
  seriesUID: string,
): DomainAnnotation[] {
  return tools.map((t) => toolToDomain(t, studyUID, seriesUID));
}

/**
 * Convert a batch of domain annotations back to tool annotations.
 */
export function domainBatchToTool(
  domains: DomainAnnotation[],
  viewportId: string,
): ToolAnnotation[] {
  return domains.map((d) => domainToTool(d, viewportId));
}
