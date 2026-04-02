import { getEffectiveTargetHostname } from '../../services/config/PreferencesService';

const API_PATH = '/ResultsAuthority';

function getApiBaseUrl(): string {
  return `${getEffectiveTargetHostname()}${API_PATH}`;
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
