/**
 * PriorsPanel — Sidebar panel showing prior studies for the current patient
 * as a chronological timeline. Allows loading a prior into a comparison viewport.
 */

import { Calendar, ArrowRight, Clock } from 'lucide-react';
import type { WorklistEntry } from '../../../adapters/IPACSAdapter';

interface PriorsPanelProps {
  currentStudyDate?: string;
  priors: WorklistEntry[];
  onLoadPrior: (prior: WorklistEntry) => void;
  loading?: boolean;
}

export default function PriorsPanel({
  currentStudyDate,
  priors,
  onLoadPrior,
  loading = false,
}: PriorsPanelProps) {
  if (loading) {
    return (
      <div className="bg-gray-900/95 border border-gray-800 rounded-md p-3">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Clock size={12} className="animate-spin" />
          Loading prior studies...
        </div>
      </div>
    );
  }

  if (priors.length === 0) {
    return (
      <div className="bg-gray-900/95 border border-gray-800 rounded-md p-3">
        <div className="text-xs text-gray-500">No prior studies found</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/95 border border-gray-800 rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
        <Calendar size={12} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-300">
          Prior Studies ({priors.length})
        </span>
      </div>

      <div className="divide-y divide-gray-800/50">
        {/* Current study marker */}
        {currentStudyDate && (
          <div className="px-3 py-2 bg-blue-900/10 border-l-2 border-blue-500">
            <div className="text-[10px] text-blue-400 uppercase tracking-wider">Current</div>
            <div className="text-xs text-gray-200">{formatDate(currentStudyDate)}</div>
          </div>
        )}

        {/* Prior studies */}
        {priors.map((prior) => (
          <button
            key={prior.examKey}
            onClick={() => onLoadPrior(prior)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-800/50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 truncate">
                {formatDate(prior.studyDate)}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {prior.studyDescription || prior.modality}
              </div>
              {prior.accessionNumber && (
                <div className="text-[10px] text-gray-600 truncate">
                  Acc# {prior.accessionNumber}
                </div>
              )}
            </div>
            <ArrowRight
              size={12}
              className="text-gray-600 group-hover:text-blue-400 shrink-0 transition-colors"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  // Handle DICOM date format YYYYMMDD
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}
