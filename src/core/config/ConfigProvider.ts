import type { AppConfig } from './AppConfig';
import { DEFAULT_CONFIG } from './AppConfig';

const STORAGE_KEY = 'isyntax_config';

let resolvedConfig: AppConfig | null = null;

/**
 * Load and merge configuration from all sources.
 * Priority (highest wins): localStorage → config.json → build-time env → defaults.
 */
export async function loadConfig(): Promise<AppConfig> {
  if (resolvedConfig) return resolvedConfig;

  // Start with defaults
  let merged: AppConfig = { ...DEFAULT_CONFIG };

  // Layer 1: config.json (deploy-time, optional)
  try {
    const resp = await fetch('/config.json');
    if (resp.ok) {
      const json = await resp.json();
      merged = mergeConfig(merged, json);
    }
  } catch {
    // config.json is optional — proceed with defaults
  }

  // Layer 2: Build-time env (Vite defines)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env = (import.meta as any).env;
    if (env.VITE_TARGET_HOSTNAME) merged.targetHostname = env.VITE_TARGET_HOSTNAME;
    if (env.VITE_API_BASE_PATH) merged.apiBasePath = env.VITE_API_BASE_PATH;
    if (env.VITE_LOG_LEVEL) merged.logLevel = env.VITE_LOG_LEVEL;
  }

  // Layer 3: localStorage overrides (user-time)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      merged = mergeConfig(merged, parsed);
    }
  } catch {
    // Ignore corrupt localStorage
  }

  resolvedConfig = merged;
  return merged;
}

/**
 * Get the current resolved config synchronously.
 * Throws if loadConfig() has not been called yet.
 */
export function getConfig(): AppConfig {
  if (!resolvedConfig) {
    throw new Error('Config not loaded. Call loadConfig() during app init.');
  }
  return resolvedConfig;
}

/**
 * Persist a user override into localStorage.
 */
export function persistConfigOverride(overrides: Partial<AppConfig>): void {
  const current = getConfig();
  const merged = mergeConfig(current, overrides);
  resolvedConfig = merged;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Reset to defaults (clear localStorage overrides).
 */
export function resetConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  resolvedConfig = null;
}

function mergeConfig(base: AppConfig, overrides: Partial<AppConfig>): AppConfig {
  const result = { ...base };
  for (const key of Object.keys(overrides) as (keyof AppConfig)[]) {
    const value = overrides[key];
    if (value !== undefined && value !== null) {
      (result as any)[key] = value;
    }
  }
  return result;
}
