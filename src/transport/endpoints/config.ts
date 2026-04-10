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
  const url = `${base}/Study/${studyUID}/Instance/${instanceUID}/iSyntaxInitImage?TQ=0&V=0&P=0&sid=${sid}`;
  // eslint-disable-next-line no-console
  console.log(`[config] getInitImageUrl: studyUID=${studyUID}, instanceUID=${instanceUID}, sid=${sid} => ${url}`);
  return url;
}

export function getCoefficientsUrl(
  studyUID: string,
  instanceUID: string,
  level: number,
  sid: string,
): string {
  const base = getApiBaseUrl();
  const url = `${base}/Study/${studyUID}/Instance/${instanceUID}/iSyntaxCoeffs?P=2&F=Y&L=${level}&Rw=0&Cl=0&FQ=0&TQ=1&Cache=true&sid=${sid}`;
  // eslint-disable-next-line no-console
  console.log(`[config] getCoefficientsUrl: studyUID=${studyUID}, instanceUID=${instanceUID}, level=${level}, sid=${sid} => ${url}`);
  return url;
}

export function getStudyDocUrl(studyUID: string, sid: string): string {
  const base = getApiBaseUrl();
  const url = `${base}/Study/${studyUID}/iSyntaxStudy?sid=${sid}`;
  // eslint-disable-next-line no-console
  console.log(`[config] getStudyDocUrl: studyUID=${studyUID}, sid=${sid} => ${url}`);
  return url;
}

export function getPresentationStateUrl(studyUID: string, psName: string): string {
  const base = getApiBaseUrl();
  return `${base}/Study/${studyUID}/PresentationState?N=${encodeURIComponent(psName)}`;
}
