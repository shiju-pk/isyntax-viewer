const PREFERENCES_KEY = 'isyntax_preferences';

interface Preferences {
  targetHostname?: string;
}

const DEFAULT_TARGET_HOSTNAME = 'http://localhost:5000';

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Preferences;
  } catch {
    return {};
  }
}

function writePreferences(prefs: Preferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

export function getDefaultTargetHostname(): string {
  return DEFAULT_TARGET_HOSTNAME;
}

export function getPersistedTargetHostname(): string | null {
  return readPreferences().targetHostname ?? null;
}

export function setPersistedTargetHostname(value: string | null): void {
  const prefs = readPreferences();
  if (value === null || value === '') {
    delete prefs.targetHostname;
  } else {
    prefs.targetHostname = value;
  }
  writePreferences(prefs);
}

export function getEffectiveTargetHostname(): string {
  return getPersistedTargetHostname() ?? getDefaultTargetHostname();
}
