import type { ITransport } from '../../core/interfaces';

/**
 * HTTP-based transport using the Fetch API.
 * Default implementation for browser environments.
 */
export class HttpTransport implements ITransport {
  async fetchBinary(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
    }
    return response.arrayBuffer();
  }
}
