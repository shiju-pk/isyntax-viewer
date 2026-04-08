import type { IAuthService, SecurityContext, AuthenticationSource } from '../interfaces/IAuthService';
import type { AuthCredentials, AuthResult } from '../IPACSAdapter';
import type { ServiceMapEntry } from '../interfaces/IDiscoveryService';
import { WcfTransport } from '../../transport/wcf/WcfTransport';
import { WcfMessageBuilder } from '../../transport/wcf/WcfMessageBuilder';
import { WcfXmlParser } from '../../transport/wcf/WcfXmlParser';
import { HmacSigner } from '../../transport/wcf/HmacSigner';
import { SecurityContextStore } from '../../core/security/SecurityContext';
import { Logger } from '../../core/logging/Logger';

const LOG_CAT = 'ISPACSAuthService';

/**
 * ISPACS authentication service.
 * Implements the full login flow:
 *   1. discoverServices()  — POST to DiscoveryService → build service map
 *   2. getAuthenticationSources() — POST to AuthenticationService → list auth sources
 *   3. authenticate() — POST login request with selected auth source
 *   4. logout() / keepAlive()
 */
export class ISPACSAuthService implements IAuthService {
  private _infrastructureBase: string;
  private _transport: WcfTransport;
  private _hmacSigner: HmacSigner;
  private _securityCtx = SecurityContextStore.getInstance();

  // Discovered endpoints
  private _serviceMap = new Map<string, ServiceMapEntry>();
  private _authServicePath: string | null = null;
  private _discoveryPaths: string[];

  // Cached auth sources
  private _authSources: AuthenticationSource[] = [];

  constructor(infrastructureBase: string) {
    this._infrastructureBase = infrastructureBase;
    this._hmacSigner = new HmacSigner();
    this._transport = new WcfTransport(infrastructureBase, this._hmacSigner);
    // Try newer path first, then older
    this._discoveryPaths = [
      '/DiscoveryService/DiscoveryService.ashx',
      '/DiscoveryService.ashx',
    ];
  }

  // ─── Discovery ────────────────────────────────────────────────

  async discoverServices(): Promise<void> {
    Logger.info(LOG_CAT, 'discoverServices()');
    const requestXml = WcfMessageBuilder.buildGetServicesRequest();

    let responseXml: string | null = null;
    for (const discoveryPath of this._discoveryPaths) {
      try {
        responseXml = await this._transport.post(discoveryPath, requestXml);
        Logger.info(LOG_CAT, `Discovery succeeded at ${discoveryPath}`);
        break;
      } catch (err) {
        Logger.warn(LOG_CAT, `Discovery failed at ${discoveryPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!responseXml) {
      throw new Error('Service discovery failed on all endpoints');
    }

    this._parseDiscoveryResponse(responseXml);
  }

  private _parseDiscoveryResponse(xml: string): void {
    const doc = WcfXmlParser.parse(xml);
    const serviceElements = WcfXmlParser.findAll(doc, 'Service');
    this._serviceMap.clear();

    for (const svcEl of serviceElements) {
      const name = WcfXmlParser.getText(svcEl, 'Name');
      const absolutePath = WcfXmlParser.getText(svcEl, 'AbsolutePath');
      if (!name || !absolutePath) continue;

      const entry: ServiceMapEntry = {
        name,
        absolutePath,
        scheme: WcfXmlParser.getText(svcEl, 'Scheme') ?? undefined,
        type: WcfXmlParser.getText(svcEl, 'Type') ?? undefined,
        isAnonymous: WcfXmlParser.getText(svcEl, 'IsAnonymous') === 'true',
      };
      this._serviceMap.set(name, entry);
    }

    Logger.info(LOG_CAT, `Discovered ${this._serviceMap.size} services: [${Array.from(this._serviceMap.keys()).join(', ')}]`);

    // Resolve auth service path
    const authEntry = this._serviceMap.get('AuthenticationService');
    if (authEntry) {
      this._authServicePath = authEntry.absolutePath;
      Logger.info(LOG_CAT, `Auth service path: ${this._authServicePath}`);
    } else {
      Logger.warn(LOG_CAT, 'AuthenticationService not found in discovery response');
    }
  }

  // ─── Auth Sources ─────────────────────────────────────────────

  async getAuthenticationSources(): Promise<AuthenticationSource[]> {
    if (!this._authServicePath) {
      throw new Error('Auth service not discovered. Call discoverServices() first.');
    }

    Logger.info(LOG_CAT, 'getAuthenticationSources()');
    const requestXml = WcfMessageBuilder.buildGetAuthSourcesRequest();
    const responseXml = await this._transport.post(this._authServicePath, requestXml);

    this._authSources = this._parseAuthSourcesResponse(responseXml);
    Logger.info(LOG_CAT, `Got ${this._authSources.length} auth sources: [${this._authSources.map((s) => s.name).join(', ')}]`);
    return this._authSources;
  }

  private _parseAuthSourcesResponse(xml: string): AuthenticationSource[] {
    const doc = WcfXmlParser.parse(xml);
    const sources: AuthenticationSource[] = [];

    const authSourceElements = WcfXmlParser.findAll(doc, 'AuthenticationSource');
    for (const srcEl of authSourceElements) {
      const name = WcfXmlParser.getText(srcEl, 'Name') ?? '';
      const displayName = WcfXmlParser.getText(srcEl, 'DisplayName') ?? name;
      const isVisible = WcfXmlParser.getText(srcEl, 'IsVisible') === 'true';
      const isPasswordChangeEnabled = WcfXmlParser.getText(srcEl, 'IsPasswordChangeEnabled') === 'true';

      // Collect supported credentials
      const supportedCredentials: string[] = [];
      const credElements = WcfXmlParser.findAll(srcEl, 'CredentialType');
      for (const credEl of credElements) {
        const cred = credEl.textContent?.trim();
        if (cred) supportedCredentials.push(cred);
      }
      // Also check SupportedCredential elements
      const credElements2 = WcfXmlParser.findAll(srcEl, 'SupportedCredential');
      for (const credEl of credElements2) {
        const cred = credEl.textContent?.trim();
        if (cred) supportedCredentials.push(cred);
      }

      sources.push({ name, displayName, isVisible, isPasswordChangeEnabled, supportedCredentials });
    }

    // Filter to visible-only
    return sources.filter((s) => s.isVisible);
  }

  // ─── Login ────────────────────────────────────────────────────

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    if (!this._authServicePath) {
      throw new Error('Auth service not discovered. Call discoverServices() first.');
    }

    Logger.info(LOG_CAT, `authenticate(${credentials.username}, source=${credentials.authSource ?? 'ISITE'})`);
    const loginStartTime = Date.now();

    const requestXml = WcfMessageBuilder.buildLoginRequest({
      userName: credentials.username,
      password: credentials.password,
      authSource: credentials.authSource,
      culture: credentials.culture,
    });

    try {
      const responseXml = await this._transport.post(this._authServicePath, requestXml);
      const latencyMs = (Date.now() - loginStartTime) / 2;
      return this._parseLoginResponse(responseXml, credentials.username, latencyMs);
    } catch (err) {
      Logger.error(LOG_CAT, `authenticate() error: ${err instanceof Error ? err.message : String(err)}`);
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Login failed',
      };
    }
  }

  private _parseLoginResponse(xml: string, username: string, latencyMs: number): AuthResult {
    const doc = WcfXmlParser.parse(xml);

    // Find the LoginResponse element
    const loginRespEl = WcfXmlParser.findFirst(doc, 'LoginResponse');
    if (!loginRespEl) {
      return { success: false, errorMessage: 'Invalid login response' };
    }

    const result = WcfXmlParser.getText(loginRespEl, 'Result') ?? 'Failure';

    if (result === 'Failure') {
      return { success: false, errorMessage: 'Authentication failed' };
    }

    // Extract security context
    const ticket = WcfXmlParser.getText(loginRespEl, 'Ticket') ?? '';
    const hmacSecretKey = WcfXmlParser.getText(loginRespEl, 'HMACSecretKey') ?? undefined;
    const serverTimestamp = WcfXmlParser.getText(loginRespEl, 'ServerTimestamp') ?? undefined;
    const userDisplayName = WcfXmlParser.getText(loginRespEl, 'UserDisplayName') ?? undefined;
    const userPrincipalName = WcfXmlParser.getText(loginRespEl, 'UserPrincipalName') ?? username;
    const userType = WcfXmlParser.getText(loginRespEl, 'UserType') ?? undefined;
    const authority = WcfXmlParser.getText(loginRespEl, 'Authority') ?? undefined;
    const sessionTimeoutStr = WcfXmlParser.getText(loginRespEl, 'SessionTimeOutMinutes');
    const sessionTimeoutMinutes = sessionTimeoutStr ? parseInt(sessionTimeoutStr, 10) : undefined;

    // Initialize HMAC if secret key is provided
    if (hmacSecretKey && ticket) {
      this._hmacSigner.enable(hmacSecretKey, ticket);
      Logger.info(LOG_CAT, `HMAC enabled (latency=${latencyMs.toFixed(0)}ms)`);
    }

    // Populate security context
    this._securityCtx.setFromLogin({
      ticket,
      hmacSecretKey,
      serverTimestamp,
      userDisplayName,
      userPrincipalName,
      userType,
      authority,
      sessionTimeoutMinutes,
    });

    Logger.info(LOG_CAT, `Login success: ${userDisplayName ?? userPrincipalName} (result=${result})`);

    // Check for error-ish result codes that are not 'Success'
    const isSuccess = result === 'Success' || result === 'PasswordExpired';
    if (result === 'PasswordExpired') {
      return { success: true, sessionToken: ticket, errorMessage: 'Password expired — please change your password' };
    }

    if (!isSuccess) {
      return { success: false, errorMessage: `Login result: ${result}` };
    }

    return { success: true, sessionToken: ticket };
  }

  // ─── Logout ───────────────────────────────────────────────────

  async logout(): Promise<void> {
    Logger.info(LOG_CAT, 'logout()');
    if (this._authServicePath) {
      try {
        const requestXml = WcfMessageBuilder.buildLogoutRequest();
        await this._transport.post(this._authServicePath, requestXml);
      } catch (err) {
        Logger.warn(LOG_CAT, `logout() error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this._hmacSigner.disable();
    this._securityCtx.clear();
  }

  // ─── Session ──────────────────────────────────────────────────

  isAuthenticated(): boolean {
    return this._securityCtx.isAuthenticated;
  }

  async keepAlive(): Promise<boolean> {
    if (!this._authServicePath) return false;

    try {
      const requestXml = WcfMessageBuilder.buildKeepAliveRequest();
      const responseXml = await this._transport.post(this._authServicePath, requestXml);
      const doc = WcfXmlParser.parse(responseXml);

      // Check IsAuthenticated in CheckLoginSessionResponse
      const isAuth = WcfXmlParser.getText(doc, 'IsAuthenticated');
      const upn = WcfXmlParser.getText(doc, 'UserPrincipalName');

      if (isAuth === 'true' && upn === this._securityCtx.userPrincipalName) {
        // Check for ExtendedTicket
        const extTicket = WcfXmlParser.getText(doc, 'ExtendedTicket');
        if (extTicket) {
          this._hmacSigner.updateTicket(extTicket);
          this._securityCtx.updateTicket(extTicket);
        }
        return true;
      }

      Logger.warn(LOG_CAT, 'keepAlive(): session expired');
      return false;
    } catch (err) {
      Logger.error(LOG_CAT, `keepAlive() error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  getSecurityContext(): SecurityContext | null {
    if (!this._securityCtx.isAuthenticated) return null;
    return {
      ticket: this._securityCtx.ticket!,
      hmacSecretKey: this._securityCtx.hmacSecretKey ?? undefined,
      userDisplayName: this._securityCtx.userDisplayName ?? undefined,
      userPrincipalName: this._securityCtx.userPrincipalName ?? undefined,
      sessionTimeoutMinutes: this._securityCtx.sessionTimeoutMinutes ?? undefined,
    };
  }

  // ─── Accessors ────────────────────────────────────────────────

  get serviceMap(): ReadonlyMap<string, ServiceMapEntry> {
    return this._serviceMap;
  }

  get authSources(): ReadonlyArray<AuthenticationSource> {
    return this._authSources;
  }

  get transport(): WcfTransport {
    return this._transport;
  }
}
