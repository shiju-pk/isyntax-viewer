import type { AuthCredentials, AuthResult } from '../IPACSAdapter';

/**
 * Authentication service interface.
 * Maps to /InfrastructureServices/ endpoints in ISPACS.
 */
export interface IAuthService {
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;
  keepAlive?(): Promise<boolean>;
  getSecurityContext?(): SecurityContext | null;

  /** Discover backend services (populates service map). */
  discoverServices?(): Promise<void>;

  /** Get the list of authentication sources from the backend. */
  getAuthenticationSources?(): Promise<AuthenticationSource[]>;
}

export interface AuthenticationSource {
  name: string;
  displayName: string;
  isVisible: boolean;
  isPasswordChangeEnabled: boolean;
  supportedCredentials: string[];
}

export interface SecurityContext {
  ticket: string;
  hmacSecretKey?: string;
  serverTimestamp?: string;
  userDisplayName?: string;
  userPrincipalName?: string;
  sessionTimeoutMinutes?: number;
  accessRights?: AccessRight[];
  organizationKeys?: string[];
}

export interface AccessRight {
  code: string;
  category: string;
}
