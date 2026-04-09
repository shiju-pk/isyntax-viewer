import { getConfig } from '../../core/config/ConfigProvider';

function getApiBaseUrl(): string {
  try {
    const cfg = getConfig();
    return cfg.apiBasePath;
  } catch {
    // Fallback if config not yet loaded (backward compat)
    return '/ResultsAuthority';
  }
}

export function getInitImageUrl(studyUID: string, instanceUID: string, sid: string): string {
  const base = getApiBaseUrl();
  return `${base}/Study/${studyUID}/Instance/${instanceUID}/iSyntaxInitImage?TQ=0&V=0&P=0&sid=${sid}`;
}

export function getCoefficientsUrl(
  studyUID: string,
  instanceUID: string,
  level: number,
  sid: string,
): string {
  const base = getApiBaseUrl();
  return `${base}/Study/${studyUID}/Instance/${instanceUID}/iSyntaxCoeffs?P=2&F=Y&L=${level}&Rw=0&Cl=0&FQ=0&TQ=1&Cache=true&sid=${sid}`;
}

export function getStudyDocUrl(studyUID: string, sid: string): string {
  const base = getApiBaseUrl();
  return `${base}/Study/${studyUID}/iSyntaxStudy?sid=${sid}`;
}

export function getPresentationStateUrl(studyUID: string, psName: string): string {
  const base = getApiBaseUrl();
  return `${base}/Study/${studyUID}/PresentationState?N=${encodeURIComponent(psName)}`;
}
