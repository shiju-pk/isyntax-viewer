import type { HmacSigner } from './wcf/HmacSigner';

/**
 * Singleton wrapper around fetch() that injects HMAC Authorization headers
 * when an HmacSigner is registered and enabled.
 *
 * Usage:
 *   1. After login:  setHmacSigner(signer)
 *   2. Replace bare fetch() with authenticatedFetch() in StudyService / ISyntaxImageService
 *   3. On logout:    clearHmacSigner()
 */

let _signer: HmacSigner | null = null;

export function setHmacSigner(signer: HmacSigner): void {
  _signer = signer;
}

export function clearHmacSigner(): void {
  _signer = null;
}

/**
 * Drop-in replacement for window.fetch() that adds HMAC Authorization
 * header when signing is enabled.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (_signer?.isEnabled) {
    const authHeader = await _signer.buildAuthorizationHeader();
    if (authHeader && !headers.has('Authorization')) {
      headers.set('Authorization', authHeader);
    }
  }

  // ResultsAuthority endpoints require application/octet-stream
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/octet-stream');
  }

  return fetch(input, { ...init, headers });
}
