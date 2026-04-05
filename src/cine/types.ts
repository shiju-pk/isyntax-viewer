/**
 * Cine Engine — Type Definitions
 *
 * Timer-based frame playback for multi-frame images and series stacks.
 * Ported from legacy `cinetimer.js`, `cinefetcher.js`, `cinesequencer.js`.
 */

/** Cine playback direction. */
export type CineDirection = 'forward' | 'backward' | 'bounce';

/** Cine playback state. */
export type CinePlaybackState = 'stopped' | 'playing' | 'paused';

/** Configuration for cine playback. */
export interface CineConfig {
  /** Frames per second (default 30). */
  fps: number;

  /** Playback direction (default 'forward'). */
  direction: CineDirection;

  /** Whether to loop when reaching the end (default true). */
  loop: boolean;

  /** First frame index (0-based, default 0). */
  startFrame: number;

  /** Last frame index (0-based, default totalFrames-1). */
  endFrame: number;
}

/** Default cine configuration. */
export const DEFAULT_CINE_CONFIG: CineConfig = {
  fps: 30,
  direction: 'forward',
  loop: true,
  startFrame: 0,
  endFrame: -1, // sentinel: use totalFrames-1
};

/** Events emitted by the CinePlayer. */
export interface CinePlayerEvents {
  /** Emitted when the frame index changes. */
  frameChange: (frameIndex: number) => void;

  /** Emitted when playback state changes. */
  stateChange: (state: CinePlaybackState) => void;

  /** Emitted when playback FPS is adjusted. */
  fpsChange: (fps: number) => void;
}
