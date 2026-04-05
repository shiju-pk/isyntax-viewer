/**
 * CinePlayer — Timer-based frame playback engine.
 *
 * Manages cine playback for multi-frame images and series stacks using
 * requestAnimationFrame for smooth frame timing. Supports forward,
 * backward, and bounce directions with configurable FPS and looping.
 *
 * Framework-agnostic: emits callbacks, no React/DOM dependency.
 *
 * Ported from legacy `cinetimer.js` / `cineactionhandler.js`.
 */

import type {
  CineConfig,
  CineDirection,
  CinePlaybackState,
} from './types';
import { DEFAULT_CINE_CONFIG } from './types';

export type FrameChangeCallback = (frameIndex: number) => void;
export type StateChangeCallback = (state: CinePlaybackState) => void;

export class CinePlayer {
  private _config: CineConfig;
  private _totalFrames: number;
  private _currentFrame: number;
  private _state: CinePlaybackState = 'stopped';
  private _bounceForward = true;

  // Timing
  private _rafId: number | null = null;
  private _lastFrameTime = 0;

  // Callbacks
  private _onFrameChange: Set<FrameChangeCallback> = new Set();
  private _onStateChange: Set<StateChangeCallback> = new Set();

  constructor(totalFrames: number, config?: Partial<CineConfig>) {
    this._totalFrames = totalFrames;
    this._config = { ...DEFAULT_CINE_CONFIG, ...config };

    // Resolve sentinel endFrame
    if (this._config.endFrame < 0) {
      this._config.endFrame = Math.max(0, totalFrames - 1);
    }

    this._currentFrame = this._config.startFrame;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Start or resume playback. */
  play(): void {
    if (this._state === 'playing') return;
    if (this._totalFrames <= 1) return;

    this._state = 'playing';
    this._lastFrameTime = performance.now();
    this._notifyStateChange();
    this._scheduleNextFrame();
  }

  /** Pause playback (can resume with play()). */
  pause(): void {
    if (this._state !== 'playing') return;
    this._cancelFrame();
    this._state = 'paused';
    this._notifyStateChange();
  }

  /** Stop playback and reset to start frame. */
  stop(): void {
    this._cancelFrame();
    this._state = 'stopped';
    this._currentFrame = this._config.startFrame;
    this._bounceForward = true;
    this._notifyStateChange();
    this._notifyFrameChange();
  }

  /** Toggle between play and pause. */
  toggle(): void {
    if (this._state === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  /** Step one frame forward. */
  stepForward(): void {
    if (this._state === 'playing') this.pause();
    this._advanceFrame('forward');
    this._notifyFrameChange();
  }

  /** Step one frame backward. */
  stepBackward(): void {
    if (this._state === 'playing') this.pause();
    this._advanceFrame('backward');
    this._notifyFrameChange();
  }

  /** Jump to a specific frame. */
  goToFrame(index: number): void {
    const clamped = Math.max(
      this._config.startFrame,
      Math.min(this._config.endFrame, index),
    );
    if (clamped !== this._currentFrame) {
      this._currentFrame = clamped;
      this._notifyFrameChange();
    }
  }

  /** Update FPS during playback. */
  setFPS(fps: number): void {
    this._config.fps = Math.max(1, Math.min(120, fps));
  }

  /** Update playback direction. */
  setDirection(direction: CineDirection): void {
    this._config.direction = direction;
    this._bounceForward = direction !== 'backward';
  }

  /** Update loop setting. */
  setLoop(loop: boolean): void {
    this._config.loop = loop;
  }

  /** Update total frame count (e.g., when switching series). */
  setTotalFrames(totalFrames: number): void {
    this._totalFrames = totalFrames;
    this._config.endFrame = Math.max(0, totalFrames - 1);
    if (this._currentFrame > this._config.endFrame) {
      this._currentFrame = this._config.startFrame;
      this._notifyFrameChange();
    }
  }

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  get currentFrame(): number { return this._currentFrame; }
  get state(): CinePlaybackState { return this._state; }
  get isPlaying(): boolean { return this._state === 'playing'; }
  get fps(): number { return this._config.fps; }
  get totalFrames(): number { return this._totalFrames; }
  get config(): Readonly<CineConfig> { return this._config; }

  // -----------------------------------------------------------------------
  // Subscriptions
  // -----------------------------------------------------------------------

  onFrameChange(cb: FrameChangeCallback): () => void {
    this._onFrameChange.add(cb);
    return () => { this._onFrameChange.delete(cb); };
  }

  onStateChange(cb: StateChangeCallback): () => void {
    this._onStateChange.add(cb);
    return () => { this._onStateChange.delete(cb); };
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose(): void {
    this._cancelFrame();
    this._onFrameChange.clear();
    this._onStateChange.clear();
    this._state = 'stopped';
  }

  // -----------------------------------------------------------------------
  // Frame loop (rAF-based)
  // -----------------------------------------------------------------------

  private _scheduleNextFrame(): void {
    this._rafId = requestAnimationFrame((timestamp) => this._tick(timestamp));
  }

  private _tick(timestamp: number): void {
    if (this._state !== 'playing') return;

    const frameDuration = 1000 / this._config.fps;
    const elapsed = timestamp - this._lastFrameTime;

    if (elapsed >= frameDuration) {
      this._lastFrameTime = timestamp - (elapsed % frameDuration);
      const advanced = this._advanceFrame(this._getEffectiveDirection());

      if (!advanced && !this._config.loop) {
        this.stop();
        return;
      }

      this._notifyFrameChange();
    }

    this._scheduleNextFrame();
  }

  private _advanceFrame(direction: 'forward' | 'backward'): boolean {
    const { startFrame, endFrame, loop } = this._config;

    if (direction === 'forward') {
      if (this._currentFrame < endFrame) {
        this._currentFrame++;
        return true;
      }
      if (loop) {
        if (this._config.direction === 'bounce') {
          this._bounceForward = false;
          this._currentFrame--;
          return true;
        }
        this._currentFrame = startFrame;
        return true;
      }
      return false;
    } else {
      if (this._currentFrame > startFrame) {
        this._currentFrame--;
        return true;
      }
      if (loop) {
        if (this._config.direction === 'bounce') {
          this._bounceForward = true;
          this._currentFrame++;
          return true;
        }
        this._currentFrame = endFrame;
        return true;
      }
      return false;
    }
  }

  private _getEffectiveDirection(): 'forward' | 'backward' {
    if (this._config.direction === 'bounce') {
      return this._bounceForward ? 'forward' : 'backward';
    }
    return this._config.direction === 'backward' ? 'backward' : 'forward';
  }

  private _cancelFrame(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // -----------------------------------------------------------------------
  // Notification
  // -----------------------------------------------------------------------

  private _notifyFrameChange(): void {
    for (const cb of this._onFrameChange) {
      cb(this._currentFrame);
    }
  }

  private _notifyStateChange(): void {
    for (const cb of this._onStateChange) {
      cb(this._state);
    }
  }
}
