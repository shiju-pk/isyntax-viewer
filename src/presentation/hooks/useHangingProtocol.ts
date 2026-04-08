/**
 * useHangingProtocol — React hook for managing hanging protocol state.
 *
 * Wires the HangingProtocolEngine with study metadata and provides
 * protocol selection, matching, and layout application.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { HangingProtocolEngine } from '../../hanging-protocol/HangingProtocolEngine';
import { DEFAULT_PROTOCOLS } from '../../hanging-protocol/DefaultProtocols';
import {
  saveProtocolPreference,
  getPreferredProtocolId,
} from '../../hanging-protocol/ProtocolStore';
import type {
  HangingProtocol,
  ProtocolMatchResult,
  StudyMatchContext,
} from '../../hanging-protocol/types';
import type { LayoutMode } from '../components/Viewer/LayoutSwitcher';

interface UseHangingProtocolOptions {
  studyContext: StudyMatchContext | null;
  enabled?: boolean;
}

interface UseHangingProtocolResult {
  engine: HangingProtocolEngine;
  matchResults: ProtocolMatchResult[];
  activeProtocol: HangingProtocol | null;
  suggestedLayout: LayoutMode | null;
  selectProtocol: (protocol: HangingProtocol | null) => void;
}

export function useHangingProtocol({
  studyContext,
  enabled = true,
}: UseHangingProtocolOptions): UseHangingProtocolResult {
  const engine = useMemo(() => {
    const e = new HangingProtocolEngine();
    e.registerProtocols(DEFAULT_PROTOCOLS);
    return e;
  }, []);

  const [matchResults, setMatchResults] = useState<ProtocolMatchResult[]>([]);
  const [activeProtocol, setActiveProtocol] = useState<HangingProtocol | null>(null);
  const [suggestedLayout, setSuggestedLayout] = useState<LayoutMode | null>(null);

  // Run matching when study context changes
  useEffect(() => {
    if (!enabled || !studyContext) {
      setMatchResults([]);
      setActiveProtocol(null);
      setSuggestedLayout(null);
      return;
    }

    const results = engine.match(studyContext);
    setMatchResults(results);

    // Check for user preference first
    const preferredId = getPreferredProtocolId(studyContext.modality);
    if (preferredId) {
      const preferred = engine.getProtocolById(preferredId);
      if (preferred) {
        engine.setActiveProtocol(preferred);
        setActiveProtocol(preferred);
        setSuggestedLayout(preferred.layout);
        return;
      }
    }

    // Fall back to auto-match
    const best = results.length > 0 ? results[0].protocol : null;
    engine.setActiveProtocol(best);
    setActiveProtocol(best);
    setSuggestedLayout(best?.layout ?? null);
  }, [engine, studyContext, enabled]);

  const selectProtocol = useCallback(
    (protocol: HangingProtocol | null) => {
      engine.setActiveProtocol(protocol);
      setActiveProtocol(protocol);
      setSuggestedLayout(protocol?.layout ?? null);

      // Persist user preference
      if (protocol && studyContext?.modality) {
        saveProtocolPreference(protocol.id, studyContext.modality);
      }
    },
    [engine, studyContext],
  );

  return {
    engine,
    matchResults,
    activeProtocol,
    suggestedLayout,
    selectProtocol,
  };
}
