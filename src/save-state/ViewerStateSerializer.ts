/**
 * ViewerStateSerializer — Serializes and deserializes viewer session state.
 *
 * Converts live viewer state (viewport transforms, annotations, overlay
 * visibility) to/from a JSON-serializable format for persistence.
 *
 * Ported from legacy `studydocservice.js` save/load workflows.
 */

import type {
  SerializedViewerSession,
  SerializedViewportState,
  SerializedAnnotation,
} from './types';

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Create a serialized viewer session snapshot.
 *
 * @param studyUID - Study Instance UID.
 * @param layoutMode - Current layout mode string.
 * @param viewports - Array of viewport state objects.
 * @param annotations - Array of annotation objects.
 * @param overlayVisibility - Optional overlay plane visibility map.
 * @param activePSKey - Optional active presentation state key.
 */
export function serializeSession(
  studyUID: string,
  layoutMode: string,
  viewports: SerializedViewportState[],
  annotations: SerializedAnnotation[],
  overlayVisibility?: Record<number, boolean>,
  activePSKey?: string,
): SerializedViewerSession {
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    studyUID,
    layoutMode,
    viewports,
    annotations,
    overlayVisibility,
    activePSKey,
  };
}

/**
 * Serialize a session to a JSON string.
 */
export function sessionToJSON(session: SerializedViewerSession): string {
  return JSON.stringify(session, null, 2);
}

/**
 * Deserialize a session from a JSON string.
 *
 * @returns The parsed session, or null if parsing fails.
 */
export function sessionFromJSON(json: string): SerializedViewerSession | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.version || !parsed.studyUID) {
      return null;
    }
    return parsed as SerializedViewerSession;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Annotation serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize an annotation from the annotation manager's format to the
 * save-state format.
 */
export function serializeAnnotation(annotation: {
  annotationUID: string;
  metadata: { toolName: string; imageId?: string };
  data: {
    handles: { points: Array<{ x: number; y: number }> };
    cachedStats?: Record<string, unknown>;
    label?: string;
  };
  isLocked: boolean;
  isVisible: boolean;
}): SerializedAnnotation {
  return {
    uid: annotation.annotationUID,
    toolName: annotation.metadata.toolName,
    imageUID: annotation.metadata.imageId ?? '',
    points: annotation.data.handles.points.map((p) => ({ x: p.x, y: p.y })),
    label: annotation.data.label,
    isLocked: annotation.isLocked,
    isVisible: annotation.isVisible,
    cachedStats: annotation.data.cachedStats,
  };
}

/**
 * Deserialize an annotation back to the annotation manager's format.
 */
export function deserializeAnnotation(
  saved: SerializedAnnotation,
  viewportId: string,
): {
  annotationUID: string;
  metadata: { toolName: string; viewportId: string; imageId: string };
  data: {
    handles: { points: Array<{ x: number; y: number }>; activeHandleIndex: number };
    cachedStats: Record<string, unknown>;
    label?: string;
  };
  highlighted: boolean;
  isLocked: boolean;
  isVisible: boolean;
  invalidated: boolean;
} {
  return {
    annotationUID: saved.uid,
    metadata: {
      toolName: saved.toolName,
      viewportId,
      imageId: saved.imageUID,
    },
    data: {
      handles: {
        points: saved.points.map((p) => ({ x: p.x, y: p.y })),
        activeHandleIndex: -1,
      },
      cachedStats: saved.cachedStats ?? {},
      label: saved.label,
    },
    highlighted: false,
    isLocked: saved.isLocked,
    isVisible: saved.isVisible,
    invalidated: false,
  };
}
