/**
 * viewport-sync — Cross-viewport synchronization
 *
 * Linked scrolling by Frame of Reference UID and reference line rendering.
 */

export { LinkedScrollManager } from './LinkedScrollManager';
export { calculateReferenceLines } from './ReferenceLineCalculator';

export type {
  LinkedViewportEntry,
  ReferenceLine,
  LinkedScrollCallback,
  ReferenceLineCallback,
} from './types';
