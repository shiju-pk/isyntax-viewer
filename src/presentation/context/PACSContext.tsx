import { createContext, useContext } from 'react';
import type { IPACSAdapter } from '../../adapters/IPACSAdapter';
import type { FeatureFlagService } from '../../core/capabilities/FeatureFlagService';
import type { AppConfig } from '../../core/config/AppConfig';
import type { CapabilitySet } from '../../core/domain/CapabilitySet';

export interface PACSContextValue {
  adapter: IPACSAdapter;
  features: FeatureFlagService;
  config: AppConfig;
}

const PACSContext = createContext<PACSContextValue | null>(null);

export function PACSProvider({
  value,
  children,
}: {
  value: PACSContextValue;
  children: React.ReactNode;
}) {
  return <PACSContext.Provider value={value}>{children}</PACSContext.Provider>;
}

/**
 * Access the PACS context (adapter, features, config).
 * Throws if used outside a PACSProvider.
 */
export function usePACS(): PACSContextValue {
  const ctx = useContext(PACSContext);
  if (!ctx) {
    throw new Error('usePACS() must be used within a <PACSProvider>');
  }
  return ctx;
}

/**
 * Check a single feature flag from the capability set.
 */
export function useFeature(flag: keyof CapabilitySet): boolean {
  const { features } = usePACS();
  return features.isEnabled(flag);
}
