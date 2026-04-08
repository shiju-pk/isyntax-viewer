/**
 * User-level preferences persisted locally or on the server.
 */
export interface UserPreference {
  /** Target PACS hostname override */
  targetHostname?: string;
  /** Default window/level presets per modality */
  windowLevelPresets?: Record<string, { ww: number; wc: number }[]>;
  /** Preferred default layout (e.g., '1x1', '1x2', '2x2') */
  defaultLayout?: string;
  /** Whether to enable progressive image loading */
  progressiveLoading?: boolean;
  /** Preferred interaction mode on study open */
  defaultTool?: string;
  /** Extension point */
  extra?: Record<string, unknown>;
}
