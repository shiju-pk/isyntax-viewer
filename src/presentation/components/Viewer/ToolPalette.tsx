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

interface ToolDef {
  mode: InteractionMode;
  icon: typeof Move;
  label: string;
  shortcut?: string;
}

const navigationTools: ToolDef[] = [
  { mode: 'pan', icon: Move, label: 'Pan', shortcut: 'P' },
  { mode: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  { mode: 'windowLevel', icon: SunMedium, label: 'W/L', shortcut: 'W' },
  { mode: 'rotate', icon: RefreshCw, label: 'Rotate', shortcut: 'R' },
];

const annotationTools: ToolDef[] = [
  { mode: 'length', icon: Ruler, label: 'Length', shortcut: 'L' },
  { mode: 'angle', icon: Triangle, label: 'Angle', shortcut: 'A' },
  { mode: 'ellipticalROI', icon: Circle, label: 'Elliptical ROI' },
  { mode: 'rectangleROI', icon: Square, label: 'Rectangle ROI' },
  { mode: 'arrowAnnotate', icon: ArrowUpRight, label: 'Arrow Annotate' },
  { mode: 'probe', icon: Crosshair, label: 'Probe' },
];

const segmentationTools: ToolDef[] = [
  { mode: 'brush', icon: Paintbrush, label: 'Brush' },
  { mode: 'eraser', icon: Eraser, label: 'Eraser' },
  { mode: 'thresholdBrush', icon: SlidersHorizontal, label: 'Threshold Brush' },
  { mode: 'scissors', icon: Scissors, label: 'Scissors' },
  { mode: 'floodFill', icon: PaintBucket, label: 'Flood Fill' },
];

function toolTitle(label: string, shortcut?: string) {
  return shortcut ? `${label} (${shortcut})` : label;
}

function ToolButton({
  tool,
  isActive,
  activeClass,
  onClick,
}: {
  tool: ToolDef;
  isActive: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  const { icon: Icon, label, shortcut } = tool;
  return (
    <button
      onClick={onClick}
      title={toolTitle(label, shortcut)}
      aria-label={toolTitle(label, shortcut)}
      aria-pressed={isActive}
      className={`p-2.5 rounded-md transition-colors relative ${
        isActive
          ? `${activeClass} text-white`
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      <Icon size={18} />
      {isActive && (
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-white/70" />
      )}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] uppercase tracking-wider text-gray-500 px-0.5 select-none hidden sm:inline">
      {children}
    </span>
  );
}

export default function ToolPalette({ activeMode, onModeChange, onReset, onFlipHorizontal, onFlipVertical, onRotateRight90, onDownload, canDownload, showMetadata, onToggleMetadata }: ToolPaletteProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm rounded-lg p-1.5 overflow-x-auto" role="toolbar" aria-label="Viewer tools">
      {/* Navigation tools */}
      <div className="flex items-center gap-0.5">
        <GroupLabel>Navigate</GroupLabel>
        {navigationTools.map((tool) => (
          <ToolButton
            key={tool.mode}
            tool={tool}
            isActive={activeMode === tool.mode}
            activeClass="bg-blue-600"
            onClick={() => onModeChange(tool.mode)}
          />
        ))}
      </div>
      <div className="w-px h-7 bg-gray-600 mx-1 shrink-0" />

      {/* Annotation tools */}
      <div className="flex items-center gap-0.5">
        <GroupLabel>Annotate</GroupLabel>
        {annotationTools.map((tool) => (
          <ToolButton
            key={tool.mode}
            tool={tool}
            isActive={activeMode === tool.mode}
            activeClass="bg-green-600"
            onClick={() => onModeChange(tool.mode)}
          />
        ))}
      </div>
      <div className="w-px h-7 bg-gray-600 mx-1 shrink-0" />

      {/* Segmentation tools */}
      <div className="flex items-center gap-0.5">
        <GroupLabel>Segment</GroupLabel>
        {segmentationTools.map((tool) => (
          <ToolButton
            key={tool.mode}
            tool={tool}
            isActive={activeMode === tool.mode}
            activeClass="bg-purple-600"
            onClick={() => onModeChange(tool.mode)}
          />
        ))}
      </div>
      <div className="w-px h-7 bg-gray-600 mx-1 shrink-0" />

      {/* Transform & utility actions */}
      <div className="flex items-center gap-0.5">
        {onFlipHorizontal && (
          <button
            onClick={onFlipHorizontal}
            title="Flip Horizontal (H)"
            aria-label="Flip Horizontal (H)"
            className="p-2.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <FlipHorizontal2 size={18} />
          </button>
        )}
        {onFlipVertical && (
          <button
            onClick={onFlipVertical}
            title="Flip Vertical (V)"
            aria-label="Flip Vertical (V)"
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
          title="Reset (Esc)"
          aria-label="Reset viewport (Esc)"
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
      </div>

      {onToggleMetadata && (
        <>
          <div className="w-px h-7 bg-gray-600 mx-1 shrink-0" />
          <button
            onClick={onToggleMetadata}
            title="DICOM Metadata (I)"
            aria-label="Toggle DICOM metadata panel (I)"
            aria-pressed={showMetadata}
            className={`p-2.5 rounded-md transition-colors ${
              showMetadata
                ? 'bg-gray-600 text-white ring-1 ring-gray-500'
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
