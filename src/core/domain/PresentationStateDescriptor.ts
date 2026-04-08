/**
 * Describes a Presentation State reference associated with a study.
 */
export interface PresentationStateDescriptor {
  key: string;
  description: string;
  psType: PSType;
  storageType: PSStorageType;
  creatorName?: string;
  creationDateTime?: string;
  accessionNumber?: string;
}

export enum PSType {
  RawDICOM = 'RawDICOM',
  Custom = 'Custom',
  GSPS = 'GSPS',
}

export enum PSStorageType {
  ISite = 'ISite',
  Other = 'Other',
}
