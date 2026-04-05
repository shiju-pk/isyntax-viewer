/**
 * presentation-state — PS model and management
 *
 * Models the PresentationState → PSWindow → PSImage hierarchy.
 */

export {
  PSType,
  PS_TYPE_PRIORITY,
  PSStorageType,
  PSLoadStatus,
  PSWindowType,
  createDefaultStackAttributes,
  createDefaultPSDescriptor,
  comparePSDescriptors,
} from './types';

export type {
  PSDescriptor,
  VOILUTModule,
  PresentationLUTModule,
  StackAttributes,
  PSImage,
  PSWindow,
  PresentationState,
} from './types';

// Image sequencing
export {
  sequenceImages,
  detectSortStrategy,
  sortImageIds,
} from './ImageSequencer';
export type {
  SortStrategy,
  ImageSequencerOptions,
  SequencerEntry,
} from './ImageSequencer';
