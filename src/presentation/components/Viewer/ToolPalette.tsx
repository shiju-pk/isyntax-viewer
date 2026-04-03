import {
  Move, ZoomIn, SunMedium, RotateCcw, RotateCw, Download, Info,
  Ruler, Triangle, Circle, Square, ArrowUpRight, Crosshair,
  Paintbrush, Eraser, SlidersHorizontal, Scissors, PaintBucket,
  FlipHorizontal2, FlipVertical2, RefreshCw,
} from 'lucide-react';
import type { InteractionMode } from '../../../core/types';

interface ToolPaletteProps {
  activeMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  onReset: () => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  onRotateRight90?: () => void;
  onDownload?: () => void;
  canDownload?: boolean;
  showMetadata?: boolean;
  onToggleMetadata?: () => void;
}

const navigationTools: { mode: InteractionMode; icon: typeof Move; label: string }[] = [
  { mode: 'pan', icon: Move, label: 'Pan' },
  { mode: 'zoom', icon: ZoomIn, label: 'Zoom' },
  { mode: 'windowLevel', icon: SunMedium, label: 'W/L' },
  { mode: 'rotate', icon: RefreshCw, label: 'Rotate (drag)' },
];

const annotationTools: { mode: InteractionMode; icon: typeof Move; label: string }[] = [
  { mode: 'length', icon: Ruler, label: 'Length' },
  { mode: 'angle', icon: Triangle, label: 'Angle' },
  { mode: 'ellipticalROI', icon: Circle, label: 'Elliptical ROI' },
  { mode: 'rectangleROI', icon: Square, label: 'Rectangle ROI' },
  { mode: 'arrowAnnotate', icon: ArrowUpRight, label: 'Arrow Annotate' },
  { mode: 'probe', icon: Crosshair, label: 'Probe' },
];

const segmentationTools: { mode: InteractionMode; icon: typeof Move; label: string }[] = [
  { mode: 'brush', icon: Paintbrush, label: 'Brush' },
  { mode: 'eraser', icon: Eraser, label: 'Eraser' },
  { mode: 'thresholdBrush', icon: SlidersHorizontal, label: 'Threshold Brush' },
  { mode: 'scissors', icon: Scissors, label: 'Scissors' },
  { mode: 'floodFill', icon: PaintBucket, label: 'Flood Fill' },
];

export default function ToolPalette({ activeMode, onModeChange, onReset, onFlipHorizontal, onFlipVertical, onRotateRight90, onDownload, canDownload, showMetadata, onToggleMetadata }: ToolPaletteProps) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-800/80 backdrop-blur-sm rounded-lg p-1.5">
      {navigationTools.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          title={label}
          aria-label={label}
          className={`p-2.5 rounded-md transition-colors ${
            activeMode === mode
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Icon size={18} />
        </button>
      ))}
      <div className="w-px h-7 bg-gray-600 mx-2" />
      {annotationTools.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          title={label}
          aria-label={label}
          className={`p-2.5 rounded-md transition-colors ${
            activeMode === mode
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Icon size={18} />
        </button>
      ))}
      <div className="w-px h-7 bg-gray-600 mx-2" />
      {segmentationTools.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          title={label}
          aria-label={label}
          className={`p-2.5 rounded-md transition-colors ${
            activeMode === mode
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Icon size={18} />
        </button>
      ))}
      <div className="w-px h-7 bg-gray-600 mx-2" />
      {onFlipHorizontal && (
        <button
          onClick={onFlipHorizontal}
          title="Flip Horizontal"
          aria-label="Flip Horizontal"
          className="p-2.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <FlipHorizontal2 size={18} />
        </button>
      )}
      {onFlipVertical && (
        <button
          onClick={onFlipVertical}
          title="Flip Vertical"
          aria-label="Flip Vertical"
          className="p-2.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <FlipVertical2 size={18} />
        </button>
      )}
      {onRotateRight90 && (
        <button
          onClick={onRotateRight90}
          title="Rotate 90° CW"
          aria-label="Rotate 90° clockwise"
          className="p-2.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <RotateCw size={18} />
        </button>
      )}
      <button
        onClick={onReset}
        title="Reset"
        aria-label="Reset viewport"
        className="p-2.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <RotateCcw size={18} />
      </button>
      {onDownload && (
        <button
          onClick={onDownload}
          disabled={!canDownload}
          title="Download Raw Image"
          aria-label="Download raw image"
          className={`p-2.5 rounded-md transition-colors ${
            canDownload
              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <Download size={18} />
        </button>
      )}
      {onToggleMetadata && (
        <>
          <div className="w-px h-7 bg-gray-600 mx-2" />
          <button
            onClick={onToggleMetadata}
            title="DICOM Metadata"
            aria-label="Toggle DICOM metadata panel"
            className={`p-2.5 rounded-md transition-colors ${
              showMetadata
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Info size={18} />
          </button>
        </>
      )}
    </div>
  );
}
