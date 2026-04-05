/**
 * cine — Cine Playback Engine
 *
 * Timer-based frame playback for multi-frame images and series stacks.
 */

export { CinePlayer } from './CinePlayer';
export type { FrameChangeCallback, StateChangeCallback } from './CinePlayer';

export type {
  CineConfig,
  CineDirection,
  CinePlaybackState,
  CinePlayerEvents,
} from './types';
export { DEFAULT_CINE_CONFIG } from './types';
