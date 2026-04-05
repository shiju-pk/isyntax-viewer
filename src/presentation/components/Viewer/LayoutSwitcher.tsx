/**
 * LayoutSwitcher — UI component for switching viewport layout modes.
 *
 * Supports 1-up, 2-horizontal, 2-vertical, and 4-up (2×2) layouts,
 * matching the legacy ViewingLayoutMode constants.
 */

import { LayoutGrid, Columns, Rows, Square } from 'lucide-react';

/** Layout mode identifiers matching legacy ViewingLayoutMode. */
export type LayoutMode = '1x1' | '1x2' | '2x1' | '2x2';

interface LayoutDef {
  mode: LayoutMode;
  icon: typeof LayoutGrid;
  label: string;
  rows: number;
  cols: number;
}

const LAYOUTS: LayoutDef[] = [
  { mode: '1x1', icon: Square,     label: '1-up',           rows: 1, cols: 1 },
  { mode: '1x2', icon: Columns,    label: '2-up Horizontal', rows: 1, cols: 2 },
  { mode: '2x1', icon: Rows,       label: '2-up Vertical',   rows: 2, cols: 1 },
  { mode: '2x2', icon: LayoutGrid, label: '2×2',             rows: 2, cols: 2 },
];

interface LayoutSwitcherProps {
  activeLayout: LayoutMode;
  onLayoutChange: (mode: LayoutMode, rows: number, cols: number) => void;
}

export default function LayoutSwitcher({ activeLayout, onLayoutChange }: LayoutSwitcherProps) {
  return (
    <div
      className="flex items-center gap-0.5 bg-gray-800/80 backdrop-blur-sm rounded-md p-1"
      role="radiogroup"
      aria-label="Viewport layout"
    >
      {LAYOUTS.map((layout) => {
        const Icon = layout.icon;
        const isActive = activeLayout === layout.mode;
        return (
          <button
            key={layout.mode}
            onClick={() => onLayoutChange(layout.mode, layout.rows, layout.cols)}
            title={layout.label}
            aria-label={layout.label}
            aria-checked={isActive}
            role="radio"
            className={`p-1.5 rounded transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

/** Utility: get the grid dimensions for a layout mode. */
export function getLayoutDimensions(mode: LayoutMode): { rows: number; cols: number } {
  const layout = LAYOUTS.find((l) => l.mode === mode);
  return layout ? { rows: layout.rows, cols: layout.cols } : { rows: 1, cols: 1 };
}
