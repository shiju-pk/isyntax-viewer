const ADDED_STUDIES_KEY = 'isyntax_added_studies';

interface StoredStudyConfig {
  studyId: string;
  stackId: string;
}

export function getAddedStudies(): StoredStudyConfig[] {
  try {
    const raw = localStorage.getItem(ADDED_STUDIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as StoredStudyConfig).studyId === 'string' &&
        typeof (item as StoredStudyConfig).stackId === 'string'
    );
  } catch {
    return [];
  }
}

export function saveAddedStudies(configs: StoredStudyConfig[]): void {
  localStorage.setItem(ADDED_STUDIES_KEY, JSON.stringify(configs));
}

export function addStudy(config: StoredStudyConfig): StoredStudyConfig[] {
  const existing = getAddedStudies();
  const duplicate = existing.some(
    (s) => s.studyId === config.studyId && s.stackId === config.stackId
  );
  if (duplicate) return existing;
  const updated = [...existing, { studyId: config.studyId, stackId: config.stackId }];
  saveAddedStudies(updated);
  return updated;
}

export function removeStudy(studyId: string, stackId: string): StoredStudyConfig[] {
  const existing = getAddedStudies();
  const updated = existing.filter(
    (s) => !(s.studyId === studyId && s.stackId === stackId)
  );
  saveAddedStudies(updated);
  return updated;
}
