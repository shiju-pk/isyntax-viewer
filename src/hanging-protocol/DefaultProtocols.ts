/**
 * DefaultProtocols — Built-in hanging protocol library.
 */

import type { HangingProtocol } from './types';

export const CT_SINGLE: HangingProtocol = {
  id: 'ct-single',
  name: 'CT Single',
  description: 'Standard CT single viewport',
  priority: 10,
  matchRules: [
    { attribute: 'modality', constraint: { equals: 'CT' }, weight: 10 },
  ],
  layout: '1x1',
  viewportSpecs: [
    { cellIndex: 0, seriesSelector: { seriesNumber: 1, instanceIndex: 'first' } },
  ],
};

export const CT_WITH_PRIOR: HangingProtocol = {
  id: 'ct-with-prior',
  name: 'CT with Prior',
  description: 'CT current + prior comparison',
  priority: 5,
  matchRules: [
    { attribute: 'modality', constraint: { equals: 'CT' }, weight: 10 },
  ],
  layout: '1x2',
  viewportSpecs: [
    { cellIndex: 0, seriesSelector: { seriesNumber: 1, instanceIndex: 'first' } },
    { cellIndex: 1, seriesSelector: { seriesNumber: 1, instanceIndex: 'first' }, isPrior: true },
  ],
  syncGroups: [
    { cellIndices: [0, 1], mode: 'all' },
  ],
};

export const MR_MULTI_SERIES: HangingProtocol = {
  id: 'mr-multi-series',
  name: 'MR Multi-Series',
  description: 'MR spread across 4 viewports',
  priority: 10,
  matchRules: [
    { attribute: 'modality', constraint: { equals: 'MR' }, weight: 10 },
  ],
  layout: '2x2',
  viewportSpecs: [
    { cellIndex: 0, seriesSelector: { seriesNumber: 1 } },
    { cellIndex: 1, seriesSelector: { seriesNumber: 2 } },
    { cellIndex: 2, seriesSelector: { seriesNumber: 3 } },
    { cellIndex: 3, seriesSelector: { seriesNumber: 4 } },
  ],
};

export const CR_DX_SINGLE: HangingProtocol = {
  id: 'cr-dx-single',
  name: 'CR/DX Single',
  description: 'Standard CR/DX single viewport',
  priority: 10,
  matchRules: [
    { attribute: 'modality', constraint: { regex: '^(CR|DX)$' }, weight: 10 },
  ],
  layout: '1x1',
  viewportSpecs: [
    { cellIndex: 0, seriesSelector: { seriesNumber: 1, instanceIndex: 'first' } },
  ],
};

export const MAMMO_STANDARD: HangingProtocol = {
  id: 'mammo-standard',
  name: 'Mammography Standard',
  description: 'Standard mammography 2x2 layout (RCC, LCC, RMLO, LMLO)',
  priority: 10,
  matchRules: [
    { attribute: 'modality', constraint: { equals: 'MG' }, weight: 10 },
  ],
  layout: '2x2',
  viewportSpecs: [
    { cellIndex: 0, seriesSelector: { seriesDescription: 'R CC' } },
    { cellIndex: 1, seriesSelector: { seriesDescription: 'L CC' } },
    { cellIndex: 2, seriesSelector: { seriesDescription: 'R MLO' } },
    { cellIndex: 3, seriesSelector: { seriesDescription: 'L MLO' } },
  ],
};

/**
 * All default protocols.
 */
export const DEFAULT_PROTOCOLS: HangingProtocol[] = [
  CT_SINGLE,
  CT_WITH_PRIOR,
  MR_MULTI_SERIES,
  CR_DX_SINGLE,
  MAMMO_STANDARD,
];
