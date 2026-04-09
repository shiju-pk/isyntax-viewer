/**
 * HMAC request signing for authenticated ISPACS service calls.
 * Ported from the 1.5 reference HMACGenerator pattern.
 *
 * When HMAC is enabled after login, each service request must include
 * an Authorization header:
 *   Authorization: HMAC Hash=<hash>;Timestamp=<serverTime>;iSiteWebApplication=<ticket>
 *
 * The hash is HMAC-SHA256(ticket + ';' + serverTimeISO, hmacKey).
 */
export class HmacSigner {
  private _enabled = false;
  private _secretKey: string | null = null;
  private _ticket: string | null = null;
  /** Offset in ms: serverTime − clientTime (add to Date.now() to get server time). */
  private _serverTimeOffsetMs = 0;

  get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Initialize HMAC signing with credentials from a login response.
   * @param secretKey  - HMACSecretKey from LoginResponse
   * @param ticket     - Session ticket from LoginResponse
   * @param serverTimestamp - ServerTimestamp ISO string from LoginResponse
   * @param loginLatencyMs  - Approx one-way network latency (RTT / 2)
   */
  enable(secretKey: string, ticket: string, serverTimestamp?: string, loginLatencyMs?: number): void {
    this._secretKey = secretKey;
    this._ticket = ticket;
    this._enabled = true;

    if (serverTimestamp) {
      const serverTime = new Date(serverTimestamp).getTime();
      const latency = loginLatencyMs ?? 0;
      this._serverTimeOffsetMs = serverTime - (Date.now() - latency);
    }
  }

  /**
   * Disable HMAC signing (e.g., on logout).
   */
  disable(): void {
    this._secretKey = null;
    this._ticket = null;
    this._enabled = false;
    this._serverTimeOffsetMs = 0;
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
   * Build the full Authorization header value for an ISPACS request.
   * Format: HMAC Hash=<hash>;Timestamp=<serverTime>;iSiteWebApplication=<ticket>
   *
   * Returns null if HMAC is not enabled.
   */
  async buildAuthorizationHeader(): Promise<string | null> {
    if (!this._enabled || !this._secretKey || !this._ticket) {
      return null;
    }

    const serverTimeISO = this._getServerTimeISO();
    const hash = await this._hmacSha256(this._ticket + ';' + serverTimeISO, this._secretKey);
    if (!hash) return null;

    return `HMAC Hash=${hash};Timestamp=${serverTimeISO};iSiteWebApplication=${this._ticket}`;
  }

  /**
   * Compute HMAC-SHA256 content signature for the request body.
   * Used for the X-Content-Signature header.
   */
  async signContent(requestBody: string): Promise<string | null> {
    if (!this._enabled || !this._secretKey) {
      return null;
    }
    return this._hmacSha256(requestBody, this._secretKey);
  }

  /**
   * Legacy sign() — compute HMAC signature for a request body.
   * Kept for backward compatibility; prefer buildAuthorizationHeader().
   */
  async sign(requestBody: string): Promise<string | null> {
    return this.signContent(requestBody);
  }

  // ─── Internal helpers ──────────────────────────────────────

  /** Get estimated server time as ISO string. */
  private _getServerTimeISO(): string {
    const serverNow = new Date(Date.now() + this._serverTimeOffsetMs);
    return serverNow.toISOString();
  }

  /** Compute HMAC-SHA256 and return hex-encoded digest. */
  private async _hmacSha256(message: string, key: string): Promise<string | null> {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      const messageData = encoder.encode(message);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );

      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      // Legacy ISPACS uses hex encoding (not base64)
      return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return null;
    }
  }
}
