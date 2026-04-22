import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Move, ZoomIn, SunMedium, RotateCcw, RotateCw, Download, Info,
  Ruler, Triangle, Circle, Square, ArrowUpRight, Crosshair,
  Paintbrush, Eraser, SlidersHorizontal, Scissors, PaintBucket,
  FlipHorizontal2, FlipVertical2, RefreshCw, Pen, Type, Maximize2,
  MousePointer2, Eye, EyeOff, ChevronDown,
} from 'lucide-react';
import type { InteractionMode } from '../../../core/types';

interface ToolPaletteProps {
  activeMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  onReset: () => void;
  onFitToWindow?: () => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  onRotateRight90?: () => void;
  onDownload?: () => void;
  canDownload?: boolean;
  showMetadata?: boolean;
  onToggleMetadata?: () => void;
  annotationsVisible?: boolean;
  onToggleAnnotations?: () => void;
}

interface ToolDef {
  mode: InteractionMode;
  icon: typeof Move;
  label: string;
  shortcut?: string;
}

const navigationTools: ToolDef[] = [
  { mode: 'select', icon: MousePointer2, label: 'Select', shortcut: 'S' },
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
  { mode: 'circle', icon: Circle, label: 'Circle ROI', shortcut: 'C' },
  { mode: 'freehand', icon: Pen, label: 'Freehand', shortcut: 'F' },
  { mode: 'textAnnotation', icon: Type, label: 'Text', shortcut: 'T' },
  { mode: 'cobbAngle', icon: Triangle, label: 'Cobb Angle' },
];

const segmentationTools: ToolDef[] = [
  { mode: 'brush', icon: Paintbrush, label: 'Brush' },
  { mode: 'eraser', icon: Eraser, label: 'Eraser' },
  { mode: 'thresholdBrush', icon: SlidersHorizontal, label: 'Threshold Brush' },
  { mode: 'scissors', icon: Scissors, label: 'Scissors' },
  { mode: 'floodFill', icon: PaintBucket, label: 'Flood Fill' },
];

const annotationModes = new Set<InteractionMode>(annotationTools.map(t => t.mode));
const segmentationModes = new Set<InteractionMode>(segmentationTools.map(t => t.mode));

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

function MenuToolButton({
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
      className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm transition-colors ${
        isActive
          ? `${activeClass} text-white`
          : 'text-gray-300 hover:text-white hover:bg-gray-700'
      }`}
    >
      <Icon size={16} />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[10px] text-gray-500">{shortcut}</span>}
    </button>
  );
}

function MenuActionButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
  active,
}: {
  icon: typeof Move;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm transition-colors ${
        disabled
          ? 'text-gray-600 cursor-not-allowed'
          : active
            ? 'bg-gray-600 text-white ring-1 ring-gray-500'
            : 'text-gray-300 hover:text-white hover:bg-gray-700'
      }`}
    >
      <Icon size={16} />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[10px] text-gray-500">{shortcut}</span>}
    </button>
  );
}

/** A single icon button that opens a dropdown menu. */
function GroupMenuButton({
  icon: Icon,
  label,
  isGroupActive,
  activeClass,
  isOpen,
  onToggle,
  children,
}: {
  icon: typeof Move;
  label: string;
  isGroupActive: boolean;
  activeClass: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
        className={`p-2.5 rounded-md transition-colors flex items-center gap-0.5 ${
          isGroupActive
            ? `${activeClass} text-white`
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
        }`}
      >
        <Icon size={18} />
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-[9999] w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

type MenuId = 'annotate' | 'segment' | 'transform' | 'view' | null;

export default function ToolPalette({ activeMode, onModeChange, onReset, onFitToWindow, onFlipHorizontal, onFlipVertical, onRotateRight90, onDownload, canDownload, showMetadata, onToggleMetadata, annotationsVisible, onToggleAnnotations }: ToolPaletteProps) {
  const [openMenu, setOpenMenu] = useState<MenuId>(null);

  const toggle = useCallback((id: MenuId) => {
    setOpenMenu(prev => (prev === id ? null : id));
  }, []);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  return (
    <div className="flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm rounded-lg p-1.5" role="toolbar" aria-label="Viewer tools">
      {/* Navigation tools — always visible */}
      <div className="flex items-center gap-0.5">
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

      {/* Annotate group */}
      <GroupMenuButton
        icon={Ruler}
        label="Annotation Tools"
        isGroupActive={annotationModes.has(activeMode)}
        activeClass="bg-green-600"
        isOpen={openMenu === 'annotate'}
        onToggle={() => toggle('annotate')}
      >
        {annotationTools.map((tool) => (
          <MenuToolButton
            key={tool.mode}
            tool={tool}
            isActive={activeMode === tool.mode}
            activeClass="bg-green-600"
            onClick={() => { onModeChange(tool.mode); closeMenu(); }}
          />
        ))}
      </GroupMenuButton>

      {/* Segment group */}
      <GroupMenuButton
        icon={Paintbrush}
        label="Segmentation Tools"
        isGroupActive={segmentationModes.has(activeMode)}
        activeClass="bg-purple-600"
        isOpen={openMenu === 'segment'}
        onToggle={() => toggle('segment')}
      >
        {segmentationTools.map((tool) => (
          <MenuToolButton
            key={tool.mode}
            tool={tool}
            isActive={activeMode === tool.mode}
            activeClass="bg-purple-600"
            onClick={() => { onModeChange(tool.mode); closeMenu(); }}
          />
        ))}
      </GroupMenuButton>

      {/* Transform group */}
      <GroupMenuButton
        icon={FlipHorizontal2}
        label="Transform & Utilities"
        isGroupActive={false}
        activeClass="bg-blue-600"
        isOpen={openMenu === 'transform'}
        onToggle={() => toggle('transform')}
      >
        {onFlipHorizontal && (
          <MenuActionButton icon={FlipHorizontal2} label="Flip Horizontal" shortcut="H" onClick={() => { onFlipHorizontal(); closeMenu(); }} />
        )}
        {onFlipVertical && (
          <MenuActionButton icon={FlipVertical2} label="Flip Vertical" shortcut="V" onClick={() => { onFlipVertical(); closeMenu(); }} />
        )}
        {onRotateRight90 && (
          <MenuActionButton icon={RotateCw} label="Rotate 90° CW" onClick={() => { onRotateRight90(); closeMenu(); }} />
        )}
        {onFitToWindow && (
          <MenuActionButton icon={Maximize2} label="Fit to Window" onClick={() => { onFitToWindow(); closeMenu(); }} />
        )}
        <MenuActionButton icon={RotateCcw} label="Reset" shortcut="Esc" onClick={() => { onReset(); closeMenu(); }} />
        {onDownload && (
          <MenuActionButton icon={Download} label="Download Raw Image" onClick={() => { onDownload(); closeMenu(); }} disabled={!canDownload} />
        )}
      </GroupMenuButton>

      {/* View group */}
      {(onToggleMetadata || onToggleAnnotations) && (
        <GroupMenuButton
          icon={Eye}
          label="View Options"
          isGroupActive={showMetadata || !annotationsVisible}
          activeClass="bg-gray-600"
          isOpen={openMenu === 'view'}
          onToggle={() => toggle('view')}
        >
          {onToggleAnnotations && (
            <MenuActionButton
              icon={annotationsVisible ? Eye : EyeOff}
              label="Toggle Annotations"
              onClick={() => { onToggleAnnotations(); closeMenu(); }}
              active={!annotationsVisible}
            />
          )}
          {onToggleMetadata && (
            <MenuActionButton
              icon={Info}
              label="DICOM Metadata"
              shortcut="I"
              onClick={() => { onToggleMetadata(); closeMenu(); }}
              active={showMetadata}
            />
          )}
        </GroupMenuButton>
      )}
    </div>
  );
}
