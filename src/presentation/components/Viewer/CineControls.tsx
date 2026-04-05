/**
 * CineControls — UI component for cine playback control.
 *
 * Displays play/pause, step forward/backward, speed control, and
 * direction toggle. Designed to sit below the viewport when cine mode
 * is active.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeftRight,
} from 'lucide-react';
import { CinePlayer } from '../../../cine/CinePlayer';
import type { CineDirection, CinePlaybackState } from '../../../cine/types';

interface CineControlsProps {
  /** Total number of frames (images or multi-frame frames). */
  totalFrames: number;
  /** Current frame index (0-based). */
  currentFrame: number;
  /** Called when the cine player requests a frame change. */
  onFrameChange: (frameIndex: number) => void;
  /** Initial FPS (default 15). */
  initialFps?: number;
}

const FPS_PRESETS = [5, 10, 15, 20, 25, 30];
const DIRECTION_LABELS: Record<CineDirection, string> = {
  forward: '→',
  backward: '←',
  bounce: '↔',
};
const DIRECTION_CYCLE: CineDirection[] = ['forward', 'backward', 'bounce'];

export default function CineControls({
  totalFrames,
  currentFrame,
  onFrameChange,
  initialFps = 15,
}: CineControlsProps) {
  const playerRef = useRef<CinePlayer | null>(null);
  const [state, setState] = useState<CinePlaybackState>('stopped');
  const [fps, setFps] = useState(initialFps);
  const [direction, setDirection] = useState<CineDirection>('forward');

  // Initialize player
  useEffect(() => {
    const player = new CinePlayer(totalFrames, { fps: initialFps });
    playerRef.current = player;

    const unsubFrame = player.onFrameChange((idx) => {
      onFrameChange(idx);
    });
    const unsubState = player.onStateChange((s) => {
      setState(s);
    });

    return () => {
      unsubFrame();
      unsubState();
      player.dispose();
      playerRef.current = null;
    };
  }, [totalFrames]);

  // Sync FPS changes
  useEffect(() => {
    playerRef.current?.setFPS(fps);
  }, [fps]);

  // Sync total frames
  useEffect(() => {
    playerRef.current?.setTotalFrames(totalFrames);
  }, [totalFrames]);

  const handlePlayPause = useCallback(() => {
    playerRef.current?.toggle();
  }, []);

  const handleStop = useCallback(() => {
    playerRef.current?.stop();
  }, []);

  const handleStepForward = useCallback(() => {
    playerRef.current?.stepForward();
  }, []);

  const handleStepBackward = useCallback(() => {
    playerRef.current?.stepBackward();
  }, []);

  const handleDirectionCycle = useCallback(() => {
    setDirection((prev) => {
      const idx = DIRECTION_CYCLE.indexOf(prev);
      const next = DIRECTION_CYCLE[(idx + 1) % DIRECTION_CYCLE.length];
      playerRef.current?.setDirection(next);
      return next;
    });
  }, []);

  const handleFpsChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFps(Number(e.target.value));
  }, []);

  const isPlaying = state === 'playing';

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700/50">
      {/* Step backward */}
      <button
        onClick={handleStepBackward}
        disabled={isPlaying}
        title="Step backward"
        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 transition-colors"
      >
        <SkipBack size={14} />
      </button>

      {/* Play / Pause */}
      <button
        onClick={handlePlayPause}
        title={isPlaying ? 'Pause' : 'Play'}
        className={`p-1.5 rounded transition-colors ${
          isPlaying
            ? 'bg-blue-600 text-white hover:bg-blue-500'
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
        }`}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* Step forward */}
      <button
        onClick={handleStepForward}
        disabled={isPlaying}
        title="Step forward"
        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 transition-colors"
      >
        <SkipForward size={14} />
      </button>

      {/* Separator */}
      <div className="w-px h-4 bg-gray-700 mx-1" />

      {/* Direction toggle */}
      <button
        onClick={handleDirectionCycle}
        title={`Direction: ${direction}`}
        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors min-w-[28px] text-center"
      >
        {direction === 'bounce' ? (
          <ArrowLeftRight size={14} />
        ) : direction === 'backward' ? (
          <ChevronsLeft size={14} />
        ) : (
          <ChevronsRight size={14} />
        )}
      </button>

      {/* FPS selector */}
      <select
        value={fps}
        onChange={handleFpsChange}
        title="Frames per second"
        className="bg-gray-800 text-gray-300 text-xs rounded px-1 py-0.5 border border-gray-700 focus:outline-none focus:border-blue-500"
      >
        {FPS_PRESETS.map((f) => (
          <option key={f} value={f}>{f} fps</option>
        ))}
      </select>

      {/* Frame counter */}
      <span className="text-[11px] text-gray-500 tabular-nums ml-auto">
        {currentFrame + 1} / {totalFrames}
      </span>
    </div>
  );
}
