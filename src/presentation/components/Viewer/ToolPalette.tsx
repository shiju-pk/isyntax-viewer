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
    <div className="flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm rounded-lg p-1">
      {navigationTools.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          title={label}
          className={`p-2 rounded-md transition-colors ${
            activeMode === mode
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
      <div className="w-px h-6 bg-gray-600 mx-1" />
      {annotationTools.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          title={label}
          className={`p-2 rounded-md transition-colors ${
            activeMode === mode
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
      <div className="w-px h-6 bg-gray-600 mx-1" />
      {segmentationTools.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          title={label}
          className={`p-2 rounded-md transition-colors ${
            activeMode === mode
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
      <div className="w-px h-6 bg-gray-600 mx-1" />
      {onFlipHorizontal && (
        <button
          onClick={onFlipHorizontal}
          title="Flip Horizontal"
          className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <FlipHorizontal2 size={16} />
        </button>
      )}
      {onFlipVertical && (
        <button
          onClick={onFlipVertical}
          title="Flip Vertical"
          className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <FlipVertical2 size={16} />
        </button>
      )}
      {onRotateRight90 && (
        <button
          onClick={onRotateRight90}
          title="Rotate 90° CW"
          className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <RotateCw size={16} />
        </button>
      )}
      <button
        onClick={onReset}
        title="Reset"
        className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <RotateCcw size={16} />
      </button>
      {onDownload && (
        <button
          onClick={onDownload}
          disabled={!canDownload}
          title="Download Raw Image"
          className={`p-2 rounded-md transition-colors ${
            canDownload
              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <Download size={16} />
        </button>
      )}
      {onToggleMetadata && (
        <>
          <div className="w-px h-6 bg-gray-600 mx-1" />
          <button
            onClick={onToggleMetadata}
            title="DICOM Metadata"
            className={`p-2 rounded-md transition-colors ${
              showMetadata
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Info size={16} />
          </button>
        </>
      )}
    </div>
  );
}
