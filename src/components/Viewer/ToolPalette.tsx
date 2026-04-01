import { Move, ZoomIn, SunMedium, RotateCcw, Download, Info } from 'lucide-react';
import type { InteractionMode } from '../../lib/canvasRenderer';

interface ToolPaletteProps {
  activeMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  onReset: () => void;
  onDownload?: () => void;
  canDownload?: boolean;
  showMetadata?: boolean;
  onToggleMetadata?: () => void;
}

const tools: { mode: InteractionMode; icon: typeof Move; label: string }[] = [
  { mode: 'pan', icon: Move, label: 'Pan' },
  { mode: 'zoom', icon: ZoomIn, label: 'Zoom' },
  { mode: 'windowLevel', icon: SunMedium, label: 'W/L' },
];

export default function ToolPalette({ activeMode, onModeChange, onReset, onDownload, canDownload, showMetadata, onToggleMetadata }: ToolPaletteProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm rounded-lg p-1">
      {tools.map(({ mode, icon: Icon, label }) => (
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
