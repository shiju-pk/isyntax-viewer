export const API_BASE_URL = '/api/ResultsAuthority';

export function getInitImageUrl(studyUID: string, instanceUID: string, sid: string): string {
  return `${API_BASE_URL}/Study/${studyUID}/Instance/${instanceUID}/iSyntaxInitImage?TQ=0&V=0&P=0&sid=${sid}`;
}

export function getCoefficientsUrl(
  studyUID: string,
  instanceUID: string,
  level: number,
  sid: string,
): string {
  return `${API_BASE_URL}/Study/${studyUID}/Instance/${instanceUID}/iSyntaxCoeffs?P=2&F=Y&L=${level}&Rw=0&Cl=0&FQ=0&TQ=1&Cache=true&sid=${sid}`;
}

export function getStudyDocUrl(studyUID: string, sid: string): string {
  return `${API_BASE_URL}/Study/${studyUID}/iSyntaxStudy?sid=${sid}`;
}
