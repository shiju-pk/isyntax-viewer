import { HmacSigner } from './HmacSigner';

/**
 * HTTP transport for WCF XML-RPC service calls.
 * Sends XML POST requests with appropriate content types and optional HMAC signing.
 */
export class WcfTransport {
  private _baseUrl: string;
  private _hmacSigner: HmacSigner;
  private _requestTimeout: number;

  constructor(baseUrl: string, hmacSigner?: HmacSigner, requestTimeoutMs = 30000) {
    this._baseUrl = baseUrl;
    this._hmacSigner = hmacSigner ?? new HmacSigner();
    this._requestTimeout = requestTimeoutMs;
  }

  get hmacSigner(): HmacSigner {
    return this._hmacSigner;
  }

  /**
   * Send an XML POST request to a service endpoint.
   * @param servicePath - Relative path from baseUrl (e.g., '/AuthenticationService.ashx')
   * @param xmlBody - The XML request body (already wrapped in <Message>)
   * @returns The raw response text (XML)
   */
  async post(servicePath: string, xmlBody: string): Promise<string> {
    const url = `${this._baseUrl}${servicePath}`;
    const headers: Record<string, string> = {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    };

    // Add Authorization header (HMAC-based) if enabled
    if (this._hmacSigner.isEnabled) {
      const authHeader = await this._hmacSigner.buildAuthorizationHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._requestTimeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: xmlBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new WcfTransportError(
          `WCF POST failed: ${response.status} ${response.statusText}`,
          response.status,
          url,
        );
      }

      return await response.text();
    } catch (err) {
      if (err instanceof WcfTransportError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new WcfTransportError('Request timed out', 0, url);
      }
      throw new WcfTransportError(
        `WCF POST error: ${err instanceof Error ? err.message : String(err)}`,
        0,
        url,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Send an XML POST request using an absolute path (no baseUrl prepended).
   * Use for discovered service endpoints that live under a different base.
   */
  async postAbsolute(absolutePath: string, xmlBody: string): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    };

    if (this._hmacSigner.isEnabled) {
      const authHeader = await this._hmacSigner.buildAuthorizationHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[WcfTransport] postAbsolute(${absolutePath}) hmacEnabled=${this._hmacSigner.isEnabled} hasAuth=${'Authorization' in headers}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._requestTimeout);

    try {
      const response = await fetch(absolutePath, {
        method: 'POST',
        headers,
        body: xmlBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new WcfTransportError(
          `WCF POST failed: ${response.status} ${response.statusText}`,
          response.status,
          absolutePath,
        );
      }

      return await response.text();
    } catch (err) {
      if (err instanceof WcfTransportError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new WcfTransportError('Request timed out', 0, absolutePath);
      }
      throw new WcfTransportError(
        `WCF POST error: ${err instanceof Error ? err.message : String(err)}`,
        0,
        absolutePath,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Send an HTTP GET request.
   */
  async get(servicePath: string): Promise<string> {
    const url = `${this._baseUrl}${servicePath}`;
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache',
    };

    if (this._hmacSigner.isEnabled) {
      const authHeader = await this._hmacSigner.buildAuthorizationHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._requestTimeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new WcfTransportError(
          `WCF GET failed: ${response.status} ${response.statusText}`,
          response.status,
          url,
        );
      }

      return await response.text();
    } catch (err) {
      if (err instanceof WcfTransportError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new WcfTransportError('Request timed out', 0, url);
      }
      throw new WcfTransportError(
        `WCF GET error: ${err instanceof Error ? err.message : String(err)}`,
        0,
        url,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class WcfTransportError extends Error {
  readonly statusCode: number;
  readonly url: string;

  constructor(message: string, statusCode: number, url: string) {
    super(message);
    this.name = 'WcfTransportError';
    this.statusCode = statusCode;
    this.url = url;
  }
}
