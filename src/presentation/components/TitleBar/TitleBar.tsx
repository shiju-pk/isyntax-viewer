import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SettingsMenu from '../Settings/SettingsMenu';

interface TitleBarProps {
  title: string;
  showBackButton?: boolean;
  children?: React.ReactNode;
}

export default function TitleBar({ title, showBackButton = false, children }: TitleBarProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
      {showBackButton && (
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-md hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      {title && <h1 className="text-lg font-semibold text-white">{title}</h1>}
      {children && <div className="flex-1 flex justify-center">{children}</div>}
      <SettingsMenu />
    </div>
  );
}
