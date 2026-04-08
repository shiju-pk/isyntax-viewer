/**
 * Builds WCF XML-RPC style <Message> envelopes for ISPACS service calls.
 * All ISPACS services expect requests wrapped in <Message>...</Message>.
 */
export class WcfMessageBuilder {
  /**
   * Wrap an inner XML payload in a <Message> envelope.
   * @example wrap('<Login><loginRequest>...</loginRequest></Login>')
   *   => '<Message><Login><loginRequest>...</loginRequest></Login></Message>'
   */
  static wrap(innerXml: string): string {
    return `<Message>${innerXml}</Message>`;
  }

  /**
   * Build a login request XML.
   */
  static buildLoginRequest(params: {
    userName: string;
    password: string;
    authSource?: string;
    appName?: string;
    appVersion?: string;
    culture?: string;
  }): string {
    const source = params.authSource ?? 'ISITE';
    const appName = params.appName ?? 'iSyntaxViewer';
    const appVersion = params.appVersion ?? '1.0';
    const culture = params.culture ?? 'en-US';

    const inner =
      `<Login>` +
      `<loginRequest xmlns="uri://stentor.com/iSite/Authentication/Messages">` +
      `<AuthenticationSource>${WcfMessageBuilder.escapeXml(source)}</AuthenticationSource>` +
      `<UserName>${WcfMessageBuilder.escapeXml(params.userName)}</UserName>` +
      `<Password>${WcfMessageBuilder.escapeXml(params.password)}</Password>` +
      `<HostName>${WcfMessageBuilder.escapeXml(appName)}</HostName>` +
      `<IpAddress></IpAddress>` +
      `<ApplicationName>${WcfMessageBuilder.escapeXml(appName)}</ApplicationName>` +
      `<ApplicationVersion>${WcfMessageBuilder.escapeXml(appVersion)}</ApplicationVersion>` +
      `<Culture>${WcfMessageBuilder.escapeXml(culture)}</Culture>` +
      `<UICulture>${WcfMessageBuilder.escapeXml(culture)}</UICulture>` +
      `<IsLoginInfoRequired>false</IsLoginInfoRequired>` +
      `</loginRequest></Login>`;

    return WcfMessageBuilder.wrap(inner);
  }

  /**
   * Build a logout request XML.
   */
  static buildLogoutRequest(): string {
    return WcfMessageBuilder.wrap('<Logout></Logout>');
  }

  /**
   * Build a keep-alive (check login session) request XML.
   */
  static buildKeepAliveRequest(): string {
    return WcfMessageBuilder.wrap('<CheckLoginSession></CheckLoginSession>');
  }

  /**
   * Build a discovery service GetServices request XML.
   */
  static buildGetServicesRequest(appVersion = '4.4', appName = 'iSiteEnterprise'): string {
    const inner =
      `<GetServices>` +
      `<getServicesRequest xmlns="uri://medical.philips.com/2006/3/15/iSite/Services/Discovery/Messages">` +
      `<ServiceClient>` +
      `<Version>${WcfMessageBuilder.escapeXml(appVersion)}</Version>` +
      `<Application>${WcfMessageBuilder.escapeXml(appName)}</Application>` +
      `<Culture></Culture>` +
      `</ServiceClient>` +
      `</getServicesRequest></GetServices>`;

    return WcfMessageBuilder.wrap(inner);
  }

  /**
   * Build a GetAuthenticationSources request XML.
   */
  static buildGetAuthSourcesRequest(): string {
    return WcfMessageBuilder.wrap('<GetAuthenticationSources></GetAuthenticationSources>');
  }

  /**
   * Build a worklist DataRequest XML with QueryFilter entries.
   */
  static buildWorklistRequest(params: {
    queryType: string;
    rowCount?: number;
    filters: Array<{ column: string; value: string }>;
  }): string {
    const rowCount = params.rowCount ?? 100;
    let inner = `<DataRequest><QueryType>${WcfMessageBuilder.escapeXml(params.queryType)}</QueryType>` +
      `<RowCount>${rowCount}</RowCount>`;

    for (const f of params.filters) {
      inner += `<QueryFilter ColumnName="${WcfMessageBuilder.escapeXml(f.column)}" ` +
        `ColumnValue="${WcfMessageBuilder.escapeXml(f.value)}"></QueryFilter>`;
    }

    inner += `</DataRequest>`;
    return WcfMessageBuilder.wrap(inner);
  }

  /**
   * Escape XML special characters in a string value.
   */
  static escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
