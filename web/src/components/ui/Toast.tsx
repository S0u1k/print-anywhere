import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration: number = 4000) => {
      if (!message || !message.trim()) return;
      const cleanMessage = message.trim();

      setToasts((prev) => {
        // Prevent duplicate toasts with the identical message and type
        const isDuplicate = prev.some((t) => t.message === cleanMessage && t.type === type);
        if (isDuplicate) return prev;

        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        if (duration > 0) {
          setTimeout(() => {
            removeToast(id);
          }, duration);
        }

        // Limit maximum simultaneous toasts on mobile to 3
        const trimmed = prev.length >= 3 ? prev.slice(prev.length - 2) : prev;
        return [...trimmed, { id, type, title, message: cleanMessage, duration }];
      });
    },
    [removeToast]
  );

  const success = useCallback((msg: string, title?: string) => addToast(msg, 'success', title), [addToast]);
  const error = useCallback((msg: string, title?: string) => addToast(msg, 'error', title), [addToast]);
  const info = useCallback((msg: string, title?: string) => addToast(msg, 'info', title), [addToast]);
  const warning = useCallback((msg: string, title?: string) => addToast(msg, 'warning', title), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}
      {/* Floating Toast Viewport */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const typeStyles = {
            success: 'bg-[#111827] border-emerald-500/60 text-emerald-300',
            error: 'bg-[#111827] border-red-500/60 text-red-300',
            warning: 'bg-[#111827] border-amber-500/60 text-amber-300',
            info: 'bg-[#111827] border-blue-500/60 text-blue-300',
          };

          const IconComponent = {
            success: CheckCircle2,
            error: AlertCircle,
            warning: AlertTriangle,
            info,
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-xl border shadow-xl flex items-start gap-3 transition-all ${typeStyles[toast.type]}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                {toast.title && <h4 className="text-xs font-bold text-white mb-0.5">{toast.title}</h4>}
                <p className="text-xs text-gray-300 leading-snug">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-white p-1 rounded-md transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
