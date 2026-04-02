import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getEffectiveTargetHostname,
  getDefaultTargetHostname,
  setPersistedTargetHostname,
} from '../../../services/config/PreferencesService';

interface PreferencesDialogProps {
  onClose: () => void;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export default function PreferencesDialog({ onClose }: PreferencesDialogProps) {
  const [hostname, setHostname] = useState(getEffectiveTargetHostname());
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    const trimmed = hostname.trim();
    if (!trimmed) {
      setPersistedTargetHostname(null);
      onClose();
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError('Please enter a valid URL (e.g. http://hostname:port)');
      return;
    }
    setPersistedTargetHostname(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Preferences"
        className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">Preferences</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Target Hostname
          </label>
          <input
            type="text"
            value={hostname}
            onChange={(e) => { setHostname(e.target.value); setError(''); }}
            placeholder={getDefaultTargetHostname()}
            className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
          <p className="mt-2 text-xs text-gray-500">
            Used by the desktop app (Tauri) to connect directly. In the browser, requests go through the dev proxy. Leave empty to use the default.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
