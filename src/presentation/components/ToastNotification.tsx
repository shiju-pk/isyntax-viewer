import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  retryAction?: () => void;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used within a <ToastProvider>');
  return ctx;
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${++nextId}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: typeof Info; iconColor: string }> = {
  info:    { bg: 'bg-gray-900/95',  border: 'border-blue-700/50',   icon: Info,          iconColor: 'text-blue-400' },
  success: { bg: 'bg-gray-900/95',  border: 'border-green-700/50',  icon: CheckCircle2,  iconColor: 'text-green-400' },
  warning: { bg: 'bg-gray-900/95',  border: 'border-yellow-700/50', icon: AlertTriangle, iconColor: 'text-yellow-400' },
  error:   { bg: 'bg-gray-900/95',  border: 'border-red-700/50',    icon: AlertTriangle, iconColor: 'text-red-400' },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = TOAST_STYLES[toast.type];
  const Icon = style.icon;

  useEffect(() => {
    const duration = toast.duration ?? (toast.type === 'error' ? 8000 : 4000);
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, toast.type, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 max-w-sm px-4 py-3 rounded-lg border backdrop-blur-sm shadow-xl ${style.bg} ${style.border} animate-in slide-in-from-right-5`}
      role="alert"
    >
      <Icon size={18} className={`${style.iconColor} mt-0.5 shrink-0`} />
      <p className="text-sm text-gray-200 flex-1">{toast.message}</p>
      {toast.retryAction && (
        <button
          onClick={toast.retryAction}
          className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors shrink-0"
          title="Retry"
        >
          <RefreshCw size={14} />
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded hover:bg-gray-700/50 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
