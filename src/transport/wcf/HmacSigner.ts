/**
 * HMAC request signing for authenticated ISPACS service calls.
 * Ported from the 1.5 reference HMACGenerator pattern.
 *
 * When HMAC is enabled after login, each service request must include
 * an HMAC signature computed from the request body + ticket + secret.
 */
export class HmacSigner {
  private _enabled = false;
  private _secretKey: string | null = null;
  private _ticket: string | null = null;

  get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Initialize HMAC signing with credentials from a login response.
   */
  enable(secretKey: string, ticket: string): void {
    this._secretKey = secretKey;
    this._ticket = ticket;
    this._enabled = true;
  }

  /**
   * Disable HMAC signing (e.g., on logout).
   */
  disable(): void {
    this._secretKey = null;
    this._ticket = null;
    this._enabled = false;
  }

  /**
   * Update the ticket (e.g., from an extended ticket in a response).
   */
  updateTicket(ticket: string): void {
    this._ticket = ticket;
  }

  /**
   * Get the current ticket value.
   */
  getTicket(): string | null {
    return this._ticket;
  }

  /**
   * Compute HMAC signature for a request body.
   * Uses Web Crypto API (SubtleCrypto) for HMAC-SHA256.
   * Returns the base64-encoded signature.
   */
  async sign(requestBody: string): Promise<string | null> {
    if (!this._enabled || !this._secretKey) {
      return null;
    }

    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this._secretKey);
      const messageData = encoder.encode(requestBody);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );

      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
    } catch {
      return null;
    }
  }
}
