import type { IWorklistService } from '../interfaces/IWorklistService';
import type { WorklistQuery, WorklistEntry } from '../IPACSAdapter';
import type { ISPACSAuthService } from './ISPACSAuthService';
import { WcfMessageBuilder } from '../../transport/wcf/WcfMessageBuilder';
import { WcfXmlParser } from '../../transport/wcf/WcfXmlParser';
import { Logger } from '../../core/logging/Logger';

const LOG_CAT = 'ISPACSWorklistService';

/**
 * Discovery service name for the worklist endpoint.
 * The ISPACS DiscoveryService returns this as the service name.
 */
const WORKLIST_SERVICE_NAME = 'WorkList';

/**
 * Query type constants matching the legacy ISPACS protocol.
 */
const QUERY_TYPES = {
  ExamWorkList: 'ExamWorkList',
  PatientWorkList: 'PatientWorkList',
  ExtendedPatientWorkList: 'ExtendedPatientWorkList',
} as const;

/**
 * Exam query attribute names (v1 — compatible with most ISPACS versions).
 */
const EXAM_ATTRS = {
  PatientLastName: 'PatientLastName',
  PatientFirstName: 'PatientFirstName',
  PatientId: 'PatientId',
  AccessionNumber: 'AccessionNumber',
  ModalityTypeCodes: 'ModalityTypeCodes',
  BeginExamDateTime: 'BeginExamDateTime',
  EndExamDateTime: 'EndExamDateTime',
  OrganizationKeys: 'OrganizationKeys',
} as const;

/**
 * Response attribute names used in <row> elements.
 */
const ROW_ATTRS = {
  // Patient
  PatientLastName: 'PatientLastName',
  PatientFirstName: 'PatientFirstName',
  PatientMiddleName: 'PatientMiddleName',
  PatientId: 'PatientId',
  PatientKey: 'PatientKey',
  PatientBirthDate: 'PatientBirthDate',
  PatientSexCode: 'PatientSexCode',
  // Exam
  ExamKey: 'ExamKey',
  AccessionNumber: 'AccessionNumber',
  ModalityTypeCode: 'ModalityTypeCode',
  ExamDescription: 'ExamDescription',
  ExamDateTime: 'ExamDateTime',
  ExamStatusCode: 'ExamStatusCode',
  OnlineImageCount: 'OnlineImageCount',
  HasReport: 'HasReport',
  BodyPartCode: 'BodyPartCode',
  OrderingLocationId: 'OrderingLocationId',
  ReferringProviderName: 'ReferringProviderName',
  ProviderLastName: 'ProviderLastName',
  ProviderFirstName: 'ProviderFirstName',
  PersonKey: 'PersonKey',
  OrganizationKey: 'OrganizationKey',
  OrganizationId: 'OrganizationId',
} as const;

/**
 * ISPACS Worklist Service implementation.
 *
 * Posts WCF XML DataRequest messages to the discovered WorkList endpoint
 * and parses the <row>-based XML response into WorklistEntry[].
 *
 * The service requires the ISPACSAuthService to have already called
 * discoverServices() so the WorkList endpoint is available.
 */
export class ISPACSWorklistService implements IWorklistService {
  private _authService: ISPACSAuthService;

  constructor(authService: ISPACSAuthService) {
    this._authService = authService;
  }

  // ─── Public API ──────────────────────────────────────────────

  async examSearch(query: WorklistQuery): Promise<WorklistEntry[]> {
    const servicePath = this._resolveWorklistPath();
    const filters = this._buildExamFilters(query);
    const maxResults = query.maxResults ?? 100;

    const requestXml = WcfMessageBuilder.buildWorklistRequest({
      queryType: QUERY_TYPES.ExamWorkList,
      rowCount: maxResults,
      filters,
    });

    Logger.info(LOG_CAT, `examSearch(): ${filters.length} filters, maxResults=${maxResults}`);
    // eslint-disable-next-line no-console
    console.log('[ISPACSWorklistService] examSearch request XML >>>', requestXml);

    const responseXml = await this._authService.transport.postAbsolute(servicePath, requestXml);
    return this._parseExamResponse(responseXml);
  }

  async patientSearch(query: WorklistQuery): Promise<WorklistEntry[]> {
    const servicePath = this._resolveWorklistPath();
    const filters = this._buildPatientFilters(query);
    const maxResults = query.maxResults ?? 100;

    const requestXml = WcfMessageBuilder.buildWorklistRequest({
      queryType: QUERY_TYPES.PatientWorkList,
      rowCount: maxResults,
      filters,
    });

    Logger.info(LOG_CAT, `patientSearch(): ${filters.length} filters, maxResults=${maxResults}`);
    // eslint-disable-next-line no-console
    console.log('[ISPACSWorklistService] patientSearch request XML >>>', requestXml);

    const responseXml = await this._authService.transport.postAbsolute(servicePath, requestXml);
    return this._parseExamResponse(responseXml);
  }

  async quickSearch(searchString: string, maxResults = 100): Promise<WorklistEntry[]> {
    const servicePath = this._resolveWorklistPath();
    const trimmed = searchString.trim();
    if (!trimmed) return [];

    const filters: Array<{ column: string; value: string }> = [];

    // Split on comma for last,first name pattern
    const parts = trimmed.split(',');
    const lastName = this._updateWildCards(parts[0]);
    if (lastName) {
      filters.push({ column: 'PatientLastName', value: lastName });
    }
    if (parts.length > 1) {
      const firstName = this._updateWildCards(parts[1]);
      if (firstName) {
        filters.push({ column: 'PatientFirstName', value: firstName });
      }
    }

    // Also search by PatientId and AccessionNumber
    const wildSearch = this._updateWildCards(trimmed);
    if (wildSearch) {
      filters.push({ column: 'PatientId', value: wildSearch });
    }
    if (trimmed.length > 0) {
      filters.push({ column: 'AccessionNumber', value: trimmed });
    }

    const requestXml = WcfMessageBuilder.buildWorklistRequest({
      queryType: QUERY_TYPES.ExtendedPatientWorkList,
      rowCount: maxResults,
      filters,
    });

    Logger.info(LOG_CAT, `quickSearch("${trimmed}"): ${filters.length} filters`);
    // eslint-disable-next-line no-console
    console.log('[ISPACSWorklistService] quickSearch request XML >>>', requestXml);

    const responseXml = await this._authService.transport.postAbsolute(servicePath, requestXml);
    return this._parseExamResponse(responseXml);
  }

  // ─── Filter Builders ─────────────────────────────────────────

  private _buildExamFilters(query: WorklistQuery): Array<{ column: string; value: string }> {
    const filters: Array<{ column: string; value: string }> = [];

    if (query.patientName) {
      const parts = query.patientName.split(',');
      const lastName = this._updateWildCards(parts[0]);
      if (lastName) {
        filters.push({ column: EXAM_ATTRS.PatientLastName, value: lastName });
      } else if (parts.length > 1) {
        filters.push({ column: EXAM_ATTRS.PatientLastName, value: '%' });
      }
      if (parts.length > 1) {
        const firstName = this._updateWildCards(parts[1]);
        if (firstName) {
          filters.push({ column: EXAM_ATTRS.PatientFirstName, value: firstName });
        }
      }
    }

    if (query.patientId) {
      const pid = this._updateWildCards(query.patientId);
      if (pid) {
        filters.push({ column: EXAM_ATTRS.PatientId, value: pid });
      }
    }

    if (query.accessionNumber) {
      filters.push({ column: EXAM_ATTRS.AccessionNumber, value: query.accessionNumber });
    }

    if (query.modality) {
      filters.push({ column: EXAM_ATTRS.ModalityTypeCodes, value: query.modality });
    }

    if (query.dateRange) {
      if (query.dateRange.from) {
        filters.push({ column: EXAM_ATTRS.BeginExamDateTime, value: query.dateRange.from });
      }
      if (query.dateRange.to) {
        filters.push({ column: EXAM_ATTRS.EndExamDateTime, value: query.dateRange.to });
      }
    }

    return filters;
  }

  private _buildPatientFilters(query: WorklistQuery): Array<{ column: string; value: string }> {
    const filters: Array<{ column: string; value: string }> = [];

    if (query.patientName) {
      const parts = query.patientName.split(',');
      const lastName = this._updateWildCards(parts[0]);
      if (lastName) {
        filters.push({ column: 'PatientLastName', value: lastName });
      } else if (parts.length > 1) {
        filters.push({ column: 'PatientLastName', value: '%' });
      }
      if (parts.length > 1) {
        const firstName = this._updateWildCards(parts[1]);
        if (firstName) {
          filters.push({ column: 'PatientFirstName', value: firstName });
        }
      }
    }

    if (query.patientId) {
      const pid = this._updateWildCards(query.patientId);
      if (pid) {
        filters.push({ column: 'PatientId', value: pid });
      }
    }

    return filters;
  }

  // ─── Response Parsing ────────────────────────────────────────

  private _parseExamResponse(xml: string): WorklistEntry[] {
    const doc = WcfXmlParser.parse(xml);
    const rows = WcfXmlParser.findAll(doc, 'row');
    const entries: WorklistEntry[] = [];

    if (rows.length === 0) {
      // Check for error
      const errorMsg = WcfXmlParser.getText(doc, 'ErrorMessage');
      if (errorMsg) {
        Logger.warn(LOG_CAT, `Server error: ${errorMsg}`);
        throw new Error(`Worklist query failed: ${errorMsg}`);
      }
      Logger.info(LOG_CAT, 'No results returned');
      return [];
    }

    for (const row of rows) {
      const examKey = row.getAttribute(ROW_ATTRS.ExamKey) ?? '';
      const patientLastName = row.getAttribute(ROW_ATTRS.PatientLastName) ?? '';
      const patientFirstName = row.getAttribute(ROW_ATTRS.PatientFirstName) ?? '';
      const patientMiddleName = row.getAttribute(ROW_ATTRS.PatientMiddleName) ?? '';
      const patientId = row.getAttribute(ROW_ATTRS.PatientId) ?? '';
      const accessionNumber = row.getAttribute(ROW_ATTRS.AccessionNumber) ?? '';
      const modality = row.getAttribute(ROW_ATTRS.ModalityTypeCode) ?? '';
      const examDateTime = row.getAttribute(ROW_ATTRS.ExamDateTime) ?? '';
      const examDescription = row.getAttribute(ROW_ATTRS.ExamDescription) ?? '';
      const onlineImageCount = parseInt(row.getAttribute(ROW_ATTRS.OnlineImageCount) ?? '0', 10);
      const bodyPart = row.getAttribute(ROW_ATTRS.BodyPartCode) ?? '';
      const examStatus = row.getAttribute(ROW_ATTRS.ExamStatusCode) ?? '';
      const referringProvider = row.getAttribute(ROW_ATTRS.ReferringProviderName) ?? '';
      const patientKey = row.getAttribute(ROW_ATTRS.PatientKey) ?? '';

      // Build display name: "LastName, FirstName MiddleName"
      let patientName = patientLastName;
      if (patientFirstName) {
        patientName += `, ${patientFirstName}`;
      }
      if (patientMiddleName) {
        patientName += ` ${patientMiddleName}`;
      }

      entries.push({
        examKey,
        patientName: patientName.trim(),
        patientId,
        accessionNumber,
        modality,
        studyDate: examDateTime,
        studyDescription: examDescription,
        studyUIDs: examKey ? [examKey] : [],
        // Extended fields available via type assertion if needed
        ...(onlineImageCount > 0 && { imageCount: onlineImageCount }),
        ...(bodyPart && { bodyPart }),
        ...(examStatus && { examStatus }),
        ...(referringProvider && { referringProvider }),
        ...(patientKey && { patientKey }),
      });
    }

    Logger.info(LOG_CAT, `Parsed ${entries.length} worklist entries`);
    return entries;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Resolve the WorkList service path from the discovery service map.
   * Throws if discovery hasn't been run or WorkList wasn't found.
   */
  private _resolveWorklistPath(): string {
    const serviceMap = this._authService.serviceMap;
    // Try exact name first, then case-insensitive fallback
    let entry = serviceMap.get(WORKLIST_SERVICE_NAME);
    if (!entry) {
      // Search case-insensitively for any service containing 'worklist'
      for (const [key, val] of serviceMap) {
        if (key.toLowerCase().includes('worklist')) {
          entry = val;
          break;
        }
      }
    }

    if (!entry) {
      throw new Error(
        `WorkList service not discovered. Available services: [${Array.from(serviceMap.keys()).join(', ')}]`,
      );
    }

    Logger.info(LOG_CAT, `Resolved worklist path: ${entry.absolutePath}`);
    return entry.absolutePath;
  }

  /**
   * Replace '*' with '%' and append '%' (ISPACS wildcard convention).
   * Returns empty string if result is just '%'.
   */
  private _updateWildCards(input: string): string {
    let val = input.trim().replace(/\*/g, '%') + '%';
    while (val.includes('%%')) {
      val = val.replace(/%%/g, '%');
    }
    return val === '%' ? '' : val;
  }
}
