import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface UnsupportedPSBannerProps {
  message?: string;
  onDismiss?: () => void;
}

export default function UnsupportedPSBanner({
  message = 'This study has a Presentation State that could not be fully applied. Some display settings may differ from the original reading.',
  onDismiss,
}: UnsupportedPSBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-amber-900/30 border border-amber-700/40 rounded-md text-xs text-amber-200">
      <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
      <span className="flex-1">{message}</span>
      <button
        onClick={handleDismiss}
        className="p-0.5 rounded hover:bg-amber-800/40 text-amber-400 hover:text-amber-200 transition-colors shrink-0"
        title="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}
