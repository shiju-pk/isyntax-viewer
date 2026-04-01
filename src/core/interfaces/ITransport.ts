/**
 * Abstract transport interface for fetching binary data.
 * Implementations may use HTTP fetch, WebSocket, Tauri IPC, etc.
 */
export interface ITransport {
  fetchBinary(url: string): Promise<Uint8Array>;
  fetchArrayBuffer(url: string): Promise<ArrayBuffer>;
}
