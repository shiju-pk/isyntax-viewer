/**
 * save-state — Viewer Session Serialization & Persistence
 *
 * Serializes/deserializes viewport state, annotations, overlay visibility,
 * and presentation state references for save/load workflows.
 */

export type {
  SerializedViewportState,
  SerializedAnnotation,
  SerializedViewerSession,
  SaveResult,
  LoadResult,
} from './types';

export {
  serializeSession,
  sessionToJSON,
  sessionFromJSON,
  serializeAnnotation,
  deserializeAnnotation,
} from './ViewerStateSerializer';
