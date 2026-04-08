/**
 * Hanging Protocol — Type Definitions
 *
 * Defines the protocol, rule, viewport spec, and series selector types
 * used by the hanging protocol engine.
 */

import type { LayoutMode } from '../presentation/components/Viewer/LayoutSwitcher';

// ---------------------------------------------------------------------------
// Rule constraint
// ---------------------------------------------------------------------------

export interface RuleConstraint {
  equals?: string;
  contains?: string;
  regex?: string;
}

// ---------------------------------------------------------------------------
// Protocol Rule
// ---------------------------------------------------------------------------

export type RuleAttribute =
  | 'modality'
  | 'bodyPartExamined'
  | 'studyDescription'
  | 'seriesDescription';

export interface ProtocolRule {
  attribute: RuleAttribute;
  constraint: RuleConstraint;
  weight: number;
}

// ---------------------------------------------------------------------------
// Series Selector (how to pick which series fills a viewport cell)
// ---------------------------------------------------------------------------

export interface SeriesSelector {
  modality?: string;
  seriesDescription?: string;
  seriesNumber?: number;
  instanceIndex?: number | 'first' | 'middle' | 'last';
}

// ---------------------------------------------------------------------------
// Viewport Spec (what goes into each cell of the layout)
// ---------------------------------------------------------------------------

export interface ViewportSpec {
  cellIndex: number;
  seriesSelector: SeriesSelector;
  isPrior?: boolean;
}

// ---------------------------------------------------------------------------
// Sync Group
// ---------------------------------------------------------------------------

export type SyncMode = 'scroll' | 'windowLevel' | 'zoom' | 'all';

export interface SyncGroup {
  cellIndices: number[];
  mode: SyncMode;
}

// ---------------------------------------------------------------------------
// Hanging Protocol
// ---------------------------------------------------------------------------

export interface HangingProtocol {
  id: string;
  name: string;
  description?: string;
  priority: number;
  matchRules: ProtocolRule[];
  layout: LayoutMode;
  viewportSpecs: ViewportSpec[];
  syncGroups?: SyncGroup[];
}

// ---------------------------------------------------------------------------
// Match Result
// ---------------------------------------------------------------------------

export interface ProtocolMatchResult {
  protocol: HangingProtocol;
  score: number;
  matchedRules: number;
  totalRules: number;
}

// ---------------------------------------------------------------------------
// Study metadata for matching
// ---------------------------------------------------------------------------

export interface StudyMatchContext {
  modality?: string;
  bodyPartExamined?: string;
  studyDescription?: string;
  seriesDescriptions?: string[];
}
