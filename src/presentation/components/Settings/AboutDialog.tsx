import { X } from 'lucide-react';
import { useEffect } from 'react';

interface AboutDialogProps {
  onClose: () => void;
}

declare const __APP_VERSION__: string;

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Microsoft Edge ' + (ua.match(/Edg\/([\d.]+)/)?.[1] ?? '');
  if (ua.includes('Chrome/')) return 'Google Chrome ' + (ua.match(/Chrome\/([\d.]+)/)?.[1] ?? '');
  if (ua.includes('Firefox/')) return 'Mozilla Firefox ' + (ua.match(/Firefox\/([\d.]+)/)?.[1] ?? '');
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari ' + (ua.match(/Version\/([\d.]+)/)?.[1] ?? '');
  return ua;
}

function getOSInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) {
    const ver = ua.match(/Windows NT ([\d.]+)/)?.[1];
    return ver ? `Windows NT ${ver}` : 'Windows';
  }
  if (ua.includes('Mac OS')) {
    const ver = ua.match(/Mac OS X ([\d_.]+)/)?.[1]?.replace(/_/g, '.');
    return ver ? `macOS ${ver}` : 'macOS';
  }
  if (ua.includes('Linux')) return 'Linux';
  return navigator.platform || 'Unknown';
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const rows = [
    { label: 'Project', value: 'iSyntax Viewer' },
    { label: 'Version', value: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '—' },
    { label: 'Developer', value: 'Shiju P K' },
    { label: 'Email', value: 'shiju.pk@philips.com' },
    { label: 'OS', value: getOSInfo() },
    { label: 'Browser', value: getBrowserInfo() },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="About"
        className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">About</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(({ label, value }) => (
                <tr key={label}>
                  <td className="py-1.5 pr-4 text-gray-400 font-medium whitespace-nowrap">{label}</td>
                  <td className="py-1.5 text-gray-200">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end px-5 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
