import { useEffect, useRef, useState } from 'react';
import { Settings, Info, SlidersHorizontal } from 'lucide-react';
import AboutDialog from './AboutDialog';
import PreferencesDialog from './PreferencesDialog';

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<'about' | 'preferences' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const openDialog = (which: 'about' | 'preferences') => {
    setOpen(false);
    setDialog(which);
  };

  return (
    <>
      <div ref={menuRef} className="relative ml-auto">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="p-1.5 rounded-md hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
          title="Settings"
          aria-haspopup="true"
          aria-expanded={open}
        >
          <Settings size={18} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-50 py-1"
          >
            <button
              role="menuitem"
              onClick={() => openDialog('about')}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              <Info size={15} className="text-gray-400" />
              About
            </button>
            <button
              role="menuitem"
              onClick={() => openDialog('preferences')}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              <SlidersHorizontal size={15} className="text-gray-400" />
              Preferences
            </button>
          </div>
        )}
      </div>

      {dialog === 'about' && <AboutDialog onClose={() => setDialog(null)} />}
      {dialog === 'preferences' && <PreferencesDialog onClose={() => setDialog(null)} />}
    </>
  );
}
