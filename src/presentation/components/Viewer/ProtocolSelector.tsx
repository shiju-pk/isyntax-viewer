/**
 * ProtocolSelector — Dropdown in the TitleBar for selecting hanging protocols.
 *
 * Shows the auto-matched protocol (highlighted), alternatives, and a
 * "Custom layout" option for manual series assignment.
 */

import { useState, useRef, useEffect } from 'react';
import { Monitor, ChevronDown, Check, Sparkles } from 'lucide-react';
import type { HangingProtocol, ProtocolMatchResult } from '../../../hanging-protocol/types';

interface ProtocolSelectorProps {
  matchResults: ProtocolMatchResult[];
  activeProtocol: HangingProtocol | null;
  onSelect: (protocol: HangingProtocol | null) => void;
}

export default function ProtocolSelector({
  matchResults,
  activeProtocol,
  onSelect,
}: ProtocolSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const bestMatch = matchResults.length > 0 ? matchResults[0] : null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
        title="Select hanging protocol"
      >
        <Monitor size={13} />
        <span className="max-w-[120px] truncate">
          {activeProtocol?.name ?? 'Custom'}
        </span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-xl z-50 overflow-hidden">
          {/* Auto-matched suggestion */}
          {bestMatch && (
            <div className="px-2 pt-2 pb-1">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <Sparkles size={9} /> Auto-matched
              </span>
            </div>
          )}

          {matchResults.map((result) => (
            <button
              key={result.protocol.id}
              onClick={() => {
                onSelect(result.protocol);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors ${
                activeProtocol?.id === result.protocol.id
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              {activeProtocol?.id === result.protocol.id && (
                <Check size={12} className="shrink-0" />
              )}
              <div className="flex-1 text-left">
                <div>{result.protocol.name}</div>
                {result.protocol.description && (
                  <div className="text-[10px] text-gray-500">{result.protocol.description}</div>
                )}
              </div>
              <span className="text-[10px] text-gray-600">
                {result.matchedRules}/{result.totalRules}
              </span>
            </button>
          ))}

          {matchResults.length > 0 && (
            <div className="border-t border-gray-700/50" />
          )}

          {/* Custom layout option */}
          <button
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors ${
              !activeProtocol
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            {!activeProtocol && <Check size={12} className="shrink-0" />}
            <span>Custom layout</span>
          </button>
        </div>
      )}
    </div>
  );
}
