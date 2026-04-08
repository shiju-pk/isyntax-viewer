import type { IPACSAdapter, AuthCredentials, AuthResult } from '../adapters/IPACSAdapter';

/**
 * Manages authentication session lifecycle:
 * - Login / logout
 * - Session token storage
 * - Keep-alive polling
 * - Timeout detection
 */
export class SessionManager {
  private _adapter: IPACSAdapter;
  private _keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private _sessionToken: string | null = null;
  private _onSessionExpired?: () => void;

  constructor(adapter: IPACSAdapter, onSessionExpired?: () => void) {
    this._adapter = adapter;
    this._onSessionExpired = onSessionExpired;
  }

  get isAuthenticated(): boolean {
    return this._adapter.isAuthenticated();
  }

  get sessionToken(): string | null {
    return this._sessionToken;
  }

  async login(credentials: AuthCredentials): Promise<AuthResult> {
    const result = await this._adapter.authenticate(credentials);
    if (result.success) {
      this._sessionToken = result.sessionToken ?? null;
      this._startKeepAlive();
    }
    return result;
  }

  async logout(): Promise<void> {
    this._stopKeepAlive();
    this._sessionToken = null;
    await this._adapter.logout();
  }

  dispose(): void {
    this._stopKeepAlive();
  }

  private _startKeepAlive(intervalMs = 60_000): void {
    this._stopKeepAlive();
    this._keepAliveTimer = setInterval(() => {
      if (!this._adapter.isAuthenticated()) {
        this._stopKeepAlive();
        this._onSessionExpired?.();
      }
    }, intervalMs);
  }

  private _stopKeepAlive(): void {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
    }
  }
}
