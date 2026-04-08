/**
 * OverlayToggle — UI component for toggling DICOM overlay visibility.
 *
 * Shows a master toggle for all overlays and, when expanded, per-plane
 * toggles with color indicators for up to 16 overlay planes.
 */

import { useState } from 'react';
import { Layers, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';

interface OverlayPlaneInfo {
  groupIndex: number;
  label: string;
  color: string;
  visible: boolean;
  hasData: boolean;
}

export interface GSPSLayerInfo {
  name: string;
  order: number;
  visible: boolean;
  description?: string;
}

interface OverlayToggleProps {
  /** Whether overlays are globally visible. */
  globalVisible: boolean;
  /** Toggle global overlay visibility. */
  onGlobalToggle: () => void;
  /** Per-plane info for available planes. */
  planes: OverlayPlaneInfo[];
  /** Toggle a specific plane. */
  onPlaneToggle: (groupIndex: number) => void;
  /** GSPS graphic layers (optional). */
  gspsLayers?: GSPSLayerInfo[];
  /** Toggle GSPS graphic layer visibility. */
  onGSPSLayerToggle?: (layerName: string) => void;
}

export default function OverlayToggle({
  globalVisible,
  onGlobalToggle,
  planes,
  onPlaneToggle,
  gspsLayers,
  onGSPSLayerToggle,
}: OverlayToggleProps) {
  const [expanded, setExpanded] = useState(false);
  const activePlanes = planes.filter((p) => p.hasData);

  const hasGSPSLayers = gspsLayers && gspsLayers.length > 0;

  if (activePlanes.length === 0 && !hasGSPSLayers) return null;

  const totalCount = activePlanes.length + (gspsLayers?.length ?? 0);

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-md overflow-hidden">
      {/* Master toggle */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={onGlobalToggle}
          title={globalVisible ? 'Hide all overlays' : 'Show all overlays'}
          className={`p-1 rounded transition-colors ${
            globalVisible
              ? 'text-blue-400 hover:text-blue-300'
              : 'text-gray-500 hover:text-gray-400'
          }`}
        >
          {globalVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-300 hover:text-white transition-colors"
        >
          <Layers size={12} />
          <span>Overlays ({totalCount})</span>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      {/* Per-plane toggles */}
      {expanded && (
        <div className="border-t border-gray-700/50 px-2 py-1 space-y-0.5">
          {activePlanes.map((plane) => (
            <button
              key={plane.groupIndex}
              onClick={() => onPlaneToggle(plane.groupIndex)}
              className="flex items-center gap-2 w-full px-1 py-0.5 rounded text-xs hover:bg-gray-700/50 transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{
                  backgroundColor: plane.visible && globalVisible ? plane.color : '#555',
                }}
              />
              <span className={plane.visible && globalVisible ? 'text-gray-200' : 'text-gray-500'}>
                {plane.label || `Plane ${plane.groupIndex}`}
              </span>
              <span className="ml-auto text-gray-600 text-[10px]">
                {plane.visible ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}

          {/* GSPS graphic layers */}
          {hasGSPSLayers && (
            <>
              {activePlanes.length > 0 && (
                <div className="border-t border-gray-700/30 my-1" />
              )}
              <span className="text-[9px] uppercase tracking-wider text-gray-500 px-1">GSPS Layers</span>
              {gspsLayers!.map((layer) => (
                <button
                  key={layer.name}
                  onClick={() => onGSPSLayerToggle?.(layer.name)}
                  className="flex items-center gap-2 w-full px-1 py-0.5 rounded text-xs hover:bg-gray-700/50 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: layer.visible && globalVisible ? '#60A5FA' : '#555' }}
                  />
                  <span className={layer.visible && globalVisible ? 'text-gray-200' : 'text-gray-500'}>
                    {layer.description || layer.name}
                  </span>
                  <span className="ml-auto text-gray-600 text-[10px]">
                    {layer.visible ? 'ON' : 'OFF'}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export type { OverlayPlaneInfo };
