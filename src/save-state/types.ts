/**
 * Save State — Type Definitions
 *
 * Serialization and persistence models for viewer state, annotations,
 * and presentation states. Supports saving to and loading from the
 * server-side StudyDoc format used by the legacy iSite system.
 */

// ---------------------------------------------------------------------------
// Serialized viewer state
// ---------------------------------------------------------------------------

/** Serializable snapshot of a single viewport's state. */
export interface SerializedViewportState {
  /** Viewport ID. */
  viewportId: string;

  /** Series UID displayed in this viewport. */
  seriesUID: string;

  /** Current image index (0-based). */
  imageIndex: number;

  /** Current SOP Instance UID. */
  sopInstanceUID: string;

  /** Window width. */
  windowWidth: number;

  /** Window center. */
  windowCenter: number;

  /** Zoom level (1.0 = fit-to-window). */
  zoom: number;

  /** Pan offset X (image pixels). */
  panX: number;

  /** Pan offset Y (image pixels). */
  panY: number;

  /** Rotation in degrees (0, 90, 180, 270). */
  rotation: number;

  /** Horizontal flip. */
  flipH: boolean;

  /** Vertical flip. */
  flipV: boolean;

  /** Whether the image is inverted. */
  inverted: boolean;
}

/** Serializable annotation. */
export interface SerializedAnnotation {
  /** Annotation UID. */
  uid: string;

  /** Tool name that created it. */
  toolName: string;

  /** Image UID this annotation belongs to. */
  imageUID: string;

  /** Handle points in world coordinates. */
  points: Array<{ x: number; y: number }>;

  /** Optional text label. */
  label?: string;

  /** Whether the annotation is locked. */
  isLocked: boolean;

  /** Whether the annotation is visible. */
  isVisible: boolean;

  /** Cached statistics (tool-specific). */
  cachedStats?: Record<string, unknown>;
}

/** Full serialized viewer session state. */
export interface SerializedViewerSession {
  /** Session version for forward compatibility. */
  version: string;

  /** Timestamp of serialization. */
  timestamp: string;

  /** Study Instance UID. */
  studyUID: string;

  /** Layout mode ('1x1', '1x2', etc.). */
  layoutMode: string;

  /** Per-viewport state. */
  viewports: SerializedViewportState[];

  /** All annotations across all images. */
  annotations: SerializedAnnotation[];

  /** Overlay visibility state per plane. */
  overlayVisibility?: Record<number, boolean>;

  /** Active presentation state key (if any). */
  activePSKey?: string;
}

// ---------------------------------------------------------------------------
// Save/Load result
// ---------------------------------------------------------------------------

export interface SaveResult {
  success: boolean;
  error?: string;
  savedAt?: string;
}

export interface LoadResult {
  success: boolean;
  error?: string;
  session?: SerializedViewerSession;
}
