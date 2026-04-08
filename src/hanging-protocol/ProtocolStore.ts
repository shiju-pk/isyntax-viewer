/**
 * ProtocolStore — Persists user/site protocol preferences to localStorage.
 */

import type { HangingProtocol } from './types';

const STORAGE_KEY = 'pacs-viewer:protocol-preferences';

export interface ProtocolPreference {
  protocolId: string;
  /** Modality this preference applies to (optional filter). */
  modality?: string;
  /** Timestamp when the preference was last set. */
  updatedAt: number;
}

/**
 * Load saved protocol preferences from localStorage.
 */
export function loadProtocolPreferences(): ProtocolPreference[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProtocolPreference[];
  } catch {
    return [];
  }
}

/**
 * Save a protocol preference for a modality.
 */
export function saveProtocolPreference(protocolId: string, modality?: string): void {
  const prefs = loadProtocolPreferences();

  const existing = prefs.findIndex(
    (p) => p.modality === modality,
  );

  const entry: ProtocolPreference = {
    protocolId,
    modality,
    updatedAt: Date.now(),
  };

  if (existing !== -1) {
    prefs[existing] = entry;
  } else {
    prefs.push(entry);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

/**
 * Get the preferred protocol ID for a given modality.
 */
export function getPreferredProtocolId(modality?: string): string | null {
  const prefs = loadProtocolPreferences();

  // Try exact modality match first
  if (modality) {
    const match = prefs.find((p) => p.modality === modality);
    if (match) return match.protocolId;
  }

  // Fall back to global (no modality) preference
  const global = prefs.find((p) => !p.modality);
  return global?.protocolId ?? null;
}

/**
 * Clear all protocol preferences.
 */
export function clearProtocolPreferences(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
