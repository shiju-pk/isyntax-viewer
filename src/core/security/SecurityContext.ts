import type { AccessRight } from '../../adapters/interfaces/IAuthService';

/**
 * Singleton security context holding authentication state.
 * Populated after successful login, cleared on logout.
 */
export class SecurityContextStore {
  private static _instance: SecurityContextStore | null = null;

  private _ticket: string | null = null;
  private _hmacSecretKey: string | null = null;
  private _serverTimestamp: string | null = null;
  private _userDisplayName: string | null = null;
  private _userPrincipalName: string | null = null;
  private _userType: string | null = null;
  private _authority: string | null = null;
  private _sessionTimeoutMinutes: number | null = null;
  private _accessRights: AccessRight[] = [];
  private _organizationKeys: string[] = [];
  private _authenticated = false;

  static getInstance(): SecurityContextStore {
    if (!SecurityContextStore._instance) {
      SecurityContextStore._instance = new SecurityContextStore();
    }
    return SecurityContextStore._instance;
  }

  get isAuthenticated(): boolean {
    return this._authenticated;
  }

  get ticket(): string | null {
    return this._ticket;
  }

  get hmacSecretKey(): string | null {
    return this._hmacSecretKey;
  }

  get userDisplayName(): string | null {
    return this._userDisplayName;
  }

  get userPrincipalName(): string | null {
    return this._userPrincipalName;
  }

  get sessionTimeoutMinutes(): number | null {
    return this._sessionTimeoutMinutes;
  }

  get accessRights(): ReadonlyArray<AccessRight> {
    return this._accessRights;
  }

  get organizationKeys(): ReadonlyArray<string> {
    return this._organizationKeys;
  }

  /**
   * Populate security context from a successful login response.
   */
  setFromLogin(params: {
    ticket: string;
    hmacSecretKey?: string;
    serverTimestamp?: string;
    userDisplayName?: string;
    userPrincipalName?: string;
    userType?: string;
    authority?: string;
    sessionTimeoutMinutes?: number;
    accessRights?: AccessRight[];
    organizationKeys?: string[];
  }): void {
    this._ticket = params.ticket;
    this._hmacSecretKey = params.hmacSecretKey ?? null;
    this._serverTimestamp = params.serverTimestamp ?? null;
    this._userDisplayName = params.userDisplayName ?? null;
    this._userPrincipalName = params.userPrincipalName ?? null;
    this._userType = params.userType ?? null;
    this._authority = params.authority ?? null;
    this._sessionTimeoutMinutes = params.sessionTimeoutMinutes ?? null;
    this._accessRights = params.accessRights ?? [];
    this._organizationKeys = params.organizationKeys ?? [];
    this._authenticated = true;
  }

  /**
   * Update ticket (e.g., from extended ticket in response).
   */
  updateTicket(ticket: string): void {
    this._ticket = ticket;
  }

  /**
   * Clear all security state (logout).
   */
  clear(): void {
    this._ticket = null;
    this._hmacSecretKey = null;
    this._serverTimestamp = null;
    this._userDisplayName = null;
    this._userPrincipalName = null;
    this._userType = null;
    this._authority = null;
    this._sessionTimeoutMinutes = null;
    this._accessRights = [];
    this._organizationKeys = [];
    this._authenticated = false;
  }

  /**
   * Check if user has a specific access right by code.
   */
  hasAccessRight(code: string): boolean {
    return this._accessRights.some((r) => r.code === code);
  }
}
